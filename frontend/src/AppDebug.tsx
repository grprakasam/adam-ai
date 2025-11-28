import { useState } from 'react';

export default function AppDebug() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const loadStep = async (stepNum: number, name: string, loader: () => Promise<any>) => {
    try {
      await loader();
      setStep(stepNum);
    } catch (err: any) {
      setError(`Failed at step ${stepNum} (${name}): ${err.message}\n\nStack: ${err.stack}`);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>🔍 App Debug Mode</h1>
      
      {error ? (
        <div style={{ background: '#fef2f2', border: '2px solid #dc2626', borderRadius: '8px', padding: '20px', marginTop: '20px' }}>
          <h2 style={{ color: '#dc2626' }}>❌ Error Detected</h2>
          <pre style={{ background: 'white', padding: '15px', borderRadius: '4px', overflow: 'auto', fontSize: '12px' }}>
            {error}
          </pre>
        </div>
      ) : (
        <>
          <p>Current step: {step}</p>
          
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => loadStep(1, 'Ant Design', async () => {
                await import('antd');
              })}
              style={{ padding: '10px 20px', background: step >= 1 ? '#10b981' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              {step >= 1 ? '✅' : '1.'} Load Ant Design
            </button>

            <button 
              onClick={() => loadStep(2, 'Lucide Icons', async () => {
                await import('lucide-react');
              })}
              style={{ padding: '10px 20px', background: step >= 2 ? '#10b981' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              disabled={step < 1}
            >
              {step >= 2 ? '✅' : '2.'} Load Lucide Icons
            </button>

            <button 
              onClick={() => loadStep(3, 'Stores', async () => {
                await import('./store/projectStore');
                await import('./store/preferencesStore');
                await import('./store/historyStore');
              })}
              style={{ padding: '10px 20px', background: step >= 3 ? '#10b981' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              disabled={step < 2}
            >
              {step >= 3 ? '✅' : '3.'} Load Stores
            </button>

            <button 
              onClick={() => loadStep(4, 'Hooks', async () => {
                await import('./hooks/useKeyboardShortcuts');
                await import('./hooks/useApplyPreferences');
              })}
              style={{ padding: '10px 20px', background: step >= 4 ? '#10b981' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              disabled={step < 3}
            >
              {step >= 4 ? '✅' : '4.'} Load Hooks
            </button>

            <button 
              onClick={() => loadStep(5, 'Components', async () => {
                await import('./components/ErrorBoundary');
                await import('./components/LoginPage');
              })}
              style={{ padding: '10px 20px', background: step >= 5 ? '#10b981' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              disabled={step < 4}
            >
              {step >= 5 ? '✅' : '5.'} Load Basic Components
            </button>

            <button 
              onClick={() => loadStep(6, 'App.tsx', async () => {
                await import('./App');
              })}
              style={{ padding: '10px 20px', background: step >= 6 ? '#10b981' : '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              disabled={step < 5}
            >
              {step >= 6 ? '✅' : '6.'} Load Full App
            </button>
          </div>

          {step >= 6 && (
            <div style={{ marginTop: '30px', padding: '20px', background: '#ecfdf5', border: '2px solid #10b981', borderRadius: '8px' }}>
              <h2 style={{ color: '#10b981' }}>✅ All Modules Loaded Successfully!</h2>
              <p>The app should work. Reloading with full app...</p>
              <button 
                onClick={() => window.location.reload()}
                style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', marginTop: '10px' }}
              >
                Reload with Full App
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
