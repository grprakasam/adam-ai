import { useState } from 'react';
import { ConfigProvider, theme, message } from 'antd';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import LandingPage from './components/LandingPage';
import { ApprovalProgressBar } from './components/ApprovalProgressBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useProjectStore } from './store/projectStore';
import type { ProgrammingLanguage, GenerationResponse } from './types';
import './App.css';

type ViewMode = 'landing' | 'workspace';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [language, setLanguage] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [generationResult] = useState<GenerationResponse | null>(null);
  const [activeTab, setActiveTab] = useState('project');

  // Access Zustand store
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);
  const setProjectConfig = useProjectStore((state) => state.setProjectConfig);
  const setSpecificationFile = useProjectStore((state) => state.setSpecificationFile);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const initializeWorkspace = useProjectStore((state) => state.initializeWorkspace);
  const llmProvider = useProjectStore((state) => state.llmProvider);
  const setLlmProvider = useProjectStore((state) => state.setLlmProvider);

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
          {viewMode === 'landing' ? (
            <LandingPage onStartProject={handleStartProject} />
          ) : (
            <>
              <Header
                language={language}
                llmProvider={llmProvider}
                onLanguageChange={setLanguage}
                onLlmProviderChange={setLlmProvider}
                onBackToLanding={() => setViewMode('landing')}
              />

              <div className="main-content">
                <LeftPanel
                  onGenerate={handleGenerate}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />

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
