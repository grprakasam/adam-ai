import { useState } from 'react';
import { ConfigProvider, theme, message } from 'antd';
import Header from './components/Header';
import LeftPanel from './components/LeftPanel';
import RightPanel from './components/RightPanel';
import ChatPanel from './components/ChatPanel';
import LandingPage from './components/LandingPage';
import { useProjectStore } from './store/projectStore';
import api from './services/api';
import type {
  ProgrammingLanguage,
  LLMProvider,
  GenerationResponse,
  GenerationRequest
} from './types';
import './App.css';

type ViewMode = 'landing' | 'workspace';

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [language, setLanguage] = useState<ProgrammingLanguage>('R' as ProgrammingLanguage);
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('google' as LLMProvider);
  const [generationResult, setGenerationResult] = useState<GenerationResponse | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Access Zustand store
  const projectConfig = useProjectStore((state) => state.projectConfig);
  const studyMetadata = useProjectStore((state) => state.studyMetadata);
  const generationOptions = useProjectStore((state) => state.generationOptions);
  const setIsGenerating = useProjectStore((state) => state.setIsGenerating);

  const handleGenerate = async () => {
    try {
      setIsGenerating(true);
      message.loading({ content: 'Generating ADAM code...', key: 'generate', duration: 0 });

      const request: GenerationRequest = {
        studyMetadata: {
          studyId: projectConfig.studyId,
          protocolNumber: projectConfig.protocolNumber,
          therapeuticArea: projectConfig.therapeuticArea,
          studyPhase: projectConfig.studyPhase,
        },
        // SDTM datasets and variables are NO LONGER required
        selectedDatasets: [],
        selectedVariables: [],
        language: language as ProgrammingLanguage,
        llmProvider: llmProvider as LLMProvider,
        options: generationOptions,
      };

      const result = await api.generateCode(request);
      setGenerationResult(result);
      message.success({ content: 'Code generated successfully!', key: 'generate', duration: 3 });
    } catch (error) {
      console.error('Generation error:', error);
      message.error({
        content: 'Failed to generate code. Backend endpoint not yet implemented.',
        key: 'generate',
        duration: 5
      });
      // For demo purposes, set mock data
      setGenerationResult({
        code: `# ADSL Dataset Generation
# Study: ${projectConfig.studyId}
# Protocol: ${projectConfig.protocolNumber}

library(dplyr)
library(haven)

# Read SDTM DM dataset
dm <- read_sas("path/to/dm.sas7bdat")

# Derive ADSL variables
adsl <- dm %>%
  mutate(
    TRTSDT = as.Date(RFSTDTC),
    TRTEDT = as.Date(RFENDTC),
    TRTDUR = as.numeric(TRTEDT - TRTSDT + 1),
    SAFFL = if_else(!is.na(TRTSDT), "Y", "N"),
    ITTFL = if_else(!is.na(TRTSDT), "Y", "N"),
    AGEGR1 = case_when(
      AGE < 18 ~ "<18",
      AGE >= 18 & AGE < 65 ~ "18-64",
      AGE >= 65 ~ ">=65"
    )
  )

# Write ADSL dataset
write_sas(adsl, "path/to/adsl.sas7bdat")`,
        validationResults: [
          { category: 'CDISC Compliance', status: 'pass', message: 'All rules passed' },
          { category: 'Required Variables', status: 'pass', message: 'Complete' },
          { category: 'Data Types', status: 'warning', message: '1 warning' },
          { category: 'Derivation Logic', status: 'pass', message: 'Valid' },
        ],
        derivationSequence: [
          { sequence: 1, variable: 'STUDYID, USUBJID, SUBJID', dependencies: 'Source: DM (no dependencies)' },
          { sequence: 2, variable: 'AGE, AGEGR1', dependencies: 'Source: DM.AGE' },
          { sequence: 3, variable: 'TRTSDT, TRTEDT', dependencies: 'Source: DM.RFSTDTC, DM.RFENDTC' },
          { sequence: 4, variable: 'TRTDUR', dependencies: 'Derived from TRTSDT, TRTEDT' },
          { sequence: 5, variable: 'SAFFL, ITTFL', dependencies: 'Derived from TRTSDT' },
        ],
        qualityMetrics: {
          compliance: 98,
          efficiency: 95,
          coverage: '100%',
          readability: 'A',
        },
        documentation: {
          variableDetails: 'All ADSL variables derived per CDISC standards',
          dataSources: 'DM dataset',
          implementationNotes: 'Standard ADSL derivations applied',
        },
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
              <LeftPanel onGenerate={handleGenerate} />

              <RightPanel
                generationResult={generationResult}
                language={language}
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
