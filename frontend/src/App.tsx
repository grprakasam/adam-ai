import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigProvider, theme, message, Modal } from 'antd';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppHeader } from './components/AppHeader';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import LandingPage from './components/LandingPage';
import ProjectsPage from './components/ProjectsPage';
import CodeMigrationPage from './components/CodeMigrationPage';
import { LoginPage } from './components/LoginPage';
import { ApprovalProgressBar } from './components/ApprovalProgressBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProjectStore } from './store/projectStore';
import { usePreferencesStore } from './store/preferencesStore';
import { RecoverySuggestions } from './components/RecoverySuggestions';
import { HelpCenterDrawer } from './components/HelpCenterDrawer';
import { PreferencesDrawer } from './components/PreferencesDrawer';
import { useWorkspaceHistory } from './store/historyStore';
import { notifyUserError } from './utils/errorNotifications';
import { clearStaleAuthTokens } from './utils/clearAuth';
import type { ProgrammingLanguage, GenerationResponse } from './types';
import { SkipLink } from './components/a11y/SkipLink';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useApplyPreferences } from './hooks/useApplyPreferences';
import './App.css';

type ViewMode = 'login' | 'landing' | 'projects' | 'workspace' | 'migration';

function App() {
  // Clear any stale auth tokens on app startup
  useEffect(() => {
    clearStaleAuthTokens();
  }, []);
  
  useEffect(() => {
    const handler = (e: any) => { try { const tab = e?.detail?.tab; if (tab) setActiveTab(tab); } catch {} };
    window.addEventListener('adam-ai:open-left-tab', handler as any);
    return () => window.removeEventListener('adam-ai:open-left-tab', handler as any);
  }, []);

  // Listen for left panel toggle event from workspace
  useEffect(() => {
    const handler = () => {
      setIsLeftPanelCollapsed(prev => !prev);
    };
    window.addEventListener('adam-ai:toggle-left-panel', handler as any);
    return () => window.removeEventListener('adam-ai:toggle-left-panel', handler as any);
  }, []);
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentStudyId, setCurrentStudyId] = useState<string | undefined>(undefined);
  const [language] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [generationResult] = useState<GenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState('project');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  const [isRightPanelUnlocked, setIsRightPanelUnlocked] = useState(false);
  const [isHelpCenterOpen, setHelpCenterOpen] = useState(false);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const undo = useWorkspaceHistory((state) => state.undo);
  const redo = useWorkspaceHistory((state) => state.redo);
  const clearHistory = useWorkspaceHistory((state) => state.clear);
  const layoutMode = usePreferencesStore((state) => state.layoutMode);
  useApplyPreferences();

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

  useEffect(() => {
    const handleAuthRequired = () => {
      setCurrentUser(null);
      setViewMode('login');
      message.warning('Your session has expired. Please sign in again.');
    };
    window.addEventListener('adam-ai:auth-required', handleAuthRequired);
    return () => window.removeEventListener('adam-ai:auth-required', handleAuthRequired);
  }, []);

  useEffect(() => {
    mainContentRef.current?.focus();
  }, [viewMode]);

  const toggleLeftPanel = useCallback(() => {
    // Check if mobile view (considering layout mode preference)
    const actualWidth = window.innerWidth;
    const isMobile = 
      layoutMode === 'mobile' || 
      (layoutMode === 'auto' && actualWidth <= 768);
    
    if (isMobile) {
      setIsMobileMenuOpen((prev) => !prev);
    } else {
      setIsLeftPanelCollapsed((prev) => !prev);
    }
  }, [layoutMode]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Determine if we should use mobile layout
  const useMobileLayout = 
    layoutMode === 'mobile' || 
    (layoutMode === 'auto' && window.innerWidth <= 768);

  // Close mobile menu when switching to desktop layout
  useEffect(() => {
    if (layoutMode === 'desktop') {
      setIsMobileMenuOpen(false);
    }
  }, [layoutMode]);

  const focusMainContent = useCallback(() => {
    mainContentRef.current?.focus();
  }, []);
  const openHelpCenter = useCallback(() => setHelpCenterOpen(true), []);
  const closeHelpCenter = useCallback(() => setHelpCenterOpen(false), []);
  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  useKeyboardShortcuts({
    onToggleLeftPanel: toggleLeftPanel,
    onFocusMainContent: focusMainContent,
    onUndo: undo,
    onRedo: redo,
    onOpenHelpCenter: openHelpCenter,
  });

  const handleLoginSuccess = (data: any) => {
    setCurrentUser(data.user);
    setViewMode('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('adam_access_token');
    localStorage.removeItem('adam_user');
    setCurrentUser(null);
    setViewMode('login');
    clearHistory();
    message.info('Logged out successfully');
  };

  const handleUnlockPairProgramming = async () => {
    // Allow unlocking regardless of completion percentage.
    if (isRightPanelUnlocked) {
      message.info('Pair programming is already active.');
      return;
    }

    try {
      setIsGenerating(true);
      message.loading({ content: 'Preparing pair programming workspace...', key: 'generate', duration: 0 });

      setIsRightPanelUnlocked(true);
      message.success({
        content: completionPercentage < 80
          ? 'Pair programming unlocked. Some configuration steps are still pending.'
          : 'Pair programming unlocked! You can now generate code.',
        key: 'generate',
        duration: 2
      });
    } catch (error) {
      notifyUserError(error, 'Preparing the pair programming workspace');
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

  const handleOpenStudy = async (studyName: string) => {
    // Initialize workspace
    clearHistory();
    initializeWorkspace();
    setIsRightPanelUnlocked(false);

    // Set the current study
    setCurrentStudyId(studyName);

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

  const handleStudyChange = (studyId: string) => {
    Modal.confirm({
      title: 'Switch Study?',
      content: 'Are you sure you want to switch studies? Any unsaved work will remain in the current study.',
      okText: 'Switch',
      cancelText: 'Cancel',
      onOk: () => {
        setCurrentStudyId(studyId);
        setIsRightPanelUnlocked(false);
        message.info(`Switched to study: ${studyId}`);
      }
    });
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
        <SkipLink targetId="main-content" />
        <div className="app-container">
          <main id="main-content" ref={mainContentRef} tabIndex={-1}>
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
                studies={[{
                  id: 'demo-study-1',
                  name: 'Demo Study 1',
                  sponsor: 'Demo Sponsor',
                  therapeuticArea: 'General Medicine',
                  description: 'Sample study showcasing ADAM AI capabilities.',
                  lastUpdated: 'Updated today'
                }]}
              />
            ) : viewMode === 'migration' ? (
              <CodeMigrationPage onBack={() => setViewMode('landing')} />
            ) : (
              <>
                <AppHeader
                  onBackToLanding={() => setViewMode('landing')}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  showStudySelector={true}
                  currentStudyId={currentStudyId}
                  onStudyChange={handleStudyChange}
                  onToggleMobileMenu={toggleLeftPanel}
                />

                <HelpCenterDrawer open={isHelpCenterOpen} onClose={closeHelpCenter} activeTab={activeTab} />
                <PreferencesDrawer open={isPreferencesOpen} onClose={closePreferences} />

                <div className="main-content" role="region" aria-label="Workspace canvas">
                  {/* Mobile backdrop */}
                  <div 
                    className={`mobile-backdrop ${isMobileMenuOpen ? 'active' : ''}`}
                    onClick={closeMobileMenu}
                    aria-hidden="true"
                  />
                  
                  <div className={`left-panel-wrapper ${isMobileMenuOpen ? 'active' : ''}`}>
                    <LeftPanel
                      activeTab={activeTab}
                      onTabChange={(tab) => {
                        setActiveTab(tab);
                        // Close mobile menu when tab changes on mobile
                        if (window.innerWidth <= 768) {
                          closeMobileMenu();
                        }
                      }}
                      isCollapsed={isLeftPanelCollapsed}
                      onOpenHelpCenter={openHelpCenter}
                      onCloseMobile={closeMobileMenu}
                    />
                    <button
                      type="button"
                      className={`panel-toggle-btn ${isLeftPanelCollapsed ? 'collapsed' : ''}`}
                      onClick={toggleLeftPanel}
                      aria-pressed={!isLeftPanelCollapsed}
                      aria-expanded={!isLeftPanelCollapsed}
                      aria-controls="configuration-panel"
                      title={isLeftPanelCollapsed ? 'Show configuration panel' : 'Hide configuration panel'}
                    >
                      {isLeftPanelCollapsed ? <ChevronRight size={20} aria-hidden="true" /> : <ChevronLeft size={20} aria-hidden="true" />}
                      <span className="sr-only">
                        {isLeftPanelCollapsed ? 'Expand configuration panel' : 'Collapse configuration panel'}
                      </span>
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

                <RecoverySuggestions />
                {/* Approval Progress Bar - visible after spec upload */}
                <ApprovalProgressBar />
              </>
            )}
          </main>
        </div>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
