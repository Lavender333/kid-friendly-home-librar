import React from 'react';
import { Book } from '../types';

interface AddBookViewProps {
  onAddBook: (book: Book) => Promise<{ success: boolean; message?: string }>;
  isLoading: boolean;
}

const emptyBook: Book = {
  barcode: '', bookId: '', title: '', author: '', publisher: '', publicationYear: '',
  genre: '', status: 'On Shelf', borrower: '', checkoutDate: '', dueDate: '', notes: '',
};

const AddBookView: React.FC<AddBookViewProps> = ({ onAddBook, isLoading }) => {
  const [book, setBook] = React.useState<Book>(emptyBook);
  const [formMessage, setFormMessage] = React.useState('');
  const barcodeRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { barcodeRef.current?.focus(); }, []);

  const update = (field: keyof Book, value: string) => {
    setBook(current => {
      const next = { ...current, [field]: value };
      if (field === 'barcode' && (!current.bookId || current.bookId === current.barcode)) next.bookId = value;
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await onAddBook(book);
    setFormMessage(result.message || '');
    if (result.success) {
      setBook(emptyBook);
      requestAnimationFrame(() => barcodeRef.current?.focus());
    }
  };

  const fields: Array<[keyof Book, string, boolean]> = [
    ['barcode', 'Scan Existing Barcode', true], ['bookId', 'Book ID', true], ['title', 'Title', true],
    ['author', 'Author', false], ['publisher', 'Publisher', false], ['publicationYear', 'Publication Year', false],
    ['genre', 'Genre', false], ['notes', 'Notes', false],
  ];

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-xl bg-secondary-blue p-5 shadow-md">
      <h2 className="mb-2 text-center text-2xl font-bold">Save New Book</h2>
      <p className="mb-5 text-center text-sm">Scan the ISBN on the back. It will also become the Book ID.</p>
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        {fields.map(([field, label, required]) => (
          <label key={field} className={field === 'notes' ? 'md:col-span-2' : ''}>
            <span className="mb-1 block font-semibold">{label}{required ? ' *' : ''}</span>
            {field === 'notes' ? (
              <textarea value={book[field]} onChange={e => update(field, e.target.value)} className="w-full rounded-lg border p-3" rows={3} />
            ) : (
              <input
                ref={field === 'barcode' ? barcodeRef : undefined}
                value={book[field]}
                onChange={e => update(field, e.target.value)}
                required={required}
                inputMode={field === 'barcode' ? 'none' : undefined}
                className="w-full rounded-lg border p-3"
                autoComplete="off"
              />
            )}
          </label>
        ))}
        <button disabled={isLoading} className="rounded-lg bg-primary-green p-4 text-lg font-bold text-white md:col-span-2">
          {isLoading ? 'Saving…' : 'Save Book'}
        </button>
      </form>
      {formMessage && <p className="mt-4 text-center font-semibold">{formMessage}</p>}
    </div>
  );
};

export default AddBookView;
