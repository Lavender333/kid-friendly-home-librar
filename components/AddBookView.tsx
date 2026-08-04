import React from 'react';
import { Book } from '../types';
import Barcode from './Barcode';
import { lookupIsbn, normalizeIsbn } from '../services/isbnService';

interface AddBookViewProps {
  onAddBook: (book: Book) => Promise<{ success: boolean; message?: string }>;
  isLoading: boolean;
}

const emptyBook: Book = {
  barcode: '', bookId: '', title: '', author: '', publisher: '', publicationYear: '',
  genre: '', status: 'On Shelf', borrower: '', checkoutDate: '', dueDate: '', notes: '',
};

const createLibraryId = () => `ML-${Date.now().toString(36).toUpperCase()}`;

const AddBookView: React.FC<AddBookViewProps> = ({ onAddBook, isLoading }) => {
  const [book, setBook] = React.useState<Book>(emptyBook);
  const [savedBook, setSavedBook] = React.useState<Book | null>(null);
  const [formMessage, setFormMessage] = React.useState('');
  const [lookupMessage, setLookupMessage] = React.useState('');
  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { titleRef.current?.focus(); }, []);

  const update = (field: keyof Book, value: string) => {
    setBook(current => ({ ...current, [field]: value }));
  };

  const findByIsbn = async () => {
    const isbn = normalizeIsbn(book.barcode);
    setBook(current => ({ ...current, barcode: isbn }));
    setLookupMessage('');
    setIsLookingUp(true);
    try {
      const details = await lookupIsbn(isbn);
      setBook(current => ({
        ...current,
        barcode: isbn,
        bookId: current.bookId.trim() || isbn,
        title: details.title,
        author: details.author,
        publisher: details.publisher,
        publicationYear: details.publicationYear,
        genre: details.genre,
      }));
      setLookupMessage(`Found “${details.title}”. Check the details, then save the book.`);
      requestAnimationFrame(() => titleRef.current?.focus());
    } catch (error) {
      setLookupMessage((error as Error).message);
    } finally {
      setIsLookingUp(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const existingCode = book.barcode.trim();
    const bookId = book.bookId.trim() || existingCode || createLibraryId();
    const bookToSave = { ...book, bookId, barcode: existingCode || bookId };
    const result = await onAddBook(bookToSave);
    setFormMessage(result.message || '');
    if (result.success) {
      setSavedBook(bookToSave);
      setBook(emptyBook);
      requestAnimationFrame(() => titleRef.current?.focus());
    }
  };

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-xl bg-secondary-blue p-5 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-bold">Add a Book</h2>
      <p className="mb-5 text-center text-sm">No barcode needed. Enter the title and the library will create one for you.</p>

      <form onSubmit={submit} className="space-y-4">
        <section className="rounded-xl bg-white/75 p-4">
          <label htmlFor="isbn-lookup" className="mb-1 block font-semibold">Scan or enter an ISBN <span className="font-normal">(optional)</span></label>
          <p className="mb-3 text-sm">This fills in the book details automatically. A non-ISBN barcode can still be saved with the book.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="isbn-lookup"
              value={book.barcode}
              onChange={event => {
                update('barcode', event.target.value);
                setLookupMessage('');
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void findByIsbn();
                }
              }}
              inputMode="numeric"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border p-3 text-lg"
              placeholder="Scan or type the ISBN"
            />
            <button
              type="button"
              onClick={() => void findByIsbn()}
              disabled={isLookingUp || !book.barcode.trim()}
              className="rounded-lg bg-accent-yellow px-5 py-3 font-bold disabled:opacity-60"
            >
              {isLookingUp ? 'Finding…' : 'Find Book'}
            </button>
          </div>
          {lookupMessage && <p className="mt-3 font-semibold" role="status" aria-live="polite">{lookupMessage}</p>}
        </section>

        <label className="block">
          <span className="mb-1 block font-semibold">Book Title *</span>
          <input
            ref={titleRef}
            value={book.title}
            onChange={event => update('title', event.target.value)}
            required
            autoComplete="off"
            className="w-full rounded-lg border p-4 text-lg"
            placeholder="Enter the book title"
          />
        </label>

        <label className="block">
          <span className="mb-1 block font-semibold">Author <span className="font-normal">(optional)</span></span>
          <input
            value={book.author}
            onChange={event => update('author', event.target.value)}
            autoComplete="off"
            className="w-full rounded-lg border p-3"
            placeholder="Author's name"
          />
        </label>

        <details className="rounded-lg bg-white/70 p-4">
          <summary className="cursor-pointer font-semibold">Optional details</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block font-semibold">Custom Book ID</span>
              <input
                value={book.bookId}
                onChange={event => update('bookId', event.target.value)}
                autoComplete="off"
                className="w-full rounded-lg border p-3"
                placeholder="Created automatically if blank"
              />
            </label>
            <label className="md:col-start-1">
              <span className="mb-1 block font-semibold">Publisher</span>
              <input value={book.publisher} onChange={event => update('publisher', event.target.value)} className="w-full rounded-lg border p-3" />
            </label>
            <label>
              <span className="mb-1 block font-semibold">Publication Year</span>
              <input value={book.publicationYear} onChange={event => update('publicationYear', event.target.value)} className="w-full rounded-lg border p-3" />
            </label>
            <label>
              <span className="mb-1 block font-semibold">Genre</span>
              <input value={book.genre} onChange={event => update('genre', event.target.value)} className="w-full rounded-lg border p-3" />
            </label>
            <label className="md:col-span-2">
              <span className="mb-1 block font-semibold">Notes</span>
              <textarea value={book.notes} onChange={event => update('notes', event.target.value)} className="w-full rounded-lg border p-3" rows={3} />
            </label>
          </div>
        </details>

        <button disabled={isLoading} className="w-full rounded-lg bg-primary-green p-4 text-lg font-bold text-white disabled:opacity-60">
          {isLoading ? 'Saving…' : 'Save Book & Create Barcode'}
        </button>
      </form>

      {formMessage && <p className="mt-4 text-center font-semibold">{formMessage}</p>}

      {savedBook && (
        <div className="mt-5 rounded-xl bg-white p-5 text-center shadow">
          <p className="text-lg font-bold">Book saved!</p>
          <p className="mb-3">Attach this label to <strong>{savedBook.title}</strong>.</p>
          <Barcode value={savedBook.barcode} className="mx-auto max-w-full" />
          <button type="button" onClick={() => window.print()} className="mt-3 rounded-lg bg-accent-yellow px-5 py-3 font-bold">
            Print 4×6 Book Label
          </button>
        </div>
      )}

      {savedBook && (
        <section className="thermal-receipt" aria-label="Thermal book label">
          <h1>Mariah's Library</h1>
          <div className="receipt-rule" />
          <h2>{savedBook.title}</h2>
          {savedBook.author && <p style={{ textAlign: 'center' }}>by {savedBook.author}</p>}
          <Barcode value={savedBook.barcode} className="mx-auto" height={95} width={3} />
          <p className="receipt-thanks">Scan to check out or return</p>
        </section>
      )}
    </div>
  );
};

export default AddBookView;
