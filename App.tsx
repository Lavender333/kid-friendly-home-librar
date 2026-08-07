import React, { useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Navigation from './components/Navigation';
import ScanStation from './components/ScanStation';
import LibraryView from './components/LibraryView';
import CheckoutLogView from './components/CheckoutLogView';
import ManageBorrowersView from './components/ManageBorrowersView';
import AddBookView from './components/AddBookView';
import { SheetService } from './services/googleSheetService';
import { Book, LogEntry, Borrower } from './types';
import LoadingSpinner from './components/LoadingSpinner';

const SHEET_WEB_APP_URL = import.meta.env.VITE_SHEET_WEB_APP_URL ||
  'https://script.google.com/macros/s/AKfycbzY5UGjISEt41xme1uexx1cQwbo59TFvRY0QgH1L5kPF7aev2ZIoDHyRe3DeH88noO6/exec';
const LIBRARY_CACHE_KEY = 'mariahs-library-books';
const LOG_CACHE_KEY = 'mariahs-library-checkout-log';
const BORROWERS_CACHE_KEY = 'mariahs-library-borrowers';

const readCache = <T,>(key: string): T[] => {
  try { const cached = localStorage.getItem(key); return cached ? JSON.parse(cached) : []; } catch { return []; }
};

const writeCache = <T,>(key: string, data: T[]) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* live Sheet remains authoritative */ }
};

