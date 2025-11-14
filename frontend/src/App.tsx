import { useState, useEffect } from 'react';
import { ConfigProvider, theme, message, Modal } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import LandingPage from './components/LandingPage';
import ProjectsPage from './components/ProjectsPage';
import CodeMigrationPage from './components/CodeMigrationPage';
import { LoginPage } from './components/LoginPage';
import { ApprovalProgressBar } from './components/ApprovalProgressBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProjectStore } from './store/projectStore';
import type { ProgrammingLanguage, GenerationResponse } from './types';
import './App.css';

type ViewMode = 'login' | 'landing' | 'projects' | 'workspace' | 'migration';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [language] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [generationResult] = useState<GenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState('project');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelUnlocked, setIsRightPanelUnlocked] = useState(false);

  // Access Zustand store
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const initializeWorkspace = useProjectStore((state) => state.initializeWorkspace);
  const completionPercentage = useProjectStore((state) => state.getCompletionPercentage());

  // Check for existing authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('adam_access_token');
    const userStr = localStorage.getItem('adam_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
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
    setViewMode('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('adam_access_token');
    localStorage.removeItem('adam_user');
    setCurrentUser(null);
    setViewMode('login');
    message.info('Logged out successfully');
  };

  const handleUnlockPairProgramming = async () => {
    if (completionPercentage < 80) {
      message.warning('Complete at least 80% of configuration to start pair programming.');
      return;
    }

    if (isRightPanelUnlocked) {
      message.info('Pair programming is already active.');
      return;
    }

    try {
      setIsGenerating(true);
      message.loading({ content: 'Preparing pair programming workspace...', key: 'generate', duration: 0 });

      setIsRightPanelUnlocked(true);
      message.success({
        content: 'Pair programming unlocked! You can now generate code.',
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
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartProject = () => {
    setViewMode('projects');
  };

  const handleOpenMigration = () => {
    setViewMode('migration');
  };

  const handleSwitchProject = () => {
    Modal.confirm({
      title: 'Switch Project?',
      content: 'Are you sure you want to switch projects? Any unsaved work will remain in the current project.',
      okText: 'Switch',
      cancelText: 'Cancel',
      onOk: () => {
        setViewMode('projects');
        setIsRightPanelUnlocked(false);
        message.info('Switched to project selection');
      }
    });
  };

  const handleOpenStudy = async (_studyName: string) => {
    // Initialize workspace
    initializeWorkspace();
    setIsRightPanelUnlocked(false);

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
            onOpenMigration={handleOpenMigration}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        ) : viewMode === 'projects' ? (
          <ProjectsPage
            onOpenStudy={handleOpenStudy}
            onBack={() => setViewMode('landing')}
            studies={[{ id: 'demo-study-1', name: 'Demo Study 1', sponsor: 'Demo Sponsor', description: 'Sample study showcasing ADAM AI capabilities.' }]}
          />
        ) : viewMode === 'migration' ? (
          <CodeMigrationPage
            onBack={() => setViewMode('landing')}
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
                  isUnlocked={isRightPanelUnlocked}
                  completionPercentage={completionPercentage}
                  onUnlock={handleUnlockPairProgramming}
                  onSwitchProject={handleSwitchProject}
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
