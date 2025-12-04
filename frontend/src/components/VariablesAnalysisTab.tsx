import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, message, Modal, Tooltip, Button, Progress } from 'antd';
import { FileSearch, AlertCircle, Loader2, Info, Zap, RefreshCw, ArrowRight, Upload } from 'lucide-react';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { useStudyStore } from '../store/studyStore';
import { adamApi } from '../services/api';
import type { VariableCategory } from '../types';
import PairProgrammingArea from './PairProgrammingArea';
import { useApprovalProgress } from '../hooks/useApprovalProgress';
import { FinalCodeGenerationDialog, GenerationPreferences } from './FinalCodeGenerationDialog';
import { ProgramDownloadModal } from './ProgramDownloadModal';
import { showNavigationConfirmation } from './ConfirmationDialog';
import { CodeGenerationProgressModal } from './CodeGenerationProgressModal';
import { LAYOUT_PRESETS } from './WorkspaceLayoutControls';
import './VariablesAnalysisTab.css';
import AnalyzingVariablesStatus from './AnalyzingVariablesStatus';

const CATEGORY_DISPLAY_OVERRIDES: Record<string, string> = {
  'Baseline Characteristic Variables': 'Baseline Characteristics',
  'Disposition Variables': 'Disposition',
  'Phase/Period Variables': 'Phase / Period Variables',
};

