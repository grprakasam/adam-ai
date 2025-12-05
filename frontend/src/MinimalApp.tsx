import { useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { LoginPage } from './components/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import LandingPage from './components/LandingPage';
import './App.css';

type ViewMode = 'login' | 'landing';

function MinimalApp() {

  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);

  const handleLoginSuccess = (data: any) => {
    console.log('Login successful:', data);
    setCurrentUser(data.user);
    setViewMode('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('adam_access_token');
    localStorage.removeItem('adam_user');
    setCurrentUser(null);
    setViewMode('login');
  };

  const handleStartProject = () => {
    alert('Start project clicked!');
  };

  const handleOpenMigration = () => {
    alert('Open migration clicked!');
  };

  return (
    <ErrorBoundary>
      <ConfigProvider
        theme={{
          algorithm: theme.defaultAlgorithm,
          token: {
            colorPrimary: '#4f46e5',
            borderRadius: 6,
          },
        }}
      >
        <div className="app-container">
          <main
            id="main-content"
            className={viewMode === 'login' ? 'login-view' : ''}
            style={viewMode === 'login' ? {
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              overflow: 'visible',
              zIndex: 1
            } : {}}
          >
            {viewMode === 'login' && (
              <ErrorBoundary>
                <LoginPage onLoginSuccess={handleLoginSuccess} />
              </ErrorBoundary>
            )}
            {viewMode === 'landing' && (
              <LandingPage
                onStartProject={handleStartProject}
                onOpenMigration={handleOpenMigration}
                currentUser={currentUser}
                onLogout={handleLogout}
              />
            )}
          </main>
        </div>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default MinimalApp;
