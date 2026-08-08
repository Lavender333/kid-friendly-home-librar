import React from 'react';
import { flushSync } from 'react-dom';
import { Book } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Barcode from './Barcode';
import { CRICUT_LABELS_PER_PAGE, downloadCricutLabelPage } from '../services/cricutLabelService';

interface LibraryViewProps {
  books: Book[];
  borrowers: string[];
  isLoading: boolean;
  onUpdateStatus: (bookId: string, status: string, borrower?: string, dueDays?: number) => Promise<{ success: boolean; message?: string }>;
  onEditBook: (bookId: string, book: Book) => Promise<{ success: boolean; message?: string }>;
  onArchiveBook: (bookId: string, archived: boolean) => Promise<{ success: boolean; message?: string }>;
  onDeleteBook: (bookId: string) => Promise<{ success: boolean; message?: string }>;
}

const editableFields: Array<[keyof Book, string]> = [
  ['title', 'Title'], ['author', 'Author'], ['publisher', 'Publisher'],
  ['publicationYear', 'Publication Year'], ['genre', 'Genre'], ['notes', 'Notes'],
];

const LibraryView: React.FC<LibraryViewProps> = ({ books, borrowers, isLoading, onUpdateStatus, onEditBook, onArchiveBook, onDeleteBook }) => {
  const [showArchived, setShowArchived] = React.useState(false);
  const [editingBook, setEditingBook] = React.useState<Book | null>(null);
  const [labelBooks, setLabelBooks] = React.useState<Book[]>([]);
  const [receiptBook, setReceiptBook] = React.useState<Book | null>(null);
  const [selectedBookIds, setSelectedBookIds] = React.useState<string[]>([]);
  const [confirmArchiveId, setConfirmArchiveId] = React.useState('');
  const [confirmDeleteId, setConfirmDeleteId] = React.useState('');
  const [checkoutBook, setCheckoutBook] = React.useState<Book | null>(null);
  const [checkoutBorrower, setCheckoutBorrower] = React.useState('');
  const [checkoutDueDays, setCheckoutDueDays] = React.useState(14);
  const [cricutMessage, setCricutMessage] = React.useState('');
  const [actionMessage, setActionMessage] = React.useState('');
  const editRef = React.useRef<HTMLFormElement>(null);
  const checkoutRef = React.useRef<HTMLFormElement>(null);
  const labelRef = React.useRef<HTMLElement>(null);
  const archivedCount = books.filter(book => book.status === 'Archived').length;
  const activeBooks = books.filter(book => book.status !== 'Archived');
  const visibleBooks = showArchived ? books : activeBooks;
  const selectedBooks = activeBooks.filter(book => selectedBookIds.includes(book.bookId));

  React.useEffect(() => { if (editingBook) window.setTimeout(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }, [editingBook]);
  React.useEffect(() => { if (checkoutBook) window.setTimeout(() => checkoutRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }, [checkoutBook]);
  React.useEffect(() => { if (labelBooks.length) window.setTimeout(() => labelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); }, [labelBooks]);
  React.useEffect(() => {
    const finishPrinting = () => {
      delete document.body.dataset.libraryPrintTarget;
      setReceiptBook(null);
    };
    window.addEventListener('afterprint', finishPrinting);
    return () => {
      window.removeEventListener('afterprint', finishPrinting);
      delete document.body.dataset.libraryPrintTarget;
    };
  }, []);

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBook || isLoading) return;
    setActionMessage('Saving changes…');
    const response = await onEditBook(editingBook.bookId, editingBook);
    setActionMessage(response.message || (response.success ? 'Changes saved.' : 'Could not save changes.'));
    if (response.success) {
      setEditingBook(null);
      setConfirmDeleteId('');
    }
  };

  const archive = async (book: Book) => {
    if (isLoading) return;
    setActionMessage(`Archiving ${book.title}…`);
    const response = await onArchiveBook(book.bookId, true);
    setActionMessage(response.message || (response.success ? 'Book archived.' : 'Could not archive book.'));
    if (response.success) {
      setConfirmArchiveId('');
      setSelectedBookIds(current => current.filter(bookId => bookId !== book.bookId));
    }
  };

  const restore = async (book: Book) => {
    if (isLoading) return;
    setActionMessage(`Restoring ${book.title}…`);
    const response = await onArchiveBook(book.bookId, false);
    setActionMessage(response.message || (response.success ? 'Book restored.' : 'Could not restore book.'));
  };

  const deleteBook = async (book: Book) => {
    if (isLoading || book.status === 'Checked Out') return;
    setActionMessage(`Deleting ${book.title}…`);
    const response = await onDeleteBook(book.bookId);
    setActionMessage(response.message || (response.success ? 'Book deleted.' : 'Could not delete book.'));
    if (response.success) {
      setConfirmDeleteId('');
      setLabelBooks(current => current.filter(item => item.bookId !== book.bookId));
      setSelectedBookIds(current => current.filter(bookId => bookId !== book.bookId));
      if (editingBook?.bookId === book.bookId) setEditingBook(null);
    }
  };

  const chooseStatus = (book: Book, status: string) => {
    if (status !== 'Checked Out') {
      void onUpdateStatus(book.bookId, status);
      return;
    }
    setCheckoutBook(book);
    setCheckoutBorrower(book.borrower || borrowers[0] || '');
    setCheckoutDueDays(14);
  };

  const confirmCheckout = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!checkoutBook || !checkoutBorrower.trim()) return;
    const response = await onUpdateStatus(checkoutBook.bookId, 'Checked Out', checkoutBorrower.trim(), checkoutDueDays);
    if (response.success) setCheckoutBook(null);
  };

  const openLabels = (selected: Book[]) => setLabelBooks(selected.filter(book => book.bookId && book.status !== 'Archived'));
  const toggleSelectedBook = (bookId: string) => setSelectedBookIds(current => current.includes(bookId) ? current.filter(id => id !== bookId) : [...current, bookId]);
  const printLabels = () => {
    document.body.dataset.libraryPrintTarget = 'labels';
    window.setTimeout(() => window.print(), 100);
  };
  const printReceipt = (book: Book) => {
    const printWindow = window.open('', '_blank', 'width=520,height=760');
    flushSync(() => setReceiptBook(book));

    const receipt = document.querySelector<HTMLElement>('.library-book-receipt');
    if (!printWindow || !receipt) {
      document.body.dataset.libraryPrintTarget = 'receipt';
      window.print();
      return;
    }

    delete document.body.dataset.libraryPrintTarget;
    const receiptMarkup = receipt.outerHTML;
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mariah's Library Receipt</title>
  <style>
    @page { size: 4in 6in; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; }
    body { width: 4in; min-height: 6in; font-family: Arial, sans-serif; }
    .thermal-receipt { display: block !important; box-sizing: border-box; width: 4in; min-height: 6in; padding: .35in; color: #000; background: #fff; font-family: Arial, sans-serif; font-size: 15pt; line-height: 1.35; }
    .thermal-receipt h1 { margin: 0; text-align: center; font-size: 25pt; }
    .thermal-receipt h2 { text-align: center; font-size: 20pt; }
    .receipt-rule { margin: .2in 0; border-top: 3px solid #000; }
    .receipt-thanks { margin-top: .35in; text-align: center; font-size: 18pt; font-weight: bold; }
    svg { display: block; max-width: 100%; height: auto; margin-left: auto; margin-right: auto; }
  </style>
</head>
<body>${receiptMarkup}</body>
</html>`);
    printWindow.document.close();

    const runPrint = () => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => setReceiptBook(null), 250);
    };

    if (printWindow.document.readyState === 'complete') window.setTimeout(runPrint, 50);
    else printWindow.addEventListener('load', runPrint, { once: true });
  };
  const cricutPages = React.useMemo(() => {
    const pages: Book[][] = [];
    for (let index = 0; index < labelBooks.length; index += CRICUT_LABELS_PER_PAGE) pages.push(labelBooks.slice(index, index + CRICUT_LABELS_PER_PAGE));
    return pages;
  }, [labelBooks]);

  const saveCricutPage = async (page: Book[], pageIndex: number) => {
    setCricutMessage('Creating your Cricut page…');
    try {
      await downloadCricutLabelPage(page, pageIndex + 1);
      setCricutMessage(`Cricut page ${pageIndex + 1} is ready.`);
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') setCricutMessage('Cricut save canceled.');
      else setCricutMessage(`Could not create the Cricut page: ${(error as Error).message}`);
    }
  };

  if (isLoading && books.length === 0) return <LoadingSpinner />;

  return (
    <div className="relative my-6 overflow-x-auto rounded-lg bg-white p-4 shadow-md">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-text-dark">Mariah&apos;s Library</h2>
          <p className="mt-1 text-sm text-gray-600">Print one compact label or export all active book labels on one or more sheets.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openLabels(selectedBooks)} disabled={selectedBooks.length === 0} className="min-h-11 rounded-lg bg-primary-green px-4 font-bold text-white disabled:opacity-40">Print Selected Labels ({selectedBooks.length})</button>
          {selectedBooks.length > 0 && <button type="button" onClick={() => setSelectedBookIds([])} className="min-h-11 rounded-lg bg-gray-200 px-4 font-semibold text-text-dark">Clear Selection</button>}
          <button type="button" onClick={() => openLabels(activeBooks)} disabled={activeBooks.length === 0} className="min-h-11 rounded-lg bg-accent-yellow px-4 font-bold text-text-dark disabled:opacity-40">Export / Print All Labels</button>
          <button type="button" onClick={() => setShowArchived(current => !current)} className="min-h-11 rounded-lg bg-gray-200 px-4 font-semibold text-text-dark">{showArchived ? 'Hide Archived' : `Show Archived (${archivedCount})`}</button>
        </div>
      </div>

      {actionMessage && <p className="mb-4 rounded-lg bg-gray-100 px-4 py-3 text-center font-semibold text-text-dark" aria-live="polite">{actionMessage}</p>}

      {labelBooks.length > 0 && (
        <section ref={labelRef} className="mb-6 scroll-mt-28 rounded-xl border-2 border-accent-yellow bg-yellow-50 p-4 shadow-lg">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Book Label Sheet</h3>
              <p className="text-sm text-gray-600">{labelBooks.length} compact label{labelBooks.length === 1 ? '' : 's'} selected. Letter paper fits up to 18 per page.</p>
            </div>
            <button type="button" onClick={() => setLabelBooks([])} className="rounded-lg bg-gray-200 px-3 py-2 font-semibold">Close</button>
          </div>
          <div className="printable-book-labels">
            {labelBooks.map(book => (
              <article key={book.bookId} className="printable-book-label">
                <p className="book-label-library">Mariah&apos;s Library</p>
                <p className="book-label-title">{book.title}</p>
                <Barcode value={book.barcode || book.bookId} className="book-label-barcode" height={38} width={1.45} />
                <p className="book-label-id">{book.bookId}</p>
              </article>
            ))}
          </div>
          <div className="print-button-only mt-4 grid gap-3">
            <button type="button" onClick={printLabels} className="w-full rounded-lg bg-text-dark px-4 py-3 text-lg font-bold text-white">Print / Save Label Sheet</button>
            <details className="rounded-xl border-2 border-purple-400 bg-purple-50 p-4">
              <summary className="cursor-pointer text-lg font-bold text-purple-900">Cricut Print Then Cut</summary>
              <p className="mt-2 text-sm text-gray-700">Each transparent PNG contains up to 12 separate white rectangles. Cricut can detect each rectangle as a label edge.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {cricutPages.map((page, pageIndex) => (
                  <button key={pageIndex} type="button" onClick={() => void saveCricutPage(page, pageIndex)} className="rounded-lg bg-purple-700 px-4 py-3 font-bold text-white">
                    Save Cricut Page {pageIndex + 1}
                  </button>
                ))}
              </div>
              {cricutMessage && <p className="mt-3 font-semibold" aria-live="polite">{cricutMessage}</p>}
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-700">
                <li>Upload the PNG to Cricut Design Space as a Flat Graphic.</li>
                <li>Choose Print Then Cut and set the image width to 6 inches with the size lock on.</li>
                <li>Do not remove the white label rectangles; they are the cut boundaries.</li>
                <li>Tap Make It, then print and cut from that same Design Space session.</li>
              </ol>
            </details>
          </div>
        </section>
      )}

      {editingBook && (
        <form ref={editRef} onSubmit={saveEdit} className="mb-6 scroll-mt-28 rounded-xl border-2 border-secondary-blue bg-blue-50 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-bold">Edit Book</h3><p className="font-mono text-sm text-gray-600">Book ID: {editingBook.bookId}</p></div>
            <button type="button" onClick={() => { setEditingBook(null); setConfirmDeleteId(''); }} className="rounded-lg bg-gray-200 px-4 py-2 font-semibold">Cancel</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {editableFields.map(([field, label]) => (
              <label key={field} className={field === 'notes' ? 'md:col-span-2' : ''}>
                <span className="mb-1 block font-semibold">{label}{field === 'title' ? ' *' : ''}</span>
                {field === 'notes'
                  ? <textarea value={editingBook[field]} onChange={event => setEditingBook(current => current ? { ...current, [field]: event.target.value } : current)} rows={3} className="w-full rounded-lg border p-3" />
                  : <input value={editingBook[field]} onChange={event => setEditingBook(current => current ? { ...current, [field]: event.target.value } : current)} required={field === 'title'} className="w-full rounded-lg border p-3" autoComplete="off" />}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button type="submit" disabled={isLoading} className="rounded-lg bg-primary-green p-3 font-bold text-white disabled:opacity-50">{isLoading ? 'Saving…' : 'Save Changes'}</button>
            <button type="button" onClick={() => openLabels([editingBook])} className="rounded-lg bg-accent-yellow p-3 font-bold">Print Small Label</button>
            <button type="button" onClick={() => setConfirmDeleteId(editingBook.bookId)} disabled={isLoading || editingBook.status === 'Checked Out'} className="rounded-lg bg-error-red p-3 font-bold text-white disabled:opacity-40">Delete Book</button>
          </div>
          {confirmDeleteId === editingBook.bookId && (
            <div className="mt-4 rounded-lg border-2 border-error-red bg-red-50 p-4">
              <p className="font-bold">Delete {editingBook.title}?</p>
              <p className="mb-3 text-sm">This removes the book from Library. Its prior checkout history remains.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void deleteBook(editingBook)} disabled={isLoading || editingBook.status === 'Checked Out'} className="rounded-lg bg-error-red px-4 py-2 font-bold text-white disabled:opacity-40">{isLoading ? 'Deleting…' : 'Yes, Delete'}</button>
                <button type="button" onClick={() => setConfirmDeleteId('')} disabled={isLoading} className="rounded-lg bg-gray-200 px-4 py-2 font-semibold">Cancel</button>
              </div>
            </div>
          )}
        </form>
      )}

      {checkoutBook && (
        <form ref={checkoutRef} onSubmit={confirmCheckout} className="mb-6 scroll-mt-28 rounded-xl border-2 border-blue-500 bg-blue-50 p-4 shadow-lg">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Check Out Book</h3>
              <p className="text-sm text-gray-700">{checkoutBook.title}</p>
            </div>
            <button type="button" onClick={() => setCheckoutBook(null)} className="rounded-lg bg-gray-200 px-4 py-2 font-semibold">Cancel</button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1 block font-semibold">Borrower *</span>
              <input list="library-borrowers" value={checkoutBorrower} onChange={event => setCheckoutBorrower(event.target.value)} required autoFocus autoComplete="off" className="w-full rounded-lg border p-3" placeholder="Select or type borrower" />
              <datalist id="library-borrowers">{borrowers.map(name => <option key={name} value={name} />)}</datalist>
            </label>
            <label>
              <span className="mb-1 block font-semibold">Loan length</span>
              <select value={checkoutDueDays} onChange={event => setCheckoutDueDays(Number(event.target.value))} className="w-full rounded-lg border bg-white p-3">
                <option value={7}>7 days</option><option value={14}>14 days</option><option value={21}>21 days</option><option value={28}>28 days</option>
              </select>
            </label>
          </div>
          <button type="submit" disabled={isLoading || !checkoutBorrower.trim()} className="mt-4 w-full rounded-lg bg-primary-green p-3 text-lg font-bold text-white disabled:opacity-50">{isLoading ? 'Checking Out…' : 'Confirm Checkout'}</button>
        </form>
      )}

      {visibleBooks.length === 0 ? <p className="text-center text-gray-500">{showArchived ? 'No books have been archived.' : 'No active books yet. Use Add Book to get started.'}</p> : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-primary-green text-white"><tr>{['Select','Book ID','Barcode','Title','Author','Status','Borrower','Due Date','Actions'].map(header => <th key={header} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:text-sm">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-200 bg-white">{visibleBooks.map(book => {
            const archived = book.status === 'Archived';
            const checkedOut = book.status === 'Checked Out';
            return <tr key={book.bookId} className={archived ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'}>
              <td className="px-3 py-4 text-center">
                <input type="checkbox" checked={selectedBookIds.includes(book.bookId)} onChange={() => toggleSelectedBook(book.bookId)} disabled={archived} aria-label={`Select ${book.title} (${book.bookId}) for label printing`} className="h-6 w-6 accent-green-700 disabled:opacity-40" />
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-mono">{book.bookId}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">{book.barcode ? <Barcode value={book.barcode} className="h-14" /> : '—'}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold">{book.title}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">{book.author || '—'}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold">{archived ? <span className="rounded-full bg-gray-300 px-3 py-2">Archived</span> : <select value={book.status || 'On Shelf'} onChange={event => chooseStatus(book, event.target.value)} disabled={isLoading} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-text-dark"><option>On Shelf</option><option>Checked Out</option><option>Missing</option><option>Repair</option></select>}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">{book.borrower || '—'}</td>
              <td className="whitespace-nowrap px-3 py-4 text-sm">{book.dueDate || '—'}</td>
              <td className="min-w-72 px-3 py-3 text-sm">
                {confirmDeleteId === book.bookId && editingBook?.bookId !== book.bookId ? (
                  <div className="rounded-lg border-2 border-error-red bg-red-50 p-3">
                    <p className="font-bold">Delete {book.title}?</p>
                    <p className="mb-3 text-xs">This removes the book from Library. Its prior checkout history remains.</p>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void deleteBook(book)} disabled={isLoading || checkedOut} className="rounded-lg bg-error-red px-3 py-2 font-bold text-white disabled:opacity-40">{isLoading ? 'Deleting…' : 'Yes, Delete'}</button>
                      <button type="button" onClick={() => setConfirmDeleteId('')} disabled={isLoading} className="rounded-lg bg-gray-200 px-3 py-2">Cancel</button>
                    </div>
                  </div>
                ) : archived ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => printReceipt(book)} className="min-h-11 rounded-lg bg-secondary-blue px-3 font-bold text-text-dark">Print Receipt</button>
                    <button type="button" onClick={() => void restore(book)} disabled={isLoading} className="min-h-11 rounded-lg bg-primary-green px-4 font-bold text-white disabled:opacity-40">{isLoading ? 'Working…' : 'Restore'}</button>
                    <button type="button" onClick={() => setConfirmDeleteId(book.bookId)} disabled={isLoading} className="min-h-11 rounded-lg bg-error-red px-3 font-bold text-white disabled:opacity-40">Delete</button>
                  </div>
                ) : confirmArchiveId === book.bookId ? (
                  <div className="rounded-lg border bg-white p-2"><p className="mb-2 font-semibold">Archive this book?</p><div className="flex gap-2"><button type="button" onClick={() => void archive(book)} disabled={isLoading} className="rounded-lg bg-gray-700 px-3 py-2 font-bold text-white disabled:opacity-40">{isLoading ? 'Archiving…' : 'Yes, Archive'}</button><button type="button" onClick={() => setConfirmArchiveId('')} disabled={isLoading} className="rounded-lg bg-gray-200 px-3 py-2">Cancel</button></div></div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => openLabels([book])} className="min-h-11 rounded-lg bg-accent-yellow px-3 font-bold text-text-dark">Print Label</button>
                    <button type="button" onClick={() => printReceipt(book)} className="min-h-11 rounded-lg bg-secondary-blue px-3 font-bold text-text-dark">Print Receipt</button>
                    <button type="button" onClick={() => { setEditingBook({ ...book }); setConfirmDeleteId(''); setConfirmArchiveId(''); }} disabled={isLoading} className="min-h-11 rounded-lg bg-secondary-blue px-3 font-bold disabled:opacity-40">Edit</button>
                    <button type="button" onClick={() => { setConfirmArchiveId(book.bookId); setConfirmDeleteId(''); }} disabled={isLoading || checkedOut} title={checkedOut ? 'Check in this book before archiving it.' : undefined} className="min-h-11 rounded-lg bg-gray-200 px-3 font-bold disabled:opacity-40">Archive</button>
                    <button type="button" onClick={() => { setConfirmDeleteId(book.bookId); setConfirmArchiveId(''); }} disabled={isLoading || checkedOut} title={checkedOut ? 'Check in this book before deleting it.' : undefined} className="min-h-11 rounded-lg bg-error-red px-3 font-bold text-white disabled:opacity-40">Delete</button>
                  </div>
                )}
              </td>
            </tr>;
          })}</tbody>
        </table>
      )}

      {receiptBook && (
        <section className="thermal-receipt library-book-receipt" aria-label={`Book receipt for ${receiptBook.title}`}>
          <h1>Mariah&apos;s Library</h1>
          <div className="receipt-rule" />
          <h2>Book Receipt</h2>
          <p style={{ textAlign: 'center', fontWeight: 'bold' }}>{receiptBook.title}</p>
          {receiptBook.author && <p style={{ textAlign: 'center' }}>by {receiptBook.author}</p>}
          <p><strong>Book ID:</strong> {receiptBook.bookId}</p>
          <p><strong>Status:</strong> {receiptBook.status || 'On Shelf'}</p>
          {receiptBook.borrower && <p><strong>Borrower:</strong> {receiptBook.borrower}</p>}
          {receiptBook.dueDate && <p><strong>Due:</strong> {receiptBook.dueDate}</p>}
          <Barcode value={receiptBook.barcode || receiptBook.bookId} className="mx-auto max-w-full" height={85} width={2.5} />
          <p className="receipt-thanks">Read, Share, Grow!</p>
        </section>
      )}

      {isLoading && books.length > 0 && !editingBook && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/75"><LoadingSpinner /></div>}
    </div>
  );
};

export default LibraryView;
