import { BrowserProfile } from '../types';

export class BrowserProfileService {
  private profiles: BrowserProfile[] = [];
  private storageKey = 'browserProfiles';

  constructor() {
    const stored = localStorage.getItem(this.storageKey);
    this.profiles = stored ? JSON.parse(stored) : [];
  }

  getProfiles(): BrowserProfile[] {
    return this.profiles;
  }

  addProfile(profile: Omit<BrowserProfile, 'id' | 'createdAt'>): BrowserProfile {
    const newProfile: BrowserProfile = {
      ...profile,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString(),
    };
    this.profiles.push(newProfile);
    localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
    return newProfile;
  }

  updateProfile(id: string, updates: Partial<BrowserProfile>): BrowserProfile | null {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return null;
    this.profiles[idx] = {
      ...this.profiles[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
    return this.profiles[idx];
  }

  deleteProfile(id: string): boolean {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.profiles.splice(idx, 1);
    localStorage.setItem(this.storageKey, JSON.stringify(this.profiles));
    return true;
  }
}
