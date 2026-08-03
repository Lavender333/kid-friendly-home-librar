import React, { useEffect, useRef, useState } from 'react';
import { ScanResponse } from '../types';
import Barcode from './Barcode';

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
  const [showCards, setShowCards] = useState(() => window.location.hash.includes('/library-cards'));
  const inputRef = useRef<HTMLInputElement>(null);
  const cardsRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    const openCardsFromRoute = () => {
      if (window.location.hash.includes('/library-cards')) {
        setShowCards(true);
        window.setTimeout(() => cardsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    };
    openCardsFromRoute();
    window.addEventListener('hashchange', openCardsFromRoute);
    return () => window.removeEventListener('hashchange', openCardsFromRoute);
  }, []);

  const switchMode = (next: 'checkout' | 'return') => {
    setOperation(next);
    setScanValue('');
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
        ? `✓ ${result.title} checked out to ${result.borrower}. Scan the next book.`
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

      <button type="button" onClick={() => setShowCards(value => !value)} className="mt-5 w-full rounded-lg bg-accent-yellow px-4 py-3 font-bold text-text-dark">
        {showCards ? 'Hide Library Cards' : 'Make & Print Library Cards'}
      </button>

      {showCards && (
        <section ref={cardsRef} className="mt-4 space-y-4" aria-label="Library card maker">
          <div className="rounded-xl bg-white p-4 text-center">
            <h3 className="text-xl font-bold">My Library Cards</h3>
            <p className="mt-1 text-sm">Each card includes the member name, member ID, scanning instructions, and a full-size barcode.</p>
          </div>
          {borrowers.length === 0 ? (
            <p className="rounded-lg bg-white p-4 text-center font-semibold">Add a borrower first, then return here to print a card.</p>
          ) : (
            <div className="printable-library-cards">
              {borrowers.map((name, index) => (
                <article key={name} className={`printable-library-card library-card-theme-${index % 3}`}>
                  <div className="library-card-decor library-card-decor-one" aria-hidden="true" />
                  <div className="library-card-decor library-card-decor-two" aria-hidden="true" />
                  <header className="library-card-header">
                    <div className="library-card-icon" aria-hidden="true">📚</div>
                    <div>
                      <p className="library-card-library-name">Mariah's Library</p>
                      <p className="library-card-tagline">Read • Imagine • Explore</p>
                    </div>
                  </header>

                  <div className="library-card-member-row">
                    <div>
                      <p className="library-card-label">Library Member</p>
                      <h4 className="library-card-member-name">{name}</h4>
                    </div>
                    <div className="library-card-badge">BOOK<br />BUDDY</div>
                  </div>

                  <div className="library-card-barcode-panel">
                    <Barcode value={memberCode(name)} className="library-card-barcode" height={48} width={1.8} />
                    <p className="library-card-member-code">Member ID: {memberCode(name)}</p>
                  </div>

                  <footer className="library-card-footer">
                    <span>Scan this card before checking out books.</span>
                    <span className="library-card-stars" aria-hidden="true">★ ★ ★</span>
                  </footer>
                </article>
              ))}
            </div>
          )}
          {borrowers.length > 0 && (
            <button type="button" onClick={() => window.print()} className="print-button-only w-full rounded-lg bg-text-dark px-4 py-3 font-bold text-white">
              Print Full Library Cards
            </button>
          )}
        </section>
      )}

      {lastReceipt?.success && (
        <div className="mt-6 rounded-xl border-2 border-primary-green bg-white p-4 text-center">
          <p className="text-xl font-bold">{lastReceipt.action} complete!</p>
          <p>{lastReceipt.title}</p>
          <p className="font-mono">{lastReceipt.bookId}</p>
          <button type="button" onClick={() => window.print()} className="mt-3 w-full rounded-lg bg-text-dark px-4 py-3 font-bold text-white">Print Receipt</button>
        </div>
      )}

      {lastReceipt?.success && (
        <section className="thermal-receipt" aria-label="Thermal receipt">
          <h1>Mariah's Library</h1>
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
