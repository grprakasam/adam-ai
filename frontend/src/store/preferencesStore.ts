import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemePreference = 'light' | 'dark' | 'system';
type DensityPreference = 'comfortable' | 'compact';
type LayoutMode = 'auto' | 'mobile' | 'desktop';

interface PreferencesStore {
  theme: ThemePreference;
  fontScale: number;
  layoutDensity: DensityPreference;
  layoutMode: LayoutMode;
  setTheme: (theme: ThemePreference) => void;
  setFontScale: (scale: number) => void;
  setLayoutDensity: (density: DensityPreference) => void;
  setLayoutMode: (mode: LayoutMode) => void;
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      theme: 'system',
      fontScale: 1,
      layoutDensity: 'comfortable',
      layoutMode: 'auto',
      setTheme: (theme) => set({ theme }),
      setFontScale: (fontScale) => set({ fontScale }),
      setLayoutDensity: (layoutDensity) => set({ layoutDensity }),
      setLayoutMode: (layoutMode) => set({ layoutMode }),
    }),
    {
      name: 'adam-ai-preferences',
    }
  )
);
