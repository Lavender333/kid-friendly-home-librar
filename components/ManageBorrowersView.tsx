
import React, { useState, useRef, useEffect } from 'react';
import { Borrower } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface ManageBorrowersViewProps {
  borrowers: Borrower[];
  onAddBorrower: (name: string) => Promise<{ success: boolean; message?: string }>;
  onEditBorrower: (oldName: string, newName: string) => Promise<{ success: boolean; message?: string }>; // New prop for editing
  isLoading: boolean;
}

const ManageBorrowersView: React.FC<ManageBorrowersViewProps> = ({ borrowers, onAddBorrower, onEditBorrower, isLoading }) => {
  const [newBorrowerName, setNewBorrowerName] = useState<string>('');
  const [editingBorrowerName, setEditingBorrowerName] = useState<string | null>(null); // Name of borrower being edited
  const [currentEditedName, setCurrentEditedName] = useState<string>(''); // Value of the edit input field
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !editingBorrowerName && addInputRef.current) {
      addInputRef.current.focus();
    }
  }, [isLoading, editingBorrowerName]);

  useEffect(() => {
    if (editingBorrowerName && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingBorrowerName]);

  const handleSubmitNewBorrower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBorrowerName.trim()) {
      alert('Please enter a borrower name.');
      return;
    }
    const result = await onAddBorrower(newBorrowerName.trim());
    if (result.success) {
      setNewBorrowerName(''); // Clear input after successful add
    }
    if (addInputRef.current) {
      addInputRef.current.focus();
    }
  };

  const startEditing = (borrower: Borrower) => {
    setEditingBorrowerName(borrower.name);
    setCurrentEditedName(borrower.name);
  };

  const cancelEditing = () => {
    setEditingBorrowerName(null);
    setCurrentEditedName('');
  };

  const handleSaveEdit = async (oldName: string) => {
    if (!currentEditedName.trim()) {
      alert('Borrower name cannot be empty.');
      return;
    }
    if (currentEditedName.trim().toLowerCase() === oldName.toLowerCase()) {
      cancelEditing(); // No change, just close edit mode
      return;
    }

    const result = await onEditBorrower(oldName, currentEditedName.trim());
    if (result.success) {
      cancelEditing();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, oldName: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit(oldName);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEditing();
    }
  };

  return (
    <div className="p-4 bg-secondary-blue rounded-lg shadow-md my-6 max-w-lg mx-auto relative">
      <h2 className="text-2xl font-bold text-center mb-6 text-text-dark">Manage Our Borrowers</h2>

      {isLoading && <LoadingSpinner />}

      <div className="bg-white p-4 rounded-lg shadow-inner mb-6">
        <h3 className="text-xl font-semibold text-text-dark mb-4">Current Borrowers</h3>
        {borrowers.length === 0 && !isLoading ? (
          <p className="text-center text-gray-500">No borrowers added yet. Add some below!</p>
        ) : (
          <ul className="list-none space-y-3">
            {borrowers.map((borrower) => (
              <li key={borrower.name} className="flex items-center justify-between group">
                {editingBorrowerName === borrower.name ? (
                  // Edit mode
                  <div className="flex-1 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                      type="text"
                      ref={editInputRef}
                      value={currentEditedName}
                      onChange={(e) => setCurrentEditedName(e.target.value)}
                      onKeyDown={(e) => handleKeyPress(e, borrower.name)}
                      className="flex-grow p-2 border border-accent-yellow rounded-lg shadow-sm focus:ring-accent-yellow focus:border-accent-yellow transition-colors duration-200 text-lg"
                      aria-label={`Edit borrower name ${borrower.name}`}
                      disabled={isLoading}
                    />
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(borrower.name)}
                        className="bg-primary-green text-white px-4 py-2 rounded-lg shadow-md hover:bg-emerald-600 transition-colors duration-200 text-sm"
                        aria-label={`Save changes for ${borrower.name}`}
                        disabled={isLoading}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="bg-soft-pink text-text-dark px-4 py-2 rounded-lg shadow-md hover:bg-red-400 transition-colors duration-200 text-sm"
                        aria-label={`Cancel editing ${borrower.name}`}
                        disabled={isLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode
                  <>
                    <span className="text-lg text-gray-800 flex-1">{borrower.name}</span>
                    <button
                      type="button"
                      onClick={() => startEditing(borrower)}
                      className="ml-4 bg-accent-yellow text-text-dark px-3 py-1 rounded-lg shadow-sm hover:bg-yellow-400 transition-colors duration-200 text-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100"
                      aria-label={`Edit ${borrower.name}`}
                      disabled={isLoading}
                    >
                      Edit
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleSubmitNewBorrower} className="space-y-4">
        <div>
          <label htmlFor="newBorrower" className="block text-lg font-medium text-text-dark mb-2">
            Add New Borrower Name
          </label>
          <input
            type="text"
            id="newBorrower"
            ref={addInputRef}
            value={newBorrowerName}
            onChange={(e) => setNewBorrowerName(e.target.value)}
            placeholder="e.g., Liam"
            className="w-full p-3 border border-border-light rounded-lg shadow-sm focus:ring-accent-yellow focus:border-accent-yellow transition-colors duration-200 text-lg"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck="false"
            aria-label="New borrower name"
            disabled={isLoading || !!editingBorrowerName} // Disable if adding or editing
          />
        </div>

        <button
          type="submit"
          className="w-full bg-accent-yellow text-text-dark text-xl font-bold py-3 px-5 rounded-lg shadow-md hover:bg-yellow-400 transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-accent-yellow focus:ring-opacity-75"
          disabled={isLoading || !!editingBorrowerName} // Disable if adding or editing
          aria-label="Add new borrower"
        >
          Add Borrower
        </button>
      </form>
    </div>
  );
};

export default ManageBorrowersView;
