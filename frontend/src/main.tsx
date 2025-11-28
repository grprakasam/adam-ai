import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SimpleErrorBoundary } from './SimpleErrorBoundary'
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

// Add detailed error handler for unhandled errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  console.error('Error message:', event.message);
  console.error('Error filename:', event.filename);
  console.error('Error lineno:', event.lineno);
  console.error('Error colno:', event.colno);
  
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: sans-serif; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #dc2626;">⚠️ Application Error</h1>
        <p style="color: #6b7280; margin: 20px 0; font-size: 16px;">${event.message || event.error?.message || 'An unexpected error occurred'}</p>
        <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: left;">
          <div style="color: #991b1b; font-weight: 600; margin-bottom: 10px;">Error Details:</div>
          <div style="font-family: monospace; font-size: 13px; color: #7f1d1d; word-break: break-all;">
            <div><strong>Message:</strong> ${event.message}</div>
            ${event.filename ? `<div style="margin-top: 8px;"><strong>File:</strong> ${event.filename}</div>` : ''}
            ${event.lineno ? `<div style="margin-top: 8px;"><strong>Line:</strong> ${event.lineno}:${event.colno || 0}</div>` : ''}
          </div>
        </div>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #7c3aed; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: 500;">
          Reload Page
        </button>
        <details style="margin-top: 30px; text-align: left; background: #f9fafb; padding: 15px; border-radius: 6px;">
          <summary style="cursor: pointer; color: #6b7280; font-weight: 600; padding: 5px;">Stack Trace</summary>
          <pre style="background: #ffffff; padding: 15px; border-radius: 6px; overflow: auto; margin-top: 10px; font-size: 12px; border: 1px solid #e5e7eb;">
${event.error?.stack || 'No stack trace available'}
          </pre>
        </details>
      </div>
    `;
  }
});

createRoot(rootElement).render(
  <StrictMode>
    <SimpleErrorBoundary>
      <App />
    </SimpleErrorBoundary>
  </StrictMode>,
)
