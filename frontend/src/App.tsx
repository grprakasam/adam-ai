import { useState } from 'react';
import { ConfigProvider, theme, message } from 'antd';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import ChatPanel from './components/ChatPanel';
import LandingPage from './components/LandingPage';
import { useProjectStore } from './store/projectStore';
import api from './services/api';
import type { ProgrammingLanguage, LLMProvider, GenerationResponse } from './types';
import './App.css';

type ViewMode = 'landing' | 'workspace';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [language, setLanguage] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('google' as LLMProvider);
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('project');

  // Access Zustand store
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const studyMetadata = useProjectStore((state) => state.studyMetadata);
  const generationOptions = useProjectStore((state) => state.generationOptions);
  const specificationFile = useProjectStore((state) => state.specificationFile);
  const tempSpecFile = useProjectStore((state) => state.tempSpecFile);
  const setCategorizedVariables = useProjectStore((state) => state.setCategorizedVariables);
  const setIsCategorizingVariables = useProjectStore((state) => state.setIsCategorizingVariables);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      message.loading({ content: 'Preparing workspace...', key: 'generate', duration: 0 });

      // Note: Actual code generation endpoint will be implemented in Phase 6
      // For now, we just show a success message and let user configure the workspace
      
      message.success({ 
        content: 'Workspace ready! Complete all tabs to generate code.', 
        key: 'generate', 
        duration: 2 
      });

      // Optionally auto-trigger Variables Analysis if spec is uploaded
      if (specificationFile && projectConfig.adamDataset) {
        try {
          setIsCategorizingVariables(true);
          let categorization = null as any;
          try {
            // Try by server path first (default spec lives in repo)
            categorization = await api.categorizeSpecification(
              specificationFile.path,
              projectConfig.adamDataset
            );
          } catch (pathErr: any) {
            const status = pathErr?.response?.status;
            if (status === 404 && tempSpecFile) {
              // Fall back to uploading the file blob the user selected
              categorization = await api.categorizeSpecificationFile(
                tempSpecFile,
                projectConfig.adamDataset
              );
            } else {
              throw pathErr;
            }
          }
          if (categorization) {
            setCategorizedVariables(categorization);
            message.success('Variables categorized successfully!');
          }
        } catch (catErr) {
          console.error('Variable categorization error:', catErr);
          message.warning('Variables Analysis could not be completed. You can retry later.');
        } finally {
          setIsCategorizingVariables(false);
        }
      }
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

  return (
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
          <LandingPage onStartProject={() => setViewMode('workspace')} />
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
                activeTab={activeTab}
              />
            </div>

            <ChatPanel
              isOpen={chatOpen}
              onToggle={() => setChatOpen(!chatOpen)}
            />
          </>
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
