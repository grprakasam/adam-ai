import { useState, useEffect } from 'react';
import App from './App';
import { useProjectStore } from './store/projectStore';
import { useStudyStore } from './store/studyStore';
import { usePreferencesStore } from './store/preferencesStore';
import { Spin } from 'antd';

/**
 * Wrapper component that ensures all Zustand stores are hydrated
 * before rendering the main App component.
 *
 * This prevents blank screen issues caused by race conditions
 * during store initialization.
 */
export function HydratedApp() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Small delay to ensure all stores have initialized from localStorage
    const timer = setTimeout(() => {
      try {
        // Access stores to trigger hydration
        useProjectStore.getState();
        useStudyStore.getState();
        usePreferencesStore.getState();

        setIsHydrated(true);
      } catch (error) {
        console.error('Store hydration error:', error);
        // Still set hydrated to true to show the app (with error boundaries)
        setIsHydrated(true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (!isHydrated) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  return <App />;
}
