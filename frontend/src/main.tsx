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

  // Display critical errors on screen if the app is blank
  const root = document.getElementById('root');
  if (root && root.childNodes.length === 0) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed; top:20px; left:20px; right:20px; padding:20px; background:#fee; border:2px solid red; color:red; z-index:99999; font-family:sans-serif;';
    errorDiv.innerHTML = `<strong>Global Error:</strong> ${message}<br/><small>Please check console for details.</small>`;
    document.body.appendChild(errorDiv);
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