const App: React.FC = () => {
  const [libraryData, setLibraryData] = useState<Book[]>(() => readCache<Book>(LIBRARY_CACHE_KEY));
  const [logData, setLogData] = useState<LogEntry[]>(() => readCache<LogEntry>(LOG_CACHE_KEY));
  const [borrowersList, setBorrowersList] = useState<Borrower[]>(() => readCache<Borrower>(BORROWERS_CACHE_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [updateApp, setUpdateApp] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const navigate = useNavigate();
  const location = useLocation();
  const sheetService = React.useMemo(() => new SheetService(SHEET_WEB_APP_URL), []);

  const checkWebAppUrl = React.useCallback(() => {
    if (!SHEET_WEB_APP_URL) { setMessage({ text: 'Please configure your Google Apps Script Web App URL in App.tsx', type: 'error' }); return false; }
    return true;
  }, []);

  const fetchLibraryData = React.useCallback(async (silent = false) => {
    if (!checkWebAppUrl()) return;
    if (!silent) setIsLoading(true);
    try {
      const { data, success, message: msg } = await sheetService.getLibraryData();
      if (success && data) { const books = data.filter(book => book.bookId?.trim()); setLibraryData(books); writeCache(LIBRARY_CACHE_KEY, books); }
      else if (!silent) setMessage({ text: msg || 'Failed to fetch library data.', type: 'error' });
    } catch (error) { if (!silent) setMessage({ text: `Error fetching library data: ${(error as Error).message}`, type: 'error' }); }
    finally { if (!silent) setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const fetchCheckoutLogData = React.useCallback(async (silent = false) => {
    if (!checkWebAppUrl()) return;
    if (!silent) setIsLoading(true);
    try {
      const { data, success, message: msg } = await sheetService.getCheckoutLog();
      if (success && data) { setLogData(data); writeCache(LOG_CACHE_KEY, data); }
      else if (!silent) setMessage({ text: msg || 'Failed to fetch checkout log.', type: 'error' });
    } catch (error) { if (!silent) setMessage({ text: `Error fetching checkout log: ${(error as Error).message}`, type: 'error' }); }
    finally { if (!silent) setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const fetchBorrowersData = React.useCallback(async (silent = false) => {
    if (!checkWebAppUrl()) return;
    if (!silent) setIsLoading(true);
    try {
      const { data, success, message: msg } = await sheetService.getBorrowers();
      if (success && data) { setBorrowersList(data); writeCache(BORROWERS_CACHE_KEY, data); }
      else if (!silent) setMessage({ text: msg || 'Failed to fetch borrowers data.', type: 'error' });
    } catch (error) { if (!silent) setMessage({ text: `Error fetching borrowers data: ${(error as Error).message}`, type: 'error' }); }
    finally { if (!silent) setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const handleScan = React.useCallback(async (bookId: string, borrower: string, dueDays: number, operation: 'checkout' | 'return') => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.scanBook(bookId, borrower, dueDays, operation);
      if (response.success) {
        setMessage({ text: `${response.action}: ${response.bookId} (${response.title}) by ${response.borrower}`, type: 'success' });
        void fetchLibraryData(true); void fetchCheckoutLogData(true); return response;
      }
      setMessage({ text: response.message || 'Scan failed.', type: 'error' }); return { success: false, message: response.message };
    } catch (error) { setMessage({ text: `Network error: ${(error as Error).message}`, type: 'error' }); return { success: false, message: `Network error: ${(error as Error).message}` }; }
    finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl, fetchLibraryData, fetchCheckoutLogData]);

  const handleCheckInFromLog = React.useCallback(async (bookId: string, borrower: string) => handleScan(bookId, borrower || 'Check In', 14, 'return'), [handleScan]);

  const handleAddBook = React.useCallback(async (book: Book) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.addBook(book);
      setMessage({ text: response.message || (response.success ? 'Book saved and added to Library.' : 'Failed to save book.'), type: response.success ? 'success' : 'error' });
      if (response.success) {
        const canonicalId = response.bookId || response.barcode || book.bookId;
        const canonicalBarcode = response.barcode || canonicalId;
        const savedBook: Book = { ...book, bookId: canonicalId, barcode: canonicalBarcode, status: 'On Shelf', borrower: '', checkoutDate: '', dueDate: '' };
        setLibraryData(current => { const updated = [savedBook, ...current.filter(item => item.bookId !== canonicalId && item.barcode !== canonicalBarcode)]; writeCache(LIBRARY_CACHE_KEY, updated); return updated; });
        window.setTimeout(() => void fetchLibraryData(true), 500);
      }
      return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl, fetchLibraryData]);

  const handleUpdateBookStatus = React.useCallback(async (bookId: string, status: string, borrower = '', dueDays = 14) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = status === 'Checked Out'
        ? await sheetService.scanBook(bookId, borrower, dueDays, 'checkout')
        : await sheetService.updateBookStatus(bookId, status);
      setMessage({ text: response.message || (response.success ? 'Status updated.' : 'Status update failed.'), type: response.success ? 'success' : 'error' });
      if (response.success) {
        const checkoutResult = response as { timestamp?: string; dueDate?: string };
        setLibraryData(current => {
          const updated = current.map(book => book.bookId === bookId
            ? { ...book, status, borrower: status === 'Checked Out' ? borrower : '', checkoutDate: status === 'Checked Out' ? (checkoutResult.timestamp || '') : '', dueDate: status === 'Checked Out' ? (checkoutResult.dueDate || '') : '' }
            : book);
          writeCache(LIBRARY_CACHE_KEY, updated);
          return updated;
        });
        if (status === 'Checked Out') void fetchCheckoutLogData(true);
      }
      return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl, fetchCheckoutLogData]);

  const handleEditBook = React.useCallback(async (bookId: string, book: Book) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.updateBook(bookId, book);
      setMessage({ text: response.message || (response.success ? 'Book updated.' : 'Book update failed.'), type: response.success ? 'success' : 'error' });
      if (response.success) setLibraryData(current => { const updated = current.map(item => item.bookId === bookId ? { ...item, ...book, bookId } : item); writeCache(LIBRARY_CACHE_KEY, updated); return updated; });
      return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const handleArchiveBook = React.useCallback(async (bookId: string, archived: boolean) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.archiveBook(bookId, archived);
      setMessage({ text: response.message || (response.success ? (archived ? 'Book archived.' : 'Book restored.') : 'Book update failed.'), type: response.success ? 'success' : 'error' });
      if (response.success) setLibraryData(current => { const updated = current.map(book => book.bookId === bookId ? { ...book, status: archived ? 'Archived' : 'On Shelf', borrower: '', checkoutDate: '', dueDate: '' } : book); writeCache(LIBRARY_CACHE_KEY, updated); return updated; });
      return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const handleDeleteBook = React.useCallback(async (bookId: string) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.deleteBook(bookId);
      setMessage({ text: response.message || (response.success ? 'Book deleted. Checkout history was kept.' : 'Book deletion failed.'), type: response.success ? 'success' : 'error' });
      if (response.success) setLibraryData(current => { const updated = current.filter(book => book.bookId !== bookId); writeCache(LIBRARY_CACHE_KEY, updated); return updated; });
      return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const handleAddNewBorrower = React.useCallback(async (name: string) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.addBorrower(name);
      if (response.success) { setMessage({ text: response.message || `Borrower '${name}' added.`, type: 'success' }); setBorrowersList(current => { const updated = [...current, { name: name.trim() }]; writeCache(BORROWERS_CACHE_KEY, updated); return updated; }); return response; }
      setMessage({ text: response.message || 'Failed to add borrower.', type: 'error' }); return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  const handleEditBorrower = React.useCallback(async (oldName: string, newName: string) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.editBorrower(oldName, newName);
      if (response.success) { setMessage({ text: response.message || `Borrower '${oldName}' updated to '${newName}'.`, type: 'success' }); setBorrowersList(current => { const updated = current.map(item => item.name === oldName ? { name: newName.trim() } : item); writeCache(BORROWERS_CACHE_KEY, updated); return updated; }); return response; }
      setMessage({ text: response.message || 'Failed to update borrower.', type: 'error' }); return response;
    } finally { setIsLoading(false); }
  }, [sheetService, checkWebAppUrl]);

  React.useEffect(() => {
    if (location.pathname === '/library') fetchLibraryData(libraryData.length > 0);
    else if (location.pathname === '/checkout-log') fetchCheckoutLogData(logData.length > 0);
    else if (location.pathname === '/') { fetchBorrowersData(true); fetchLibraryData(true); fetchCheckoutLogData(true); }
    else if (location.pathname === '/manage-borrowers') fetchBorrowersData();
  }, [location.pathname, fetchLibraryData, fetchCheckoutLogData, fetchBorrowersData]);

  React.useEffect(() => {
    const handleUpdate = (event: Event) => setUpdateApp(() => (event as CustomEvent<(reloadPage?: boolean) => Promise<void>>).detail);
    window.addEventListener('mariahs-library-update', handleUpdate); return () => window.removeEventListener('mariahs-library-update', handleUpdate);
  }, []);

  React.useEffect(() => {
    if (!message.text) return;
    const timer = window.setTimeout(() => setMessage({ text: '', type: '' }), message.type === 'success' ? 2000 : 6000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const borrowerNames = React.useMemo(() => borrowersList.map(b => b.name), [borrowersList]);

  return (
    <div className="flex flex-col flex-grow items-center justify-center p-4">
      <Header />
      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-xl relative mt-4">
        <Navigation navigate={navigate} />
        {isLoading && location.pathname === '/' && <LoadingSpinner />}
        {message.text && <div role="alert" aria-live="polite" className={`fixed top-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-md z-50 text-white text-center ${message.type === 'success' ? 'bg-success-green' : 'bg-error-red'}`}>{message.text}</div>}
        {updateApp && <div role="status" className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl bg-text-dark p-4 text-center text-white shadow-2xl"><p className="mb-3 font-bold">A new version of Mariah&apos;s Library is ready.</p><div className="flex justify-center gap-3"><button type="button" onClick={() => updateApp(true)} className="rounded-lg bg-primary-green px-4 py-2 font-bold text-text-dark">Update Now</button><button type="button" onClick={() => setUpdateApp(null)} className="rounded-lg bg-white/20 px-4 py-2 font-semibold">Later</button></div></div>}
        <div className="mt-6">
          <Routes>
            <Route path="/" element={<ScanStation onScan={handleScan} borrowers={borrowerNames} />} />
            <Route path="/library" element={<LibraryView books={libraryData} borrowers={borrowerNames} isLoading={isLoading} onUpdateStatus={handleUpdateBookStatus} onEditBook={handleEditBook} onArchiveBook={handleArchiveBook} onDeleteBook={handleDeleteBook} />} />
            <Route path="/add-book" element={<AddBookView onAddBook={handleAddBook} isLoading={isLoading} />} />
            <Route path="/checkout-log" element={<CheckoutLogView logEntries={logData} isLoading={isLoading} onCheckIn={handleCheckInFromLog} />} />
            <Route path="/manage-borrowers" element={<ManageBorrowersView borrowers={borrowersList} onAddBorrower={handleAddNewBorrower} onEditBorrower={handleEditBorrower} isLoading={isLoading} message={message} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default App;
