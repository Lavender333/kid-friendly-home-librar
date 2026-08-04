import React from 'react';
import { LogEntry, ScanResponse } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface CheckoutLogViewProps {
  logEntries: LogEntry[];
  isLoading: boolean;
  onCheckIn: (bookId: string, borrower: string) => Promise<ScanResponse>;
}

type StatusFilter = 'all' | 'checked-out' | 'overdue' | 'returned-on-time' | 'returned-late' | 'other';
type DateFilter = 'all' | '7-days' | '30-days' | 'this-year';

interface DisplayEntry {
  entry: LogEntry;
  originalIndex: number;
  checkoutDate: string;
  isActiveCheckout: boolean;
  lateDays: number;
  statusKey: Exclude<StatusFilter, 'all'>;
  statusText: string;
  sortTime: number;
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
  const [search, setSearch] = React.useState('');
  const [borrowerFilter, setBorrowerFilter] = React.useState('all');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = React.useState<DateFilter>('all');

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

  const displayEntries = React.useMemo<DisplayEntry[]>(() => {
    return logEntries.map((entry, originalIndex) => {
      const action = String(entry.action || '').trim().toLowerCase();
      const isActiveCheckout = action === 'checkout'
        && latestTransactionByBook.get(entry.bookId) === originalIndex
        && !completedBookIds.has(entry.bookId);
      const currentLateDays = isActiveCheckout ? daysOverdueNow(entry.dueDate) : 0;
      const recordedLateDays = Number(entry.daysLate || 0);
      const lateDays = isActiveCheckout ? currentLateDays : recordedLateDays;
      const checkoutDate = entry.checkoutDate || entry.timestamp || '';

      let statusKey: DisplayEntry['statusKey'] = 'other';
      let statusText = entry.action || 'Other';

      if (isActiveCheckout && lateDays > 0) {
        statusKey = 'overdue';
        statusText = `${lateDays} day${lateDays === 1 ? '' : 's'} overdue`;
      } else if (isActiveCheckout) {
        statusKey = 'checked-out';
        statusText = 'Currently checked out';
      } else if (action === 'return' && lateDays > 0) {
        statusKey = 'returned-late';
        statusText = `Returned ${lateDays} day${lateDays === 1 ? '' : 's'} late`;
      } else if (action === 'return') {
        statusKey = 'returned-on-time';
        statusText = 'Returned on time';
      }

      const activityDate = parseDate(entry.returnDate || checkoutDate);
      return {
        entry,
        originalIndex,
        checkoutDate,
        isActiveCheckout,
        lateDays,
        statusKey,
        statusText,
        sortTime: activityDate?.getTime() || originalIndex,
      };
    }).sort((a, b) => b.sortTime - a.sortTime || b.originalIndex - a.originalIndex);
  }, [logEntries, latestTransactionByBook, completedBookIds]);

  const borrowerOptions = React.useMemo(() => {
    return Array.from(new Set(logEntries.map(entry => entry.borrower?.trim()).filter(Boolean) as string[]))
      .sort((a, b) => a.localeCompare(b));
  }, [logEntries]);

  const counts = React.useMemo(() => ({
    checkedOut: displayEntries.filter(item => item.statusKey === 'checked-out').length,
    overdue: displayEntries.filter(item => item.statusKey === 'overdue').length,
    returnedOnTime: displayEntries.filter(item => item.statusKey === 'returned-on-time').length,
    returnedLate: displayEntries.filter(item => item.statusKey === 'returned-late').length,
  }), [displayEntries]);

