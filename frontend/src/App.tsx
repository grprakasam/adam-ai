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
import { RecoverySuggestions } from './components/RecoverySuggestions';
import { HelpCenterDrawer } from './components/HelpCenterDrawer';
import { PreferencesDrawer } from './components/PreferencesDrawer';
import { QuickCreateStudy } from './components/QuickCreateStudy';
import { useWorkspaceHistory } from './store/historyStore';
import { notifyUserError } from './utils/errorNotifications';
import { clearStaleAuthTokens } from './utils/clearAuth';
import type { ProgrammingLanguage, GenerationResponse } from './types';
import { SkipLink } from './components/a11y/SkipLink';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useApplyPreferences } from './hooks/useApplyPreferences';
import { useStudyStore, StudyDocument } from './store/studyStore';
import { setupStudyDocumentSync, syncStudySpecificationToProjectStore } from './utils/studyDocumentSync';
import { SpecificationSelectionModal } from './components/SpecificationSelectionModal';
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

const WORKSPACE_ROUTES = [
  '/workspace', '/pair-programming', '/code-review', '/consolidated-code',
  '/generation-history', '/traceability', '/test-with-data', '/adam-generator',
  '/adam-dataset-comparer', '/submission-dashboard', '/submission-package',
  '/code-validator', '/validation-reports', '/r-frontend', '/adam-data-analytics',
  '/study-chatbot', '/code-comparer', '/code-understanding', '/tlf-generator', '/adam-tutor',
  '/agentic-ai', '/code-refactorer', '/missing-spec-detector',
  '/spec-comparison', '/esubmission-checker', '/fda-reviewer-preview'
];

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('login');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [language] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [generationResult] = useState<GenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState('project');
  const [isRightPanelUnlocked, setIsRightPanelUnlocked] = useState(true);
  const [isHelpCenterOpen, setHelpCenterOpen] = useState(false);
  const [isPreferencesOpen, setPreferencesOpen] = useState(false);
  const [isQuickCreateOpen, setQuickCreateOpen] = useState(false);
  const [specSelectionModalVisible, setSpecSelectionModalVisible] = useState(false);
  const [pendingSpecDocuments, setPendingSpecDocuments] = useState<StudyDocument[]>([]);
  const [pendingSpecStudyId, setPendingSpecStudyId] = useState<string>('');
  const mainContentRef = useRef<HTMLElement | null>(null);

  const undo = useWorkspaceHistory((state) => state.undo);
  const redo = useWorkspaceHistory((state) => state.redo);
  const clearHistory = useWorkspaceHistory((state) => state.clear);

  useApplyPreferences();

  useEffect(() => {
    clearStaleAuthTokens();
  }, []);

  // Set up study document sync - automatically loads specification files when study is selected
  useEffect(() => {
    const cleanup = setupStudyDocumentSync();
    return cleanup;
  }, []);

  // Handle multiple specification files event
  useEffect(() => {
    const handleMultipleSpecs = (event: CustomEvent<{ studyId: string; specificationDocuments: StudyDocument[] }>) => {
      const { studyId, specificationDocuments } = event.detail;
      if (specificationDocuments && specificationDocuments.length > 1) {
        setPendingSpecStudyId(studyId);
        setPendingSpecDocuments(specificationDocuments);
        setSpecSelectionModalVisible(true);
      }
    };

    window.addEventListener('multiple-specifications-found', handleMultipleSpecs as EventListener);
    return () => {
      window.removeEventListener('multiple-specifications-found', handleMultipleSpecs as EventListener);
    };
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      try {
        const tab = e?.detail?.tab;
        if (tab) setActiveTab(tab);
      } catch { }
    };
    window.addEventListener('adam-ai:open-left-tab', handler as any);
    return () => window.removeEventListener('adam-ai:open-left-tab', handler as any);
  }, []);

  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const initializeWorkspace = useProjectStore((state) => state.initializeWorkspace);
  const completionPercentage = useProjectStore((state) => state.getCompletionPercentage());
  const storeCurrentStudyId = useStudyStore((state) => state.currentStudyId);
  const setStoreCurrentStudy = useStudyStore((state) => state.setCurrentStudy);

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
        } else if (WORKSPACE_ROUTES.some(route => path.startsWith(route))) {
          setViewMode('workspace');
        } else {
          setViewMode('landing');
        }
      } catch (error) {
        localStorage.removeItem('adam_access_token');
        localStorage.removeItem('adam_user');
        setViewMode('login');
      }
    } else {
      setViewMode('login');
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

  // Handle navigation events (popstate, locationchange)
  useEffect(() => {
    const handleNavigation = () => {
      const path = window.location.pathname || '/';

      if (path.startsWith('/admin')) {
        setViewMode('admin');
      } else if (path.startsWith('/enter-study-details')) {
        setViewMode('enter-study-details');
      } else if (path.startsWith('/migration')) {
        setViewMode('migration');
      } else if (path.startsWith('/projects')) {
        setViewMode('projects');
      } else if (WORKSPACE_ROUTES.some(route => path.startsWith(route))) {
        setViewMode('workspace');
      } else if (path === '/' || path === '/landing') {
        setViewMode('landing');
      }
    };

    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('locationchange', handleNavigation);

    return () => {
      window.removeEventListener('popstate', handleNavigation);
      window.removeEventListener('locationchange', handleNavigation);
    };
  }, []);

  useEffect(() => {
    mainContentRef.current?.focus();
  }, [viewMode]);

  const toggleLeftPanel = useCallback(() => { }, []);

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
    clearHistory();
    initializeWorkspace();
    setIsRightPanelUnlocked(true);

    try {
      await setStoreCurrentStudy(studyId);
      setProjectConfig({ studyId } as any);
      setViewMode('workspace');
    } catch (error) {
      message.error('Failed to open study workspace. Please ensure the study exists and you have access.');
      return;
    }

    if (!projectConfig.adamDataset) {
      setProjectConfig({ studyId, adamDataset: 'ADSL' } as any);
    }

    // Try to sync specification from study documents
    syncStudySpecificationToProjectStore(studyId);
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
    clearHistory();
    initializeWorkspace();
    setIsRightPanelUnlocked(true);

    try {
      await setStoreCurrentStudy(studyId);
      setProjectConfig({ studyId } as any);
      setViewMode('workspace');
    } catch (error) {
      message.error('Failed to open study workspace. Please ensure the study exists and you have access.');
      return;
    }

    if (!projectConfig.adamDataset) {
      setProjectConfig({ studyId, adamDataset: 'ADSL' } as any);
    }

    // Try to sync specification from study documents first
    // The study-documents-ready event will trigger auto-sync, but we also try manually
    const synced = syncStudySpecificationToProjectStore(studyId);

    if (!synced && !specificationFile) {
      // Only fall back to default if no study spec found and no existing spec
      const defaultSpecPath = 'Content/UserInputs/ADAMSpecifications/ADSLSpec.xlsx';
      const defaultSpecName = 'ADSLSpec.xlsx';
      setSpecificationFile({
        name: defaultSpecName,
        path: defaultSpecPath,
        size: 0,
        uploadedAt: new Date().toISOString(),
        isDefault: true,
      } as any);
      message.info({ content: 'Using default specification. Upload a study-specific spec in Enter Study Details.', duration: 3 });
    } else if (synced) {
      message.success({ content: 'Study specification loaded from documents!', duration: 2 });
    }

    message.success({ content: 'Workspace initialized! Configure your project to generate code.', duration: 2 });
  };

  const handleOpenUtility = async (path: string) => {
    // Allow access to all modules without mandatory study
    // Study context is optional - modules will adapt gracefully
    setViewMode('workspace');
    setIsRightPanelUnlocked(true);

    // If study is selected, it's already in the store
    // Modules can check storeCurrentStudyId and adapt accordingly

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
          <main
            id="main-content"
            ref={mainContentRef}
            tabIndex={-1}
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
            {viewMode !== 'login' && (
              <>
                <AppHeader
                  onBackToLanding={viewMode !== 'landing' ? () => {
                    setViewMode('landing');
                    window.history.pushState({}, '', '/');
                  } : undefined}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  showStudySelector={true}
                  showWorkspaceControls={viewMode !== 'landing'}
                  currentStudyId={storeCurrentStudyId || undefined}
                  onStudyChange={handleStudyChange}
                  onCreateStudy={() => setQuickCreateOpen(true)}
                  isOnLandingPage={viewMode === 'landing'}
                  onNavigateToUtility={handleOpenUtility}
                />

                {/* Quick Create Study Modal */}
                <QuickCreateStudy
                  visible={isQuickCreateOpen}
                  onClose={() => setQuickCreateOpen(false)}
                  onStudyCreated={(studyId) => {
                    setProjectConfig({ studyId } as any);
                    message.success('Study created! You can now work with study context.');
                  }}
                  onAdvancedOptions={() => {
                    setViewMode('enter-study-details');
                    window.history.pushState({}, '', '/enter-study-details');
                  }}
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
                      clearHistory();
                      initializeWorkspace();
                      setIsRightPanelUnlocked(false);

                      try {
                        await setStoreCurrentStudy(studyId);
                        setProjectConfig({ studyId } as any);
                        setViewMode('workspace');
                      } catch (error) {
                        message.error('Failed to open study workspace. Please ensure the study exists and you have access.');
                      }

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
                        key={storeCurrentStudyId || 'default-workspace'}
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
                    <ApprovalProgressBar />

                    {/* Specification Selection Modal - shown when study has multiple spec files */}
                    <SpecificationSelectionModal
                      visible={specSelectionModalVisible}
                      studyId={pendingSpecStudyId}
                      specificationDocuments={pendingSpecDocuments}
                      onClose={() => {
                        setSpecSelectionModalVisible(false);
                        setPendingSpecDocuments([]);
                        setPendingSpecStudyId('');
                      }}
                      onSelect={(documentId, sheetName) => {
                        console.log('User selected specification:', documentId, sheetName);
                        message.success('Specification file selected. You may need to re-categorize variables.');
                      }}
                    />
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
