import { create } from 'zustand'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

export interface Preferences {
  theme: 'light' | 'dark'
  default_week: number
  students_per_page: 10 | 20 | 50
}

const DEFAULT_PREFERENCES: Preferences = {
  theme: 'light',
  default_week: 1,
  students_per_page: 20,
}

interface PreferencesStore {
  preferences: Preferences
  loading: boolean
  fetchPreferences: (getToken: () => Promise<string>) => Promise<void>
  updatePreferences: (updates: Partial<Preferences>, getToken: () => Promise<string>) => Promise<void>
}

export const usePreferencesStore = create<PreferencesStore>((set) => ({
  preferences: DEFAULT_PREFERENCES,
  loading: false,

  // Load preferences from MongoDB on login
  fetchPreferences: async (getToken) => {
    set({ loading: true })
    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/profile/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch preferences')
      const data = await res.json()
      set({ preferences: { ...DEFAULT_PREFERENCES, ...data } })
    } catch (err) {
      console.error('[preferencesStore] fetchPreferences error:', err)
    } finally {
      set({ loading: false })
    }
  },

  // Save a partial update to MongoDB — optimistic update
  updatePreferences: async (updates, getToken) => {
    set((state) => ({
      preferences: { ...state.preferences, ...updates },
    }))
    try {
      const token = await getToken()
      const res = await fetch(`${API_BASE}/profile/preferences`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update preferences')
      const data = await res.json()
      set({ preferences: { ...DEFAULT_PREFERENCES, ...data } })
    } catch (err) {
      console.error('[preferencesStore] updatePreferences error:', err)
    }
  },
}))