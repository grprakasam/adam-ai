import { useEffect } from 'react';
import { usePreferencesStore } from '../store/preferencesStore';

const getSystemTheme = () => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useApplyPreferences = () => {
  const theme = usePreferencesStore((state) => state.theme);
  const fontScale = usePreferencesStore((state) => state.fontScale);
  const layoutDensity = usePreferencesStore((state) => state.layoutDensity);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const appliedTheme = theme === 'system' ? getSystemTheme() : theme;
    root.dataset.theme = appliedTheme;
    root.dataset.density = layoutDensity;
    root.style.setProperty('--app-font-scale', fontScale.toString());

    if (theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const listener = (event: MediaQueryListEvent) => {
        root.dataset.theme = event.matches ? 'dark' : 'light';
      };
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [theme, fontScale, layoutDensity]);
};
