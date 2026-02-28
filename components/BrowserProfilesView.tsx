import React, { useState } from 'react';
import { BrowserProfile } from '../types';
import { BrowserProfileService } from '../services/browserProfileService';

const service = new BrowserProfileService();

export default function BrowserProfilesView() {
  const [profiles, setProfiles] = useState<BrowserProfile[]>(service.getProfiles());
  const [form, setForm] = useState({ name: '', settings: '', bookmarks: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAdd = () => {
    const bookmarks = form.bookmarks
      ? form.bookmarks.split('\n').map(line => {
          const [title, url] = line.split('|');
          return { title: title.trim(), url: url.trim() };
        })
      : [];
    const settings = form.settings ? JSON.parse(form.settings) : {};
    const newProfile = service.addProfile({
      name: form.name,
      settings,
      bookmarks,
    });
    setProfiles(service.getProfiles());
    setForm({ name: '', settings: '', bookmarks: '' });
  };

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto', padding: 20, border: '1px solid #ccc', borderRadius: 8 }}>
      <h2>Browser Profiles</h2>
      <div style={{ marginBottom: 20 }}>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
