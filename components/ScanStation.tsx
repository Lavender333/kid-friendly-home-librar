import React, { useEffect, useRef, useState } from 'react';
import { ScanResponse } from '../types';

interface ScanStationProps {
  onScan: (bookId: string, borrower: string, dueDays: number, operation: 'checkout' | 'return') => Promise<ScanResponse>;
  borrowers: string[];
}

const memberCode = (name: string) => `MEM-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;

const ScanStation: React.FC<ScanStationProps> = ({ onScan, borrowers }) => {
  const [scanValue, setScanValue] = useState('');
  const [selectedBorrower, setSelectedBorrower] = useState(borrowers[0] || '');
  const [dueDays, setDueDays] = useState(14);
  const [operation, setOperation] = useState<'checkout' | 'return'>('checkout');
  const [lastReceipt, setLastReceipt] = useState<ScanResponse | null>(null);
  const [stationMessage, setStationMessage] = useState('Choose a mode, then scan.');
  const inputRef = useRef<HTMLInputElement>(null);

  const focusScanner = React.useCallback(() => inputRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    if (borrowers.length > 0 && !borrowers.includes(selectedBorrower)) setSelectedBorrower(borrowers[0]);
    if (borrowers.length === 0) setSelectedBorrower('');
    focusScanner();
  }, [borrowers, selectedBorrower, focusScanner]);

  useEffect(() => {
    const refocus = () => focusScanner();
    window.addEventListener('focus', refocus);
    return () => window.removeEventListener('focus', refocus);
  }, [focusScanner]);

  const switchMode = (next: 'checkout' | 'return') => {
    setOperation(next);
    setScanValue('');
    setLastReceipt(null);
    setStationMessage(next === 'checkout'
      ? 'Scan a library card, then scan one or more books.'
      : 'Scan each returned book. No library card is needed.');
    requestAnimationFrame(focusScanner);
  };

  const processScan = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;

    const matchedBorrower = borrowers.find(name => memberCode(name) === value.toUpperCase());
    if (matchedBorrower) {
      if (operation === 'return') {
        setStationMessage('Library cards are only needed for check out. Scan the returned book.');
      } else {
        setSelectedBorrower(matchedBorrower);
        setStationMessage(`✓ ${matchedBorrower}'s card selected. Now scan a book.`);
      }
      setScanValue('');
      requestAnimationFrame(focusScanner);
      return;
    }

    if (operation === 'checkout' && !selectedBorrower) {
      setStationMessage('Scan a library card or select a borrower before scanning a book.');
      setScanValue('');
      requestAnimationFrame(focusScanner);
      return;
    }

    const result = await onScan(value, selectedBorrower, dueDays, operation);
    if (result.success) {
      setLastReceipt(result);
      setStationMessage(operation === 'checkout'
        ? `✓ ${result.title} checked out to ${result.borrower}. Print the receipt or scan the next book.`
        : `✓ ${result.title} checked in. Scan the next returned book.`);
    } else {
      setStationMessage(result.message || 'The scan could not be completed.');
    }
    setScanValue('');
    requestAnimationFrame(focusScanner);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void processScan(scanValue);
  };

  const printMunbynReceipt = () => {
    const style = document.createElement('style');
    style.id = 'munbyn-receipt-page-size';
    style.textContent = '@page { size: 100mm 152mm; margin: 0; }';
    document.head.appendChild(style);
    document.body.classList.add('print-munbyn-receipt');

    const cleanup = () => {
      document.body.classList.remove('print-munbyn-receipt');
      document.getElementById('munbyn-receipt-page-size')?.remove();
      window.removeEventListener('afterprint', cleanup);
      requestAnimationFrame(focusScanner);
    };

    window.addEventListener('afterprint', cleanup);
    window.print();
    window.setTimeout(cleanup, 3000);
  };

  return (
    <div className="mx-auto my-6 max-w-lg rounded-lg bg-secondary-blue p-4 shadow-md">
      <h2 className="mb-4 text-center text-2xl font-bold text-text-dark">Library Scan Station</h2>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-white p-2">
        <button type="button" onClick={() => switchMode('checkout')} className={`min-h-12 rounded-lg text-lg font-bold ${operation === 'checkout' ? 'bg-primary-green text-white' : 'bg-gray-100 text-gray-700'}`}>
          Check Out
        </button>
        <button type="button" onClick={() => switchMode('return')} className={`min-h-12 rounded-lg text-lg font-bold ${operation === 'return' ? 'bg-accent-yellow text-text-dark' : 'bg-gray-100 text-gray-700'}`}>
          Check In
        </button>
      </div>

      <p className="mb-4 rounded-lg bg-white p-3 text-center font-semibold" aria-live="polite">{stationMessage}</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {operation === 'checkout' && (
          <>
            <div>
              <label htmlFor="borrower" className="mb-2 block text-lg font-medium">Borrower</label>
              <select id="borrower" value={selectedBorrower} onChange={event => setSelectedBorrower(event.target.value)} className="w-full rounded-lg border p-3 text-lg">
                {borrowers.length === 0 && <option value="">No borrowers available</option>}
                {borrowers.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="dueDays" className="mb-2 block text-lg font-medium">Due in days</label>
              <input id="dueDays" type="number" min="1" max="365" value={dueDays} onChange={event => setDueDays(Number(event.target.value))} className="w-full rounded-lg border p-3 text-lg" />
            </div>
          </>
        )}

        <div>
          <label htmlFor="scanValue" className="mb-2 block text-lg font-medium">
            {operation === 'checkout' ? 'Scan Library Card or Book Barcode' : 'Scan Book Barcode'}
          </label>
          <input
            id="scanValue"
            ref={inputRef}
            value={scanValue}
            onChange={event => setScanValue(event.target.value)}
            className="w-full rounded-lg border-2 border-primary-green p-4 text-center font-mono text-2xl shadow-lg"
            placeholder={operation === 'checkout' ? 'MEM-MARIAH or ML-BOOK-ID' : 'ML-BOOK-ID'}
            autoComplete="off"
            autoCapitalize="off"
            inputMode="none"
            spellCheck="false"
          />
        </div>

        <button type="submit" className="w-full rounded-lg bg-primary-green px-6 py-4 text-xl font-bold text-white">
          Process Scan
        </button>
      </form>

      {lastReceipt?.success && (
        <div className="mt-6 rounded-xl border-2 border-primary-green bg-white p-4 text-center">
          <p className="text-xl font-bold">{lastReceipt.action} complete!</p>
          <p className="mt-1 font-semibold">{lastReceipt.title}</p>
          <p className="font-mono text-sm">{lastReceipt.bookId}</p>
          {lastReceipt.action === 'Checkout' && (
            <>
              <p className="mt-2 text-sm">Borrower: <strong>{lastReceipt.borrower}</strong></p>
              <p className="text-sm">Due: <strong>{lastReceipt.dueDate}</strong></p>
              <button type="button" onClick={printMunbynReceipt} className="mt-3 w-full rounded-lg bg-text-dark px-4 py-3 font-bold text-white">
                Print MUNBYN Checkout Receipt
              </button>
              <p className="mt-2 text-xs text-gray-500">Sized for a 100 mm × 152 mm thermal label.</p>
            </>
          )}
        </div>
      )}

      {lastReceipt?.success && lastReceipt.action === 'Checkout' && (
        <section className="thermal-receipt munbyn-checkout-receipt" aria-label="Checkout receipt">
          <h1>Mariah's Library</h1>
          <p className="receipt-subtitle">CHECKOUT RECEIPT</p>
          <div className="receipt-rule" />
          <div className="receipt-book-title">{lastReceipt.title}</div>
          <div className="receipt-details">
            <p><strong>Borrower</strong><br />{lastReceipt.borrower}</p>
            <p><strong>Book ID</strong><br /><span className="receipt-mono">{lastReceipt.bookId}</span></p>
            <p><strong>Checked out</strong><br />{lastReceipt.timestamp || new Date().toLocaleString()}</p>
            <p><strong>Due date</strong><br /><span className="receipt-due-date">{lastReceipt.dueDate}</span></p>
          </div>
          <div className="receipt-rule" />
          <p className="receipt-reminder">Please return this book by the due date.</p>
          <p className="receipt-thanks">Happy reading! 📚</p>
        </section>
      )}
    </div>
  );
};

export default ScanStation;
