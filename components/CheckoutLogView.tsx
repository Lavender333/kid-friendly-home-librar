

import React from 'react';
import { LogEntry, ScanResponse } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface CheckoutLogViewProps {
  logEntries: LogEntry[];
  isLoading: boolean;
  onCheckIn: (bookId: string, borrower: string) => Promise<ScanResponse>;
}

const CheckoutLogView: React.FC<CheckoutLogViewProps> = ({ logEntries, isLoading, onCheckIn }) => {
  const [checkingInBookId, setCheckingInBookId] = React.useState('');
  const [completedBookIds, setCompletedBookIds] = React.useState<Set<string>>(() => new Set());

  const latestTransactionByBook = React.useMemo(() => {
    const latest = new Map<string, number>();
    logEntries.forEach((entry, index) => {
      const action = entry.action.trim().toLowerCase();
      if (entry.bookId && (action === 'checkout' || action === 'return')) {
        latest.set(entry.bookId, index);
      }
    });
    return latest;
  }, [logEntries]);

  React.useEffect(() => {
    // Once the refreshed log contains the Return row, forget the temporary
    // optimistic state so a future checkout of the same book can be returned.
    setCompletedBookIds(current => {
      const next = new Set(Array.from(current).filter(bookId => {
        const latestIndex = latestTransactionByBook.get(bookId);
        return latestIndex !== undefined
          && logEntries[latestIndex]?.action.trim().toLowerCase() === 'checkout';
      }));
      return next;
    });
  }, [logEntries, latestTransactionByBook]);

  const checkIn = async (bookId: string, borrower: string) => {
    setCheckingInBookId(bookId);
    const result = await onCheckIn(bookId, borrower);
    setCheckingInBookId('');
    if (result.success) {
      setCompletedBookIds(current => new Set(current).add(bookId));
    }
  };

  if (isLoading && logEntries.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md my-6 overflow-x-auto relative">
      <h2 className="text-2xl font-bold text-center mb-6 text-text-dark">Checkout Log</h2>
      {logEntries.length === 0 ? (
        <p className="text-center text-gray-500">No checkout history yet.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-primary-green text-white">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Timestamp
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Book ID
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Title
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Borrower
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Action
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Check In
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logEntries.map((entry, index) => {
              const isActiveCheckout = entry.action.trim().toLowerCase() === 'checkout'
                && latestTransactionByBook.get(entry.bookId) === index
                && !completedBookIds.has(entry.bookId);
              const isCheckingIn = checkingInBookId === entry.bookId;

              return <tr key={index} className={isActiveCheckout ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {entry.timestamp}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {entry.bookId}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {entry.title}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {entry.borrower}
                </td>
                <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold md:px-6
                  ${entry.action === 'Checkout' ? 'text-soft-pink' : 'text-primary-green'}`}>
                  {entry.action}
                </td>
                <td className="px-3 py-3 text-sm md:px-6">
                  {isActiveCheckout && (
                    <button
                      type="button"
                      onClick={() => checkIn(entry.bookId, entry.borrower)}
                      disabled={!!checkingInBookId}
                      className="min-h-11 whitespace-nowrap rounded-lg bg-accent-yellow px-4 font-bold text-text-dark disabled:opacity-50"
                    >
                      {isCheckingIn ? 'Checking In…' : 'Check In'}
                    </button>
                  )}
                  {!isActiveCheckout && <span className="text-gray-400">—</span>}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      )}
      {isLoading && logEntries.length > 0 && !checkingInBookId && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};

export default CheckoutLogView;
