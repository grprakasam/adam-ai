import { useState, useEffect, useRef, useCallback } from 'react';
import { ConfigProvider, theme, message, Modal } from 'antd';
import { AppHeader } from './components/AppHeader';
import RightPanel from './components/RightPanel';
import LandingPage from './components/LandingPage';
import ProjectsPage from './components/ProjectsPage';
import CodeMigrationPage from './components/CodeMigrationPage';
import EnterStudyDetailsPage from './components/EnterStudyDetailsPage';
import ProjectSelectionPage from './components/ProjectSelectionPage';
import { AdminPanel } from './pages/AdminPanel';
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
import { useStudyStore } from './store/studyStore';
import './App.css';

type ViewMode =
  | 'login'
  | 'landing'
  | 'project-selection'
  | 'projects'
  | 'workspace'
  | 'migration'
  | 'enter-study-details'
  | 'admin';

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

  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [language] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [generationResult] = useState<GenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState('project');
  const [isRightPanelUnlocked, setIsRightPanelUnlocked] = useState(true);
  const [isHelpCenterOpen, setHelpCenterOpen] = useState(false);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const mainContentRef = useRef<HTMLElement | null>(null);
  const undo = useWorkspaceHistory((state) => state.undo);
  const redo = useWorkspaceHistory((state) => state.redo);
  const clearHistory = useWorkspaceHistory((state) => state.clear);
  useApplyPreferences();

  // Access Zustand store
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const initializeWorkspace = useProjectStore((state) => state.initializeWorkspace);
  const completionPercentage = useProjectStore((state) => state.getCompletionPercentage());
  const storeCurrentStudyId = useStudyStore((state) => state.currentStudyId);
  const setStoreCurrentStudy = useStudyStore((state) => state.setCurrentStudy);

  // Check for existing authentication on mount and derive initial view from URL
  useEffect(() => {
    const token = localStorage.getItem('adam_access_token');
    const userStr = localStorage.getItem('adam_user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);

        const path = window.location.pathname || '/';
        if (path.startsWith('/admin')) {
          setViewMode('admin');
        } else if (path.startsWith('/enter-study-details')) {
          setViewMode('enter-study-details');
        } else if (path.startsWith('/migration')) {
          setViewMode('migration');
        } else if (path.startsWith('/projects')) {
          setViewMode('projects');
        } else if (path.startsWith('/workspace')) {
          setViewMode('workspace');
        } else {
          setViewMode('landing');
        }
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

  // Left configuration panel has been integrated into the Pair Programming tab.
  // Keep a no-op handler so keyboard shortcuts remain stable.
  const toggleLeftPanel = useCallback(() => {
    // no-op: legacy toggle preserved for shortcut compatibility
  }, []);

  const focusMainContent = useCallback(() => {
    mainContentRef.current?.focus();
  }, []);
  const openHelpCenter = useCallback(() => setHelpCenterOpen(true), []);
  const closeHelpCenter = useCallback(() => setHelpCenterOpen(false), []);
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
    const path = window.location.pathname || '/';
    if (path.startsWith('/admin')) {
      setViewMode('admin');
    } else {
      setViewMode('landing');
    }
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
    setViewMode('project-selection');
  };

  const handleCreateNewProject = () => {
    setViewMode('enter-study-details');
  };

  const handleContinueExistingProject = async (studyId: string) => {
    // Initialize workspace
    clearHistory();
    initializeWorkspace();
    setIsRightPanelUnlocked(true);

    try {
      await setStoreCurrentStudy(studyId);
      setProjectConfig({ studyId } as any);
      // Move to workspace view
      setViewMode('workspace');
    } catch (error) {
      console.error('Failed to open study workspace', error);
      message.error('Failed to open study workspace. Please ensure the study exists and you have access.');
      return;
    }

    // Set default dataset if not selected
    if (!projectConfig.adamDataset) {
      setProjectConfig({ studyId, adamDataset: 'ADSL' } as any);
    }
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

  const handleOpenStudy = async (studyId: string) => {
    // Initialize workspace
    clearHistory();
    initializeWorkspace();
    setIsRightPanelUnlocked(true);

    try {
      await setStoreCurrentStudy(studyId);
      setProjectConfig({ studyId } as any);
      // Move to workspace view
      setViewMode('workspace');
    } catch (error) {
      console.error('Failed to open study workspace', error);
      message.error('Failed to open study workspace. Please ensure the study exists and you have access.');
      return;
    }

    // Set default dataset if not selected
    if (!projectConfig.adamDataset) {
      setProjectConfig({ studyId, adamDataset: 'ADSL' } as any);
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

  const handleOpenUtility = async (path: string) => {
    if (!storeCurrentStudyId) {
      message.info('Please create or select a study first.');
      setViewMode('enter-study-details');
      window.history.pushState({}, '', '/enter-study-details');
      return;
    }

    setViewMode('workspace');

    setIsRightPanelUnlocked(true);

    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('adam-ai:navigate-workspace', {
          detail: { path },
        })
      );
    }, 50);
  };

  const handleStudyChange = (studyId: string) => {
    Modal.confirm({
      title: 'Switch Study?',
      content: 'Are you sure you want to switch studies? Any unsaved work will remain in the current study.',
      okText: 'Switch',
      cancelText: 'Cancel',
      onOk: () => {
        setStoreCurrentStudy(studyId);
        setProjectConfig({ studyId } as any);
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
            ) : (
              <>
                <AppHeader
                  onBackToLanding={() => {
                    setViewMode('landing');
                    window.history.pushState({}, '', '/');
                  }}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  showStudySelector={viewMode !== 'landing'}
                  showWorkspaceControls={viewMode !== 'landing'}
                  currentStudyId={storeCurrentStudyId || undefined}
                  onStudyChange={handleStudyChange}
                />

                {viewMode === 'landing' && (
                  <LandingPage
                    onStartProject={handleStartProject}
                    onOpenMigration={handleOpenMigration}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onNavigateToUtility={handleOpenUtility}
                  />
                )}

                {viewMode === 'project-selection' && (
                  <ProjectSelectionPage
                    onCreateNew={handleCreateNewProject}
                    onContinueExisting={handleContinueExistingProject}
                    onBack={() => {
                      setViewMode('landing');
                      window.history.pushState({}, '', '/');
                    }}
                  />
                )}

                {viewMode === 'projects' && (
                  <ProjectsPage
                    onOpenStudy={handleOpenStudy}
                    onBack={() => {
                      setViewMode('landing');
                      window.history.pushState({}, '', '/');
                    }}
                    studies={[
                      {
                        id: 'demo-study-1',
                        name: 'Demo Study 1',
                        sponsor: 'Demo Sponsor',
                        therapeuticArea: 'General Medicine',
                        description: 'Sample study showcasing ADAM AI capabilities.',
                        lastUpdated: 'Updated today',
                      },
                    ]}
                  />
                )}

                {viewMode === 'migration' && (
                  <CodeMigrationPage
                    onBack={() => {
                      setViewMode('landing');
                      window.history.pushState({}, '', '/');
                    }}
                  />
                )}

                {viewMode === 'enter-study-details' && (
                  <EnterStudyDetailsPage
                    onBack={() => {
                      setViewMode('project-selection');
                      window.history.pushState({}, '', '/project-selection');
                    }}
                    onStudyCreated={async (studyId: string) => {
                      // Initialize workspace
                      clearHistory();
                      initializeWorkspace();
                      setIsRightPanelUnlocked(false);

                      try {
                        await setStoreCurrentStudy(studyId);
                        setProjectConfig({ studyId } as any);
                        // Move to workspace view
                        setViewMode('workspace');
                      } catch (error) {
                        console.error('Failed to open study workspace', error);
                        message.error('Failed to open study workspace. Please ensure the study exists and you have access.');
                      }

                      // Set default dataset if not selected
                      if (!projectConfig.adamDataset) {
                        setProjectConfig({ studyId, adamDataset: 'ADSL' } as any);
                      }
                    }}
                  />
                )}

                {viewMode === 'admin' && <AdminPanel />}

                {viewMode === 'workspace' && (
                  <>
                    <HelpCenterDrawer open={isHelpCenterOpen} onClose={closeHelpCenter} activeTab={activeTab} />
                    <PreferencesDrawer open={isPreferencesOpen} onClose={closePreferences} />

                    <div className="main-content" role="region" aria-label="Workspace canvas">
                      <RightPanel
                        generationResult={generationResult}
                        language={language}
                        isUnlocked={isRightPanelUnlocked}
                        completionPercentage={completionPercentage}
                        onUnlock={handleUnlockPairProgramming}
                        onSwitchProject={handleSwitchProject}
                        onOpenHelpCenter={openHelpCenter}
                      />
                    </div>

                    <RecoverySuggestions />
                    {/* Approval Progress Bar - visible after spec upload */}
                    <ApprovalProgressBar />
                  </>
                )}
              </>
            )}
          </main>
        </div>
      </ConfigProvider>
    </ErrorBoundary>
  );
}

export default App;