const formatCategoryName = (name: string): string => {
  if (!name) return 'Uncategorized';
  let cleaned = name.trim();
  cleaned = cleaned.replace(/^[0-9]+[-_]?/, '');
  cleaned = cleaned.replace(/_/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const override = CATEGORY_DISPLAY_OVERRIDES[cleaned];
  if (override) {
    return override;
  }

  return cleaned;
};

const getCategorySortKey = (name: string, fallbackIndex: number) => {
  if (!name) return fallbackIndex + 100;
  const match = name.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : fallbackIndex + 100;
};

type DisplayCategory = VariableCategory & { displayName: string; sortKey: number };

interface VariablesAnalysisTabProps {
  onSwitchProject?: () => void;
  onNavigateToConsolidated?: () => void;
  onNavigateToTraceability?: () => void;
  onOpenHelpCenter?: () => void;
}

export const VariablesAnalysisTab: React.FC<VariablesAnalysisTabProps> = ({
  onNavigateToConsolidated,
  onNavigateToTraceability: _onNavigateToTraceability,
  onOpenHelpCenter,
}) => {
  const {
    specificationFile,
    projectConfig,
    setProjectConfig,
    categorizedVariables,
    setCategorizedVariables,
    isCategorizingVariables,
    setIsCategorizingVariables,
    setIsGenerating,
    setBulkCodeSnippets,
    clearAllAIResults,
    programmingLanguage,
    sdtmVersion,
    adamIgVersion,
    medraVersion,
    tempSpecFile,
    llmProvider,
    llmConnectionStatus,
    selectedModel,
    resetWorkspace,
    getCompletionPercentage,
  } = useProjectStore();

  // Study context integration
  const { currentStudyId, currentStudy, getStudyConfig, loadDatasetSelections, datasetSelections } = useStudyStore();
  const studyConfig = currentStudyId ? getStudyConfig(currentStudyId) : null;
  const studyDatasets = currentStudyId ? datasetSelections[currentStudyId] || [] : [];

  const [activeCategory, setActiveCategory] = useState<string>('all'); // Default to "All Variables"
  const [error, setError] = useState<string | null>(null);
  const [bulkGenerationProgress, setBulkGenerationProgress] = useState<{
    isGenerating: boolean;
    current: number;
    total: number;
    currentVariable: string;
  }>({
    isGenerating: false,
    current: 0,
    total: 0,
    currentVariable: '',
  });

  // Enhanced progress modal state
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [progressDetails, setProgressDetails] = useState<{
    status: string;
    variableName?: string;
    batchSize?: number;
    variables?: string[];
    elapsedSeconds: number;
    etaSeconds: number;
  }>({
    status: 'initializing',
    elapsedSeconds: 0,
    etaSeconds: 0,
  });

  // Final code generation state
  const [showFinalGenerationDialog, setShowFinalGenerationDialog] = useState(false);
  const [, setIsGeneratingFinalCode] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [finalProgramCode, setFinalProgramCode] = useState('');

  // Get layout preset from store
  const layoutPreset = useProjectStore((state) => state.workspaceLayoutPreset);

  // Loading visualizer state for categorization
  const [categorizeStartedAt, setCategorizeStartedAt] = useState<number | null>(null);
  const [loadingStep, setLoadingStep] = useState<number>(1);
  const categorizeAbortRef = useRef<AbortController | null>(null);
  const bulkGenerationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let timer: any;
    let initialKick: any;
    let timeoutTimer: any;
    let safetyCheckTimer: any;
    let isMounted = true;
    let rafId: any;

    if (isCategorizingVariables) {
      // Use requestAnimationFrame to ensure DOM is ready before state updates
      rafId = requestAnimationFrame(() => {
        if (!isMounted) return;
        if (!categorizeStartedAt) setCategorizeStartedAt(Date.now());
        setLoadingStep(1);
      });

      // Quick initial bump to avoid perceived stall
      initialKick = setTimeout(() => {
        if (isMounted) {
          setLoadingStep((s) => Math.max(s, 2));
        }
      }, 800);

      // Advance visible step every ~3s up to 6, purely for user feedback
      timer = setInterval(() => {
        if (isMounted) {
          setLoadingStep((s) => (s < 6 ? s + 1 : s));
        }
      }, 3000);
      // Add a hard timeout of 2 minutes (120 seconds) - reduced from 3 minutes
      timeoutTimer = setTimeout(() => {
        if (!isMounted) return;
        console.error('Categorization timeout - forcing cleanup');
        if (categorizeAbortRef.current) {
          try {
            categorizeAbortRef.current.abort();
            console.log('Abort signal sent');
          } catch (e) {
            console.error('Error aborting request:', e);
          }
        }
        // Use startTransition with requestAnimationFrame to ensure React has finished current render
        requestAnimationFrame(() => {
          if (!isMounted) return;
          try {
            setIsCategorizingVariables(false);
            setError('Categorization timed out after 2 minutes. The request may have failed. Please try again or check the backend server.');
            setLoadingStep(1);
            message.error('Categorization timed out. Please try again or check if the backend is running.');
            categorizeAbortRef.current = null;
          } catch (error) {
            console.error('Error in timeout handler:', error);
            categorizeAbortRef.current = null;
          }
        });
      }, 120000); // 2 minutes instead of 3

      // Safety check: Monitor if stuck at step 6 for too long (30 seconds)
      safetyCheckTimer = setInterval(() => {
        if (!isMounted) return;
        if (loadingStep >= 6 && categorizeStartedAt) {
          const elapsed = Date.now() - categorizeStartedAt;
          // If stuck at step 6 for more than 30 seconds, something is wrong
          if (elapsed > 150000) { // 2.5 minutes total
            console.warn('Detected stuck state at step 6 - forcing reset');
            if (categorizeAbortRef.current) {
              try { categorizeAbortRef.current.abort(); } catch { }
            }
            requestAnimationFrame(() => {
              if (!isMounted) return;
              try {
                setIsCategorizingVariables(false);
                setError('The categorization appears to be stuck. Please try again or check the backend server.');
                setLoadingStep(1);
                message.warning('Categorization appears stuck. Please try again.');
                categorizeAbortRef.current = null;
              } catch (error) {
                console.error('Error in safety check handler:', error);
                categorizeAbortRef.current = null;
              }
            });
          }
        }
      }, 5000); // Check every 5 seconds
    } else {
      if (categorizeStartedAt) {
        setCategorizeStartedAt(null);
      }
      setLoadingStep(1); // Reset to step 1 when not categorizing
    }
    return () => {
      isMounted = false;
      if (rafId) cancelAnimationFrame(rafId);
      if (timer) clearInterval(timer);
      if (initialKick) clearTimeout(initialKick);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (safetyCheckTimer) clearInterval(safetyCheckTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCategorizingVariables, loadingStep]);

  // Get approval progress
  const { percentage, isReadyForGeneration, totalVariables, approvedVariables } = useApprovalProgress();
  // Commented out - not currently used but may be useful in future
  // const canGenerateConsolidated = useProjectStore((state) => state.canGenerateConsolidated());

  // Use approved count from hook for consistency
  const approvedCount = approvedVariables;

  const sortedCategories: DisplayCategory[] = useMemo(() => {
    if (!categorizedVariables?.categories) {
      return [];
    }

    return categorizedVariables.categories
      .map((category, index) => ({
        ...category,
        displayName: formatCategoryName(category.name),
        sortKey: getCategorySortKey(category.name, index),
      }))
      .sort((a, b) => a.sortKey - b.sortKey || a.displayName.localeCompare(b.displayName));
  }, [categorizedVariables]);

  // Ensure dataset selections are loaded when a study is active
  useEffect(() => {
    if (currentStudyId) {
      loadDatasetSelections(currentStudyId);
    }
  }, [currentStudyId, loadDatasetSelections]);

  const datasetOptions = useMemo(() => {
    if (studyDatasets.length > 0) {
      return studyDatasets.map((d) => ({
        value: d.dataset_name,
        label: d.dataset_name,
        language: d.language || 'Both',
      }));
    }
    return [
      { value: 'ADSL', label: 'ADSL', language: 'Both' },
      { value: 'ADAE', label: 'ADAE', language: 'Both' },
      { value: 'ADLB', label: 'ADLB', language: 'Both' },
    ];
  }, [studyDatasets]);

  const handleDatasetSwitch = (datasetName: string) => {
    setProjectConfig({
      adamDataset: datasetName,
      studyId: currentStudyId || projectConfig.studyId,
      studyPhase: currentStudy?.phase || projectConfig.studyPhase,
    });
    message.success(`Switched to ${datasetName} for pair programming`);
  };

  // If no dataset is set in projectConfig, default to the first available option
  useEffect(() => {
    if (!projectConfig.adamDataset && datasetOptions.length > 0) {
      setProjectConfig({
        adamDataset: datasetOptions[0].value,
        studyId: currentStudyId || projectConfig.studyId,
        studyPhase: currentStudy?.phase || projectConfig.studyPhase,
      });
    }
  }, [datasetOptions, projectConfig.adamDataset, setProjectConfig, currentStudyId, currentStudy?.phase, projectConfig.studyId, projectConfig.studyPhase]);

  const handleUploadSpecCTA = () => {
    // Navigate to Enter Study Details tab
    window.dispatchEvent(
      new CustomEvent('adam-ai:navigate-workspace', {
        detail: { path: '/enter-study-details' },
      })
    );

    // Wait for navigation, then show helpful message and try to focus on upload
    setTimeout(() => {
      message.success({
        content: 'Navigating to study details. Please upload your ADAM specification Excel file in the "Upload study Documents" tab.',
        duration: 5,
      });

      // Try to find and focus on the upload section after navigation
      setTimeout(() => {
        // Try to find the documents tab button and click it
        const documentsTabs = document.querySelectorAll('.study-tab');
        documentsTabs.forEach((tab) => {
          if (tab.textContent?.includes('Upload study Documents')) {
            (tab as HTMLElement).click();
          }
        });

        // Focus on the upload button after a short delay
        setTimeout(() => {
          const uploadButton = document.querySelector('[type="button"]') as HTMLElement;
          if (uploadButton && uploadButton.textContent?.includes('Upload Document')) {
            uploadButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            uploadButton.focus();
          }
        }, 300);
      }, 500);
    }, 100);
  };

  useEffect(() => {
    // Don't reset if "All Variables" is selected
    if (activeCategory === 'all') {
      return;
    }
    if (sortedCategories.length === 0) {
      setActiveCategory('all'); // Default to "All Variables" if no categories
      return;
    }
    const index = parseInt(activeCategory, 10);
    if (Number.isNaN(index) || index >= sortedCategories.length) {
      setActiveCategory('all'); // Default to "All Variables" if invalid index
    }
  }, [sortedCategories.length, activeCategory]);

  // Track if auto-categorization has been attempted to prevent duplicate calls
  const autoCategorizeAttemptedRef = useRef(false);
  const [autoCategorizeStatus, setAutoCategorizeStatus] = useState<'pending' | 'started' | 'completed'>('pending');

  useEffect(() => {
    // Auto-categorize when spec file is uploaded
    // Prevent multiple calls
    if (autoCategorizeAttemptedRef.current) {
      return;
    }

    // Don't auto-categorize if there's an error or if categorization is already in progress
    if (error || isCategorizingVariables) {
      return;
    }

    if (specificationFile && !categorizedVariables && projectConfig.adamDataset) {
      console.log('🔄 Specification file detected - starting automatic categorization');
      console.log('📄 File:', specificationFile.name);
      console.log('📊 Dataset:', projectConfig.adamDataset);

      autoCategorizeAttemptedRef.current = true;
      setAutoCategorizeStatus('started');

      // Start categorization directly without delay
      handleCategorizeVariables()
        .then(() => {
          setAutoCategorizeStatus('completed');
        })
        .catch((err) => {
          console.error('Auto-categorization failed:', err);
          // Reset the flag on error so user can retry manually
          autoCategorizeAttemptedRef.current = false;
          setAutoCategorizeStatus('pending');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specificationFile, categorizedVariables, projectConfig.adamDataset]);

  // Reset auto-categorization flag when spec file or dataset changes
  useEffect(() => {
    console.log('🔄 Resetting auto-categorization flag (spec or dataset changed)');
    autoCategorizeAttemptedRef.current = false;
    setAutoCategorizeStatus('pending');
  }, [specificationFile?.path, projectConfig.adamDataset]);

  const formatDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  // Handle workspace refresh
  const handleRefresh = async () => {
    const completionPercentage = getCompletionPercentage();

    // If user has made progress, show confirmation
    if (completionPercentage > 0) {
      await showNavigationConfirmation(
        () => {
          resetWorkspace(); // Reset all workspace state
          // Reload the page to ensure complete refresh
          window.location.reload();
        },
        'This will reset all your work and start fresh. All uploaded files, configurations, and generated code will be lost. Are you sure you want to continue?'
      );
    } else {
      // No work in progress, just reset and reload
      resetWorkspace();
      window.location.reload();
    }
  };

  // Handle refresh AI results - Clear all AI-generated code and cache
  const handleRefreshAIResults = () => {
    Modal.confirm({
      title: 'Refresh AI Results?',
      icon: <RefreshCw size={20} style={{ color: '#faad14' }} />,
      content: (
        <div style={{ marginTop: '12px' }}>
          <p style={{ marginBottom: '12px', fontWeight: 500 }}>
            This will clear all AI-generated content including:
          </p>
          <ul style={{ paddingLeft: '24px', marginBottom: '12px' }}>
            <li>Code snippets for all variables</li>
            <li>Coding rationales and AI inputs</li>
            <li>User notes and acceptance states</li>
            <li>Consolidated code generation</li>
            <li>Traceability matrix data</li>
          </ul>
          <p style={{ marginBottom: 0, color: '#8c8c8c', fontSize: '13px' }}>
            Your variable categorization will be preserved. You can regenerate AI code after clearing.
          </p>
        </div>
      ),
      okText: 'Clear AI Results',
      okType: 'primary',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      width: 520,
      onOk: () => {
        clearAllAIResults();
        message.success({
          content: 'All AI results cleared successfully! You can now generate fresh code.',
          duration: 4,
        });
      },
    });
  };

  const handleCategorizeVariables = async () => {
    if (!specificationFile) {
      setError('No specification file uploaded');
      return;
    }

    if (!projectConfig.adamDataset) {
      setError('Please select an ADAM dataset first');
      return;
    }

    // Prevent multiple simultaneous categorizations
    if (isCategorizingVariables) {
      console.log('Categorization already in progress');
      return;
    }

    // Clear any existing error first
    setError(null);

    // Clean up any existing abort controller before starting new one
    if (categorizeAbortRef.current) {
      try {
        categorizeAbortRef.current.abort();
      } catch (e) {
        console.debug('Error aborting previous request:', e);
      }
      categorizeAbortRef.current = null;
    }

    // Reset loading step and start time
    setLoadingStep(1);
    setCategorizeStartedAt(Date.now());

    // Create abort controller first
    categorizeAbortRef.current = new AbortController();
    const currentAbortController = categorizeAbortRef.current;

    // Set categorization state directly
    setIsCategorizingVariables(true);

    // Wait for state to update and DOM to stabilize
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 0);
      });
    });

    // Verify we still have the abort controller
    if (categorizeAbortRef.current !== currentAbortController) {
      console.log('Categorization cancelled before starting - abort controller changed');
      return;
    }

    try {
      console.log('Starting categorization...');
      console.log('Spec file path:', specificationFile.path);
      console.log('Dataset type:', projectConfig.adamDataset);


      let result;
      // Check if we can use server path (file already on server)
      // This includes:
      // 1. Default spec files (isDefault flag)
      // 2. Content/ paths (default specifications)
      // 3. storage/ paths (study documents uploaded to server)
      const canUseServerPath =
        specificationFile.isDefault ||
        specificationFile.path?.startsWith('Content/') ||
        specificationFile.path?.startsWith('storage/') ||
        specificationFile.path?.startsWith('storage\\');

      if (canUseServerPath) {
        console.log('Using server path categorization');
        console.log('Server path:', specificationFile.path);
        result = await adamApi.categorizeSpecification(
          specificationFile.path,
          projectConfig.adamDataset,
          { signal: currentAbortController.signal, timeoutMs: 120000 }
        );
        console.log('Server path categorization completed');
      } else if (tempSpecFile) {
        console.log('Using file upload categorization');
        result = await adamApi.categorizeSpecificationFile(
          tempSpecFile,
          projectConfig.adamDataset,
          { signal: currentAbortController.signal, timeoutMs: 120000 }
        );
        console.log('File upload categorization completed');
      } else {
        throw new Error('Specification file not accessible. Please upload the file again so we can process it.');
      }

      console.log('=== CATEGORIZATION RESULT ===');
      console.log('Total variables:', result.total_variables);
      console.log('Categories:', result.categories.length);
      console.log('Spec columns:', result.spec_columns);
      console.log('First variable sample:', result.categories[0]?.variables[0]);

      // Set categorized variables directly
      setCategorizedVariables(result);
      console.log('Categorized variables set in state');
      message.success(
        `Categorized ${result.total_variables} variables into ${result.categories.length} categories using VariablesMapping.xlsx`
      );
    } catch (err: any) {
      console.error('=== CATEGORIZATION ERROR ===');
      console.error('Error object:', err);
      console.error('Response:', err.response);
      console.error('Message:', err.message);

      // Handle abort differently for cleaner UX
      if (err.name === 'CanceledError' || err.name === 'AbortError') {
        // Do not surface as an error UI; keep clean state for retry
        setError(null);
        message.info('Categorization cancelled');
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        const errorMsg = 'Request timed out. The file may be too large or the server is busy. Please try again.';
        setError(errorMsg);
        message.error(errorMsg);
      } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
        // Check if user is authenticated
        const token = localStorage.getItem('adam_access_token');
        let errorMsg = 'Network error. ';
        if (!token) {
          errorMsg += 'Please log in first.';
          window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
        } else {
          errorMsg += 'Please check if the backend server is running on port 8002.';
        }
        setError(errorMsg);
        message.error(errorMsg);
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        const errorMsg = 'Authentication required. Please log in again.';
        setError(errorMsg);
        message.error(errorMsg);
        localStorage.removeItem('adam_access_token');
        localStorage.removeItem('adam_user');
        window.dispatchEvent(new CustomEvent('adam-ai:auth-required'));
      } else {
        const errorMsg = err.response?.data?.detail || err.message || 'Failed to categorize variables';
        setError(errorMsg);
        message.error(`Failed to categorize variables: ${errorMsg}`);
      }
      console.error('Categorization error:', err);
    } finally {
      console.log('Categorization finally block - setting isCategorizingVariables to false');
      setIsCategorizingVariables(false);
      // Only clear abort controller if it's still the same one
      if (categorizeAbortRef.current === currentAbortController) {
        categorizeAbortRef.current = null;
      }
    }
  };

  const handleCancelCategorization = () => {
    try {
      if (categorizeAbortRef.current) {
        categorizeAbortRef.current.abort();
      }
    } catch (e) {
      console.debug('Error aborting during cancel:', e);
    }
    setIsCategorizingVariables(false);
    setError(null);
    message.info('Categorization cancelled. You can retry when ready.');
  };

  const handleForceReset = () => {
    console.log('Force reset triggered - clearing all categorization state');
    try {
      if (categorizeAbortRef.current) {
        categorizeAbortRef.current.abort();
        console.log('Abort signal sent during force reset');
      }
    } catch (e) {
      console.error('Error aborting during force reset:', e);
    }
    // Force clear all state
    setIsCategorizingVariables(false);
    setError(null);
    setCategorizedVariables(null);
    setLoadingStep(1);
    setCategorizeStartedAt(null);
    categorizeAbortRef.current = null;
    message.warning('Force reset completed. You can try categorizing again.');
  };

  const handleCancelBulkGeneration = () => {
    try {
      bulkGenerationAbortRef.current?.abort();
    } catch { }
    setBulkGenerationProgress({
      isGenerating: false,
      current: 0,
      total: 0,
      currentVariable: '',
    });
    setIsGenerating(false);
    setProgressModalVisible(false);
    message.info('Code generation cancelled by user');
  };

  const handleGenerateCode = async () => {
    if (!categorizedVariables) {
      message.error('No categorized variables available');
      return;
    }

    // Use study context if available, otherwise fall back to project config
    const effectiveStudyId = currentStudyId || projectConfig.studyId;
    if (!effectiveStudyId || (typeof effectiveStudyId === 'string' && effectiveStudyId.trim().length < 3)) {
      message.warning('Please select or configure a valid Study in the "Enter Study Details" page');
      return;
    }

    if (!projectConfig.adamDataset) {
      message.warning('Please select an ADAM dataset first');
      return;
    }

    // Count total variables
    const totalVariables = categorizedVariables.total_variables;

    // Get provider display name
    const providerNames: Record<string, string> = {
      groq: '🚀 Groq',
      openai: '🧠 OpenAI',
      anthropic: '✨ Anthropic',
      google: '🌐 Google',
      openrouter: '🌟 OpenRouter',
    };

    const getModelDisplay = () => {
      if (llmProvider === 'openrouter' && selectedModel) {
        const modelName = selectedModel.split('/').pop() || selectedModel;
        return `${providerNames[llmProvider]} (${modelName})`;
      }
      return providerNames[llmProvider] || 'AI Provider';
    };

    const startBulkGeneration = async () => {
      const total = categorizedVariables.total_variables;
      if (total === 0) {
        message.info('No variables available for AI generation.');
        return;
      }

      const estimatedTime = Math.ceil(Math.max(total, 1) / 2); // Rough estimate: 2 variables per second
      const startTime = Date.now();
      let progressTimer: ReturnType<typeof setInterval> | null = null;

      const stopTimer = () => {
        if (progressTimer) {
          clearInterval(progressTimer);
          progressTimer = null;
        }
      };

      const updateProgressState = (completed: number, statusLabel: string) => {
        setBulkGenerationProgress({
          isGenerating: true,
          current: Math.min(completed, total),
          total,
          currentVariable: statusLabel,
        });
      };

      try {
        setIsGenerating(true);
        setProgressModalVisible(true);
        updateProgressState(0, 'Initializing...');
        setProgressDetails({
          status: 'initializing',
          elapsedSeconds: 0,
          etaSeconds: estimatedTime,
        });

        // Create abort controller for cancellation
        bulkGenerationAbortRef.current = new AbortController();

        // Update progress timer for real-time updates
        progressTimer = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          setProgressDetails(prev => ({
            ...prev,
            elapsedSeconds: elapsed,
          }));
        }, 100); // Update every 100ms for smooth progress

        const requestPayload: any = {
          categorized_variables: categorizedVariables,
          study_id: projectConfig.studyId,
          dataset: projectConfig.adamDataset || 'ADSL',
          language: programmingLanguage,
          standards: {
            sdtm_version: sdtmVersion,
            adam_ig_version: adamIgVersion,
            meddra_version: medraVersion,
          },
          llm_provider: llmProvider,
        };

        if (llmProvider === 'openrouter') {
          const selectedModelValue = useProjectStore.getState().selectedModel;
          if (selectedModelValue) {
            requestPayload.model = selectedModelValue;
          }
        }

        const results = await adamApi.generateCodeBulkStream(requestPayload, (progress) => {
          const { completed, total: totalVars, variable_name, message: progressMessage, status } = progress;
          const batch_size = (progress as any).batch_size;
          const variables = (progress as any).variables;

          const displayMessage = status === 'batch_completed' && batch_size
            ? `Batch completed: ${batch_size} variables`
            : variable_name || progressMessage || 'Processing variables...';

          updateProgressState(completed, displayMessage);

          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const avgTimePerVar = completed > 0 ? elapsedSeconds / completed : 2;
          const remainingVars = totalVars - completed;
          const etaSeconds = Math.max(0, remainingVars * avgTimePerVar);

          setProgressDetails({
            status: status || 'processing',
            variableName: variable_name,
            batchSize: batch_size,
            variables: variables || (variable_name ? [variable_name] : undefined),
            elapsedSeconds,
            etaSeconds,
          });
        });

        stopTimer();

        setBulkCodeSnippets(results);

        const successCount = results.filter(r => !r.error).length;
        const errorCount = results.filter(r => r.error).length;
        const totalTime = (Date.now() - startTime) / 1000;

        setBulkGenerationProgress({
          isGenerating: false,
          current: total,
          total,
          currentVariable: 'Completed',
        });

        stopTimer();
        setProgressModalVisible(false);

        const successRate = Math.round((successCount / total) * 100);
        const hasErrors = errorCount > 0;

        Modal.success({
          title: (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircleOutlined style={{ fontSize: '28px', color: hasErrors ? '#faad14' : '#52c41a' }} />
              <span style={{ fontSize: '18px', fontWeight: 600 }}>
                {hasErrors ? 'Code Generation Completed with Issues' : 'Code Generation Complete! dYZ%'}
              </span>
            </div>
          ),
          width: 600,
          icon: null,
          okText: 'Got it, Continue',
          okButtonProps: {
            size: 'large',
            style: { height: '40px', fontSize: '14px', fontWeight: 500 }
          },
          content: (
            <div style={{ marginTop: '20px' }}>
              {/* Statistics Section */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
                color: 'white'
              }}>
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
                  dY"S Generation Summary
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700 }}>{total}</div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>Total Variables</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: '#95de64' }}>{successCount}</div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>�o" Successful</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '32px', fontWeight: 700, color: hasErrors ? '#ffa39e' : '#95de64' }}>{errorCount}</div>
                    <div style={{ fontSize: '12px', opacity: 0.9 }}>
                      {hasErrors ? '�s� Needs Attention' : '�o" No Errors'}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginTop: '16px' }}>
                  <Progress
                    percent={successRate}
                    strokeColor={hasErrors ? '#faad14' : '#52c41a'}
                    trailColor="rgba(255, 255, 255, 0.3)"
                    strokeWidth={12}
                    format={() => `${successRate}% Success Rate`}
                  />
                </div>

                <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '13px', opacity: 0.9 }}>
                  �?�,? Completed in {formatDuration(totalTime)}
                </div>
              </div>

              {/* Summary details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
                {hasErrors ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(250, 173, 20, 0.12)',
                    border: '1px solid rgba(250, 173, 20, 0.4)'
                  }}>
                    <AlertCircle size={18} color="#faad14" />
                    <div>
                      <div style={{ fontWeight: 600 }}>Some variables need your attention</div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        Review the warnings and regenerate specific variables if needed.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'rgba(82, 196, 26, 0.12)',
                    border: '1px solid rgba(82, 196, 26, 0.4)'
                  }}>
                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    <div>
                      <div style={{ fontWeight: 600 }}>All variables generated successfully!</div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        You're ready to review and validate the AI-generated code.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ),
        });

        message.success(`Generated code for ${successCount} variables in ${formatDuration(totalTime)}${hasErrors ? `, ${errorCount} need review` : ''}`);
      } catch (error: any) {
        console.error('Bulk generation failed:', error);
        stopTimer();
        setIsGenerating(false);
        setProgressModalVisible(false);
        message.error(error.message || 'Code generation failed. Please try again.');
      } finally {
        stopTimer();
        setIsGenerating(false);
      }
    };

    Modal.confirm({
      title: <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={20} color="#1890ff" />
        <span>Generate AI Code for All Variables</span>
      </div>,
      width: 600,
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ marginBottom: '0', fontSize: '14px' }}>
            This will generate code snippets for <strong>{totalVariables} variables</strong> using <strong>{getModelDisplay()}</strong>.
          </p>
        </div>
      ),
      okText: 'Start Generation',
      cancelText: 'Cancel',
      okButtonProps: {
        type: 'primary',
        icon: <Zap size={14} />,
        style: { height: '36px' }
      },
      cancelButtonProps: { style: { height: '36px' } },
      onOk: () => {
        void startBulkGeneration();
      },
    });
  };

  const handleConfirmGeneration = async (preferences: GenerationPreferences) => {
    setIsGeneratingFinalCode(true);
    setShowFinalGenerationDialog(false);

    try {
      message.loading({ content: 'Generating complete ADAM program...', key: 'finalGen', duration: 0 });

      // Collect approved variables and their data
      // Include all variables with generated code (auto-approved) unless explicitly marked as 'modify'
      const pairProgramming = useProjectStore.getState().pairProgramming;
      const approvedVarNames = Object.entries(pairProgramming.snippets)
        .filter(([_, snippet]) => {
          // Include if:
          // 1. Has code snippet and not marked as 'modify' (auto-approved)
          // 2. OR explicitly marked as 'accept'
          return (snippet.codeSnippet && !snippet.error && snippet.accepted !== 'modify')
            || snippet.accepted === 'accept';
        })
        .map(([name, _]) => name);

      // Validate that we have at least one approved variable
      if (approvedVarNames.length === 0) {
        message.warning({
          content: 'No approved variables found. Please approve at least one variable in the pair programming area before generating consolidated code.',
          key: 'finalGen',
          duration: 5,
        });
        setIsGeneratingFinalCode(false);
        return;
      }

      // Collect user notes for approved variables
      const userNotes: Record<string, string> = {};
      approvedVarNames.forEach((varName) => {
        const notes = pairProgramming.snippets[varName]?.userNotes;
        if (notes && notes.trim()) {
          userNotes[varName] = notes;
        }
      });

      // Collect code snippets for approved variables
      const codeSnippets: Record<string, string> = {};
      approvedVarNames.forEach((varName) => {
        const code = pairProgramming.snippets[varName]?.codeSnippet;
        if (code) {
          codeSnippets[varName] = code;
        }
      });

      // Call enhanced API endpoint
      const result = await adamApi.generateProgramWithNotes({
        study_id: projectConfig.studyId,
        dataset: projectConfig.adamDataset || 'ADSL',
        language: programmingLanguage,
        categorized_variables: categorizedVariables,
        approved_variables: approvedVarNames,
        code_snippets: codeSnippets,
        user_notes: userNotes,
        user_preferences: preferences,
        standards: {
          sdtm_version: sdtmVersion,
          adam_ig_version: adamIgVersion,
          meddra_version: medraVersion,
        },
      });

      message.success({
        content: 'Complete ADAM program generated successfully!',
        key: 'finalGen',
        duration: 3,
      });

      // Show download modal with generated code
      setFinalProgramCode(result.program_code);
      setShowDownloadModal(true);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to generate program';
      message.error({ content: `Generation failed: ${errorMsg}`, key: 'finalGen', duration: 5 });
      console.error('Final generation error:', err);
    } finally {
      setIsGeneratingFinalCode(false);
    }
  };

  const renderCategoryContent = (category: DisplayCategory) => {
    if (category.count === 0) {
      return (
        <div className="empty-category">
          <FileSearch size={48} />
          <p>No variables in this category</p>
        </div>
      );
    }

    return (
      <div className="category-summary">
        {category.description && (
          <div className="category-info-banner">
            <Info size={16} />
            <span>{category.description}</span>
          </div>
        )}
        <div className="category-summary-content">
          <p className="category-summary-text">
            This category contains <strong>{category.count}</strong> variables.
            Use the Pair Programming Area on the right to generate code for each variable.
          </p>
        </div>
      </div>
    );
  };

  // Main content with categorized variables
  // Get active category for pair programming panel
  // Handle special 'all' case for showing all variables
  const isAllVariablesSelected = activeCategory === 'all';
  const activeCategoryData = isAllVariablesSelected
    ? null
    : sortedCategories[parseInt(activeCategory, 10)] || null;

  // Get all variables when "All Variables" is selected
  // IMPORTANT: This hook must be called before any conditional returns
  const allVariablesForPairProgramming = useMemo(() => {
    if (!categorizedVariables?.categories) return [];
    return categorizedVariables.categories.flatMap(category =>
      category.variables || []
    );
  }, [categorizedVariables]);

  const activeDataset = projectConfig.adamDataset || datasetOptions[0]?.value || 'ADSL';

  // Use a stable container to prevent React from completely unmounting the component tree
  // This prevents the removeChild error by maintaining a consistent DOM structure
  return (
    <div className="variables-analysis-tab" key="variables-analysis-root">
      {/* Always-visible context bar for dataset selection */}
      <div className="pair-programming-context-bar">
        <div className="context-label">Active ADaM dataset</div>
        <div className="context-actions">
          <select
            value={activeDataset}
            onChange={(e) => handleDatasetSwitch(e.target.value)}
            className="dataset-dropdown"
          >
            {datasetOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {currentStudyId && (
            <span className="context-study-pill">
              Study: {currentStudy?.name || currentStudyId}
            </span>
          )}
        </div>
      </div>

      {/* No spec file uploaded */}
      {!specificationFile && (
        <div className="variables-empty-state" key="no-spec">
          <AlertCircle size={64} className="empty-icon" />
          <h3>No Specification File Uploaded</h3>
          <p>
            To analyze variables and generate code for <strong>{activeDataset}</strong>, please upload your ADAM specification Excel file. Click the button below to navigate to the upload section.
          </p>
          <div className="empty-actions">
            <div className="empty-step-card">
              <div className="step-title">Step 1: Choose ADaM dataset</div>
              <select
                value={activeDataset}
                onChange={(e) => handleDatasetSwitch(e.target.value)}
                className="dataset-dropdown"
              >
                {datasetOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="empty-step-card">
              <div className="step-title">Step 2: Upload specification</div>
              <p style={{ marginBottom: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                Upload your ADAM specification Excel file to analyze variables and generate code.
              </p>
              <button className="categorize-button" onClick={handleUploadSpecCTA} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={18} />
                Take me to Upload Specification
              </button>
              {currentStudyId && (
                <div className="step-helper">
                  Study: {currentStudy?.name || currentStudyId}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hard stop until a spec is uploaded */}
      {!specificationFile && (
        null
      )}

      {specificationFile && (
        <div className="spec-summary-bar" key={`spec-bar-${specificationFile.name}`}>
          <div>
            <span className="summary-label">Dataset:</span> <strong>{activeDataset}</strong>
          </div>
          <div>
            <span className="summary-label">Specification:</span> <strong>{specificationFile?.name || 'Unknown file'}</strong>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '13px', fontWeight: 500 }} key={`status-${isCategorizingVariables}-${!!categorizedVariables}`}>
            {!categorizedVariables && !isCategorizingVariables && !error && (
              <span style={{ color: '#10b981' }}>✓ File detected - Auto-processing will begin</span>
            )}
            {isCategorizingVariables && (
              <span style={{ color: '#3b82f6' }}>⏳ Processing variables...</span>
            )}
            {categorizedVariables && (
              <span style={{ color: '#10b981' }}>✓ {categorizedVariables.total_variables} variables categorized</span>
            )}
          </div>
        </div>
      )}

      {/* Categorizing in progress - use a stable wrapper to prevent unmount issues */}
      {specificationFile && isCategorizingVariables && (
        <div
          className="variables-loading-state"
          key={`loading-${categorizeStartedAt || 'default'}`}
          data-loading-state="true"
        >
          <AnalyzingVariablesStatus
            key={`analyzing-${categorizeStartedAt || Date.now()}`}
            fileName={specificationFile?.name}
            totalVars={undefined}
            parsedVars={undefined}
            categoryCount={undefined}
            currentStep={loadingStep}
            totalSteps={6}
            adamVersion={adamIgVersion}
            meddraVersion={medraVersion}
            startTime={categorizeStartedAt ?? undefined}
            cancellable
            onCancel={handleCancelCategorization}
            onForceReset={handleForceReset}
          />
        </div>
      )}

      {/* Error state */}
      {specificationFile && error && !categorizedVariables && !isCategorizingVariables && (
        <div className="variables-error-state" key="error-state">
          <AlertCircle size={64} className="error-icon" />
          <h3>Categorization Failed</h3>
          <p>{error}</p>
          <button className="retry-button" onClick={handleCategorizeVariables}>
            Retry Categorization
          </button>
        </div>
      )}

      {/* No categorized variables yet */}
      {specificationFile && !categorizedVariables && !isCategorizingVariables && !error && (
        <div className="variables-empty-state" key={`no-categories-${specificationFile.name}`}>
          <FileSearch size={64} className="empty-icon" />
          <h3>Specification File Detected</h3>
          <p>
            Found specification file: <strong>{specificationFile.name}</strong>
            <br />
            <span key={`auto-status-${autoCategorizeStatus}`}>
              {autoCategorizeStatus === 'started'
                ? 'Processing variables... Please wait.'
                : 'Automatic categorization will start shortly.'}
            </span>
          </p>
          <div key={`button-container-${autoCategorizeStatus}`}>
            {autoCategorizeStatus === 'pending' && (
              <button className="categorize-button" onClick={handleCategorizeVariables} key="categorize-btn">
                Start Categorization Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content with categorized variables */}
      {specificationFile && categorizedVariables && !isCategorizingVariables && (
        <div className="variables-content" key="variables-content">
          <div className="variables-header-compact">
            <div className="header-info-group">
              <h2 className="header-title">
                <FileSearch size={18} />
                <span>Variables Analysis</span>
              </h2>
              <div className="header-stats-compact">
                <div className="stat-item">
                  <span className="stat-value">{categorizedVariables?.total_variables || 0}</span>
                  <span className="stat-label">Variables</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item">
                  <span className="stat-value">{sortedCategories.length}</span>
                  <span className="stat-label">Categories</span>
                </div>
                <div className="stat-divider"></div>
                <div className="stat-item stat-item-dataset">
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <rect x="2" y="10" width="4" height="8" rx="1" fill="#10b981" />
                    <rect x="8" y="6" width="4" height="12" rx="1" fill="#ec4899" />
                    <rect x="14" y="2" width="4" height="16" rx="1" fill="#3b82f6" />
                  </svg>
                  <span className="stat-dataset">{projectConfig.adamDataset || 'ADSL'}</span>
                </div>
              </div>
            </div>
            <div className="header-actions-compact">
              <Tooltip
                title={
                  llmConnectionStatus !== 'connected'
                    ? 'Test the connection first using the "Test Connection" button in the header'
                    : bulkGenerationProgress.isGenerating
                      ? 'Generation in progress...'
                      : 'Generate code snippets for all variables using AI'
                }
              >
                <Button
                  onClick={handleGenerateCode}
                  disabled={bulkGenerationProgress.isGenerating || isCategorizingVariables || llmConnectionStatus !== 'connected'}
                  icon={bulkGenerationProgress.isGenerating ? <Loader2 size={14} className="spinning" /> : <Zap size={14} />}
                  className="action-button-compact action-button-primary"
                  size="small"
                  type="primary"
                >
                  {bulkGenerationProgress.isGenerating ? `Generating (${bulkGenerationProgress.current}/${bulkGenerationProgress.total})` : 'Get AI Inputs'}
                </Button>
              </Tooltip>
              <Button
                onClick={handleCategorizeVariables}
                disabled={isCategorizingVariables}
                icon={isCategorizingVariables ? <LoadingOutlined /> : <RefreshCw size={14} />}
                className="action-button-compact"
                size="small"
                type="default"
              >
                Re-analyze
              </Button>
              <Button
                onClick={handleRefreshAIResults}
                icon={<RefreshCw size={14} />}
                className="action-button-compact action-button-warning"
                size="small"
                type="default"
                title="Clear all AI-generated code and start fresh"
              >
                Refresh AI Results
              </Button>
              <Button
                onClick={handleRefresh}
                icon={<RefreshCw size={14} />}
                className="action-button-compact action-button-danger"
                size="small"
                type="default"
                title="Reset workspace and start fresh"
              >
                Clear & Restart
              </Button>
            </div>
          </div>

          {sortedCategories.length > 0 ? (
            <>
              {/* Top Section: Tabs (configurable split) + Pair Programming */}
              <div
                className="tabs-and-pair-programming"
                style={{ ['--layout-columns' as any]: LAYOUT_PRESETS[layoutPreset].columns }}
              >
                <div className="category-tabs-container">
                  <Tabs
                    activeKey={activeCategory}
                    onChange={(key) => {
                      // Direct state update - simpler and more stable
                      setActiveCategory(key);
                    }}
                    type="card"
                    tabPosition="left"
                    className="category-tabs category-tabs-vertical"
                    tabBarGutter={8}
                    destroyInactiveTabPane={false}
                    items={[
                      // "All Variables" option at the top
                      {
                        key: 'all',
                        label: (
                          <div className="tab-label all-variables-tab">
                            <span className="tab-name">All Variables</span>
                            <span className="tab-count">{allVariablesForPairProgramming.length}</span>
                          </div>
                        ),
                        children: null // No content for "All Variables" - handled in pair programming area
                      },
                      // Category tabs
                      ...sortedCategories.map((category, index) => ({
                        key: index.toString(),
                        label: (
                          <div className="tab-label">
                            <span className="tab-name">{category.displayName}</span>
                            <span className="tab-count">{category.count}</span>
                          </div>
                        ),
                        children: renderCategoryContent(category)
                      }))
                    ]}
                  />
                </div>

                {/* Pair Programming Panel - 70% on the right */}
                {/* Use a stable container that doesn't unmount to prevent removeChild errors */}
                <div className="pair-programming-container" key="pair-programming-container">
                  {/* Always render PairProgrammingArea to prevent mount/unmount issues */}
                  <div
                    className="pair-programming-panel"
                    role="region"
                    aria-label="Pair Programming Area"
                  >
                    <PairProgrammingArea
                      key="pair-area"
                      variables={isAllVariablesSelected ? allVariablesForPairProgramming : (activeCategoryData?.variables || [])}
                      categoryName={isAllVariablesSelected ? 'All Variables' : (activeCategoryData?.displayName || activeCategoryData?.name || 'Unknown')}
                    />
                  </div>
                </div>
              </div>

              {/* Bottom Action Area - Compact Status Bar */}
              <div className="bottom-action-area">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {isReadyForGeneration ? (
                    <>
                      <CheckCircleOutlined style={{ fontSize: '16px', color: '#10B981' }} />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#10B981' }}>
                          Ready • {approvedCount} approved
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          {approvedCount} of {totalVariables} variables ({percentage}%)
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <Info size={16} color="#f59e0b" />
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>
                          No variables approved yet
                        </div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                          Approve variables to generate consolidated code
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <a
                  className="consolidated-code-link"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigateToConsolidated?.();
                  }}
                  href="#"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#3b82f6',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '14px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#2563eb';
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#3b82f6';
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  <span>Consolidated Code</span>
                  <ArrowRight size={16} />
                </a>
              </div>
            </>
          ) : (
            <div className="no-categories">
              <AlertCircle size={48} />
              <p>No variable categories found</p>
            </div>
          )}

          {/* Final Code Generation Dialog */}
          <FinalCodeGenerationDialog
            visible={showFinalGenerationDialog}
            onCancel={() => setShowFinalGenerationDialog(false)}
            onConfirm={handleConfirmGeneration}
            programmingLanguage={programmingLanguage as 'R' | 'SAS'}
          />

          {/* Program Download Modal */}
          <ProgramDownloadModal
            visible={showDownloadModal}
            onClose={() => setShowDownloadModal(false)}
            programCode={finalProgramCode}
            language={programmingLanguage as 'R' | 'SAS'}
            datasetName={projectConfig.adamDataset || 'ADSL'}
          />

          {/* Enhanced Code Generation Progress Modal */}
          <CodeGenerationProgressModal
            visible={progressModalVisible}
            total={bulkGenerationProgress.total || categorizedVariables?.total_variables || 0}
            completed={bulkGenerationProgress.current}
            currentStatus={bulkGenerationProgress.currentVariable || progressDetails.status}
            status={progressDetails.status}
            variableName={progressDetails.variableName}
            batchSize={progressDetails.batchSize}
            variables={progressDetails.variables}
            elapsedSeconds={progressDetails.elapsedSeconds}
            etaSeconds={progressDetails.etaSeconds}
            onCancel={handleCancelBulkGeneration}
            llmProvider={llmProvider}
            language={programmingLanguage}
            dataset={projectConfig.adamDataset || 'ADSL'}
          />
        </div>
      )}
    </div>
  );
};
