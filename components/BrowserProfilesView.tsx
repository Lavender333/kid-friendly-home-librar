import React, { useState } from 'react';
import { BrowserProfile } from '../types';
import { BrowserProfileService } from '../services/browserProfileService';

const service = new BrowserProfileService();

export default function BrowserProfilesView() {
  const [profiles, setProfiles] = useState<BrowserProfile[]>(service.getProfiles());
  const [form, setForm] = useState({ name: '', settings: '', bookmarks: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', settings: '', bookmarks: '' });
  const [error, setError] = useState<string>('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = () => {
    setError('');
    if (!form.name.trim()) {
      setError('Profile name is required.');
      return;
    }
    let settings = {};
    try {
      settings = form.settings ? JSON.parse(form.settings) : {};
    } catch {
      setError('Settings must be valid JSON.');
      return;
    }
    const bookmarks = form.bookmarks
      ? form.bookmarks.split('\n').map(line => {
          const [title, url] = line.split('|');
          return { title: title?.trim() || '', url: url?.trim() || '' };
        }).filter(bm => bm.title && bm.url)
      : [];
    const newProfile = service.addProfile({
      name: form.name,
      settings,
      bookmarks,
    });
    setProfiles(service.getProfiles());
    setForm({ name: '', settings: '', bookmarks: '' });
  };

  const handleDelete = (id: string) => {
    service.deleteProfile(id);
    setProfiles(service.getProfiles());
  };

  const startEdit = (profile: BrowserProfile) => {
    setEditId(profile.id);
    setEditForm({
      name: profile.name,
      settings: JSON.stringify(profile.settings || {}, null, 2),
      bookmarks: (profile.bookmarks || []).map(bm => `${bm.title}|${bm.url}`).join('\n'),
    });
    setError('');
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const handleEditSave = () => {
    setError('');
    if (!editForm.name.trim()) {
      setError('Profile name is required.');
      return;
    }
    let settings = {};
    try {
      settings = editForm.settings ? JSON.parse(editForm.settings) : {};
    } catch {
      setError('Settings must be valid JSON.');
      return;
    }
    const bookmarks = editForm.bookmarks
      ? editForm.bookmarks.split('\n').map(line => {
          const [title, url] = line.split('|');
          return { title: title?.trim() || '', url: url?.trim() || '' };
        }).filter(bm => bm.title && bm.url)
      : [];
    service.updateProfile(editId!, {
      name: editForm.name,
      settings,
      bookmarks,
    });
    setProfiles(service.getProfiles());
    setEditId(null);
  };

  const handleEditCancel = () => {
    setEditId(null);
    setError('');
  };

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Browser Profiles</h2>
      <div style={{ marginBottom: 20 }}>
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Profile Name"
          style={{ width: '100%', marginBottom: 8 }}
        />
        <textarea
          name="settings"
          value={form.settings}
          onChange={handleChange}
          placeholder='Settings (JSON)'
          style={{ width: '100%', marginBottom: 8 }}
        />
        <textarea
          name="bookmarks"
          value={form.bookmarks}
          onChange={handleChange}
          placeholder="Bookmarks (title|url per line)"
          style={{ width: '100%', marginBottom: 8 }}
        />
        <button onClick={handleAdd} style={{ width: '100%' }}>Add Profile</button>
      </div>
      <ul>
        {profiles.map(profile => (
          <li key={profile.id} style={{ marginBottom: 12, padding: 8, border: '1px solid #eee', borderRadius: 4 }}>
            {editId === profile.id ? (
              <div style={{ background: '#f9f9f9', padding: 8, borderRadius: 4 }}>
                <input
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  placeholder="Profile Name"
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <textarea
                  name="settings"
                  value={editForm.settings}
                  onChange={handleEditChange}
                  placeholder='Settings (JSON)'
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <textarea
                  name="bookmarks"
                  value={editForm.bookmarks}
                  onChange={handleEditChange}
                  placeholder="Bookmarks (title|url per line)"
                  style={{ width: '100%', marginBottom: 8 }}
                />
                <button onClick={handleEditSave} style={{ marginRight: 8 }}>Save</button>
                <button onClick={handleEditCancel}>Cancel</button>
                {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
              </div>
            ) : (
              <>
                <strong>{profile.name}</strong>
                <div>Settings: <pre>{JSON.stringify(profile.settings, null, 2)}</pre></div>
                <div>Bookmarks:
                  <ul>
                    {profile.bookmarks?.map((bm, i) => (
                      <li key={i}><a href={bm.url} target="_blank" rel="noopener noreferrer">{bm.title}</a></li>
                    ))}
                  </ul>
                </div>
                <div>Created: {profile.createdAt}</div>
                <button onClick={() => startEdit(profile)} style={{ marginRight: 8 }}>Edit</button>
                <button onClick={() => handleDelete(profile.id)}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
