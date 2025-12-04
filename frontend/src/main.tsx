import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SimpleErrorBoundary } from './SimpleErrorBoundary';
import App from './App.tsx';
import './styles/design-tokens.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/global.css';

// Error handling for root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found! Make sure index.html has a div with id="root"');
}

// Global error logger that keeps the React tree intact
window.addEventListener('error', (event) => {
  const message = event.error?.message || event.message || '';
  const isRemoveChildRace = message.includes("Failed to execute 'removeChild' on 'Node'");

  if (isRemoveChildRace) {
    // Swallow known removeChild race so it does not crash the app
    console.warn('[GlobalError] Ignoring transient removeChild race condition', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
    event.preventDefault();
    return;
  }

  console.error('[GlobalError]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    stack: event.error?.stack,
  });
});

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <SimpleErrorBoundary>
      <App />
    </SimpleErrorBoundary>
  </StrictMode>,
);
