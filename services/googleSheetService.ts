import { AddBookResponse, Book, Borrower, LogEntry, ScanResponse, SheetResponse } from '../types';

const CHECKOUT_LOG_HEADERS = ['Checkout Date','Book ID','Title','Borrower','Action','Due Date','Return Date','Days Late','Notes'];
type MutationResult = { success: boolean; message?: string };

export class SheetService {
  private webAppUrl: string;
  private readonly readCache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly inFlightReads = new Map<string, Promise<SheetResponse<unknown>>>();

  constructor(webAppUrl: string) { this.webAppUrl = webAppUrl.trim(); }

  private async readJson<T>(response: Response): Promise<T> {
    const body = await response.text();
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}.`);
    try { return JSON.parse(body) as T; } catch {
      if (body.includes('Script function not found: doGet')) throw new Error('The Google Apps Script deployment is outdated.');
      if (body.includes('Google Apps Script') || body.trim().startsWith('<!DOCTYPE html>')) throw new Error('The Apps Script URL is not a working public Web app deployment.');
      throw new Error('The backend returned an invalid response.');
    }
  }

  private async fetchMutation(url: string, init: RequestInit = {}, timeoutMs = 15000): Promise<Response> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...init,
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') throw new Error('The Library backend did not respond. Please try again.');
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async sendMutation<T>(payload: object): Promise<T> {
    const response = await this.fetchMutation(this.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    return this.readJson<T>(response);
  }

  private async sendMutationByGet<T>(payload: object): Promise<T> {
    const separator = this.webAppUrl.includes('?') ? '&' : '?';
    const response = await this.fetchMutation(`${this.webAppUrl}${separator}request=${encodeURIComponent(JSON.stringify(payload))}&_=${Date.now()}`);
    return this.readJson<T>(response);
  }

  private isCompatibilityFailure(message: string): boolean {
    return /invalid tab|invalid|unknown|unsupported|borrower.*required|choose check out|book id is required|script function not found/i.test(message);
  }

  private async mutateWithFallback<T extends MutationResult>(payload: object, actionLabel: string): Promise<T> {
    let getError: Error | null = null;

    // The deployed Apps Script supports mutations through doGet(request=...).
    // GET is the most reliable path in Safari/iPad because it avoids POST/CORS
    // edge cases. Keep POST as a compatibility fallback for older deployments.
    try {
      const result = await this.sendMutationByGet<T>(payload);
      if (result.success || !this.isCompatibilityFailure(result.message || '')) return result;
    } catch (error) {
      getError = error instanceof Error ? error : new Error(String(error));
    }

    try {
      return await this.sendMutation<T>(payload);
    } catch (postError) {
      const detail = postError instanceof Error ? postError.message : String(postError);
      throw new Error(`${actionLabel} failed. ${detail || getError?.message || ''}`.trim());
    }
  }

  private async fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try { return await fetch(url, { cache: 'no-store', redirect: 'follow', signal: controller.signal }); }
    finally { window.clearTimeout(timer); }
  }

  private mapRows<T>(tab: string, headers: string[], data: string[][]): T[] {
    if (tab === 'CHECKOUT LOG') {
      const isOldSchema = headers.some(header => header.trim().toLowerCase() === 'timestamp') && headers.length <= 6;
      return data.map(row => {
        if (isOldSchema && row.length <= 6) {
          return { checkoutDate: row[0] || '', timestamp: row[0] || '', bookId: row[1] || '', title: row[2] || '', borrower: row[3] || '', action: row[4] || '', dueDate: '', returnDate: '', daysLate: '', notes: row[5] || '' } as T;
        }
        const obj: Record<string, string> = {};
        CHECKOUT_LOG_HEADERS.forEach((header, index) => { obj[this.toCamelCase(header)] = row[index] ?? ''; });
        return obj as T;
      });
    }
    return data.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((header, index) => { if (header.trim()) obj[this.toCamelCase(header)] = row[index] ?? ''; });
      if (tab === 'LIBRARY' && obj.borrower?.trim()) obj.status = 'Checked Out';
      return obj as T;
    });
  }

  private async fetchData<T>(tab: string): Promise<SheetResponse<T>> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    const key = tab.toUpperCase();
    const cached = this.readCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as SheetResponse<T>;
    const existing = this.inFlightReads.get(key);
    if (existing) return existing as Promise<SheetResponse<T>>;

    const request = (async (): Promise<SheetResponse<T>> => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const separator = this.webAppUrl.includes('?') ? '&' : '?';
          const response = await this.fetchWithTimeout(`${this.webAppUrl}${separator}tab=${encodeURIComponent(tab)}&_=${Date.now()}`);
          const json = await this.readJson<{ success: boolean; headers?: string[]; data?: string[][]; message?: string }>(response);
          if (!json.success) throw new Error(json.message || `Unable to load ${tab}.`);
          const result: SheetResponse<T> = { success: true, data: this.mapRows<T>(tab, json.headers || [], json.data || []) };
          this.readCache.set(key, { expiresAt: Date.now() + 30000, value: result });
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt === 0) await new Promise(resolve => window.setTimeout(resolve, 900));
        }
      }
      const stale = this.readCache.get(key);
      if (stale) return stale.value as SheetResponse<T>;
      return { success: false, message: `Failed to fetch ${tab} data. Tap Retry in a moment. ${lastError?.message || ''}`.trim() };
    })();

    this.inFlightReads.set(key, request as Promise<SheetResponse<unknown>>);
    try { return await request; } finally { this.inFlightReads.delete(key); }
  }

  private toCamelCase(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+([a-z0-9])/g, (_match, group: string) => group.toUpperCase());
  }

  async getLibraryData(): Promise<SheetResponse<Book>> { return this.fetchData<Book>('LIBRARY'); }
  async getCheckoutLog(): Promise<SheetResponse<LogEntry>> { return this.fetchData<LogEntry>('CHECKOUT LOG'); }
  async getBorrowers(): Promise<SheetResponse<Borrower>> { return this.fetchData<Borrower>('BORROWERS'); }

  async addBook(book: Book): Promise<AddBookResponse> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    const payload = { action: 'addBook', ...book, book };
    try {
      const result = await this.mutateWithFallback<AddBookResponse>(payload, 'Add book');
      if (!result.success && /borrower.*required/i.test(result.message || '')) return { success: false, message: 'The deployed Apps Script is outdated and is treating Add Book as checkout. Redeploy the current Code.gs.' };
      if (result.success) this.readCache.delete('LIBRARY');
      return result;
    } catch (error) { return { success: false, message: `Failed to add book: ${(error as Error).message}` }; }
  }

  async updateBookStatus(bookId: string, status: string) {
    try {
      const result = await this.mutateWithFallback<MutationResult>({ action: 'updateBookStatus', bookId, status }, 'Status update');
      if (result.success) this.readCache.delete('LIBRARY');
      return result;
    } catch (error) { return { success: false, message: `Failed to update status: ${(error as Error).message}` }; }
  }

  async updateBook(bookId: string, book: Book) {
    try {
      const result = await this.mutateWithFallback<MutationResult>({ action: 'updateBook', bookId, book }, 'Edit book');
      if (result.success) this.readCache.delete('LIBRARY');
      if (!result.success && this.isCompatibilityFailure(result.message || '')) {
        return { success: false, message: 'Save is not available in the deployed Apps Script version. Redeploy the current Code.gs as a new Web App version.' };
      }
      return result;
    } catch (error) { return { success: false, message: `Failed to edit book: ${(error as Error).message}` }; }
  }

  async archiveBook(bookId: string, archived: boolean) {
    try {
      const result = await this.mutateWithFallback<MutationResult>({ action: 'archiveBook', bookId, archived }, archived ? 'Archive book' : 'Restore book');
      if (result.success) this.readCache.delete('LIBRARY');
      if (!result.success && this.isCompatibilityFailure(result.message || '')) {
        return { success: false, message: 'Archive is not available in the deployed Apps Script version. Redeploy the current Code.gs as a new Web App version.' };
      }
      return result;
    } catch (error) { return { success: false, message: `Failed to ${archived ? 'archive' : 'restore'} book: ${(error as Error).message}` }; }
  }

  async deleteBook(bookId: string) {
    try {
      const result = await this.mutateWithFallback<MutationResult>({ action: 'deleteBook', bookId }, 'Delete book');
      if (result.success) this.readCache.delete('LIBRARY');
      if (!result.success && this.isCompatibilityFailure(result.message || '')) {
        return { success: false, message: 'Delete is not available in the deployed Apps Script version. Redeploy the current Code.gs as a new Web App version.' };
      }
      return result;
    } catch (error) { return { success: false, message: `Failed to delete book: ${(error as Error).message}` }; }
  }

  async addBorrower(name: string) {
    try {
      const result = await this.mutateWithFallback<MutationResult>({ action: 'addBorrower', borrowerName: name }, 'Add borrower');
      if (result.success) this.readCache.delete('BORROWERS');
      return result;
    } catch (error) { return { success: false, message: `Failed to add borrower: ${(error as Error).message}` }; }
  }

  async editBorrower(oldName: string, newName: string) {
    try {
      const result = await this.mutateWithFallback<MutationResult>({ action: 'editBorrower', oldName, newName }, 'Edit borrower');
      if (result.success) this.readCache.delete('BORROWERS');
      return result;
    } catch (error) { return { success: false, message: `Failed to edit borrower: ${(error as Error).message}` }; }
  }

  async scanBook(bookId: string, borrower: string, dueDays: number, operation: 'checkout' | 'return'): Promise<ScanResponse> {
    try {
      const result = await this.mutateWithFallback<ScanResponse>({ bookId, borrower, dueDays, operation }, 'Process scan');
      if (result.success) { this.readCache.delete('LIBRARY'); this.readCache.delete('CHECKOUT LOG'); }
      return result;
    } catch (error) { return { success: false, message: `Failed to process scan: ${(error as Error).message}` }; }
  }
}
