import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './styles/design-tokens.css'
import './styles/components.css'
import './styles/utilities.css'
import './styles/global.css'

// Error handling for root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found! Make sure index.html has a div with id="root"');
}

// Add error handler for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif;">
        <h1 style="color: #dc2626;">Application Error</h1>
        <p style="color: #6b7280; margin: 20px 0;">${event.error?.message || 'An unexpected error occurred'}</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer;">
          Reload Page
        </button>
        <details style="margin-top: 20px; text-align: left;">
          <summary style="cursor: pointer; color: #6b7280;">Error Details</summary>
          <pre style="background: #f3f4f6; padding: 15px; border-radius: 6px; overflow: auto; margin-top: 10px;">
${event.error?.stack || 'No stack trace available'}
          </pre>
        </details>
      </div>
    `;
  }
});

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
