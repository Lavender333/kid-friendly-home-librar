
import { Book, LogEntry, Borrower, SheetResponse, ScanResponse } from '../types';

export class SheetService {
  private webAppUrl: string;

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

  private async fetchData<T>(tab: string): Promise<SheetResponse<T>> {
    // Fix: Remove the specific string literal comparison for webAppUrl.
    // The App.tsx component now handles the initial URL configuration check.
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }
    try {
      const response = await fetch(`${this.webAppUrl}?tab=${tab}`);
      const jsonResponse = await this.readJson<{ success: boolean; headers?: string[]; data?: string[][]; message?: string }>(response);
      if (jsonResponse.success) {
        // Map data from array of arrays to array of objects
        const headers: string[] = jsonResponse.headers || [];
        const data: string[][] = jsonResponse.data || [];
        const typedData: T[] = data.map(row => {
          const obj: { [key: string]: string } = {};
          headers.forEach((header, index) => {
            obj[this.toCamelCase(header)] = row[index];
          });
          return obj as T;
        });
        return { success: true, data: typedData };
      } else {
        return { success: false, message: jsonResponse.message || 'An unknown error occurred.' };
      }
    } catch (error) {
      console.error(`Error fetching data from ${tab}:`, error);
      return { success: false, message: `Failed to fetch ${tab} data: ${(error as Error).message}` };
    }
  }

  private toCamelCase(str: string): string {
    // Normalize headers such as "Book ID" -> "bookId" and "Publication Year" -> "publicationYear".
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
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'addBook', book }),
      });
      return await this.readJson<{ success: boolean; message?: string }>(response);
    } catch (error) {
      console.error('Error adding book:', error);
      return { success: false, message: `Failed to add book: ${(error as Error).message}` };
    }
  }

  async addBorrower(name: string): Promise<{ success: boolean; message?: string }> {
    // Fix: Remove the specific string literal comparison for webAppUrl.
    // The App.tsx component now handles the initial URL configuration check.
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'addBorrower', borrowerName: name }),
      });

      const jsonResponse = await this.readJson<{ success: boolean; message?: string }>(response);
      return jsonResponse;

    } catch (error) {
      console.error('Error adding borrower:', error);
      return { success: false, message: `Failed to add borrower: ${(error as Error).message}` };
    }
  }

  async editBorrower(oldName: string, newName: string): Promise<{ success: boolean; message?: string }> {
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'editBorrower', oldName, newName }),
      });

      const jsonResponse = await this.readJson<{ success: boolean; message?: string }>(response);
      return jsonResponse;

    } catch (error) {
      console.error('Error editing borrower:', error);
      return { success: false, message: `Failed to edit borrower: ${(error as Error).message}` };
    }
  }

  async scanBook(bookId: string, borrower: string, dueDays: number): Promise<ScanResponse> {
    // Fix: Remove the specific string literal comparison for webAppUrl.
    // The App.tsx component now handles the initial URL configuration check.
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }
    try {
      const response = await fetch(this.webAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ bookId, borrower, dueDays }),
      });

      const jsonResponse = await this.readJson<ScanResponse>(response);
      return jsonResponse;

    } catch (error) {
      console.error('Error scanning book:', error);
      return { success: false, message: `Failed to process scan: ${(error as Error).message}` };
    }
  }
}
