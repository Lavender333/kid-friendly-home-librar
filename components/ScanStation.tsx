
import React, { useState, useRef, useEffect } from 'react';

interface ScanStationProps {
  onScan: (bookId: string, borrower: string, dueDays: number) => Promise<{ success: boolean; message?: string }>;
  borrowers: string[]; // This will now receive the mapped string array of borrower names
}

const ScanStation: React.FC<ScanStationProps> = ({ onScan, borrowers }) => {
  const [bookId, setBookId] = useState<string>('');
  const [selectedBorrower, setSelectedBorrower] = useState<string>(borrowers[0] || '');
  const [dueDays, setDueDays] = useState<number>(14);
  const bookIdInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Set default borrower if the list changes and the current selected is no longer valid
    if (borrowers.length > 0 && !borrowers.includes(selectedBorrower)) {
      setSelectedBorrower(borrowers[0]);
    } else if (borrowers.length === 0) {
      setSelectedBorrower(''); // Clear if no borrowers are available
    }

    if (bookIdInputRef.current) {
      bookIdInputRef.current.focus();
    }
  }, [borrowers, selectedBorrower]); // Depend on borrowers to update default selection

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
    }
    if (bookIdInputRef.current) {
      bookIdInputRef.current.focus();
    }
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
    </div>
  );
};

export default ScanStation;
