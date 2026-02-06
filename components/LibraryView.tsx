
import React from 'react';
import { Book } from '../types';
import LoadingSpinner from './LoadingSpinner';
import Barcode from './Barcode';

interface LibraryViewProps {
  books: Book[];
  isLoading: boolean;
}

const LibraryView: React.FC<LibraryViewProps> = ({ books, isLoading }) => {
  if (isLoading && books.length === 0) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-4 bg-white rounded-lg shadow-md my-6 overflow-x-auto relative">
      <h2 className="text-2xl font-bold text-center mb-6 text-text-dark">Our Library</h2>
      {books.length === 0 ? (
        <p className="text-center text-gray-500">No books in the library yet. Add some IDs to your Google Sheet!</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-primary-green text-white">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Book ID
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Barcode
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Title
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Author
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Publisher
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Pub. Year
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Status
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Borrower
              </th>
              <th scope="col" className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider md:px-6 md:text-sm">
                Due Date
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {books.map((book) => (
              <tr key={book.bookId} className="hover:bg-gray-50">
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.bookId}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.barcode ? <Barcode value={book.barcode} className="h-16" /> : '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.title}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.author || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.publisher || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.publicationYear || '-'}
                </td>
                <td className={`px-3 py-4 whitespace-nowrap text-sm font-semibold md:px-6
                  ${book.status === 'On Shelf' ? 'text-primary-green' : 'text-soft-pink'}`}>
                  {book.status}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.borrower || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 md:px-6">
                  {book.dueDate || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isLoading && books.length > 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};

export default LibraryView;
