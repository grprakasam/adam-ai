import { JSDOM } from 'jsdom';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { useWorkspaceAutosave } from '../src/hooks/useWorkspaceAutosave';
import { useProjectStore } from '../src/store/projectStore';
import { usePreferencesStore } from '../src/store/preferencesStore';
import { useApplyPreferences } from '../src/hooks/useApplyPreferences';
import { useKeyboardShortcuts } from '../src/hooks/useKeyboardShortcuts';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost',
});

Object.defineProperties(globalThis, {
  window: { value: dom.window },
  document: { value: dom.window.document },
  HTMLElement: { value: dom.window.HTMLElement },
  localStorage: { value: dom.window.localStorage },
  navigator: { value: dom.window.navigator },
});

// Ant Design expects ResizeObserver in the environment
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserverMock as any;

const AutosaveProbe = () => {
  useWorkspaceAutosave();
  return null;
};

const PreferencesProbe = () => {
  useApplyPreferences();
  return null;
};

const ShortcutProbe = ({ onOpenHelpCenter }: { onOpenHelpCenter: () => void }) => {
  useKeyboardShortcuts({
    onOpenHelpCenter,
  });
  return null;
};

const log = (message: string, data?: unknown) => {
  // eslint-disable-next-line no-console
  console.log(`QA: ${message}`, data ?? '');
};

const run = async () => {
  // Seed workspace data
  const store = useProjectStore.getState();
  store.setProjectConfig({
    studyId: 'QA-STUDY',
    adamDataset: 'ADSL',
    sponsor: 'QA Sponsor',
  } as any);
  store.setSpecificationFile({
    name: 'QA.xlsx',
    path: '/path/QA.xlsx',
    size: 1024,
    uploadedAt: new Date().toISOString(),
  });

  render(<AutosaveProbe />);
  await new Promise((resolve) => setTimeout(resolve, 900));
  const autosavePayload = localStorage.getItem('adam-ai-autosave-draft');
  log('autosave payload length', autosavePayload?.length);
  cleanup();

  // Preferences verification
  const prefStore = usePreferencesStore.getState();
  prefStore.setTheme('dark');
  prefStore.setFontScale(1.1);
  prefStore.setLayoutDensity('compact');
  render(<PreferencesProbe />);
  await new Promise((resolve) => setTimeout(resolve, 10));
  log('theme applied', document.documentElement.dataset.theme);
  log('font scale', document.documentElement.style.getPropertyValue('--app-font-scale'));
  cleanup();

  // Help center shortcut wiring
  let helpCenterOpened = false;
  render(<ShortcutProbe onOpenHelpCenter={() => { helpCenterOpened = true; }} />);
  window.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: '/', shiftKey: true }));
  await new Promise((resolve) => setTimeout(resolve, 10));
  log('help center shortcut fired', helpCenterOpened);
  cleanup();
};

run().catch((error) => {
  console.error('QA script failed', error);
  process.exitCode = 1;
});
