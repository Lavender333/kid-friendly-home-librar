

import React from 'react';
import { LogEntry } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface CheckoutLogViewProps {
  logEntries: LogEntry[];
  isLoading: boolean;
}

const CheckoutLogView: React.FC<CheckoutLogViewProps> = ({ logEntries, isLoading }) => {
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {logEntries.map((entry, index) => (
              <tr key={index} className="hover:bg-gray-50">
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isLoading && logEntries.length > 0 && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
};

export default CheckoutLogView;
