import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs, message, Modal, Tooltip, Button, Progress } from 'antd';
import { FileSearch, AlertCircle, Loader2, Info, Zap, Download, RefreshCw } from 'lucide-react';
import { CheckCircleOutlined, FileDoneOutlined, LinkOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import type { VariableCategory } from '../types';
import { PairProgrammingArea } from './PairProgrammingArea';
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
  onNavigateToValidation?: () => void;
  onNavigateToConsolidated?: () => void;
  onNavigateToTraceability?: () => void;
}

export const VariablesAnalysisTab: React.FC<VariablesAnalysisTabProps> = ({ onNavigateToValidation, onNavigateToConsolidated, onNavigateToTraceability }) => {
  const {
    specificationFile,
    projectConfig,
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

  const [activeCategory, setActiveCategory] = useState<string>('0');
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
  const [isGeneratingFinalCode, setIsGeneratingFinalCode] = useState(false);
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
    if (isCategorizingVariables) {
      if (!categorizeStartedAt) setCategorizeStartedAt(Date.now());
      setLoadingStep(1);
      // Quick initial bump to avoid perceived stall
      initialKick = setTimeout(() => setLoadingStep((s) => Math.max(s, 2)), 800);
      // Advance visible step every ~3s up to 6, purely for user feedback
      timer = setInterval(() => {
        setLoadingStep((s) => (s < 6 ? s + 1 : s));
      }, 3000);
      // Add a hard timeout of 3 minutes (180 seconds)
      timeoutTimer = setTimeout(() => {
        console.error('Categorization timeout - forcing cleanup');
        setIsCategorizingVariables(false);
        setError('Categorization timed out after 3 minutes. Please try again or use a smaller file.');
        message.error('Categorization timed out. Please try again.');
        if (categorizeAbortRef.current) {
          try { categorizeAbortRef.current.abort(); } catch {}
        }
      }, 180000);
    } else {
      if (categorizeStartedAt) {
        setCategorizeStartedAt(null);
      }
      setLoadingStep(6);
    }
    return () => {
      timer && clearInterval(timer);
      initialKick && clearTimeout(initialKick);
      timeoutTimer && clearTimeout(timeoutTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCategorizingVariables]);

  // Get approval progress
  const { percentage, isReadyForGeneration, totalVariables, approvedVariables } = useApprovalProgress();
  const canGenerateConsolidated = useProjectStore((state) => state.canGenerateConsolidated());

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

  useEffect(() => {
    if (sortedCategories.length === 0) {
      setActiveCategory('0');
      return;
    }
    const index = parseInt(activeCategory, 10);
    if (Number.isNaN(index) || index >= sortedCategories.length) {
      setActiveCategory('0');
    }
  }, [sortedCategories.length, activeCategory]);

  useEffect(() => {
    // Auto-categorize when spec file is uploaded
    const autoCategorize = async () => {
      if (specificationFile && !categorizedVariables && !isCategorizingVariables && projectConfig.adamDataset) {
        try {
          await handleCategorizeVariables();
        } catch (err) {
          console.error('Auto-categorization failed:', err);
          // Error is already handled in handleCategorizeVariables
        }
      }
    };

    autoCategorize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specificationFile, categorizedVariables, isCategorizingVariables, projectConfig.adamDataset]);

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

    setIsCategorizingVariables(true);
    setError(null);
    // Prepare abort controller
    if (categorizeAbortRef.current) {
      try { categorizeAbortRef.current.abort(); } catch {}
    }
    categorizeAbortRef.current = new AbortController();

    try {
      console.log('Starting categorization...');
      console.log('Spec file path:', specificationFile.path);
      console.log('Dataset type:', projectConfig.adamDataset);

      let result;
      const canUseServerPath = specificationFile.isDefault || specificationFile.path?.startsWith('Content/');

      if (canUseServerPath) {
        result = await adamApi.categorizeSpecification(
          specificationFile.path,
          projectConfig.adamDataset,
          { signal: categorizeAbortRef.current.signal, timeoutMs: 180000 }
        );
      } else if (tempSpecFile) {
        result = await adamApi.categorizeSpecificationFile(
          tempSpecFile,
          projectConfig.adamDataset,
          { signal: categorizeAbortRef.current.signal, timeoutMs: 180000 }
        );
      } else {
        throw new Error('Specification file not accessible. Please upload the file again so we can process it.');
      }

      console.log('=== CATEGORIZATION RESULT ===');
      console.log('Total variables:', result.total_variables);
      console.log('Categories:', result.categories.length);
      console.log('Spec columns:', result.spec_columns);
      console.log('First variable sample:', result.categories[0]?.variables[0]);

      setCategorizedVariables(result);
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
      } else if (err.code === 'ERR_NETWORK') {
        const errorMsg = 'Network error. Please check if the backend server is running.';
        setError(errorMsg);
        message.error(errorMsg);
      } else {
        const errorMsg = err.response?.data?.detail || err.message || 'Failed to categorize variables';
        setError(errorMsg);
        message.error(errorMsg);
      }
      console.error('Categorization error:', err);
    } finally {
      setIsCategorizingVariables(false);
      categorizeAbortRef.current = null;
    }
  };

  const handleCancelCategorization = () => {
    try {
      categorizeAbortRef.current?.abort();
    } catch {}
    setIsCategorizingVariables(false);
    setError(null);
    message.info('Categorization cancelled. You can retry when ready.');
  };

  const handleForceReset = () => {
    try {
      categorizeAbortRef.current?.abort();
    } catch {}
    setIsCategorizingVariables(false);
    setError(null);
    setCategorizedVariables(null);
    setLoadingStep(1);
    message.success('State reset successfully. You can now retry categorization.');
  };

  const handleCancelBulkGeneration = () => {
    try {
      bulkGenerationAbortRef.current?.abort();
    } catch {}
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

    if (!projectConfig.studyId || projectConfig.studyId.trim().length < 3) {
      message.warning('Please configure a valid Study ID (minimum 3 characters) in Project Configuration tab');
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

  // Handle final ADAM code generation
  const handleGenerateADAMCode = () => {
    setShowFinalGenerationDialog(true);
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

  // No spec file uploaded
  if (!specificationFile) {
    return (
      <div className="variables-empty-state">
        <AlertCircle size={64} className="empty-icon" />
        <h3>No Specification File Uploaded</h3>
        <p>Please upload an ADAM specification file in the Specification tab to analyze variables.</p>
      </div>
    );
  }

  // Categorizing in progress
  if (isCategorizingVariables) {
    return (
      <div className="variables-loading-state">
        <AnalyzingVariablesStatus
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
    );
  }

  // Error state
  if (error && !categorizedVariables) {
    return (
      <div className="variables-error-state">
        <AlertCircle size={64} className="error-icon" />
        <h3>Categorization Failed</h3>
        <p>{error}</p>
        <button className="retry-button" onClick={handleCategorizeVariables}>
          Retry Categorization
        </button>
      </div>
    );
  }

  // No categorized variables yet
  if (!categorizedVariables) {
    return (
      <div className="variables-empty-state">
        <FileSearch size={64} className="empty-icon" />
        <h3>Variables Not Categorized</h3>
        <p>Click the button below to categorize variables from the specification.</p>
        <button className="categorize-button" onClick={handleCategorizeVariables}>
          Categorize Variables
        </button>
      </div>
    );
  }

  // Main content with categorized variables
  // Get active category for pair programming panel
  const activeCategoryData = sortedCategories[parseInt(activeCategory, 10)] || null;

  return (
    <div className="variables-analysis-tab">
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
                onChange={setActiveCategory}
                type="card"
                tabPosition="left"
                className="category-tabs category-tabs-vertical"
                tabBarGutter={8}
                items={sortedCategories.map((category, index) => ({
                  key: index.toString(),
                  label: (
                    <div className="tab-label">
                      <span className="tab-name">{category.displayName}</span>
                      <span className="tab-count">{category.count}</span>
                    </div>
                  ),
                  children: renderCategoryContent(category)
                }))}
              />
            </div>

            {/* Pair Programming Panel - 70% on the right */}
            <div className="pair-programming-container">
              {activeCategoryData && (
                <div className="pair-programming-panel" role="region" aria-label="Pair Programming Area">
                  <PairProgrammingArea
                    variables={activeCategoryData.variables}
                    categoryName={activeCategoryData.displayName || activeCategoryData.name}
                  />
                </div>
              )}
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

            <Tooltip
              title={
                approvedCount > 0
                  ? `Generate complete ADAM program from ${approvedCount} approved variable${approvedCount !== 1 ? 's' : ''}`
                  : 'Approve variables in the pair programming area to include them in the consolidated code'
              }
            >
              <button
                className="generate-adam-code-button-bottom"
                onClick={handleGenerateADAMCode}
                disabled={isGeneratingFinalCode}
              >
                {isGeneratingFinalCode ? (
                  <>
                    <Loader2 size={22} className="spinning" />
                    <span>Generating Program...</span>
                  </>
                ) : (
                  <>
                    <Download size={22} />
                    <span>Generate Complete ADAM Program</span>
                  </>
                )}
              </button>
            </Tooltip>
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
  );
};
