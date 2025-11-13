import { useState, useEffect } from 'react';
import { ConfigProvider, theme, message } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import LandingPage from './components/LandingPage';
import { LoginPage } from './components/LoginPage';
import { ApprovalProgressBar } from './components/ApprovalProgressBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProjectStore } from './store/projectStore';
import type { ProgrammingLanguage, GenerationResponse } from './types';
import './App.css';

type ViewMode = 'login' | 'landing' | 'workspace';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [language, setLanguage] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [generationResult] = useState<GenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState('project');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);

  // Access Zustand store
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const initializeWorkspace = useProjectStore((state) => state.initializeWorkspace);
  const llmProvider = useProjectStore((state) => state.llmProvider);
  const setLlmProvider = useProjectStore((state) => state.setLlmProvider);

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('adam_access_token');
    const userStr = localStorage.getItem('adam_user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        setIsAuthenticated(true);
        setViewMode('landing');
      } catch (error) {
        console.error('Invalid stored user data:', error);
        localStorage.removeItem('adam_access_token');
        localStorage.removeItem('adam_user');
      }
    }
  }, []);

  const handleLoginSuccess = (data: any) => {
    setCurrentUser(data.user);
    setIsAuthenticated(true);
    setViewMode('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('adam_access_token');
    localStorage.removeItem('adam_user');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setViewMode('login');
    message.info('Logged out successfully');
  };

  const handleGenerate = async () => {
    // Track all state changes for cleanup
    const cleanupStates = {
      isGenerating: false,
    };

    try {
      setIsGenerating(true);
      cleanupStates.isGenerating = true;
      message.loading({ content: 'Preparing workspace...', key: 'generate', duration: 0 });

      // Note: Actual code generation endpoint will be implemented in Phase 6
      // For now, we just show a success message and let user configure the workspace

      message.success({
        content: 'Workspace ready! Complete all tabs to generate code.',
        key: 'generate',
        duration: 2
      });

    } catch (error) {
      console.error('Workspace error:', error);
      message.error({
        content: 'Failed to prepare workspace.',
        key: 'generate',
        duration: 3
      });
      // Clean up all states on error
    } finally {
      // Always clean up generation state
      if (cleanupStates.isGenerating) {
        setIsGenerating(false);
      }
    }
  };

  const handleStartProject = async () => {
    // Initialize workspace
    initializeWorkspace();
    
    // Move to workspace view
    setViewMode('workspace');

    // Set default dataset if not selected
    if (!projectConfig.adamDataset) {
      setProjectConfig({ adamDataset: 'ADSL' } as any);
    }

    // Set default specification file if none selected
    if (!specificationFile) {
      const defaultSpecPath = 'Content/UserInputs/ADAMSpecifications/ADSLSpec.xlsx';
      const defaultSpecName = 'ADSLSpec.xlsx';
      // We don't know size here; it's informational only in UI
      setSpecificationFile({
        name: defaultSpecName,
        path: defaultSpecPath,
        size: 0,
        uploadedAt: new Date().toISOString(),
        isDefault: true,
      } as any);
    }

    // Friendly UX messaging
    message.success({ content: 'Workspace initialized! Configure your project to generate code.', duration: 2 });
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
          {viewMode === 'login' ? (
            <LoginPage onLoginSuccess={handleLoginSuccess} />
          ) : viewMode === 'landing' ? (
            <LandingPage 
              onStartProject={handleStartProject}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          ) : (
            <>
              <Header
                onBackToLanding={() => setViewMode('landing')}
                currentUser={currentUser}
                onLogout={handleLogout}
              />

              <div className="main-content">
                <div className="left-panel-wrapper">
                  <LeftPanel
                    onGenerate={handleGenerate}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isCollapsed={isLeftPanelCollapsed}
                  />
                  <button 
                    className={`panel-toggle-btn ${isLeftPanelCollapsed ? 'collapsed' : ''}`}
                    onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
                    title={isLeftPanelCollapsed ? 'Show configuration panel' : 'Hide configuration panel'}
                  >
                    {isLeftPanelCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                  </button>
                </div>

                <RightPanel
                  generationResult={generationResult}
                  language={language}
                />
              </div>

              {/* Approval Progress Bar - visible after spec upload */}
              <ApprovalProgressBar />
            </>
          )}
        </div>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
