import React, { useEffect, useRef, useState } from 'react';
import { ScanResponse } from '../types';

interface ScanStationProps {
  onScan: (bookId: string, borrower: string, dueDays: number, operation: 'checkout' | 'return') => Promise<ScanResponse>;
  borrowers: string[];
}

const memberCode = (name: string) => `MEM-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;

const ScanStation: React.FC<ScanStationProps> = ({ onScan, borrowers }) => {
  const [memberScan, setMemberScan] = useState('');
  const [bookScan, setBookScan] = useState('');
  const [selectedBorrower, setSelectedBorrower] = useState(borrowers[0] || '');
  const [dueDays, setDueDays] = useState(14);
  const [operation, setOperation] = useState<'checkout' | 'return'>('checkout');
  const [lastReceipt, setLastReceipt] = useState<ScanResponse | null>(null);
  const [stationMessage, setStationMessage] = useState('Choose a mode, then scan.');
  const memberInputRef = useRef<HTMLInputElement>(null);
  const bookInputRef = useRef<HTMLInputElement>(null);

  const focusBookScanner = React.useCallback(() => bookInputRef.current?.focus({ preventScroll: true }), []);

  useEffect(() => {
    if (borrowers.length > 0 && !borrowers.includes(selectedBorrower)) setSelectedBorrower(borrowers[0]);
    if (borrowers.length === 0) setSelectedBorrower('');
  }, [borrowers, selectedBorrower]);

  useEffect(() => {
    if (operation === 'return' || selectedBorrower) focusBookScanner();
    else memberInputRef.current?.focus({ preventScroll: true });
  }, [operation, selectedBorrower, focusBookScanner]);

  const switchMode = (next: 'checkout' | 'return') => {
    setOperation(next);
    setMemberScan('');
    setBookScan('');
    setLastReceipt(null);
    setStationMessage(next === 'checkout'
      ? 'Select a borrower or scan a library card, then scan one or more books.'
      : 'Scan each returned book. No library card is needed.');
    requestAnimationFrame(() => next === 'return' ? focusBookScanner() : memberInputRef.current?.focus());
  };

  const processMemberCard = (raw: string) => {
    const value = raw.trim().toUpperCase();
    if (!value) return;
    const matchedBorrower = borrowers.find(name => memberCode(name) === value);
    if (!matchedBorrower) {
      setStationMessage('Library card not recognized. Select the borrower or scan a valid member card.');
      setMemberScan('');
      memberInputRef.current?.focus();
      return;
    }
    setSelectedBorrower(matchedBorrower);
    setMemberScan('');
    setStationMessage(`✓ ${matchedBorrower} selected. Now scan the Library Book barcode.`);
    requestAnimationFrame(focusBookScanner);
  };

  const processBook = async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (operation === 'checkout' && !selectedBorrower) {
      setStationMessage('Select a borrower or scan a library card first.');
      setBookScan('');
      memberInputRef.current?.focus();
      return;
    }

    const result = await onScan(value, selectedBorrower, dueDays, operation);
    if (result.success) {
      setLastReceipt(result);
      setStationMessage(operation === 'checkout'
        ? `✓ ${result.title} checked out to ${result.borrower}. Scan the next book.`
        : `✓ ${result.title} checked in${result.borrower ? ` from ${result.borrower}` : ''}. Scan the next returned book.`);
    } else {
      setStationMessage(result.message || 'The scan could not be completed.');
    }
    setBookScan('');
    requestAnimationFrame(focusBookScanner);
  };

  const actionSentence = lastReceipt?.action === 'Checkout'
    ? `${lastReceipt.title} checked out to ${lastReceipt.borrower}.`
    : `${lastReceipt?.title || 'Book'} checked in${lastReceipt?.borrower ? ` from ${lastReceipt.borrower}` : ''}.`;

  return (
    <div className="mx-auto my-6 max-w-lg rounded-lg bg-secondary-blue p-4 shadow-md">
      <h2 className="mb-4 text-center text-2xl font-bold text-text-dark">Library Scan Station</h2>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-white p-2">
        <button type="button" onClick={() => switchMode('checkout')} className={`min-h-12 rounded-lg text-lg font-bold ${operation === 'checkout' ? 'bg-primary-green text-white' : 'bg-gray-100 text-gray-700'}`}>Check Out</button>
        <button type="button" onClick={() => switchMode('return')} className={`min-h-12 rounded-lg text-lg font-bold ${operation === 'return' ? 'bg-accent-yellow text-text-dark' : 'bg-gray-100 text-gray-700'}`}>Check In</button>
      </div>

      <p className="mb-4 rounded-lg bg-white p-3 text-center font-semibold" aria-live="polite">{stationMessage}</p>

      {operation === 'checkout' && (
        <section className="mb-4 space-y-4 rounded-xl bg-white p-4">
          <h3 className="text-xl font-bold">Borrower</h3>
          <div>
            <label htmlFor="borrower" className="mb-2 block font-semibold">Select Borrower</label>
            <select id="borrower" value={selectedBorrower} onChange={event => { setSelectedBorrower(event.target.value); requestAnimationFrame(focusBookScanner); }} className="w-full rounded-lg border p-3 text-lg">
              <option value="">Choose borrower</option>
              {borrowers.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          <div className="text-center text-sm font-bold text-gray-500">OR</div>

          <form onSubmit={event => { event.preventDefault(); processMemberCard(memberScan); }}>
            <label htmlFor="memberScan" className="mb-2 block font-semibold">Scan Library Card</label>
            <input
              id="memberScan"
              ref={memberInputRef}
              value={memberScan}
              onChange={event => setMemberScan(event.target.value)}
              className="w-full rounded-lg border-2 border-accent-yellow p-4 text-center font-mono text-xl"
              placeholder="MEM-MARIAH"
              autoComplete="off"
              autoCapitalize="off"
              inputMode="none"
            />
          </form>

          {selectedBorrower && <p className="rounded-lg bg-green-50 p-3 text-center font-bold text-primary-green">✓ Selected: {selectedBorrower}</p>}

          <div>
            <label htmlFor="dueDays" className="mb-2 block font-semibold">Due in days</label>
            <input id="dueDays" type="number" min="1" max="365" value={dueDays} onChange={event => setDueDays(Number(event.target.value))} className="w-full rounded-lg border p-3 text-lg" />
          </div>
        </section>
      )}

      <form onSubmit={event => { event.preventDefault(); void processBook(bookScan); }} className="space-y-4 rounded-xl bg-white p-4">
        <div>
          <label htmlFor="bookScan" className="mb-2 block text-lg font-bold">{operation === 'checkout' ? 'Scan Library Book Barcode' : 'Scan Returned Book Barcode'}</label>
          <input
            id="bookScan"
            ref={bookInputRef}
            value={bookScan}
            onChange={event => setBookScan(event.target.value)}
            className="w-full rounded-lg border-2 border-primary-green p-4 text-center font-mono text-2xl shadow-lg"
            placeholder="Scan book label"
            autoComplete="off"
            autoCapitalize="off"
            inputMode="none"
            spellCheck="false"
          />
          <p className="mt-2 text-center text-xs text-gray-500">The barcode identifies the book, but it will not appear in the confirmation or receipt.</p>
        </div>
        <button type="submit" className="w-full rounded-lg bg-primary-green px-6 py-4 text-xl font-bold text-white">Process Book Scan</button>
      </form>

      {lastReceipt?.success && (
        <div className="mt-6 rounded-xl border-2 border-primary-green bg-white p-5 text-center">
          <p className="text-2xl font-black">{lastReceipt.action === 'Checkout' ? 'Checked Out' : 'Checked In'}</p>
          <p className="mt-3 text-xl font-bold">{lastReceipt.title}</p>
          <p className="mt-2 text-lg">Borrower: <strong>{lastReceipt.borrower || '—'}</strong></p>
          {lastReceipt.action === 'Checkout' && lastReceipt.dueDate && <p className="mt-1">Due: <strong>{lastReceipt.dueDate}</strong></p>}
          <button type="button" onClick={() => window.print()} className="mt-4 w-full rounded-lg bg-text-dark px-4 py-3 font-bold text-white">Print Receipt</button>
        </div>
      )}

      {lastReceipt?.success && (
        <section className="thermal-receipt" aria-label="Thermal receipt">
          <h1>Mariah's Library</h1>
          <div className="receipt-rule" />
          <h2>{lastReceipt.action === 'Checkout' ? 'Checkout Receipt' : 'Check-In Receipt'}</h2>
          <p style={{ textAlign: 'center', fontSize: '18pt', fontWeight: 'bold' }}>{actionSentence}</p>
          <p><strong>Book:</strong> {lastReceipt.title}</p>
          <p><strong>Borrower:</strong> {lastReceipt.borrower || '—'}</p>
          {lastReceipt.action === 'Checkout' && <p><strong>Due:</strong> {lastReceipt.dueDate}</p>}
          <p><strong>Date:</strong> {lastReceipt.timestamp || new Date().toLocaleString()}</p>
          <div className="receipt-rule" />
          <p className="receipt-thanks">{lastReceipt.action === 'Checkout' ? 'Happy reading!' : 'Thank you for returning your book!'}</p>
        </section>
      )}
    </div>
  );
};

export default ScanStation;
