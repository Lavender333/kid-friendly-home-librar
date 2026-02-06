
import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Navigation from './components/Navigation';
import ScanStation from './components/ScanStation';
import LibraryView from './components/LibraryView';
import CheckoutLogView from './components/CheckoutLogView';
import ManageBorrowersView from './components/ManageBorrowersView';
import { SheetService } from './services/googleSheetService';
import { Book, LogEntry, Borrower } from './types';
import LoadingSpinner from './components/LoadingSpinner';

// <<< IMPORTANT: Replace with your deployed Google Apps Script Web App URL
// Deployment ID provided by user on 2026-02-06: 1fVvIQPOxt_zTqmHQ04KSxMpXJ_newld_GPvs-Z5M47EPVpAIMsSOLkUP
const SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/1fVvIQPOxt_zTqmHQ04KSxMpXJ_newld_GPvs-Z5M47EPVpAIMsSOLkUP/exec';

const App: React.FC = () => {
  const [libraryData, setLibraryData] = useState<Book[]>([]);
  const [logData, setLogData] = useState<LogEntry[]>([]);
  const [borrowersList, setBorrowersList] = useState<Borrower[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' | '' }>({ text: '', type: '' });
  const navigate = useNavigate();

  const sheetService = React.useMemo(() => new SheetService(SHEET_WEB_APP_URL), []);

  const checkWebAppUrl = React.useCallback(() => {
    if (!SHEET_WEB_APP_URL) {
      setMessage({ text: 'Please configure your Google Apps Script Web App URL in App.tsx', type: 'error' });
      return false;
    }
    return true;
  }, []);

  const fetchLibraryData = React.useCallback(async () => {
    if (!checkWebAppUrl()) return;
    setIsLoading(true);
    try {
      const { data, success, message: msg } = await sheetService.getLibraryData();
      if (success && data) {
        setLibraryData(data);
      } else {
        setMessage({ text: msg || 'Failed to fetch library data.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: `Error fetching library data: ${(error as Error).message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetService, checkWebAppUrl]);

  const fetchCheckoutLogData = React.useCallback(async () => {
    if (!checkWebAppUrl()) return;
    setIsLoading(true);
    try {
      const { data, success, message: msg } = await sheetService.getCheckoutLog();
      if (success && data) {
        setLogData(data);
      } else {
        setMessage({ text: msg || 'Failed to fetch checkout log.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: `Error fetching checkout log: ${(error as Error).message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetService, checkWebAppUrl]);

  const fetchBorrowersData = React.useCallback(async () => {
    if (!checkWebAppUrl()) return;
    setIsLoading(true);
    try {
      const { data, success, message: msg } = await sheetService.getBorrowers();
      if (success && data) {
        setBorrowersList(data);
      } else {
        setMessage({ text: msg || 'Failed to fetch borrowers data.', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: `Error fetching borrowers data: ${(error as Error).message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetService, checkWebAppUrl]);

  const handleScan = React.useCallback(async (bookId: string, borrower: string, dueDays: number) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.scanBook(bookId, borrower, dueDays);
      if (response.success) {
        setMessage({ text: `${response.action}: ${response.bookId} (${response.title}) by ${response.borrower}`, type: 'success' });
        fetchLibraryData(); // Refresh library data
        fetchCheckoutLogData(); // Refresh log data
        return { success: true, message: response.message };
      } else {
        setMessage({ text: response.message || 'Scan failed.', type: 'error' });
        return { success: false, message: response.message };
      }
    } catch (error) {
      setMessage({ text: `Network error: ${(error as Error).message}`, type: 'error' });
      return { success: false, message: `Network error: ${(error as Error).message}` };
    } finally {
      setIsLoading(false);
    }
  }, [sheetService, fetchLibraryData, fetchCheckoutLogData, checkWebAppUrl]);

  const handleAddNewBorrower = React.useCallback(async (name: string) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.addBorrower(name);
      if (response.success) {
        setMessage({ text: response.message || `Borrower '${name}' added.`, type: 'success' });
        fetchBorrowersData(); // Refresh borrowers list
        return { success: true, message: response.message };
      } else {
        setMessage({ text: response.message || 'Failed to add borrower.', type: 'error' });
        return { success: false, message: 'Failed to add borrower.' };
      }
    } catch (error) {
      setMessage({ text: `Network error: ${(error as Error).message}`, type: 'error' });
      return { success: false, message: `Network error: ${(error as Error).message}` };
    } finally {
      setIsLoading(false);
    }
  }, [sheetService, fetchBorrowersData, checkWebAppUrl]);

  const handleEditBorrower = React.useCallback(async (oldName: string, newName: string) => {
    if (!checkWebAppUrl()) return { success: false, message: 'Configuration error.' };
    setIsLoading(true);
    try {
      const response = await sheetService.editBorrower(oldName, newName);
      if (response.success) {
        setMessage({ text: response.message || `Borrower '${oldName}' updated to '${newName}'.`, type: 'success' });
        fetchBorrowersData(); // Refresh borrowers list
        fetchLibraryData(); // Refresh library data in case books were checked out by this borrower
        fetchCheckoutLogData(); // Refresh log data
        return { success: true, message: response.message };
      } else {
        setMessage({ text: response.message || 'Failed to update borrower.', type: 'error' });
        return { success: false, message: 'Failed to update borrower.' };
      }
    } catch (error) {
      setMessage({ text: `Network error: ${(error as Error).message}`, type: 'error' });
      return { success: false, message: `Network error: ${(error as Error).message}` };
    } finally {
      setIsLoading(false);
    }
  }, [sheetService, fetchBorrowersData, fetchLibraryData, fetchCheckoutLogData, checkWebAppUrl]);

  React.useEffect(() => {
    fetchLibraryData();
    fetchCheckoutLogData();
    fetchBorrowersData(); // Fetch borrowers on initial load
  }, [fetchLibraryData, fetchCheckoutLogData, fetchBorrowersData]);

  React.useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ text: '', type: '' }), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const borrowerNames = React.useMemo(() => borrowersList.map(b => b.name), [borrowersList]);

  return (
    <div className="flex flex-col flex-grow items-center justify-center p-4">
      <Header />
      <div className="w-full max-w-4xl bg-white p-6 rounded-lg shadow-xl relative mt-4">
        <Navigation navigate={navigate} />

        {/* Global Loading Spinner for any operation */}
        {isLoading && <LoadingSpinner />}

        {/* Global message/toast display */}
        {message.text && (
          <div role="alert" aria-live="polite" className={`fixed top-4 left-1/2 -translate-x-1/2 p-3 rounded-lg shadow-md z-50 text-white text-center
            ${message.type === 'success' ? 'bg-success-green' : 'bg-error-red'}`}
          >
            {message.text}
          </div>
        )}

        <div className="mt-6">
          <Routes>
            <Route path="/" element={<ScanStation onScan={handleScan} borrowers={borrowerNames} />} />
            <Route path="/library" element={<LibraryView books={libraryData} isLoading={isLoading} />} />
            <Route path="/checkout-log" element={<CheckoutLogView logEntries={logData} isLoading={isLoading} />} />
            <Route
              path="/manage-borrowers"
              element={<ManageBorrowersView
                borrowers={borrowersList}
                onAddBorrower={handleAddNewBorrower}
                onEditBorrower={handleEditBorrower} // Pass the new prop
                isLoading={isLoading}
              />}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default App;
