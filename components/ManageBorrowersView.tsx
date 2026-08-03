import React, { useEffect, useRef, useState } from 'react';
import { Borrower } from '../types';
import Barcode from './Barcode';

interface ManageBorrowersViewProps {
  borrowers: Borrower[];
  onAddBorrower: (name: string) => Promise<{ success: boolean; message?: string }>;
  onEditBorrower: (oldName: string, newName: string) => Promise<{ success: boolean; message?: string }>;
  isLoading: boolean;
  message?: { text: string; type: 'success' | 'error' | '' };
}

const memberCode = (name: string) => `MEM-${name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-')}`;

const ManageBorrowersView: React.FC<ManageBorrowersViewProps> = ({
  borrowers,
  onAddBorrower,
  onEditBorrower,
  isLoading,
  message,
}) => {
  const [newBorrowerName, setNewBorrowerName] = useState('');
  const [editingBorrowerName, setEditingBorrowerName] = useState<string | null>(null);
  const [currentEditedName, setCurrentEditedName] = useState('');
  const [selectedCardName, setSelectedCardName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const cardPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editingBorrowerName) addInputRef.current?.focus();
  }, [editingBorrowerName]);

  useEffect(() => {
    if (editingBorrowerName) editInputRef.current?.focus();
  }, [editingBorrowerName]);

  const handleSubmitNewBorrower = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newBorrowerName.trim();
    if (!name) return;
    setIsSaving(true);
    const result = await onAddBorrower(name);
    setIsSaving(false);
    if (result.success) {
      setNewBorrowerName('');
      setSelectedCardName(name);
      window.setTimeout(() => cardPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    }
    addInputRef.current?.focus();
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
    const newName = currentEditedName.trim();
    if (!newName) return;
    if (newName.toLowerCase() === oldName.toLowerCase()) {
      cancelEditing();
      return;
    }
    setIsSaving(true);
    const result = await onEditBorrower(oldName, newName);
    setIsSaving(false);
    if (result.success) {
      if (selectedCardName === oldName) setSelectedCardName(newName);
      cancelEditing();
    }
  };

  const showCard = (name: string) => {
    setSelectedCardName(name);
    window.setTimeout(() => cardPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  };

  const printCard = (name: string) => {
    setSelectedCardName(name);
    window.setTimeout(() => window.print(), 150);
  };

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-xl bg-secondary-blue p-4 shadow-md sm:p-6">
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-bold text-text-dark">Manage Our Borrowers</h2>
        <p className="mt-1 text-sm text-gray-700">Add family members, edit names, and make a scannable library card for each person.</p>
        {isLoading && <p className="mt-2 text-xs font-semibold text-gray-500">Refreshing borrower list in the background…</p>}
      </div>

      {message?.text && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-center font-semibold ${
          message.type === 'error' ? 'border border-red-300 bg-red-100 text-red-700' :
          message.type === 'success' ? 'border border-green-300 bg-green-100 text-green-700' :
          'border border-gray-300 bg-gray-100 text-gray-700'
        }`}>
          {message.text}
        </div>
      )}

      <section className="mb-6 rounded-xl bg-white p-4 shadow-inner">
        <h3 className="mb-4 text-xl font-semibold text-text-dark">Current Borrowers</h3>
        {borrowers.length === 0 ? (
          <div className="rounded-lg bg-yellow-50 p-4 text-center">
            <p className="font-semibold">No borrowers are showing yet.</p>
            <p className="mt-1 text-sm text-gray-600">You can add the first borrower below immediately; this page no longer waits for loading to finish.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {borrowers.map(borrower => (
              <li key={borrower.name} className="rounded-xl border border-gray-200 p-3 shadow-sm">
                {editingBorrowerName === borrower.name ? (
                  <div className="space-y-3">
                    <input
                      ref={editInputRef}
                      value={currentEditedName}
                      onChange={event => setCurrentEditedName(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') { event.preventDefault(); void handleSaveEdit(borrower.name); }
                        if (event.key === 'Escape') cancelEditing();
                      }}
                      className="w-full rounded-lg border border-accent-yellow p-3 text-lg"
                      disabled={isSaving}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => void handleSaveEdit(borrower.name)} disabled={isSaving} className="rounded-lg bg-primary-green px-4 py-3 font-bold text-white disabled:opacity-50">Save</button>
                      <button type="button" onClick={cancelEditing} disabled={isSaving} className="rounded-lg bg-gray-100 px-4 py-3 font-bold">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xl font-bold text-gray-900">{borrower.name}</p>
                        <p className="font-mono text-xs text-gray-500">{memberCode(borrower.name)}</p>
                      </div>
                      <button type="button" onClick={() => startEditing(borrower)} disabled={isSaving} className="rounded-lg bg-gray-100 px-4 py-2 font-semibold disabled:opacity-50">Edit</button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => showCard(borrower.name)} className="rounded-lg bg-accent-yellow px-4 py-3 font-bold text-text-dark">Make & View Library Card</button>
                      <button type="button" onClick={() => printCard(borrower.name)} className="rounded-lg bg-text-dark px-4 py-3 font-bold text-white">Print This Card</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form onSubmit={handleSubmitNewBorrower} className="mb-6 space-y-3 rounded-xl bg-white p-4 shadow-inner">
        <label htmlFor="newBorrower" className="block text-lg font-semibold text-text-dark">Add New Borrower</label>
        <input
          id="newBorrower"
          ref={addInputRef}
          value={newBorrowerName}
          onChange={event => setNewBorrowerName(event.target.value)}
          placeholder="Enter name"
          className="w-full rounded-lg border border-border-light p-3 text-lg"
          autoComplete="off"
          autoCapitalize="words"
          disabled={isSaving || !!editingBorrowerName}
        />
        <button type="submit" disabled={isSaving || !!editingBorrowerName || !newBorrowerName.trim()} className="w-full rounded-lg bg-primary-green px-5 py-3 text-xl font-bold text-white disabled:opacity-50">
          {isSaving ? 'Saving…' : 'Add Borrower'}
        </button>
      </form>

      {selectedCardName && (
        <section ref={cardPreviewRef} className="rounded-xl bg-white p-4 shadow-inner" aria-label={`${selectedCardName} library card`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">{selectedCardName}&apos;s Library Card</h3>
              <p className="text-sm text-gray-600">This is the design that will print.</p>
            </div>
            <button type="button" onClick={() => setSelectedCardName(null)} className="rounded-lg bg-gray-100 px-3 py-2 font-semibold">Close</button>
          </div>

          <div className="printable-library-cards">
            <article className="printable-library-card library-card-fun overflow-hidden rounded-2xl border-4 border-purple-400 bg-gradient-to-br from-pink-100 via-yellow-50 to-blue-100 p-4 shadow-xl">
              <div className="library-card-header flex items-center justify-between gap-2">
                <div>
                  <p className="library-card-brand text-xs font-black uppercase tracking-widest text-purple-700">Mariah&apos;s Library</p>
                  <p className="library-card-tagline text-xs font-semibold text-pink-600">Read • Imagine • Explore</p>
                </div>
                <div className="library-card-badge rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-purple-800">📚 BOOK BUDDY</div>
              </div>

              <div className="library-card-member mt-3 rounded-xl bg-white/80 px-3 py-2 text-center">
                <p className="library-card-label text-[10px] font-bold uppercase tracking-widest text-gray-500">Library Member</p>
                <h4 className="library-card-name truncate text-2xl font-black text-purple-800">{selectedCardName}</h4>
                <p className="library-card-id font-mono text-xs font-bold text-gray-700">Member ID: {memberCode(selectedCardName)}</p>
              </div>

              <div className="library-card-barcode-panel mt-3 rounded-xl bg-white px-3 py-2 text-center">
                <Barcode value={memberCode(selectedCardName)} className="mx-auto max-w-full" height={54} />
                <p className="library-card-instruction mt-1 text-[10px] font-bold text-gray-700">Scan this card before checking out books</p>
              </div>
            </article>
          </div>

          <button type="button" onClick={() => printCard(selectedCardName)} className="print-button-only mt-4 w-full rounded-lg bg-text-dark px-4 py-3 text-lg font-bold text-white">Print {selectedCardName}&apos;s Library Card</button>
        </section>
      )}
    </div>
  );
};

export default ManageBorrowersView;
