
import React, { useState, useRef, useEffect } from 'react';
import { ScanResponse } from '../types';

interface ScanStationProps {
  onScan: (bookId: string, borrower: string, dueDays: number) => Promise<ScanResponse>;
  borrowers: string[]; // This will now receive the mapped string array of borrower names
}

const ScanStation: React.FC<ScanStationProps> = ({ onScan, borrowers }) => {
  const [bookId, setBookId] = useState<string>('');
  const [selectedBorrower, setSelectedBorrower] = useState<string>(borrowers[0] || '');
  const [dueDays, setDueDays] = useState<number>(14);
  const [lastReceipt, setLastReceipt] = useState<ScanResponse | null>(null);
  const bookIdInputRef = useRef<HTMLInputElement>(null);

  const focusScannerInput = React.useCallback(() => {
    // preventScroll avoids Safari jumping the page when a Bluetooth scanner
    // reconnects or the user returns to the app.
    bookIdInputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    // Set default borrower if the list changes and the current selected is no longer valid
    if (borrowers.length > 0 && !borrowers.includes(selectedBorrower)) {
      setSelectedBorrower(borrowers[0]);
    } else if (borrowers.length === 0) {
      setSelectedBorrower(''); // Clear if no borrowers are available
    }

    focusScannerInput();
  }, [borrowers, selectedBorrower, focusScannerInput]);

  useEffect(() => {
    const handleWindowFocus = () => focusScannerInput();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') focusScannerInput();
    };

    window.addEventListener('focus', handleWindowFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [focusScannerInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookId.trim()) {
      alert('Please enter a Book ID.');
      return;
    }
    if (!selectedBorrower) {
      alert('Please select a Borrower.');
      return;
    }

    const result = await onScan(bookId.trim(), selectedBorrower, dueDays);
    if (result.success) {
      setBookId(''); // Clear for next scan
      setLastReceipt(result);
    }
    // Refocus after React applies the cleared value so the NADAMOO scanner can
    // immediately send the next barcode and its Enter suffix.
    requestAnimationFrame(focusScannerInput);
  };

  return (
    <div className="p-4 bg-secondary-blue rounded-lg shadow-md max-w-lg mx-auto my-6">
      <h2 className="text-2xl font-bold text-center mb-6 text-text-dark">Scan Station!</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="borrower" className="block text-lg font-medium text-text-dark mb-2">
            Who's Borrowing?
          </label>
          <select
            id="borrower"
            value={selectedBorrower}
            onChange={(e) => setSelectedBorrower(e.target.value)}
            className="w-full p-3 border border-border-light rounded-lg shadow-sm focus:ring-primary-green focus:border-primary-green transition-colors duration-200 bg-white text-lg"
            aria-label="Select borrower"
            disabled={borrowers.length === 0}
          >
            {borrowers.length === 0 && <option value="">No borrowers available</option>}
            {borrowers.map((borrower) => (
              <option key={borrower} value={borrower}>
                {borrower}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dueDays" className="block text-lg font-medium text-text-dark mb-2">
            Due in (days)
          </label>
          <input
            type="number"
            id="dueDays"
            value={dueDays}
            onChange={(e) => setDueDays(Number(e.target.value))}
            className="w-full p-3 border border-border-light rounded-lg shadow-sm focus:ring-primary-green focus:border-primary-green transition-colors duration-200 text-lg"
            min="1"
            max="365"
            aria-label="Due days"
          />
        </div>

        <div>
          <label htmlFor="bookId" className="block text-lg font-medium text-text-dark mb-2">
            Scan Book ID
          </label>
          <input
            type="text"
            id="bookId"
            ref={bookIdInputRef}
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            placeholder="e.g., ML-001"
            className="w-full p-4 border-2 border-primary-green rounded-lg shadow-lg text-2xl text-center font-mono placeholder-gray-400 focus:outline-none focus:ring-4 focus:ring-primary-green focus:border-transparent transition-all duration-300"
            autoComplete="off"
            autoCapitalize="off"
            inputMode="none"
            spellCheck="false"
            aria-label="Book ID to scan"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-primary-green text-white text-xl font-bold py-4 px-6 rounded-lg shadow-md hover:bg-emerald-600 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-primary-green focus:ring-opacity-75"
          disabled={borrowers.length === 0}
          aria-label="Process scan"
        >
          Process Scan
        </button>
      </form>
      {lastReceipt?.success && (
        <div className="mt-6 rounded-xl border-2 border-primary-green bg-white p-4 text-center">
          <p className="text-xl font-bold">{lastReceipt.action} complete!</p>
          <p>{lastReceipt.title}</p>
          <p className="font-mono">{lastReceipt.bookId}</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-3 w-full rounded-lg bg-text-dark px-4 py-3 font-bold text-white"
          >
            Print 4×6 Receipt
          </button>
        </div>
      )}
      {lastReceipt?.success && (
        <section className="thermal-receipt" aria-label="Thermal receipt">
          <h1>Mariahs Library</h1>
          <div className="receipt-rule" />
          <h2>{lastReceipt.action} Receipt</h2>
          <p><strong>Book:</strong> {lastReceipt.title}</p>
          <p><strong>Book ID:</strong> {lastReceipt.bookId}</p>
          <p><strong>Borrower:</strong> {lastReceipt.borrower}</p>
          {lastReceipt.action === 'Checkout' && <p><strong>Due:</strong> {lastReceipt.dueDate}</p>}
          <p><strong>Date:</strong> {lastReceipt.timestamp || new Date().toLocaleString()}</p>
          <div className="receipt-rule" />
          <p className="receipt-thanks">Happy reading!</p>
        </section>
      )}
    </div>
  );
};

export default ScanStation;