  const filteredEntries = React.useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    return displayEntries.filter(item => {
      const { entry } = item;
      const matchesSearch = !normalizedSearch || [entry.title, entry.bookId, entry.borrower]
        .some(value => String(value || '').toLowerCase().includes(normalizedSearch));
      const matchesBorrower = borrowerFilter === 'all' || entry.borrower === borrowerFilter;
      const matchesStatus = statusFilter === 'all' || item.statusKey === statusFilter;

      let matchesDate = true;
      if (dateFilter !== 'all') {
        const activityTime = parseDate(entry.returnDate || item.checkoutDate)?.getTime();
        if (!activityTime) {
          matchesDate = false;
        } else if (dateFilter === '7-days') {
          matchesDate = activityTime >= Date.now() - 7 * 86400000;
        } else if (dateFilter === '30-days') {
          matchesDate = activityTime >= Date.now() - 30 * 86400000;
        } else if (dateFilter === 'this-year') {
          matchesDate = activityTime >= startOfYear;
        }
      }

      return matchesSearch && matchesBorrower && matchesStatus && matchesDate;
    });
  }, [displayEntries, search, borrowerFilter, statusFilter, dateFilter]);

  const checkIn = async (bookId: string, borrower: string) => {
    setCheckingInBookId(bookId);
    const result = await onCheckIn(bookId, borrower);
    setCheckingInBookId('');
    if (result.success) setCompletedBookIds(current => new Set(current).add(bookId));
  };

  const clearFilters = () => {
    setSearch('');
    setBorrowerFilter('all');
    setStatusFilter('all');
    setDateFilter('all');
  };

  if (isLoading && logEntries.length === 0) return <LoadingSpinner />;

  return (
    <div className="relative my-6 rounded-lg bg-white p-4 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-bold text-text-dark">Checkout & Return History</h2>
      <p className="mb-5 text-center text-sm text-gray-600">Filter by borrower, status, date, title, or Library Book ID.</p>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button type="button" onClick={() => setStatusFilter('checked-out')} className={`rounded-xl border p-3 text-left shadow-sm ${statusFilter === 'checked-out' ? 'border-blue-500 bg-blue-100' : 'border-blue-200 bg-blue-50'}`}>
          <span className="block text-2xl font-black text-blue-800">{counts.checkedOut}</span><span className="text-sm font-bold text-blue-800">Currently Out</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('overdue')} className={`rounded-xl border p-3 text-left shadow-sm ${statusFilter === 'overdue' ? 'border-red-500 bg-red-100' : 'border-red-200 bg-red-50'}`}>
          <span className="block text-2xl font-black text-red-700">{counts.overdue}</span><span className="text-sm font-bold text-red-700">Overdue</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('returned-on-time')} className={`rounded-xl border p-3 text-left shadow-sm ${statusFilter === 'returned-on-time' ? 'border-green-500 bg-green-100' : 'border-green-200 bg-green-50'}`}>
          <span className="block text-2xl font-black text-green-800">{counts.returnedOnTime}</span><span className="text-sm font-bold text-green-800">Returned On Time</span>
        </button>
        <button type="button" onClick={() => setStatusFilter('returned-late')} className={`rounded-xl border p-3 text-left shadow-sm ${statusFilter === 'returned-late' ? 'border-orange-500 bg-orange-100' : 'border-orange-200 bg-orange-50'}`}>
          <span className="block text-2xl font-black text-orange-800">{counts.returnedLate}</span><span className="text-sm font-bold text-orange-800">Returned Late</span>
        </button>
      </div>

      <div className="mb-5 grid gap-3 rounded-xl bg-gray-50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <label className="xl:col-span-2">
          <span className="mb-1 block text-sm font-bold">Search</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Book title, Book ID, or borrower" className="w-full rounded-lg border bg-white p-3" />
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold">Borrower</span>
          <select value={borrowerFilter} onChange={event => setBorrowerFilter(event.target.value)} className="w-full rounded-lg border bg-white p-3">
            <option value="all">All Borrowers</option>
            {borrowerOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold">Status</span>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)} className="w-full rounded-lg border bg-white p-3">
            <option value="all">All Statuses</option>
            <option value="checked-out">Currently Checked Out</option>
            <option value="overdue">Overdue</option>
            <option value="returned-on-time">Returned On Time</option>
            <option value="returned-late">Returned Late</option>
            <option value="other">Edited / Archived / Deleted</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-sm font-bold">Date</span>
          <select value={dateFilter} onChange={event => setDateFilter(event.target.value as DateFilter)} className="w-full rounded-lg border bg-white p-3">
            <option value="all">All Time</option>
            <option value="7-days">Last 7 Days</option>
            <option value="30-days">Last 30 Days</option>
            <option value="this-year">This Year</option>
          </select>
        </label>
        <button type="button" onClick={clearFilters} className="rounded-lg bg-gray-200 px-4 py-3 font-bold md:col-span-2 xl:col-span-1">Clear Filters</button>
      </div>

      <p className="mb-3 text-sm font-semibold text-gray-600">Showing {filteredEntries.length} of {displayEntries.length} records — newest first.</p>

      {logEntries.length === 0 ? <p className="text-center text-gray-500">No checkout history yet.</p> : filteredEntries.length === 0 ? (
        <div className="rounded-xl bg-yellow-50 p-6 text-center"><p className="font-bold">No records match these filters.</p><button type="button" onClick={clearFilters} className="mt-3 rounded-lg bg-accent-yellow px-4 py-2 font-bold">Show All Records</button></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-primary-green text-white">
              <tr>{['Checkout Date','Book ID','Title','Borrower','Due Date','Return Date','Status','Check In'].map(label => <th key={label} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:text-sm">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredEntries.map(item => {
                const { entry, originalIndex, isActiveCheckout, lateDays, statusKey, statusText, checkoutDate } = item;
                const isCheckingIn = checkingInBookId === entry.bookId;
                const rowClass = statusKey === 'overdue' || statusKey === 'returned-late'
                  ? 'bg-red-50 hover:bg-red-100'
                  : statusKey === 'checked-out'
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : statusKey === 'returned-on-time'
                      ? 'bg-green-50 hover:bg-green-100'
                      : 'hover:bg-gray-50';
                const statusClass = statusKey === 'overdue' ? 'bg-red-100 text-red-800'
                  : statusKey === 'returned-late' ? 'bg-orange-100 text-orange-800'
                    : statusKey === 'checked-out' ? 'bg-blue-100 text-blue-800'
                      : statusKey === 'returned-on-time' ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-700';

                return (
                  <tr key={`${entry.bookId}-${originalIndex}`} className={rowClass}>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">{checkoutDate || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-4 font-mono text-sm font-semibold">{entry.bookId}</td>
                    <td className="px-3 py-4 text-sm font-semibold">{entry.title}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">{entry.borrower || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">{entry.dueDate || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">{entry.returnDate || (isActiveCheckout ? 'Not returned' : '—')}</td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm"><span className={`inline-block rounded-full px-3 py-2 font-bold ${statusClass}`}>{statusText || '—'}</span>{lateDays > 0 && statusKey === 'overdue' && <span className="sr-only"> Currently overdue</span>}</td>
                    <td className="px-3 py-3 text-sm">
                      {isActiveCheckout ? <button type="button" onClick={() => void checkIn(entry.bookId, entry.borrower)} disabled={!!checkingInBookId} className="min-h-11 whitespace-nowrap rounded-lg bg-accent-yellow px-4 font-bold text-text-dark disabled:opacity-50">{isCheckingIn ? 'Checking In…' : 'Check In'}</button> : <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {isLoading && logEntries.length > 0 && !checkingInBookId && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/75"><LoadingSpinner /></div>}
    </div>
  );
};

export default CheckoutLogView;
