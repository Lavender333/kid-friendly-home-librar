import { BrowserProfile } from '../types';

export class BrowserProfileService {
  private profiles: BrowserProfile[] = [];

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
    return this.profiles[idx];
  }

  deleteProfile(id: string): boolean {
    const idx = this.profiles.findIndex(p => p.id === id);
    if (idx === -1) return false;
    this.profiles.splice(idx, 1);
    return true;
  }
}
