import React from 'react';
import { Book } from '../types';
import Barcode from './Barcode';

interface AddBookViewProps {
  onAddBook: (book: Book) => Promise<{ success: boolean; message?: string }>;
  isLoading: boolean;
}

interface BookLookupResult {
  title: string;
  author?: string;
  publisher?: string;
  publicationYear?: string;
  genre?: string;
  description?: string;
  source: 'Google Books' | 'Open Library';
}

interface GoogleBooksResponse {
  items?: Array<{
    volumeInfo?: {
      title?: string;
      authors?: string[];
      publisher?: string;
      publishedDate?: string;
      categories?: string[];
      description?: string;
    };
  }>;
}

interface OpenLibraryResponse {
  title?: string;
  authors?: Array<{ name?: string }>;
  publishers?: Array<{ name?: string }>;
  publish_date?: string;
  subjects?: Array<{ name?: string }>;
  notes?: string | { value?: string };
}

const createLibraryId = () => `ML-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const createEmptyBook = (): Book => ({
  barcode: '',
  bookId: createLibraryId(),
  title: '',
  author: '',
  publisher: '',
  publicationYear: '',
  genre: '',
  status: 'On Shelf',
  borrower: '',
  checkoutDate: '',
  dueDate: '',
  notes: '',
});

const normalizeIsbn = (value: string) => value.replace(/[^0-9Xx]/g, '').toUpperCase();
const isValidIsbnLength = (value: string) => value.length === 10 || value.length === 13;
const extractYear = (value?: string) => value?.match(/\d{4}/)?.[0] ?? '';

const AddBookView: React.FC<AddBookViewProps> = ({ onAddBook, isLoading }) => {
  const [book, setBook] = React.useState<Book>(() => createEmptyBook());
  const [isbn, setIsbn] = React.useState('');
  const [savedBook, setSavedBook] = React.useState<Book | null>(null);
  const [formMessage, setFormMessage] = React.useState('');
  const [lookupMessage, setLookupMessage] = React.useState('Ready to scan the ISBN barcode on the back of the book.');
  const [isLookingUp, setIsLookingUp] = React.useState(false);
  const isbnRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLInputElement>(null);
  const scanTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    isbnRef.current?.focus();
    return () => {
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
    };
  }, []);

  const update = (field: keyof Book, value: string) => {
    setBook(current => ({ ...current, [field]: value }));
  };

  const lookupGoogleBooks = async (value: string): Promise<BookLookupResult | null> => {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(value)}&maxResults=1`);
    if (!response.ok) return null;
    const data = await response.json() as GoogleBooksResponse;
    const info = data.items?.[0]?.volumeInfo;
    if (!info?.title) return null;
    return {
      title: info.title,
      author: info.authors?.join(', '),
      publisher: info.publisher,
      publicationYear: extractYear(info.publishedDate),
      genre: info.categories?.join(', '),
      description: info.description,
      source: 'Google Books',
    };
  };

  const lookupOpenLibrary = async (value: string): Promise<BookLookupResult | null> => {
    const response = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(value)}&jscmd=data&format=json`);
    if (!response.ok) return null;
    const data = await response.json() as Record<string, OpenLibraryResponse>;
    const info = data[`ISBN:${value}`];
    if (!info?.title) return null;
    const notes = typeof info.notes === 'string' ? info.notes : info.notes?.value;
    return {
      title: info.title,
      author: info.authors?.map(author => author.name).filter(Boolean).join(', '),
      publisher: info.publishers?.map(publisher => publisher.name).filter(Boolean).join(', '),
      publicationYear: extractYear(info.publish_date),
      genre: info.subjects?.slice(0, 4).map(subject => subject.name).filter(Boolean).join(', '),
      description: notes,
      source: 'Open Library',
    };
  };

  const lookUpIsbn = async (rawIsbn?: string) => {
    const value = normalizeIsbn(rawIsbn ?? isbn);
    if (!isValidIsbnLength(value)) {
      setLookupMessage('Scan or enter a valid 10- or 13-digit ISBN.');
      isbnRef.current?.focus();
      return;
    }

    setIsbn(value);
    setIsLookingUp(true);
    setLookupMessage('Looking up book information…');
    setFormMessage('');

    try {
      let result: BookLookupResult | null = null;
      try {
        result = await lookupGoogleBooks(value);
      } catch {
        result = null;
      }
      if (!result) {
        setLookupMessage('Trying a second book database…');
        try {
          result = await lookupOpenLibrary(value);
        } catch {
          result = null;
        }
      }

      if (!result) {
        setLookupMessage('Book information was not found online. Your Library Book ID is already created; enter the title manually and save.');
        titleRef.current?.focus();
        return;
      }

      setBook(current => ({
        ...current,
        title: result.title || current.title,
        author: result.author || current.author,
        publisher: result.publisher || current.publisher,
        publicationYear: result.publicationYear || current.publicationYear,
        genre: result.genre || current.genre,
        notes: current.notes || result.description || `ISBN: ${value}`,
      }));
      setLookupMessage(`✓ Book information found using ${result.source}. Library Book ID ${book.bookId} is ready.`);
      titleRef.current?.focus();
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleIsbnChange = (value: string) => {
    const normalized = normalizeIsbn(value);
    setIsbn(normalized);
    setLookupMessage('Waiting for the complete ISBN…');
    if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
    if (isValidIsbnLength(normalized)) {
      scanTimerRef.current = window.setTimeout(() => void lookUpIsbn(normalized), 250);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const bookId = book.bookId.trim() || createLibraryId();
    const isbnNote = isbn ? `ISBN: ${isbn}` : '';
    const notes = [book.notes.trim(), isbnNote].filter(Boolean).join('\n');
    const bookToSave: Book = { ...book, bookId, barcode: bookId, notes };
    const result = await onAddBook(bookToSave);
    setFormMessage(result.message || '');
    if (result.success) {
      setSavedBook(bookToSave);
      setBook(createEmptyBook());
      setIsbn('');
      setLookupMessage('Ready to scan the next ISBN barcode. A new Library Book ID has been created.');
      requestAnimationFrame(() => isbnRef.current?.focus());
    }
  };

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-xl bg-secondary-blue p-5 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-bold">Add a Book</h2>
      <p className="mb-5 text-center text-sm">Scan the ISBN to look up details. The Library Book ID is created automatically before you save.</p>

      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl border-2 border-primary-green bg-white p-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide">Automatically Created Library Book ID</p>
          <p className="mt-1 font-mono text-xl font-bold">{book.bookId}</p>
          <p className="mt-1 text-xs">This becomes the barcode used for check-in and check-out.</p>
        </div>

        <label className="block rounded-xl bg-white/80 p-4">
          <span className="mb-1 block text-lg font-bold">1. Scan ISBN</span>
          <input
            ref={isbnRef}
            value={isbn}
            onChange={event => handleIsbnChange(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
                void lookUpIsbn(event.currentTarget.value);
              }
            }}
            inputMode="none"
            autoComplete="off"
            className="w-full rounded-lg border p-4 text-lg"
            placeholder="Scan the book's ISBN barcode"
            aria-describedby="isbn-status"
          />
          <p id="isbn-status" className="mt-2 text-sm font-semibold" aria-live="polite">{isLookingUp ? '📖 ' : ''}{lookupMessage}</p>
          <button type="button" disabled={isLookingUp || !isValidIsbnLength(isbn)} onClick={() => void lookUpIsbn()} className="mt-3 rounded-lg bg-accent-yellow px-4 py-2 font-bold disabled:opacity-50">
            {isLookingUp ? 'Looking Up…' : 'Look Up ISBN'}
          </button>
        </label>

        <label className="block">
          <span className="mb-1 block font-semibold">2. Book Title *</span>
          <input ref={titleRef} value={book.title} onChange={event => update('title', event.target.value)} required autoComplete="off" className="w-full rounded-lg border p-4 text-lg" placeholder="Filled automatically or enter manually" />
        </label>

        <label className="block">
          <span className="mb-1 block font-semibold">Author <span className="font-normal">(optional)</span></span>
          <input value={book.author} onChange={event => update('author', event.target.value)} autoComplete="off" className="w-full rounded-lg border p-3" placeholder="Filled automatically when available" />
        </label>

        <details className="rounded-lg bg-white/70 p-4">
          <summary className="cursor-pointer font-semibold">Review or add optional details</summary>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label><span className="mb-1 block font-semibold">Publisher</span><input value={book.publisher} onChange={event => update('publisher', event.target.value)} className="w-full rounded-lg border p-3" /></label>
            <label><span className="mb-1 block font-semibold">Publication Year</span><input value={book.publicationYear} onChange={event => update('publicationYear', event.target.value)} className="w-full rounded-lg border p-3" /></label>
            <label><span className="mb-1 block font-semibold">Genre</span><input value={book.genre} onChange={event => update('genre', event.target.value)} className="w-full rounded-lg border p-3" /></label>
            <label className="md:col-span-2"><span className="mb-1 block font-semibold">Notes</span><textarea value={book.notes} onChange={event => update('notes', event.target.value)} className="w-full rounded-lg border p-3" rows={3} /></label>
          </div>
        </details>

        <button disabled={isLoading || isLookingUp} className="w-full rounded-lg bg-primary-green p-4 text-lg font-bold text-white disabled:opacity-60">{isLoading ? 'Saving…' : '3. Save Book & Create Library Barcode'}</button>
      </form>

      {formMessage && <p className="mt-4 text-center font-semibold">{formMessage}</p>}

      {savedBook && (
        <>
          <div className="mt-5 rounded-xl bg-white p-5 text-center shadow">
            <p className="text-lg font-bold">Book saved!</p>
            <p className="mb-3">Attach this library label to <strong>{savedBook.title}</strong>.</p>
            <Barcode value={savedBook.barcode} className="mx-auto max-w-full" />
            <button type="button" onClick={() => window.print()} className="mt-3 rounded-lg bg-accent-yellow px-5 py-3 font-bold">Print 4×6 Book Label</button>
          </div>
          <section className="thermal-receipt" aria-label="Thermal book label">
            <h1>Mariah's Library</h1><div className="receipt-rule" /><h2>{savedBook.title}</h2>
            {savedBook.author && <p style={{ textAlign: 'center' }}>by {savedBook.author}</p>}
            <Barcode value={savedBook.barcode} className="mx-auto" height={95} width={3} />
            <p className="receipt-thanks">Scan to check out or return</p>
          </section>
        </>
      )}
    </div>
  );
};

export default AddBookView;
