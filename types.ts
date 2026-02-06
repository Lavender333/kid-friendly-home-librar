
export interface Book {
  barcode: string;
  bookId: string;
  title: string;
  author: string; // New
  publisher: string; // New
  publicationYear: string; // New
  genre: string;
  status: string;
  borrower: string;
  checkoutDate: string;
  dueDate: string;
  notes: string;
}

export interface LogEntry {
  timestamp: string;
  bookId: string;
  title: string;
  borrower: string;
  action: string;
  notes: string;
}

export interface Borrower {
  name: string;
}

export interface SheetResponse<T> {
  success: boolean;
  message?: string;
  data?: T[];
}

export interface ScanResponse {
  success: boolean;
  message?: string;
  action?: 'Checkout' | 'Return';
  bookId?: string;
  title?: string;
  borrower?: string;
  newStatus?: string;
}
