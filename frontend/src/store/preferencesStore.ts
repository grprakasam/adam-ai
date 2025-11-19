import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemePreference = 'light' | 'dark' | 'system';
type DensityPreference = 'comfortable' | 'compact';

interface PreferencesStore {
  theme: ThemePreference;
  fontScale: number;
  layoutDensity: DensityPreference;
  setTheme: (theme: ThemePreference) => void;
  setFontScale: (scale: number) => void;
  setLayoutDensity: (density: DensityPreference) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      theme: 'system',
      fontScale: 1,
      layoutDensity: 'comfortable',
      setTheme: (theme) => set({ theme }),
      setFontScale: (fontScale) => set({ fontScale }),
      setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
    }),
    {
      name: 'adam-ai-preferences',
    }
  )
);
