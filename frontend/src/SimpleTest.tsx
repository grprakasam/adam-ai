// Simple test component to verify React is working
export default function SimpleTest() {
  return (
    <div style={{
      padding: '40px',
      fontSize: '24px',
      color: '#4f46e5',
      fontFamily: 'sans-serif',
      textAlign: 'center'
    }}>
      <h1>✅ React is Working!</h1>
      <p>If you see this, React is loading correctly.</p>
      <p style={{ fontSize: '16px', color: '#666', marginTop: '20px' }}>
        The issue might be in the App component or one of its dependencies.
      </p>
    </div>
  );
}
