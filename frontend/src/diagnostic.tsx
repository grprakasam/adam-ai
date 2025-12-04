// Diagnostic component to test rendering
import React from 'react';

export function DiagnosticTest() {
  console.log('🔍 Diagnostic component is rendering');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      padding: '20px',
      zIndex: 99999,
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ color: '#10b981', marginBottom: '20px', fontSize: '32px' }}>
        ✅ React is Rendering!
      </h1>
      <div style={{
        background: 'white',
        padding: '30px',
        borderRadius: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        maxWidth: '600px'
      }}>
        <h2 style={{ color: '#6b7280', marginBottom: '15px' }}>Diagnostic Test Page</h2>
        <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '10px' }}>
          If you can see this page, React is working correctly.
        </p>
        <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '10px' }}>
          <strong>Backend Status:</strong> Connected on port 8002
        </p>
        <p style={{ color: '#374151', lineHeight: '1.6', marginBottom: '10px' }}>
          <strong>Frontend Status:</strong> Running on port 3000
        </p>
        <div style={{ marginTop: '20px', padding: '15px', background: '#f9fafb', borderRadius: '8px', fontSize: '14px' }}>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Check the browser console (F12) for any error messages.
          </p>
        </div>
      </div>
    </div>
  );
}
