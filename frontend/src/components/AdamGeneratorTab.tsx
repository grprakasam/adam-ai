/**
 * ADAM Generator Tab Component
 * 
 * Executes consolidated R/SAS programs against SDTM datasets to produce ADAM datasets.
 * Uses Dockerized R runtime for scalability and security.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Select,
  Alert,
  Table,
  message,
  Modal,
  Rate,
  Input,
  Space,
  Descriptions,
  Tag,
  Progress,
  Collapse,
  Typography,
  Row,
  Col,
  Tooltip,
  Spin,
  Divider,
} from 'antd';
import {
  PlayCircleOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  RocketOutlined,
  CopyOutlined,
  FormatPainterOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  BgColorsOutlined,
  FolderOpenOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { FileCode } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { triggerDownload } from '../utils/downloadHelpers';
import type {
  RVersionInfo,
  SDTMInputStatus,
  AdamGenerationStatus,
  AdamGenerationResult,
} from '../types/adamGeneration';
import type { ExecutionCapabilities } from '../types/rExecution';
import './AdamGeneratorTab.css';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;

// Types imported from types/adamGeneration.ts

export const AdamGeneratorTab: React.FC = () => {
  const { projectConfig, consolidatedCode } = useProjectStore();

  // State
  const [rVersion, setRVersion] = useState<string>('4.3.2');
  const [availableVersions, setAvailableVersions] = useState<RVersionInfo[]>([]);
  const [code, setCode] = useState<string>('');
  const [sdtmInputs, setSdtmInputs] = useState<SDTMInputStatus | null>(null);
  const [loadingSdtmInputs, setLoadingSdtmInputs] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [result, setResult] = useState<AdamGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AdamGenerationStatus | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState<number>(0);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [isProductionReady, setIsProductionReady] = useState(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [rOutput, setROutput] = useState<string>('');

  // R Execution capabilities (Docker vs Local R)
  const [capabilities, setCapabilities] = useState<ExecutionCapabilities | null>(null);
  const [executionMethod, setExecutionMethod] = useState<'docker' | 'local_r'>('docker');

  // Editor UX enhancements
  const [editorTheme, setEditorTheme] = useState<'vs' | 'vs-dark' | 'hc-black'>('vs');
  const [fontSize, setFontSize] = useState(14);
  const [showMinimap, setShowMinimap] = useState(false);
  const [wordWrap, setWordWrap] = useState<'on' | 'off'>('on');
  const [editorRef, setEditorRef] = useState<any>(null);
  const [showSnippets, setShowSnippets] = useState(false);

  // R Code Snippets/Templates
  const codeSnippets = {
    'Basic ADAM Template': `# ADAM Dataset Generation Script
# Study: ${projectConfig.studyId || 'STUDY-001'}
# Dataset: ${projectConfig.adamDataset || 'ADSL'}
# Generated: ${new Date().toLocaleDateString()}

# Load required libraries
library(dplyr)
library(tidyr)
library(lubridate)

# Load SDTM datasets
dm <- read_sas("path/to/dm.sas7bdat")
ex <- read_sas("path/to/ex.sas7bdat")
ae <- read_sas("path/to/ae.sas7bdat")

# Create ADAM dataset
adam <- dm %>%
  # Add your transformations here
  mutate(
    STUDYID = STUDYID,
    USUBJID = USUBJID
  )

# Save output
write.csv(adam, "adam_output.csv", row.names = FALSE)`,
    
    'Date Calculations': `# Date calculations and derivations
library(lubridate)

adam <- adam %>%
  mutate(
    # Calculate age
    AGE = as.numeric(difftime(RFSTDTC, BRTHDTC, units = "days")) / 365.25,
    
    # Calculate study day
    ADY = as.numeric(difftime(ADT, RFSTDTC, units = "days")),
    
    # Format dates
    ADT = as.Date(ADT, format = "%Y-%m-%d")
  )`,
    
    'Merge Operations': `# Merge SDTM datasets
adam <- dm %>%
  left_join(ex, by = "USUBJID") %>%
  left_join(ae, by = "USUBJID") %>%
  # Add merge flags
  mutate(
    HAS_EX = !is.na(EXSEQ),
    HAS_AE = !is.na(AESEQ)
  )`,
    
    'Categorical Variables': `# Create categorical variables
adam <- adam %>%
  mutate(
    AGEGR1 = case_when(
      AGE < 18 ~ "<18",
      AGE >= 18 & AGE < 65 ~ "18-64",
      AGE >= 65 ~ ">=65",
      TRUE ~ "Missing"
    ),
    SEXN = case_when(
      SEX == "M" ~ 1,
      SEX == "F" ~ 2,
      TRUE ~ NA_real_
    )
  )`,
    
    'Summary Statistics': `# Generate summary statistics
summary_stats <- adam %>%
  group_by(TRT01P) %>%
  summarise(
    N = n(),
    Mean_Age = mean(AGE, na.rm = TRUE),
    SD_Age = sd(AGE, na.rm = TRUE),
    Min_Age = min(AGE, na.rm = TRUE),
    Max_Age = max(AGE, na.rm = TRUE)
  )`
  };

  const checkSdtmInputs = useCallback(async (showLoading = false) => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      return;
    }
    try {
      if (showLoading) {
        setLoadingSdtmInputs(true);
      }
      const inputs = await adamApi.checkSdtmInputs({
        study_id: projectConfig.studyId,
        adam_dataset: projectConfig.adamDataset,
      });
      
      // Only update if data has changed to avoid unnecessary re-renders
      setSdtmInputs(prevInputs => {
        if (!prevInputs || 
            JSON.stringify(prevInputs.available_domains.sort()) !== JSON.stringify(inputs.available_domains.sort()) ||
            JSON.stringify(prevInputs.missing_domains.sort()) !== JSON.stringify(inputs.missing_domains.sort())) {
          return inputs;
        }
        return prevInputs;
      });
    } catch (err: any) {
      if (showLoading) {
        message.error('Failed to check SDTM inputs: ' + (err.message || 'Unknown error'));
      }
    } finally {
      if (showLoading) {
        setLoadingSdtmInputs(false);
      }
    }
  }, [projectConfig.studyId, projectConfig.adamDataset]);

  const generateMissingDatasets = useCallback(async () => {
    if (!projectConfig.studyId || !sdtmInputs || sdtmInputs.missing_domains.length === 0) {
      return;
    }

    setLoadingSdtmInputs(true);
    try {
      message.loading({
        content: `Generating ${sdtmInputs.missing_domains.length} missing SDTM dataset(s)...`,
        key: 'generate-missing',
        duration: 0,
      });

      // Get current parameters from project config or use defaults
      const batchRequest = {
        domains: sdtmInputs.missing_domains,
        study_id: projectConfig.studyId,
        num_subjects: 50, // Default, can be made configurable
        sdtm_version: projectConfig.sdtmVersion || '3.4',
        adam_ig_version: projectConfig.adamIgVersion || '1.3',
        study_start_date: '2024-01-01',
        study_end_date: '2024-12-31',
        study_phase: 'Phase III',
        therapeutic_area: 'Oncology',
        sex_distribution: 'balanced' as const,
        age_min: 18,
        age_max: 75,
        age_distribution: 'realistic' as const,
        num_treatment_arms: 2,
        treatment_arms: ['Placebo', 'Active'],
        randomization_ratio: '1:1',
        num_visits: 5,
        visit_schedule_days: [1, 15, 30, 60, 90],
        visit_window_days: 3,
        records_per_subject: 5,
        missingness_pct: 10,
        protocol_deviations_pct: 5,
        outlier_pct: 2,
        distribution_type: 'realistic' as const,
        template_source: 'pharmaverse' as const,
        include_meddra: true,
        include_ct: true,
        serious_ae_pct: 5.0,
        severe_ae_pct: 10.0,
        related_ae_pct: 30.0,
        lab_abnormality_pct: 15.0,
      };

      const result = await adamApi.generateSdtmBatch(batchRequest);

      if (result.status === 'success' || result.status === 'partial') {
        message.success({
          content: `Successfully generated ${result.total_generated} of ${result.total_requested} dataset(s)`,
          key: 'generate-missing',
          duration: 4,
        });

        if (result.failed.length > 0) {
          message.warning({
            content: `Some datasets failed to generate: ${result.failed.map(f => f.domain).join(', ')}`,
            duration: 6,
          });
        }

        // Reload SDTM inputs to reflect new datasets
        await checkSdtmInputs(true);
      } else {
        throw new Error(result.message || 'Failed to generate datasets');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate missing datasets';
      message.error({
        content: `Failed to generate datasets: ${errorMessage}`,
        key: 'generate-missing',
        duration: 6,
      });
      console.error('Error generating missing datasets:', err);
    } finally {
      setLoadingSdtmInputs(false);
    }
  }, [projectConfig, sdtmInputs, checkSdtmInputs]);

  const loadSdtmData = useCallback(async () => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      message.warning('Please set Study ID and ADAM Dataset first.');
      return;
    }

    setLoadingSdtmInputs(true);
    try {
      console.log('Loading SDTM data for:', {
        study_id: projectConfig.studyId,
        adam_dataset: projectConfig.adamDataset
      });

      const inputs = await adamApi.checkSdtmInputs({
        study_id: projectConfig.studyId,
        adam_dataset: projectConfig.adamDataset,
      });

      console.log('SDTM inputs response:', inputs);

      // Ensure inputs object exists
      if (!inputs) {
        message.warning({
          content: 'No SDTM data found. Please generate SDTM datasets in the SDTM Generator section first, then try loading again.',
          duration: 6,
        });
        // Set empty state to show the UI
        setSdtmInputs({
          study_id: projectConfig.studyId,
          adam_dataset: projectConfig.adamDataset,
          required_domains: [],
          available_domains: [],
          missing_domains: [],
          dataset_metadata: {}
        });
        return;
      }

      // Ensure arrays exist
      const availableDomains = inputs.available_domains || [];
      const requiredDomains = inputs.required_domains || [];
      const missingDomains = inputs.missing_domains || [];

      // Always update state, even if no data found
      setSdtmInputs({
        study_id: inputs.study_id || projectConfig.studyId,
        adam_dataset: inputs.adam_dataset || projectConfig.adamDataset,
        required_domains: requiredDomains,
        available_domains: availableDomains,
        missing_domains: missingDomains,
        dataset_metadata: inputs.dataset_metadata || {}
      });

      // Check if any SDTM data exists
      if (availableDomains.length === 0) {
        message.warning({
          content: 'No SDTM data found. Please generate SDTM datasets in the SDTM Generator section first, then try loading again.',
          duration: 6,
        });
        return;
      }

      // Data exists, show success
      const domainCount = availableDomains.length;
      message.success(`SDTM data loaded successfully! Found ${domainCount} dataset${domainCount !== 1 ? 's' : ''}: ${availableDomains.join(', ')}`);
    } catch (err: any) {
      console.error('Error loading SDTM data:', err);
      const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || 'Unknown error';
      message.error({
        content: `Failed to load SDTM data: ${errorMessage}`,
        duration: 6,
      });
      
      // Set empty state on error so UI doesn't break
      setSdtmInputs({
        study_id: projectConfig.studyId,
        adam_dataset: projectConfig.adamDataset,
        required_domains: [],
        available_domains: [],
        missing_domains: [],
        dataset_metadata: {}
      });
    } finally {
      setLoadingSdtmInputs(false);
    }
  }, [projectConfig.studyId, projectConfig.adamDataset]);

  // Keyboard shortcut for Run (Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Enter or Cmd+Enter to run code
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (canExecute && !isExecuting && code.trim()) {
          handleExecute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [canExecute, isExecuting, code, handleExecute]);

  // Load initial data and pre-populate inputs
  useEffect(() => {
    loadRVersions();
    // Don't auto-check SDTM inputs on load - user should click "Load SDTM Data" button
    // checkSdtmInputs();
    
    // Pre-populate consolidated code on load
    if (consolidatedCode?.consolidated_code) {
      setCode(consolidatedCode.consolidated_code);
    }
    
    // Cleanup event source on unmount
    return () => {
      const eventSource = (window as any).__adamGeneratorEventSource;
      if (eventSource) {
        eventSource.close();
        delete (window as any).__adamGeneratorEventSource;
      }
    };
  }, [projectConfig.studyId, projectConfig.adamDataset]);

  // Auto-generate DM dataset if no SDTM data exists
  useEffect(() => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      return;
    }

    const autoGenerateDM = async () => {
      try {
        // Check current SDTM inputs
        const inputs = await adamApi.checkSdtmInputs({
          study_id: projectConfig.studyId,
          adam_dataset: projectConfig.adamDataset,
        });

        // If DM dataset is not available, generate it automatically
        const hasDM = inputs.available_domains && inputs.available_domains.includes('DM');
        
        if (!hasDM) {
          message.loading({ content: 'Generating default DM dataset (50 records)...', key: 'auto-generate', duration: 0 });
          
          const dmGenerationParams = {
            domain: 'DM',
            num_subjects: 50,
            sdtm_version: '3.4',
            adam_ig_version: '1.3',
            study_start_date: '2024-01-01',
            study_end_date: '2024-12-31',
            study_phase: 'Phase III',
            therapeutic_area: 'Oncology',
            sex_distribution: 'balanced',
            age_min: 18,
            age_max: 75,
            age_distribution: 'realistic',
            num_treatment_arms: 2,
            treatment_arms: ['Placebo', 'Active'],
            randomization_ratio: '1:1',
            num_visits: 5,
            visit_schedule_days: [1, 15, 30, 60, 90],
            visit_window_days: 3,
            records_per_subject: 1,
            missingness_pct: 10,
            protocol_deviations_pct: 5,
            outlier_pct: 2,
            distribution_type: 'realistic',
            template_source: 'pharmaverse',
            include_meddra: true,
            include_ct: true,
            serious_ae_pct: 5.0,
            severe_ae_pct: 10.0,
            related_ae_pct: 30.0,
            lab_abnormality_pct: 15.0,
          };

          const response = await fetch('/api/v1/test-data/generate-sdtm?study_id=' + encodeURIComponent(projectConfig.studyId), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dmGenerationParams),
          });

          if (!response.ok) {
            let errorMessage = `Server error: ${response.status} ${response.statusText}`;
            try {
              const errorText = await response.text();
              if (errorText) {
                try {
                  const errorData = JSON.parse(errorText);
                  errorMessage = errorData.detail || errorData.message || errorMessage;
                } catch {
                  if (errorText.length < 200) {
                    errorMessage = errorText;
                  }
                }
              }
            } catch (e) {
              console.error('Failed to read error response:', e);
            }
            throw new Error(errorMessage);
          }

          // Check if response has content before parsing JSON
          const responseText = await response.text();
          if (!responseText || responseText.trim().length === 0) {
            throw new Error('Server returned an empty response');
          }

          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Failed to parse JSON response:', parseError);
            throw new Error('Server returned invalid JSON response');
          }

          if (data.status === 'success') {
            message.success({
              content: 'Default DM dataset generated successfully (50 records)',
              key: 'auto-generate',
              duration: 3,
            });
            // Refresh SDTM inputs to show the newly generated dataset
            await checkSdtmInputs();
          } else {
            message.error({
              content: 'Failed to generate default DM dataset: ' + (data.message || 'Unknown error'),
              key: 'auto-generate',
              duration: 5,
            });
          }
        } else {
          // Data exists, just refresh to show current state
          checkSdtmInputs();
        }
      } catch (err: any) {
        message.error({
          content: 'Failed to check/generate SDTM datasets: ' + (err.message || 'Unknown error'),
          key: 'auto-generate',
          duration: 5,
        });
      }
    };

    autoGenerateDM();
  }, [projectConfig.studyId, projectConfig.adamDataset, checkSdtmInputs]);

  const loadRVersions = async () => {
    try {
      const versions = await adamApi.getRVersions();
      setAvailableVersions(versions);
      const defaultVersion = versions.find(v => v.is_default) || versions[0];
      if (defaultVersion) {
        setRVersion(defaultVersion.version);
      }
    } catch (err: any) {
      message.error('Failed to load R versions: ' + (err.message || 'Unknown error'));
    }
  };

  const loadConsolidatedCode = useCallback(() => {
    // Check if consolidated code exists
    if (!consolidatedCode) {
      message.warning('Consolidated code is not ready. Please generate the consolidated code in the Consolidated Code section first, then try again.');
      return;
    }

    const codeToLoad = consolidatedCode.consolidated_code;
    
    // Validate that code exists and is not empty
    if (!codeToLoad || codeToLoad.trim().length === 0) {
      message.warning('Consolidated code is empty. Please generate the consolidated code in the Consolidated Code section first, then try again.');
      return;
    }

    console.log('Loading consolidated code:', { 
      codeLength: codeToLoad.length, 
      lineCount: codeToLoad.split('\n').length,
      firstChars: codeToLoad.substring(0, 100)
    });

    // Update state immediately - this triggers React re-render
    setCode(codeToLoad);

    // Update editor directly if it's mounted (immediate update)
    if (editorRef) {
      try {
        // Force update the editor value
        editorRef.setValue(codeToLoad);
        
        // Move cursor to top and scroll to top
        editorRef.setPosition({ lineNumber: 1, column: 1 });
        editorRef.revealLine(1);
        editorRef.revealLineInCenter(1);
        
        // Force editor to update its layout
        editorRef.layout();
        
        // Verify the update
        const updatedValue = editorRef.getValue();
        console.log('Editor updated:', { 
          updatedLength: updatedValue.length,
          matches: updatedValue === codeToLoad
        });
      } catch (error) {
        console.error('Error updating editor:', error);
        message.error('Failed to update editor. Please try again.');
      }
    } else {
      console.warn('Editor ref not available, will retry in 100ms');
    }

    // Also use setTimeout as a fallback to ensure update happens even if editor wasn't ready
    setTimeout(() => {
      if (editorRef) {
        const currentValue = editorRef.getValue();
        if (currentValue !== codeToLoad) {
          console.log('Fallback: Updating editor value');
          editorRef.setValue(codeToLoad);
          editorRef.setPosition({ lineNumber: 1, column: 1 });
          editorRef.revealLine(1);
          editorRef.layout();
        } else {
          console.log('Editor value already matches');
        }
      } else {
        console.warn('Editor ref still not available after timeout');
      }
    }, 200);

    const lineCount = codeToLoad.split('\n').length;
    message.success(`Consolidated code loaded successfully (${lineCount} lines)`);
  }, [consolidatedCode, editorRef]);

  // Enhanced editor functions
  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    message.success('Code copied to clipboard');
  }, [code]);

  const handleFormatCode = useCallback(() => {
    if (editorRef) {
      editorRef.getAction('editor.action.formatDocument')?.run();
      message.success('Code formatted');
    } else {
      message.warning('Editor not ready. Please wait a moment and try again.');
    }
  }, [editorRef]);

  const handleEditorDidMount = (editor: any, monacoInstance: any) => {
    setEditorRef(editor);
    
    // Configure R language support
    if (monacoInstance && monacoInstance.languages) {
      monacoInstance.languages.setLanguageConfiguration('r', {
        comments: {
          lineComment: '#',
          blockComment: ['/*', '*/']
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')']
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" }
        ]
      });
    }

    // Add keyboard shortcuts
    if (monacoInstance && monacoInstance.KeyMod && monacoInstance.KeyCode) {
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
        handleDownloadCode();
      });
      
      editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyF, () => {
        handleFormatCode();
      });
    }
  };

  const handleDownloadCode = () => {
    triggerDownload(
      new Blob([code], { type: 'text/plain' }),
      `${projectConfig.adamDataset || 'program'}.R`,
      {
        onSuccess: () => message.success('Code downloaded'),
        onError: (err) => message.error(`Download failed: ${err.message}`)
      }
    );
  };

  // Code statistics
  const codeStats = useMemo(() => {
    const lines = code.split('\n').length;
    const characters = code.length;
    const nonEmptyLines = code.split('\n').filter(line => line.trim().length > 0).length;
    const words = code.split(/\s+/).filter(word => word.length > 0).length;
    return { lines, characters, nonEmptyLines, words };
  }, [code]);

  const handleExecute = async () => {
    // Validation
    if (!code.trim()) {
      message.error('R code is empty. Please add code to execute.');
      return;
    }

    if (!projectConfig.studyId) {
      message.error('Study ID is required. Please set it in the Setup tab.');
      return;
    }

    if (!projectConfig.adamDataset) {
      message.error('ADAM dataset is required. Please select it in the Setup tab.');
      return;
    }

    // Check SDTM inputs
    if (sdtmInputs && sdtmInputs.missing_domains.length > 0) {
      Modal.warning({
        title: 'Missing SDTM Datasets',
        content: `Required SDTM domains are missing: ${sdtmInputs.missing_domains.join(', ')}. Please generate them in the Testing tab first.`,
      });
      return;
    }

    // Start execution immediately (no confirmation needed for better UX)
    setIsExecuting(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setExecutionLogs([]);
    setROutput('');
    setCurrentStep('Initializing Docker environment...');

    try {
      // Add initial log
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Starting R execution...`]);
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Using R version: ${rVersion}`]);
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Study ID: ${projectConfig.studyId}`]);
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Target dataset: ${projectConfig.adamDataset}`]);
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] SDTM domains: ${sdtmInputs?.available_domains.join(', ') || 'None'}`]);

      // Start execution
      const response = await adamApi.startAdamGeneration({
        study_id: projectConfig.studyId || '',
        adam_dataset: projectConfig.adamDataset || '',
        language: 'R',
        r_version: rVersion,
        consolidated_code_text: code,
        output_formats: ['csv', 'xlsx'],
        timeout_seconds: 600,
        memory_limit_mb: 2048,
      });

      setRunId(response.run_id);
      setStatus(response);
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Execution started with run ID: ${response.run_id}`]);

      // Start polling
      pollProgress(response.run_id);

    } catch (err: any) {
      const errorMsg = err.message || 'Unknown error';
      message.error('Failed to start execution: ' + errorMsg);
      setIsExecuting(false);
      setError(errorMsg);
      setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`]);
    }
  };

  const pollProgress = async (runId: string) => {
    // Try SSE first, fallback to polling
    try {
      const eventSource = new EventSource(`/api/v1/adam-generation/run/${runId}/stream`);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setProgress(data.progress_percent || 0);
          setCurrentStep(data.current_step || 'Processing...');
          
          // Add logs from execution
          if (data.logs) {
            setExecutionLogs(prev => [...prev, ...data.logs]);
          }
          if (data.stdout) {
            setROutput(prev => prev + data.stdout);
            setExecutionLogs(prev => [...prev, `[STDOUT] ${data.stdout}`]);
          }
          if (data.stderr) {
            setExecutionLogs(prev => [...prev, `[STDERR] ${data.stderr}`]);
          }
          
          if (data.status === 'succeeded' || data.step === 'complete') {
            eventSource.close();
            setIsExecuting(false);
            setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Execution completed successfully`]);
            loadResult(runId);
          } else if (data.status === 'failed' || data.status === 'timeout') {
            eventSource.close();
            setIsExecuting(false);
            const errorMsg = data.error || data.error_message || 'Execution failed';
            setError(errorMsg);
            setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`]);
          }
        } catch (e) {
          console.error('Error parsing SSE event:', e);
        }
      };
      
      eventSource.onerror = (error) => {
        console.warn('SSE connection error, falling back to polling:', error);
        eventSource.close();
        // Fallback to polling
        pollProgressFallback(runId);
      };
      
      // Store eventSource for cleanup
      (window as any).__adamGeneratorEventSource = eventSource;
    } catch (err: any) {
      console.warn('SSE not available, using polling:', err);
      pollProgressFallback(runId);
    }
  };

  const pollProgressFallback = async (runId: string) => {
    const maxAttempts = 120; // 10 minutes max (5s intervals)
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await adamApi.getAdamGenerationStatus(runId);
        setStatus(status);
        setProgress(status.progress_percent);
        setCurrentStep(status.current_step);
        
        // Add status update to logs
        if (status.current_step) {
          setExecutionLogs(prev => {
            const lastLog = prev[prev.length - 1];
            if (!lastLog || !lastLog.includes(status.current_step)) {
              return [...prev, `[${new Date().toLocaleTimeString()}] ${status.current_step}`];
            }
            return prev;
          });
        }

        if (status.status === 'succeeded') {
          setIsExecuting(false);
          setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Execution completed successfully`]);
          await loadResult(runId);
        } else if (status.status === 'failed' || status.status === 'timeout') {
          setIsExecuting(false);
          const errorMsg = status.error_message || 'Execution failed';
          setError(errorMsg);
          setExecutionLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ERROR: ${errorMsg}`]);
        } else if (status.status === 'running' || status.status === 'queued') {
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(poll, 5000); // Poll every 5 seconds
          } else {
            setIsExecuting(false);
            setError('Execution timeout - please check run status manually');
          }
        }
      } catch (err: any) {
        setIsExecuting(false);
        setError('Failed to poll status: ' + (err.message || 'Unknown error'));
      }
    };

    poll();
  };

  const loadResult = async (runId: string) => {
    try {
      const result = await adamApi.getAdamGenerationResult(runId);
      setResult(result);
      message.success('ADAM dataset generated successfully!');
      setShowFeedback(true);
    } catch (err: any) {
      // If result endpoint not available, construct from status
      if (status) {
        message.success('ADAM dataset generated successfully!');
        setShowFeedback(true);
      } else {
        message.error('Failed to load result: ' + (err.message || 'Unknown error'));
      }
    }
  };

  const handleDownload = async (format: 'csv' | 'xlsx' | 'rds' | 'zip') => {
    if (!runId) return;

    try {
      const response = await adamApi.downloadAdamDataset(runId, format);
      triggerDownload(
        new Blob([response.data]),
        `${projectConfig.studyId}_${projectConfig.adamDataset}_${runId.substring(0, 8)}.${format}`,
        {
          onSuccess: () => message.success(`Downloaded ${format.toUpperCase()} file`),
          onError: (err) => message.error(`Failed to download: ${err.message}`)
        }
      );
    } catch (err: any) {
      message.error('Failed to download: ' + (err.message || 'Unknown error'));
    }
  };

  const handleSubmitFeedback = async () => {
    if (!runId) return;

    try {
      await adamApi.submitAdamGenerationFeedback(runId, {
        study_id: projectConfig.studyId || '',
        adam_dataset: projectConfig.adamDataset || '',
        rating: feedbackRating,
        is_production_ready: isProductionReady,
        comments: feedbackComments,
      });
      message.success('Feedback submitted successfully!');
      setShowFeedback(false);
    } catch (err: any) {
      message.error('Failed to submit feedback: ' + (err.message || 'Unknown error'));
    }
  };

  const canExecute = useMemo(() => {
    return (
      code.trim().length > 0 &&
      projectConfig.studyId &&
      projectConfig.adamDataset &&
      (!sdtmInputs || sdtmInputs.missing_domains.length === 0)
    );
  }, [code, projectConfig, sdtmInputs]);

  return (
    <div className="adam-generator-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Row gutter={16} style={{ flex: 1, minHeight: 0 }}>
        {/* Left Panel - Inputs & Code Editor */}
        <Col span={12} className="adam-generator-left" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Study Context */}
            <Card title="Study Context" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Study ID">
                  {projectConfig.studyId || <Text type="secondary">Not set</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="ADAM Dataset">
                  {projectConfig.adamDataset || <Text type="secondary">Not selected</Text>}
                </Descriptions.Item>
                <Descriptions.Item label="Language">R</Descriptions.Item>
                <Descriptions.Item label="Status">
                  {isExecuting ? (
                    <Tag color="processing">Executing</Tag>
                  ) : result ? (
                    <Tag color="success">Complete</Tag>
                  ) : (
                    <Tag>Ready</Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* SDTM Inputs */}
            <Card
              title="SDTM Input Datasets"
              size="small"
              extra={
                <Space>
                  <Tooltip title="Load SDTM data from SDTM Generator">
                    <Button
                      type="default"
                      size="small"
                      icon={<FolderOpenOutlined />}
                      onClick={loadSdtmData}
                      loading={loadingSdtmInputs}
                    >
                      Load SDTM Data
                    </Button>
                  </Tooltip>
                  <Tooltip title="Refresh SDTM datasets">
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={() => checkSdtmInputs(true)}
                      loading={loadingSdtmInputs}
                    />
                  </Tooltip>
                </Space>
              }
            >
              {sdtmInputs ? (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {/* Summary Statistics */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-around', 
                    padding: '12px',
                    background: '#f5f5f5',
                    borderRadius: '6px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#52c41a' }}>
                        {sdtmInputs.available_domains.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Available
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: '#1890ff' }}>
                        {sdtmInputs.required_domains.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Required
                      </div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: 600, color: sdtmInputs.missing_domains.length > 0 ? '#ff4d4f' : '#52c41a' }}>
                        {sdtmInputs.missing_domains.length}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        Missing
                      </div>
                    </div>
                  </div>

                  {/* Available Datasets - Show First */}
                  {sdtmInputs.available_domains.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <CheckCircleOutlined style={{ color: '#52c41a', fontSize: '16px', marginRight: '8px' }} />
                        <Text strong style={{ fontSize: '14px' }}>Available Datasets ({sdtmInputs.available_domains.length})</Text>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px',
                        padding: '12px',
                        background: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '6px'
                      }}>
                        {sdtmInputs.available_domains.map(domain => {
                          const metadata = sdtmInputs.dataset_metadata?.[domain];
                          return (
                            <Tag
                              key={domain}
                              color="success"
                              style={{ 
                                margin: 0,
                                padding: '4px 12px',
                                fontSize: '13px',
                                fontWeight: 500,
                                borderRadius: '4px'
                              }}
                            >
                              <CheckCircleOutlined style={{ marginRight: '4px' }} />
                              {domain}.csv
                              {metadata?.file_size && (
                                <span style={{ marginLeft: '6px', opacity: 0.7, fontSize: '11px' }}>
                                  ({(metadata.file_size / 1024).toFixed(1)} KB)
                                </span>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Required Datasets */}
                  {sdtmInputs.required_domains.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                        <InfoCircleOutlined style={{ color: '#1890ff', fontSize: '16px', marginRight: '8px' }} />
                        <Text strong style={{ fontSize: '14px' }}>Required Datasets ({sdtmInputs.required_domains.length})</Text>
                      </div>
                      <div style={{ 
                        display: 'flex', 
                        flexWrap: 'wrap', 
                        gap: '8px',
                        padding: '12px',
                        background: '#e6f7ff',
                        border: '1px solid #91d5ff',
                        borderRadius: '6px'
                      }}>
                        {sdtmInputs.required_domains.map(domain => {
                          const isAvailable = sdtmInputs.available_domains.includes(domain);
                          return (
                            <Tag
                              key={domain}
                              color={isAvailable ? 'success' : 'error'}
                              style={{ 
                                margin: 0,
                                padding: '4px 12px',
                                fontSize: '13px',
                                fontWeight: 500,
                                borderRadius: '4px'
                              }}
                            >
                              {isAvailable ? (
                                <>
                                  <CheckCircleOutlined style={{ marginRight: '4px' }} />
                                  {domain}.csv
                                </>
                              ) : (
                                <>
                                  <CloseCircleOutlined style={{ marginRight: '4px' }} />
                                  {domain}.csv
                                </>
                              )}
                            </Tag>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Missing Datasets Alert */}
                  {sdtmInputs.missing_domains.length > 0 && (
                    <Alert
                      type="warning"
                      message={
                        <span style={{ fontWeight: 600 }}>
                          Cannot Generate {projectConfig.adamDataset || 'ADAM'} - Missing Required SDTM Datasets
                        </span>
                      }
                      description={
                        <div>
                          <div style={{ marginBottom: '12px', lineHeight: '1.6' }}>
                            <div style={{ marginBottom: '8px' }}>
                              <strong>Why this error?</strong> To generate <strong>{projectConfig.adamDataset || 'ADAM'}</strong>, 
                              the system needs specific SDTM source datasets. Currently, you have{' '}
                              <strong>{sdtmInputs.available_domains.length}</strong> dataset{sdtmInputs.available_domains.length !== 1 ? 's' : ''} available, 
                              but <strong>{sdtmInputs.missing_domains.length}</strong> more {sdtmInputs.missing_domains.length === 1 ? 'is' : 'are'} required.
                            </div>
                            <div style={{ marginBottom: '8px' }}>
                              <strong>Available:</strong>{' '}
                              {sdtmInputs.available_domains.length > 0 ? (
                                <span style={{ color: '#52c41a' }}>
                                  {sdtmInputs.available_domains.map((d, i) => (
                                    <span key={d}>
                                      <strong>{d}</strong>
                                      {i < sdtmInputs.available_domains.length - 1 ? ', ' : ''}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span style={{ color: '#999' }}>None</span>
                              )}
                            </div>
                            <div>
                              <strong>Missing:</strong>{' '}
                              <span style={{ color: '#ff4d4f' }}>
                                {sdtmInputs.missing_domains.map((d, i) => (
                                  <span key={d}>
                                    <strong>{d}</strong>
                                    {i < sdtmInputs.missing_domains.length - 1 ? ', ' : ''}
                                  </span>
                                ))}
                              </span>
                            </div>
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            flexWrap: 'wrap', 
                            gap: '6px', 
                            marginBottom: '12px',
                            padding: '8px',
                            background: '#fff7e6',
                            borderRadius: '4px',
                            border: '1px solid #ffe58f'
                          }}>
                            {sdtmInputs.missing_domains.map(domain => (
                              <Tag key={domain} color="warning" style={{ margin: 0, fontSize: '13px', padding: '4px 10px' }}>
                                {domain}
                              </Tag>
                            ))}
                          </div>
                          <div style={{ 
                            marginTop: '12px',
                            padding: '10px',
                            background: '#f6f8fa',
                            borderRadius: '4px',
                            fontSize: '13px',
                            lineHeight: '1.6'
                          }}>
                            <strong>What to do:</strong> Click the button below to automatically generate all missing datasets, 
                            or navigate to the SDTM Generator section to generate them manually with custom parameters.
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                            <Button
                              type="primary"
                              size="small"
                              icon={<ExperimentOutlined />}
                              onClick={generateMissingDatasets}
                              loading={loadingSdtmInputs}
                              style={{ flex: 1 }}
                            >
                              Auto-Generate Missing Datasets
                            </Button>
                            <Button
                              size="small"
                              onClick={() => {
                                // Navigate to SDTM Generator (if navigation is available)
                                window.dispatchEvent(
                                  new CustomEvent('adam-ai:navigate-workspace', {
                                    detail: { path: '/test-with-data' },
                                  })
                                );
                              }}
                            >
                              Go to SDTM Generator
                            </Button>
                          </div>
                        </div>
                      }
                      showIcon
                      style={{ marginTop: '8px' }}
                    />
                  )}

                  {/* Success Message */}
                  {sdtmInputs.missing_domains.length === 0 && 
                   sdtmInputs.required_domains.length > 0 && 
                   sdtmInputs.available_domains.length > 0 && (
                    <Alert
                      type="success"
                      message="All Required Datasets Available"
                      description="All required SDTM datasets are loaded and ready. You can proceed with ADAM generation."
                      showIcon
                      style={{ marginTop: '8px' }}
                    />
                  )}

                  {/* Empty State */}
                  {sdtmInputs.available_domains.length === 0 && 
                   sdtmInputs.required_domains.length === 0 && (
                    <Alert
                      type="info"
                      message="No SDTM Data Loaded"
                      description="Click 'Load SDTM Data' to check for available datasets from the SDTM Generator section."
                      showIcon
                      style={{ marginTop: '8px' }}
                    />
                  )}
                </Space>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '32px 20px',
                  background: '#fafafa',
                  borderRadius: '6px',
                  border: '1px dashed #d9d9d9'
                }}>
                  <DatabaseOutlined style={{ fontSize: '32px', color: '#bfbfbf', marginBottom: '12px' }} />
                  <div style={{ color: '#8c8c8c', fontSize: '14px', marginBottom: '8px' }}>
                    No SDTM data loaded
                  </div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Click "Load SDTM Data" to load datasets from SDTM Generator
                  </Text>
                </div>
              )}
            </Card>

            {/* R Runtime Configuration */}
            <Collapse>
              <Panel header="Runtime Settings" key="runtime">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>R Version:</Text>
                    <Select
                      value={rVersion}
                      onChange={setRVersion}
                      style={{ width: '100%', marginTop: 8 }}
                      options={availableVersions.map((v: RVersionInfo) => ({
                        label: `${v.version}${v.is_recommended ? ' (Recommended)' : ''}`,
                        value: v.version,
                      }))}
                    />
                  </div>
                  {availableVersions.find(v => v.version === rVersion)?.description && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {availableVersions.find(v => v.version === rVersion)?.description}
                    </Text>
                  )}
                </Space>
              </Panel>
            </Collapse>

            {/* Enhanced R Code Editor - Pre-populated with Consolidated Code */}
            <Card
              className="editor-card enhanced-editor-card"
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '650px' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '600px', padding: '12px' }}
              title={
                <Space>
                  <FileCode size={18} style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 600 }}>R Program Editor</span>
                  {consolidatedCode?.consolidated_code && (
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      Pre-loaded
                    </Tag>
                  )}
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {codeStats.lines} lines
                  </Tag>
                </Space>
              }
              extra={
                <Space size="small">
                  {/* Code Statistics Tooltip */}
                  <Tooltip
                    title={
                      <div style={{ fontSize: '12px', lineHeight: '1.6' }}>
                        <div><strong>Lines:</strong> {codeStats.lines}</div>
                        <div><strong>Characters:</strong> {codeStats.characters.toLocaleString()}</div>
                        <div><strong>Words:</strong> {codeStats.words}</div>
                        <div><strong>Non-empty:</strong> {codeStats.nonEmptyLines}</div>
                      </div>
                    }
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<FileTextOutlined />}
                      style={{ color: '#8c8c8c' }}
                    >
                      Stats
                    </Button>
                  </Tooltip>

                  {/* Theme Toggle */}
                  <Tooltip title={`Switch to ${editorTheme === 'vs' ? 'dark' : 'light'} theme`}>
                    <Button
                      type="text"
                      size="small"
                      icon={<BgColorsOutlined />}
                      onClick={() => {
                        const themes: ('vs' | 'vs-dark' | 'hc-black')[] = ['vs', 'vs-dark', 'hc-black'];
                        const currentIndex = themes.indexOf(editorTheme);
                        const nextIndex = (currentIndex + 1) % themes.length;
                        setEditorTheme(themes[nextIndex]);
                      }}
                    />
                  </Tooltip>

                  {/* Font Size Controls */}
                  <Space size={4}>
                    <Tooltip title="Decrease font size">
                      <Button
                        type="text"
                        size="small"
                        icon={<ZoomOutOutlined />}
                        onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
                      />
                    </Tooltip>
                    <span style={{ fontSize: '12px', minWidth: '30px', textAlign: 'center', display: 'inline-block' }}>
                      {fontSize}px
                    </span>
                    <Tooltip title="Increase font size">
                      <Button
                        type="text"
                        size="small"
                        icon={<ZoomInOutlined />}
                        onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
                      />
                    </Tooltip>
                  </Space>

                  <Divider type="vertical" style={{ margin: '0 4px' }} />

                  {/* Copy */}
                  <Tooltip title="Copy code (Ctrl+C)">
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={handleCopyCode}
                    />
                  </Tooltip>

                  {/* Format */}
                  <Tooltip title="Format code (Ctrl+Shift+F)">
                    <Button
                      type="text"
                      size="small"
                      icon={<FormatPainterOutlined />}
                      onClick={handleFormatCode}
                    />
                  </Tooltip>

                  {/* Code Snippets */}
                  <Tooltip title="Insert code snippet">
                    <Button
                      type="text"
                      size="small"
                      icon={<FileTextOutlined />}
                      onClick={() => setShowSnippets(true)}
                    />
                  </Tooltip>

                  {/* Reset */}
                  <Tooltip title="Reset to consolidated code">
                    <Button
                      type="text"
                      size="small"
                      icon={<ReloadOutlined />}
                      onClick={loadConsolidatedCode}
                    />
                  </Tooltip>

                  <Divider type="vertical" style={{ margin: '0 4px' }} />

                  {/* Run Button */}
                  <Tooltip title="Execute R code (Ctrl+Enter)">
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlayCircleOutlined />}
                      onClick={handleExecute}
                      disabled={!canExecute || isExecuting}
                      loading={isExecuting}
                      style={{ 
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        fontWeight: 600,
                        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)'
                      }}
                    >
                      {isExecuting ? 'Running...' : 'Run'}
                    </Button>
                  </Tooltip>

                  {/* Download */}
                  <Tooltip title="Download code (Ctrl+S)">
                    <Button
                      type="default"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadCode}
                    >
                      Download
                    </Button>
                  </Tooltip>
                </Space>
              }
            >
              <div className="editor-wrapper" style={{ flex: 1, minHeight: '600px', height: '100%' }}>
                <Editor
                  height="600px"
                  language="r"
                  theme={editorTheme}
                  value={code}
                  onChange={(value) => setCode(value || '')}
                  onMount={handleEditorDidMount}
                  options={{
                    minimap: { enabled: showMinimap },
                    fontSize: fontSize,
                    wordWrap: wordWrap,
                    lineNumbers: 'on',
                    lineNumbersMinChars: 3,
                    renderLineHighlight: 'all',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    insertSpaces: true,
                    detectIndentation: false,
                    formatOnPaste: true,
                    formatOnType: true,
                    suggestOnTriggerCharacters: true,
                    acceptSuggestionOnEnter: 'on',
                    quickSuggestions: {
                      other: true,
                      comments: true,
                      strings: true
                    },
                    parameterHints: {
                      enabled: true
                    },
                    hover: {
                      enabled: true
                    },
                    bracketPairColorization: {
                      enabled: true
                    },
                    guides: {
                      bracketPairs: true,
                      indentation: true
                    },
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    smoothScrolling: true,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', 'Courier New', monospace",
                    fontLigatures: true,
                    contextmenu: true,
                    mouseWheelZoom: false,
                    multiCursorModifier: 'ctrlCmd',
                    selectionHighlight: true,
                    occurrencesHighlight: true,
                    renderWhitespace: 'selection',
                    folding: true,
                    foldingStrategy: 'auto',
                    showFoldingControls: 'mouseover',
                    matchBrackets: 'always',
                    colorDecorators: true,
                    codeLens: false,
                    links: true,
                    colorDecoratorsLimit: 500,
                    rulers: [80, 120],
                    overviewRulerLanes: 3,
                    overviewRulerBorder: true,
                  }}
                />
                
                {/* Editor Footer with Quick Actions */}
                <div className="editor-footer">
                  <Space size="middle" split={<Divider type="vertical" />}>
                    <Space size="small">
                      <Tooltip title="Toggle minimap">
                        <Button
                          type="text"
                          size="small"
                          onClick={() => setShowMinimap(!showMinimap)}
                          style={{ fontSize: '11px', height: '22px', padding: '0 6px' }}
                        >
                          {showMinimap ? 'Hide' : 'Show'} Minimap
                        </Button>
                      </Tooltip>
                      <Tooltip title="Toggle word wrap">
                        <Button
                          type="text"
                          size="small"
                          onClick={() => setWordWrap(wordWrap === 'on' ? 'off' : 'on')}
                          style={{ fontSize: '11px', height: '22px', padding: '0 6px' }}
                        >
                          Wrap: {wordWrap === 'on' ? 'On' : 'Off'}
                        </Button>
                      </Tooltip>
                    </Space>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      {codeStats.lines} lines • {codeStats.characters.toLocaleString()} chars
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      <kbd style={{ 
                        background: '#f5f5f5', 
                        padding: '2px 6px', 
                        borderRadius: '3px',
                        border: '1px solid #d9d9d9',
                        fontSize: '10px'
                      }}>Ctrl+S</kbd> Download • <kbd style={{ 
                        background: '#f5f5f5', 
                        padding: '2px 6px', 
                        borderRadius: '3px',
                        border: '1px solid #d9d9d9',
                        fontSize: '10px'
                      }}>Ctrl+Shift+F</kbd> Format
                    </Text>
                  </Space>
                </div>
              </div>
            </Card>

            {/* Code Snippets Modal */}
            <Modal
              title={
                <Space>
                  <FileTextOutlined />
                  <span>R Code Snippets & Templates</span>
                </Space>
              }
              open={showSnippets}
              onCancel={() => setShowSnippets(false)}
              footer={null}
              width={800}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Text type="secondary">
                  Click on a snippet to insert it at the cursor position in the editor.
                </Text>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {Object.entries(codeSnippets).map(([name, snippet]) => (
                    <Card
                      key={name}
                      size="small"
                      style={{ marginBottom: 12, cursor: 'pointer' }}
                      hoverable
                      onClick={() => {
                        if (editorRef) {
                          const position = editorRef.getPosition();
                          const model = editorRef.getModel();
                          if (model) {
                            const range = {
                              startLineNumber: position.lineNumber,
                              startColumn: position.column,
                              endLineNumber: position.lineNumber,
                              endColumn: position.column
                            };
                            editorRef.executeEdits('insert-snippet', [
                              {
                                range: range,
                                text: snippet + '\n\n'
                              }
                            ]);
                            message.success(`Inserted: ${name}`);
                            setShowSnippets(false);
                          } else {
                            setCode(prev => prev + '\n\n' + snippet);
                            message.success(`Appended: ${name}`);
                            setShowSnippets(false);
                          }
                        } else {
                          setCode(prev => prev + '\n\n' + snippet);
                          message.success(`Appended: ${name}`);
                          setShowSnippets(false);
                        }
                      }}
                    >
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <Text strong>{name}</Text>
                        <pre style={{
                          background: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          overflowX: 'auto',
                          margin: 0,
                          maxHeight: '150px',
                          overflowY: 'auto'
                        }}>
                          {snippet.substring(0, 200)}{snippet.length > 200 ? '...' : ''}
                        </pre>
                      </Space>
                    </Card>
                  ))}
                </div>
              </Space>
            </Modal>
          </Space>
        </Col>

        {/* Right Panel - Execution & R Output */}
        <Col span={12} className="adam-generator-right" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Space direction="vertical" size="middle" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Execution Control Panel */}
            <Card 
              size="small"
              title={
                <Space>
                  <RocketOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 600 }}>Execution Control</span>
                </Space>
              }
              extra={
                <Space>
                  {sdtmInputs && sdtmInputs.available_domains.length > 0 && (
                    <Tag color="success">
                      {sdtmInputs.available_domains.length} dataset{sdtmInputs.available_domains.length !== 1 ? 's' : ''} loaded
                    </Tag>
                  )}
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={handleExecute}
                    disabled={!canExecute || isExecuting}
                    loading={isExecuting}
                    style={{ 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      border: 'none',
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                    }}
                  >
                    {isExecuting ? 'Running...' : 'Run R Program'}
                  </Button>
                </Space>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                {/* Load Consolidated Code Button */}
                <Button
                  type="default"
                  icon={<FileTextOutlined />}
                  onClick={loadConsolidatedCode}
                  block
                  style={{ marginBottom: '8px' }}
                >
                  Load Consolidated Code
                </Button>
                
                {/* Quick Status */}
                <Row gutter={16}>
                  <Col span={8}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Study ID</div>
                      <div style={{ fontWeight: 600, marginTop: '4px' }}>
                        {projectConfig.studyId || <Text type="secondary">Not set</Text>}
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>Target Dataset</div>
                      <div style={{ fontWeight: 600, marginTop: '4px' }}>
                        {projectConfig.adamDataset || <Text type="secondary">Not set</Text>}
                      </div>
                    </div>
                  </Col>
                  <Col span={8}>
                    <div style={{ textAlign: 'center', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
                      <div style={{ fontSize: '12px', color: '#666' }}>R Version</div>
                      <div style={{ fontWeight: 600, marginTop: '4px' }}>{rVersion}</div>
                    </div>
                  </Col>
                </Row>

                {/* Pre-flight Checks */}
                <Alert
                  message="Pre-flight Status"
                  description={
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {projectConfig.studyId ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} /> 
                        ) : (
                          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        )}
                        <span>Study context {projectConfig.studyId ? 'configured' : 'not set'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {sdtmInputs && sdtmInputs.missing_domains.length === 0 && sdtmInputs.available_domains.length > 0 ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        )}
                        <span>
                          {sdtmInputs && sdtmInputs.missing_domains.length > 0 ? (
                            <>
                              <span style={{ fontWeight: 600, color: '#ff4d4f' }}>
                                Missing {sdtmInputs.missing_domains.length} required dataset{sdtmInputs.missing_domains.length !== 1 ? 's' : ''}: {sdtmInputs.missing_domains.join(', ')}
                              </span>
                              <span style={{ color: '#666', marginLeft: '8px' }}>
                                ({sdtmInputs.available_domains.length} available: {sdtmInputs.available_domains.join(', ')})
                              </span>
                            </>
                          ) : sdtmInputs && sdtmInputs.available_domains.length > 0 ? (
                            <>
                              All required datasets available ({sdtmInputs.available_domains.length}): {sdtmInputs.available_domains.join(', ')}
                            </>
                          ) : (
                            'No SDTM datasets loaded. Click "Load SDTM Data" to check availability.'
                          )}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {code.trim() ? (
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        ) : (
                          <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                        )}
                        <span>R code {code.trim() ? `ready (${codeStats.lines} lines)` : 'empty'}</span>
                      </div>
                    </Space>
                  }
                  type={canExecute ? 'success' : 'warning'}
                  showIcon
                  style={{ marginTop: '8px' }}
                />

                {/* Execution Progress */}
                {isExecuting && (
                  <div style={{ marginTop: '12px' }}>
                    <Progress 
                      percent={progress} 
                      status="active" 
                      strokeColor={{
                        '0%': '#108ee9',
                        '100%': '#87d068',
                      }}
                    />
                    <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}>
                      {currentStep || 'Processing...'}
                    </Text>
                    {runId && (
                      <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginTop: '4px' }}>
                        Run ID: {runId.substring(0, 8)}...
                      </Text>
                    )}
                  </div>
                )}
              </Space>
            </Card>

            {/* R Output Panel - Main Focus */}
            <Card
              title={
                <Space>
                  <FileCode size={18} style={{ color: '#667eea' }} />
                  <span style={{ fontWeight: 600 }}>R Execution Output</span>
                  {isExecuting && <Spin size="small" />}
                </Space>
              }
              extra={
                <Space>
                  {executionLogs.length > 0 && (
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setExecutionLogs([]);
                        setROutput('');
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </Space>
              }
              style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '12px' }}
            >
              {!isExecuting && executionLogs.length === 0 && !result && !error && (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                  color: '#999',
                  textAlign: 'center',
                  padding: '40px'
                }}>
                  <RocketOutlined style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }} />
                  <Text type="secondary" style={{ fontSize: '14px' }}>
                    Click "Run R Program" to execute your code against SDTM datasets
                  </Text>
                  <Text type="secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
                    Real-time output and logs will appear here
                  </Text>
                </div>
              )}

              {(isExecuting || executionLogs.length > 0 || rOutput || result || error) && (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  minHeight: 0,
                  fontFamily: "'JetBrains Mono', 'Consolas', monospace",
                  fontSize: '13px'
                }}>
                  {/* Execution Logs */}
                  {executionLogs.length > 0 && (
                    <div style={{ 
                      marginBottom: '16px',
                      padding: '12px',
                      background: '#1e1e1e',
                      borderRadius: '4px',
                      color: '#d4d4d4',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {executionLogs.map((log, idx) => (
                        <div key={idx} style={{ 
                          marginBottom: '4px',
                          color: log.includes('ERROR') ? '#f48771' : log.includes('STDERR') ? '#f48771' : '#d4d4d4'
                        }}>
                          {log}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* R Console Output */}
                  {rOutput && (
                    <div style={{ 
                      flex: 1,
                      padding: '12px',
                      background: '#1e1e1e',
                      borderRadius: '4px',
                      color: '#d4d4d4',
                      overflowY: 'auto',
                      minHeight: '200px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {rOutput}
                    </div>
                  )}

                  {/* Results Display */}
                  {result && (
                    <div style={{ marginTop: '16px' }}>
                      <Alert
                        message={
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            <span style={{ fontWeight: 600 }}>Execution Completed Successfully</span>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size="small" style={{ width: '100%', marginTop: '8px' }}>
                            <div>Run ID: {result.run_id}</div>
                            <div>Duration: {result.execution_duration.toFixed(1)}s</div>
                            <div>Subjects: {result.preview.total_rows}</div>
                          </Space>
                        }
                        type="success"
                        showIcon={false}
                        style={{ marginBottom: '16px' }}
                      />
                      
                      {result.preview && result.preview.rows && result.preview.rows.length > 0 && (
                        <div>
                          <Text strong style={{ display: 'block', marginBottom: '8px' }}>Dataset Preview:</Text>
                          <Table
                            dataSource={result.preview.rows.map((row: any, idx: number) => ({ ...row, key: idx }))}
                            columns={result.preview.columns.slice(0, 8).map((col: string) => ({
                              title: col,
                              dataIndex: col,
                              key: col,
                              ellipsis: true,
                            }))}
                            pagination={{ pageSize: 10, size: 'small' }}
                            size="small"
                            scroll={{ x: 'max-content' }}
                          />
                        </div>
                      )}

                      <Space style={{ marginTop: '16px' }}>
                        <Button
                          type="primary"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload('csv')}
                        >
                          Download CSV
                        </Button>
                        <Button
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownload('xlsx')}
                        >
                          Download XLSX
                        </Button>
                      </Space>
                    </div>
                  )}

                  {/* Error Display */}
                  {error && (
                    <Alert
                      message="Execution Failed"
                      description={
                        <div style={{ marginTop: '8px' }}>
                          <Text>{error}</Text>
                        </div>
                      }
                      type="error"
                      showIcon
                      action={
                        <Button size="small" onClick={() => setError(null)}>
                          Dismiss
                        </Button>
                      }
                      style={{ marginTop: '16px' }}
                    />
                  )}
                </div>
              )}
            </Card>


            {/* Feedback Modal */}
            <Modal
              title="Provide Feedback"
              open={showFeedback}
              onOk={handleSubmitFeedback}
              onCancel={() => setShowFeedback(false)}
              okText="Submit"
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text>Rating:</Text>
                  <Rate value={feedbackRating} onChange={setFeedbackRating} />
                </div>
                <div>
                  <Text>Comments:</Text>
                  <TextArea
                    rows={4}
                    value={feedbackComments}
                    onChange={(e) => setFeedbackComments(e.target.value)}
                    placeholder="Optional feedback about the generated dataset..."
                  />
                </div>
                <div>
                  <input
                    type="checkbox"
                    checked={isProductionReady}
                    onChange={(e) => setIsProductionReady(e.target.checked)}
                  />
                  <Text style={{ marginLeft: 8 }}>Dataset is production-ready</Text>
                </div>
              </Space>
            </Modal>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

