import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SimpleErrorBoundary } from './SimpleErrorBoundary';
import { HydratedApp } from './HydratedApp';
import './styles/design-tokens.css';
import './styles/components.css';
import './styles/utilities.css';
import './styles/global.css';

// Error handling for root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found! Make sure index.html has a div with id="root"');
}

// Global error handler
window.addEventListener('error', (event) => {
  const message = event.error?.message || event.message || '';
  const isRemoveChildRace = message.includes("Failed to execute 'removeChild' on 'Node'");

  if (isRemoveChildRace) {
    event.preventDefault();
    return;
  }
});

const root = createRoot(rootElement);

// Render the application
root.render(
  <StrictMode>
    <SimpleErrorBoundary>
      <HydratedApp />
    </SimpleErrorBoundary>
  </StrictMode>,
);
