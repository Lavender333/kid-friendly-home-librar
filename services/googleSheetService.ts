import { Book, LogEntry, Borrower, SheetResponse, ScanResponse } from '../types';

export class SheetService {
  private webAppUrl: string;
  private readonly readCache = new Map<string, { expiresAt: number; value: unknown }>();
  private readonly inFlightReads = new Map<string, Promise<SheetResponse<unknown>>>();

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl.trim();
  }

  private async readJson<T>(response: Response): Promise<T> {
    const body = await response.text();
    if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}.`);
    try {
      return JSON.parse(body) as T;
    } catch {
      if (body.includes('Script function not found: doGet')) {
        throw new Error('The Google Apps Script deployment is outdated: deploy Code.gs as a Web app, then use its /exec URL.');
      }
      if (body.includes('Google Apps Script') || body.trim().startsWith('<!DOCTYPE html>')) {
        throw new Error('The Google Apps Script URL is not a working public Web app deployment. Redeploy it with access set to Anyone.');
      }
      throw new Error('The backend returned an invalid response. Verify the Apps Script deployment URL and permissions.');
    }
  }

  private async sendMutation<T>(payload: object): Promise<T> {
    const response = await fetch(this.webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
    return this.readJson<T>(response);
  }

  private async fetchWithTimeout(url: string, timeoutMs = 12000): Promise<Response> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        cache: 'no-store',
        redirect: 'follow',
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  private async fetchData<T>(tab: string): Promise<SheetResponse<T>> {
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }

    const cacheKey = tab.toUpperCase();
    const cached = this.readCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as SheetResponse<T>;
    }

    const existingRequest = this.inFlightReads.get(cacheKey);
    if (existingRequest) return existingRequest as Promise<SheetResponse<T>>;

    const request = (async (): Promise<SheetResponse<T>> => {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const separator = this.webAppUrl.includes('?') ? '&' : '?';
          const url = `${this.webAppUrl}${separator}tab=${encodeURIComponent(tab)}&_=${Date.now()}`;
          const response = await this.fetchWithTimeout(url);
          const jsonResponse = await this.readJson<{ success: boolean; headers?: string[]; data?: string[][]; message?: string }>(response);

          if (!jsonResponse.success) {
            throw new Error(jsonResponse.message || `Unable to load ${tab}.`);
          }

          const headers = jsonResponse.headers || [];
          const data = jsonResponse.data || [];
          const typedData: T[] = data.map(row => {
            const obj: { [key: string]: string } = {};
            headers.forEach((header, index) => {
              obj[this.toCamelCase(header)] = row[index] ?? '';
            });
            return obj as T;
          });

          const result: SheetResponse<T> = { success: true, data: typedData };
          this.readCache.set(cacheKey, { expiresAt: Date.now() + 30000, value: result });
          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt === 0) await new Promise(resolve => window.setTimeout(resolve, 900));
        }
      }

      const stale = this.readCache.get(cacheKey);
      if (stale) return stale.value as SheetResponse<T>;

      console.error(`Error fetching data from ${tab}:`, lastError);
      return {
        success: false,
        message: `Failed to fetch ${tab} data. The Google Sheet service may be waking up. Tap Retry in a moment. ${lastError?.message || ''}`.trim(),
      };
    })();

    this.inFlightReads.set(cacheKey, request as Promise<SheetResponse<unknown>>);
    try {
      return await request;
    } finally {
      this.inFlightReads.delete(cacheKey);
    }
  }

  private toCamelCase(str: string): string {
    return str
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+([a-z0-9])/g, (_match, group1) => group1.toUpperCase());
  }

  async getLibraryData(): Promise<SheetResponse<Book>> {
    return this.fetchData<Book>('LIBRARY');
  }

  async getCheckoutLog(): Promise<SheetResponse<LogEntry>> {
    return this.fetchData<LogEntry>('CHECKOUT LOG');
  }

  async getBorrowers(): Promise<SheetResponse<Borrower>> {
    return this.fetchData<Borrower>('BORROWERS');
  }

  async addBook(book: Book): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      // Support both Apps Script payload formats: older deployments expect the
      // book fields at the top level, while newer deployments read payload.book.
      const result = await this.sendMutation<{ success: boolean; message?: string }>({
        action: 'addBook',
        ...book,
        book,
      });
      if (result.success) this.readCache.delete('LIBRARY');
      return result;
    } catch (error) {
      return { success: false, message: `Failed to add book: ${(error as Error).message}` };
    }
  }

  async updateBookStatus(bookId: string, status: string): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      return await this.sendMutation<{ success: boolean; message?: string }>({ action: 'updateBookStatus', bookId, status });
    } catch (error) {
      return { success: false, message: `Failed to update status: ${(error as Error).message}` };
    }
  }

  async updateBook(bookId: string, book: Book): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      return await this.sendMutation<{ success: boolean; message?: string }>({ action: 'updateBook', bookId, book });
    } catch (error) {
      return { success: false, message: `Failed to edit book: ${(error as Error).message}` };
    }
  }

  async archiveBook(bookId: string, archived: boolean): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      return await this.sendMutation<{ success: boolean; message?: string }>({ action: 'archiveBook', bookId, archived });
    } catch (error) {
      return { success: false, message: `Failed to ${archived ? 'archive' : 'restore'} book: ${(error as Error).message}` };
    }
  }

  async addBorrower(name: string): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      const result = await this.sendMutation<{ success: boolean; message?: string }>({ action: 'addBorrower', borrowerName: name });
      if (result.success) this.readCache.delete('BORROWERS');
      return result;
    } catch (error) {
      return { success: false, message: `Failed to add borrower: ${(error as Error).message}` };
    }
  }

  async editBorrower(oldName: string, newName: string): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      const result = await this.sendMutation<{ success: boolean; message?: string }>({ action: 'editBorrower', oldName, newName });
      if (result.success) this.readCache.delete('BORROWERS');
      return result;
    } catch (error) {
      return { success: false, message: `Failed to edit borrower: ${(error as Error).message}` };
    }
  }

  async scanBook(bookId: string, borrower: string, dueDays: number, operation: 'checkout' | 'return'): Promise<ScanResponse> {
    if (!this.webAppUrl) return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    try {
      const result = await this.sendMutation<ScanResponse>({ bookId, borrower, dueDays, operation });
      if (result.success) {
        this.readCache.delete('LIBRARY');
        this.readCache.delete('CHECKOUT LOG');
      }
      return result;
    } catch (error) {
      return { success: false, message: `Failed to process scan: ${(error as Error).message}` };
    }
  }
}
