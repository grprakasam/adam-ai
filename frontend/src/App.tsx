import { useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import ChatPanel from './components/ChatPanel';
import type { 
  ProgrammingLanguage, 
  LLMProvider, 
  StudyMetadata,
  GenerationOptions,
  GenerationResponse
} from './types';
import './App.css';

function App() {
  const [language, setLanguage] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai' as LLMProvider);
  const [studyMetadata, setStudyMetadata] = useState<StudyMetadata>({
    studyId: '',
    protocolNumber: '',
    therapeuticArea: '',
    studyPhase: ''
  });
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(['DM']);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>({
    includeComments: 'comprehensive',
    codeStyle: 'standard',
    optimizationLevel: 'balanced'
  });
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // API call will be implemented
    console.log('Generating code...', {
      studyMetadata,
      selectedDatasets,
      selectedVariables,
      language,
      llmProvider,
      generationOptions
    });
    
    // Simulate API call
    setTimeout(() => {
      setGenerationResult({
        code: '# Generated ADSL code will appear here...',
        validationResults: [],
        derivationSequence: [],
        qualityMetrics: {
          compliance: 98,
          efficiency: 95,
          coverage: '12/13',
          readability: 'A+'
        },
        documentation: {
          variableDetails: '',
          dataSources: '',
          implementationNotes: ''
        }
      });
      setIsGenerating(false);
    }, 2000);
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
        <Header 
          language={language}
          llmProvider={llmProvider}
          onLanguageChange={setLanguage}
          onLlmProviderChange={setLlmProvider}
        />
        
        <div className="main-content">
          <LeftPanel
            studyMetadata={studyMetadata}
            selectedDatasets={selectedDatasets}
            selectedVariables={selectedVariables}
            generationOptions={generationOptions}
            onStudyMetadataChange={setStudyMetadata}
            onDatasetsChange={setSelectedDatasets}
            onVariablesChange={setSelectedVariables}
            onOptionsChange={setGenerationOptions}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
          
          <RightPanel
            generationResult={generationResult}
            language={language}
          />
        </div>

        <ChatPanel 
          isOpen={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
        />
      </div>
    </ConfigProvider>
  );
}

export default App;
