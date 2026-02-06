
import { Book, LogEntry, Borrower, SheetResponse, ScanResponse } from '../types';

export class SheetService {
  private webAppUrl: string;

  constructor(webAppUrl: string) {
    this.webAppUrl = webAppUrl;
  }

  private async fetchData<T>(tab: string): Promise<SheetResponse<T>> {
    // Fix: Remove the specific string literal comparison for webAppUrl.
    // The App.tsx component now handles the initial URL configuration check.
    if (!this.webAppUrl) {
      return { success: false, message: 'Google Apps Script Web App URL is not configured.' };
    }
    try {
      const response = await fetch(`${this.webAppUrl}?tab=${tab}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }
      const jsonResponse = await response.json();
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'addBorrower', borrowerName: name }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      const jsonResponse: { success: boolean; message?: string } = await response.json();
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'editBorrower', oldName, newName }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      const jsonResponse: { success: boolean; message?: string } = await response.json();
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookId, borrower, dueDays }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      const jsonResponse: ScanResponse = await response.json();
      return jsonResponse;

    } catch (error) {
      console.error('Error scanning book:', error);
      return { success: false, message: `Failed to process scan: ${(error as Error).message}` };
    }
  }
}
