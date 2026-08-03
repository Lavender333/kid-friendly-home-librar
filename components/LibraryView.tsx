import React from 'react';
import { Book } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Barcode from './Barcode';

interface LibraryViewProps {
  books: Book[];
  isLoading: boolean;
  onUpdateStatus: (bookId: string, status: string) => Promise<{ success: boolean; message?: string }>;
  onEditBook: (bookId: string, book: Book) => Promise<{ success: boolean; message?: string }>;
  onArchiveBook: (bookId: string, archived: boolean) => Promise<{ success: boolean; message?: string }>;
  onDeleteBook: (bookId: string) => Promise<{ success: boolean; message?: string }>;
}

const editableFields: Array<[keyof Book, string]> = [
  ['title', 'Title'],
  ['author', 'Author'],
  ['publisher', 'Publisher'],
  ['publicationYear', 'Publication Year'],
  ['genre', 'Genre'],
  ['notes', 'Notes'],
];

const LibraryView: React.FC<LibraryViewProps> = ({ books, isLoading, onUpdateStatus, onEditBook, onArchiveBook, onDeleteBook }) => {
  const [showArchived, setShowArchived] = React.useState(false);
  const [editingBook, setEditingBook] = React.useState<Book | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = React.useState('');
  const [confirmDeleteId, setConfirmDeleteId] = React.useState('');
  const editRef = React.useRef<HTMLFormElement>(null);
  const archivedCount = books.filter(book => book.status === 'Archived').length;
  const visibleBooks = showArchived ? books : books.filter(book => book.status !== 'Archived');

  React.useEffect(() => {
    if (editingBook) window.setTimeout(() => editRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [editingBook]);

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingBook) return;
    const response = await onEditBook(editingBook.bookId, editingBook);
    if (response.success) setEditingBook(null);
  };

  const archive = async (book: Book) => {
    const response = await onArchiveBook(book.bookId, true);
    if (response.success) setConfirmArchiveId('');
  };

  const deleteBook = async (book: Book) => {
    const response = await onDeleteBook(book.bookId);
    if (response.success) {
      setConfirmDeleteId('');
      if (editingBook?.bookId === book.bookId) setEditingBook(null);
    }
  };

  if (isLoading && books.length === 0) return <LoadingSpinner />;

  return (
    <div className="relative my-6 overflow-x-auto rounded-lg bg-white p-4 shadow-md">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-text-dark">Mariah&apos;s Library</h2>
        <button type="button" onClick={() => setShowArchived(current => !current)} className="min-h-11 rounded-lg bg-gray-200 px-4 font-semibold text-text-dark">
          {showArchived ? 'Hide Archived' : `Show Archived (${archivedCount})`}
        </button>
      </div>

      {editingBook && (
        <form ref={editRef} onSubmit={saveEdit} className="mb-6 scroll-mt-28 rounded-xl border-2 border-secondary-blue bg-blue-50 p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-bold">Edit Book</h3><p className="font-mono text-sm text-gray-600">Book ID: {editingBook.bookId}</p></div>
            <button type="button" onClick={() => setEditingBook(null)} className="rounded-lg bg-gray-200 px-4 py-2 font-semibold">Cancel</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {editableFields.map(([field, label]) => (
              <label key={field} className={field === 'notes' ? 'md:col-span-2' : ''}>
                <span className="mb-1 block font-semibold">{label}{field === 'title' ? ' *' : ''}</span>
                {field === 'notes' ? (
                  <textarea value={editingBook[field]} onChange={event => setEditingBook(current => current ? { ...current, [field]: event.target.value } : current)} rows={3} className="w-full rounded-lg border p-3" />
                ) : (
                  <input value={editingBook[field]} onChange={event => setEditingBook(current => current ? { ...current, [field]: event.target.value } : current)} required={field === 'title'} className="w-full rounded-lg border p-3" autoComplete="off" />
                )}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button disabled={isLoading} className="rounded-lg bg-primary-green p-3 font-bold text-white disabled:opacity-50">{isLoading ? 'Saving…' : 'Save Changes'}</button>
            <button type="button" onClick={() => setConfirmDeleteId(editingBook.bookId)} disabled={isLoading || editingBook.status === 'Checked Out'} className="rounded-lg bg-error-red p-3 font-bold text-white disabled:opacity-40">Delete Book</button>
          </div>
        </form>
      )}

      {visibleBooks.length === 0 ? (
        <p className="text-center text-gray-500">{showArchived ? 'No books have been archived.' : 'No active books yet. Use Add Book to get started.'}</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-primary-green text-white"><tr>{['Book ID', 'Barcode', 'Title', 'Author', 'Publisher', 'Pub. Year', 'Status', 'Borrower', 'Due Date', 'Actions'].map(header => <th key={header} className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:text-sm">{header}</th>)}</tr></thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {visibleBooks.map(book => {
              const archived = book.status === 'Archived';
              const checkedOut = book.status === 'Checked Out';
              return (
                <tr key={book.bookId} className={archived ? 'bg-gray-100 text-gray-500' : 'hover:bg-gray-50'}>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-mono">{book.bookId}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{book.barcode ? <Barcode value={book.barcode} className="h-16" /> : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold">{book.title}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{book.author || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{book.publisher || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{book.publicationYear || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold">
                    {archived ? <span className="rounded-full bg-gray-300 px-3 py-2">Archived</span> : (
                      <select value={book.status || 'On Shelf'} onChange={event => void onUpdateStatus(book.bookId, event.target.value)} disabled={isLoading} className="min-h-11 rounded-lg border bg-white px-3 py-2 text-text-dark">
                        <option>On Shelf</option><option>Missing</option><option>Repair</option>
                      </select>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{book.borrower || '—'}</td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm">{book.dueDate || '—'}</td>
                  <td className="min-w-64 px-3 py-3 text-sm">
                    {confirmDeleteId === book.bookId ? (
                      <div className="rounded-lg border-2 border-error-red bg-red-50 p-3">
                        <p className="font-bold">Delete {book.title}?</p>
                        <p className="mb-3 text-xs">The book record will be removed, but checkout history will remain.</p>
                        <div className="flex gap-2"><button type="button" onClick={() => void deleteBook(book)} disabled={isLoading || checkedOut} className="rounded-lg bg-error-red px-3 py-2 font-bold text-white disabled:opacity-40">Delete</button><button type="button" onClick={() => setConfirmDeleteId('')} className="rounded-lg bg-gray-200 px-3 py-2">Cancel</button></div>
                      </div>
                    ) : archived ? (
                      <div className="flex gap-2"><button type="button" onClick={() => void onArchiveBook(book.bookId, false)} disabled={isLoading} className="min-h-11 rounded-lg bg-primary-green px-4 font-bold text-white">Restore</button><button type="button" onClick={() => setConfirmDeleteId(book.bookId)} className="min-h-11 rounded-lg bg-error-red px-3 font-bold text-white">Delete</button></div>
                    ) : confirmArchiveId === book.bookId ? (
                      <div className="rounded-lg border bg-white p-2"><p className="mb-2 font-semibold">Archive this book?</p><div className="flex gap-2"><button type="button" onClick={() => void archive(book)} disabled={isLoading} className="rounded-lg bg-gray-700 px-3 py-2 font-bold text-white">Yes</button><button type="button" onClick={() => setConfirmArchiveId('')} className="rounded-lg bg-gray-200 px-3 py-2">Cancel</button></div></div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => setEditingBook({ ...book })} disabled={isLoading} className="min-h-11 rounded-lg bg-secondary-blue px-3 font-bold">Edit</button>
                        <button type="button" onClick={() => setConfirmArchiveId(book.bookId)} disabled={isLoading || checkedOut} className="min-h-11 rounded-lg bg-gray-200 px-3 font-bold disabled:opacity-40">Archive</button>
                        <button type="button" onClick={() => setConfirmDeleteId(book.bookId)} disabled={isLoading || checkedOut} className="min-h-11 rounded-lg bg-error-red px-3 font-bold text-white disabled:opacity-40">Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {isLoading && books.length > 0 && !editingBook && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/75"><LoadingSpinner /></div>}
    </div>
  );
};

export default LibraryView;
