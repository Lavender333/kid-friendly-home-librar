import React from 'react';
import { LogEntry, ScanResponse } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface CheckoutLogViewProps {
  logEntries: LogEntry[];
  isLoading: boolean;
  onCheckIn: (bookId: string, borrower: string) => Promise<ScanResponse>;
}

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysOverdueNow = (dueDate?: string) => {
  const due = parseDate(dueDate);
  if (!due) return 0;
  return Math.max(0, Math.ceil((Date.now() - due.getTime()) / 86400000));
};

const CheckoutLogView: React.FC<CheckoutLogViewProps> = ({ logEntries, isLoading, onCheckIn }) => {
  const [checkingInBookId, setCheckingInBookId] = React.useState('');
  const [completedBookIds, setCompletedBookIds] = React.useState<Set<string>>(() => new Set());

  const latestTransactionByBook = React.useMemo(() => {
    const latest = new Map<string, number>();
    logEntries.forEach((entry, index) => {
      const action = String(entry.action || '').trim().toLowerCase();
      if (entry.bookId && (action === 'checkout' || action === 'return')) latest.set(entry.bookId, index);
    });
    return latest;
  }, [logEntries]);

  React.useEffect(() => {
    setCompletedBookIds(current => {
      const next = new Set(Array.from(current).filter(bookId => {
        const latestIndex = latestTransactionByBook.get(bookId);
        return latestIndex !== undefined && String(logEntries[latestIndex]?.action || '').trim().toLowerCase() === 'checkout';
      }));
      return next;
    });
  }, [logEntries, latestTransactionByBook]);

  const checkIn = async (bookId: string, borrower: string) => {
    setCheckingInBookId(bookId);
    const result = await onCheckIn(bookId, borrower);
    setCheckingInBookId('');
    if (result.success) setCompletedBookIds(current => new Set(current).add(bookId));
  };

  if (isLoading && logEntries.length === 0) return <LoadingSpinner />;

  return (
    <div className="relative my-6 overflow-x-auto rounded-lg bg-white p-4 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-bold text-text-dark">Checkout & Return History</h2>
      <p className="mb-6 text-center text-sm text-gray-600">Each physical copy is tracked by its unique Library Book ID.</p>
      {logEntries.length === 0 ? <p className="text-center text-gray-500">No checkout history yet.</p> : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-primary-green text-white">
            <tr>
              {['Checkout Date','Book ID','Title','Borrower','Due Date','Return Date','Status','Check In'].map(label => (
                <th key={label} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:text-sm">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {logEntries.map((entry, index) => {
              const action = String(entry.action || '').trim().toLowerCase();
              const isActiveCheckout = action === 'checkout' && latestTransactionByBook.get(entry.bookId) === index && !completedBookIds.has(entry.bookId);
              const currentLateDays = isActiveCheckout ? daysOverdueNow(entry.dueDate) : 0;
              const recordedLateDays = Number(entry.daysLate || 0);
              const lateDays = isActiveCheckout ? currentLateDays : recordedLateDays;
              const statusText = isActiveCheckout
                ? (lateDays > 0 ? `${lateDays} day${lateDays === 1 ? '' : 's'} overdue` : 'Checked out')
                : action === 'return'
                  ? (lateDays > 0 ? `Returned ${lateDays} day${lateDays === 1 ? '' : 's'} late` : 'Returned on time')
                  : entry.action;
              const checkoutDate = entry.checkoutDate || entry.timestamp || '';
              const isCheckingIn = checkingInBookId === entry.bookId;

              return (
                <tr key={`${entry.bookId}-${index}`} className={lateDays > 0 ? 'bg-red-50 hover:bg-red-100' : isActiveCheckout ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'}>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{checkoutDate || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 font-mono text-sm font-semibold">{entry.bookId}</td>
                  <td className="px-3 py-4 text-sm">{entry.title}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{entry.borrower || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{entry.dueDate || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{entry.returnDate || (isActiveCheckout ? 'Not returned' : '—')}</td>
                  <td className={`whitespace-nowrap px-3 py-4 text-sm font-bold ${lateDays > 0 ? 'text-red-700' : isActiveCheckout ? 'text-amber-700' : 'text-primary-green'}`}>{statusText || '—'}</td>
                  <td className="px-3 py-3 text-sm">
                    {isActiveCheckout ? (
                      <button type="button" onClick={() => checkIn(entry.bookId, entry.borrower)} disabled={!!checkingInBookId} className="min-h-11 whitespace-nowrap rounded-lg bg-accent-yellow px-4 font-bold text-text-dark disabled:opacity-50">
                        {isCheckingIn ? 'Checking In…' : 'Check In'}
                      </button>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {isLoading && logEntries.length > 0 && !checkingInBookId && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white bg-opacity-75"><LoadingSpinner /></div>}
    </div>
  );
};

export default CheckoutLogView;
