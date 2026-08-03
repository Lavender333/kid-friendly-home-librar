export interface Book {
  barcode: string;
  bookId: string;
  title: string;
  author: string;
  publisher: string;
  publicationYear: string;
  genre: string;
  status: string;
  borrower: string;
  checkoutDate: string;
  dueDate: string;
  notes: string;
}

export interface LogEntry {
  checkoutDate: string;
  timestamp?: string; // Backward compatibility with older log rows.
  bookId: string;
  title: string;
  borrower: string;
  action: string;
  dueDate: string;
  returnDate: string;
  daysLate: string;
  notes: string;
}

export interface BrowserProfile {
  id: string;
  name: string;
  settings?: Record<string, any>;
  bookmarks?: Array<{ title: string; url: string }>;
  createdAt: string;
  updatedAt?: string;
}

export interface Borrower {
  name: string;
}

export interface SheetResponse<T> {
  success: boolean;
  message?: string;
  data?: T[];
}

export interface AddBookResponse {
  success: boolean;
  message?: string;
  bookId?: string;
  barcode?: string;
}

export interface ScanResponse {
  success: boolean;
  message?: string;
  action?: 'Checkout' | 'Return';
  bookId?: string;
  title?: string;
  borrower?: string;
  newStatus?: string;
  dueDate?: string;
  timestamp?: string;
  daysLate?: number;
}
