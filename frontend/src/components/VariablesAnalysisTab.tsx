import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, message, Modal, Tooltip, Button, Select, Progress } from 'antd';
import { FileSearch, AlertCircle, Loader2, Info, Zap, Download, RefreshCw } from 'lucide-react';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ApiOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import type { VariableCategory } from '../types';
import { PairProgrammingArea } from './PairProgrammingArea';
import { useApprovalProgress } from '../hooks/useApprovalProgress';
import { FinalCodeGenerationDialog, GenerationPreferences } from './FinalCodeGenerationDialog';
import { ProgramDownloadModal } from './ProgramDownloadModal';
import { showNavigationConfirmation } from './ConfirmationDialog';
import './VariablesAnalysisTab.css';

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
type LayoutPresetKey = 'balanced' | 'focused' | 'immersive' | 'ultra';
const LAYOUT_PRESETS: Record<
  LayoutPresetKey,
  { label: string; subtitle: string; columns: string; pairPercentage: number }
> = {
  balanced: { label: 'Balanced', subtitle: '30% / 70%', columns: '30% 70%', pairPercentage: 70 },
  focused: { label: 'Focused', subtitle: '25% / 75%', columns: '25% 75%', pairPercentage: 75 },
  immersive: { label: 'Immersive', subtitle: '20% / 80%', columns: '20% 80%', pairPercentage: 80 },
  ultra: { label: 'Ultra Focus', subtitle: '5% / 95%', columns: '5% 95%', pairPercentage: 95 },
};

export const VariablesAnalysisTab: React.FC = () => {
  const {
    specificationFile,
    projectConfig,
    categorizedVariables,
    setCategorizedVariables,
    isCategorizingVariables,
    setIsCategorizingVariables,
    setIsGenerating,
    setBulkCodeSnippets,
    programmingLanguage,
    setProgrammingLanguage,
    sdtmVersion,
    adamIgVersion,
    medraVersion,
    tempSpecFile,
    llmProvider,
    setLlmProvider,
    llmConnectionStatus,
    selectedModel,
    setSelectedModel,
    availableModels,
    setAvailableModels,
    llmConnectionMessage,
    setLlmConnectionStatus,
    resetWorkspace,
    getCompletionPercentage,
  } = useProjectStore();

  const [activeCategory, setActiveCategory] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
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

  // Final code generation state
  const [showFinalGenerationDialog, setShowFinalGenerationDialog] = useState(false);
  const [isGeneratingFinalCode, setIsGeneratingFinalCode] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [finalProgramCode, setFinalProgramCode] = useState('');
  const [layoutPreset, setLayoutPreset] = useState<LayoutPresetKey>('focused');
  const layoutOptions = useMemo(
    () =>
      (Object.entries(LAYOUT_PRESETS) as [LayoutPresetKey, (typeof LAYOUT_PRESETS)[LayoutPresetKey]][]).sort(
        (a, b) => a[1].pairPercentage - b[1].pairPercentage
      ),
    []
  );

  // Get approval progress
  const { percentage, isReadyForGeneration } = useApprovalProgress();

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
    if (specificationFile && !categorizedVariables && !isCategorizingVariables && projectConfig.adamDataset) {
      handleCategorizeVariables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specificationFile, categorizedVariables, isCategorizingVariables, projectConfig.adamDataset]);

  // Fetch OpenRouter models when provider is OpenRouter
  useEffect(() => {
    const fetchModels = async () => {
      if (llmProvider === 'openrouter') {
        if (availableModels.length > 0) {
          console.log('Models already loaded:', availableModels.length);
          return;
        }
        
        console.log('Fetching OpenRouter models...');
        setLoadingModels(true);
        setModelError(null);
        
        try {
          const models = await adamApi.getOpenRouterModels();
          console.log('Received models:', models?.length || 0, models);
          
          if (!models || models.length === 0) {
            setModelError('No models available. Check OpenRouter API key configuration.');
            console.error('No models returned from API');
            return;
          }
          
          setAvailableModels(models);
          
          // Set default model if none selected
          if (!selectedModel && models.length > 0) {
            console.log('Setting default model:', models[0].id);
            setSelectedModel(models[0].id);
          }
        } catch (error: any) {
          const errorMsg = error.response?.data?.detail || error.message || 'Failed to load models';
          console.error('Failed to fetch OpenRouter models:', errorMsg, error);
          setModelError(errorMsg);
        } finally {
          setLoadingModels(false);
        }
      }
    };
    
    fetchModels();
  }, [llmProvider, availableModels.length, selectedModel, setAvailableModels, setSelectedModel]);

  const formatDuration = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.round(seconds));
    const mins = Math.floor(safeSeconds / 60);
    const secs = safeSeconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs}s`;
  };

  // Test LLM connection
  const handleTestConnection = async () => {
    setLlmConnectionStatus('testing', 'Testing connection...');
    
    try {
      console.log('Testing connection to:', llmProvider, 'model:', selectedModel);
      
      const result = await adamApi.testLLMConnection(
        llmProvider,
        llmProvider === 'openrouter' ? selectedModel || undefined : undefined
      );
      
      if (result.success) {
        setLlmConnectionStatus('connected', result.message);
        message.success({
          content: (
            <span>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              {result.message}
            </span>
          ),
          duration: 3,
        });
      } else {
        setLlmConnectionStatus('failed', result.message);
        message.error({
          content: (
            <span>
              <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
              {result.message}
            </span>
          ),
          duration: 5,
        });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Connection test failed';
      setLlmConnectionStatus('failed', errorMsg);
      message.error({
        content: (
          <span>
            <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            {errorMsg}
          </span>
        ),
        duration: 5,
      });
      console.error('Connection test failed:', error);
    }
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

    try {
      console.log('Starting categorization...');
      console.log('Spec file path:', specificationFile.path);
      console.log('Dataset type:', projectConfig.adamDataset);

      let result;
      const canUseServerPath = specificationFile.isDefault || specificationFile.path?.startsWith('Content/');

      if (canUseServerPath) {
        result = await adamApi.categorizeSpecification(
          specificationFile.path,
          projectConfig.adamDataset
        );
      } else if (tempSpecFile) {
        result = await adamApi.categorizeSpecificationFile(
          tempSpecFile,
          projectConfig.adamDataset
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
      
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to categorize variables';
      setError(errorMsg);
      message.error(errorMsg);
      console.error('Categorization error:', err);
    } finally {
      setIsCategorizingVariables(false);
    }
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
    const estimatedTime = Math.ceil(totalVariables / 2); // Rough estimate: 2 variables per second

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
      onOk: async () => {
        const total = categorizedVariables.total_variables;
        if (total === 0) {
          message.info('No variables available for AI generation.');
          return;
        }

        const progressKey = 'bulk-ai-inputs';
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

        const updateToast = (completed: number, statusLabel: string) => {
          const elapsedSeconds = (Date.now() - startTime) / 1000;
          const etaSeconds = Math.max(0, estimatedTime - elapsedSeconds);
          const progressPercent = Math.round((completed / total) * 100);

          message.open({
            key: progressKey,
            type: 'loading',
            duration: 0,
            content: (
              <div className="bulk-progress-message" style={{ width: '320px' }}>
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                  {statusLabel}
                </div>
                
                {/* Visual Progress Bar */}
                <Progress
                  percent={progressPercent}
                  status="active"
                  strokeColor={{
                    '0%': '#667eea',
                    '100%': '#764ba2',
                  }}
                  trailColor="#f0f0f0"
                  strokeWidth={8}
                  showInfo={false}
                  style={{ marginBottom: '8px' }}
                />
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '13px',
                  marginBottom: '6px'
                }}>
                  <span style={{ fontWeight: 500 }}>{completed}/{total} variables</span>
                  <span style={{ color: '#667eea', fontWeight: 500 }}>{progressPercent}%</span>
                </div>
                
                <div style={{ 
                  fontSize: '11px', 
                  color: '#999',
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span>⏱️ {formatDuration(elapsedSeconds)}</span>
                  <span>⏳ ~{formatDuration(etaSeconds)}</span>
                </div>
              </div>
            ),
          });
        };

        try {
          setIsGenerating(true);
          updateProgressState(0, 'Initializing...');
          updateToast(0, 'Initializing...');

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

          // Add model parameter if OpenRouter is selected
          if (llmProvider === 'openrouter') {
            const selectedModel = useProjectStore.getState().selectedModel;
            if (selectedModel) {
              requestPayload.model = selectedModel;
            }
          }

          const results = await adamApi.generateCodeBulkStream(requestPayload, (progress) => {
            // Real-time progress update from backend
            const { completed, total: totalVars, variable_name, message: progressMessage } = progress;
            
            updateProgressState(completed, variable_name || progressMessage);
            
            // Update toast with real progress
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const avgTimePerVar = completed > 0 ? elapsedSeconds / completed : 2;
            const remainingVars = totalVars - completed;
            const etaSeconds = remainingVars * avgTimePerVar;
            const progressPercent = Math.round((completed / totalVars) * 100);
            
            message.open({
              key: progressKey,
              type: 'loading',
              duration: 0,
              content: (
                <div className="bulk-progress-message" style={{ width: '320px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                    Generating AI Code
                  </div>
                  
                  {/* Visual Progress Bar */}
                  <Progress
                    percent={progressPercent}
                    status="active"
                    strokeColor={{
                      '0%': '#667eea',
                      '100%': '#764ba2',
                    }}
                    trailColor="#f0f0f0"
                    strokeWidth={8}
                    showInfo={false}
                    style={{ marginBottom: '8px' }}
                  />
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between',
                    fontSize: '13px',
                    marginBottom: '6px'
                  }}>
                    <span style={{ fontWeight: 500 }}>{completed}/{totalVars} variables</span>
                    <span style={{ color: '#667eea', fontWeight: 500 }}>{progressPercent}%</span>
                  </div>
                  
                  {variable_name && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      marginBottom: '6px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      📝 {variable_name}
                    </div>
                  )}
                  
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#999',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span>⏱️ {formatDuration(elapsedSeconds)}</span>
                    <span>⏳ ~{formatDuration(etaSeconds)}</span>
                  </div>
                </div>
              ),
            });
          });

          stopTimer();

          console.log('[Bulk Generation] API returned results:', results.length);
          console.log('[Bulk Generation] Sample result:', results[0]);

          setBulkCodeSnippets(results);

          const successCount = results.filter(r => !r.error).length;
          const errorCount = results.filter(r => r.error).length;

          console.log('[Bulk Generation] Success:', successCount, 'Errors:', errorCount);

          setBulkGenerationProgress({
            isGenerating: false,
            current: total,
            total,
            currentVariable: 'Completed',
          });

          message.success({
            key: progressKey,
            duration: 5,
            content: (
              <div className="bulk-progress-message">
                <div style={{ fontWeight: 600 }}>AI inputs ready</div>
                <div>
                  Generated code for {successCount} of {total} variables
                  {errorCount ? ` (${errorCount} need attention)` : ''}.
                </div>
                <div>Total time: {formatDuration((Date.now() - startTime) / 1000)}</div>
              </div>
            ),
          });

        } catch (err: any) {
          stopTimer();
          const errorMsg = err.response?.data?.detail || err.message || 'Failed to generate code';

          // Don't populate with mock snippets - just show error and keep cells empty
          setBulkGenerationProgress({
            isGenerating: false,
            current: 0,
            total,
            currentVariable: 'Failed',
          });

          message.error({
            key: progressKey,
            content: `Code generation failed: ${errorMsg}`,
            duration: 5,
          });
          console.error('Bulk generation error:', err);
        } finally {
          stopTimer();
          setIsGenerating(false);
        }
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
      const pairProgramming = useProjectStore.getState().pairProgramming;
      const approvedVarNames = Object.entries(pairProgramming.snippets)
        .filter(([_, snippet]) => snippet.accepted === 'accept')
        .map(([name, _]) => name);

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
        <Loader2 size={64} className="loading-spinner" />
        <h3>Analyzing variables...</h3>
        <p>Reading specification and categorizing variables using the standard mapping</p>
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
      {/* Model Configuration Section */}
      <div className="variables-header-with-config">
        {/* Left side: Language Selection */}
        <div className="header-config-left">
          <div className="compact-group">
            <span className="compact-label">Language:</span>
            <div className="language-buttons-compact">
              <Button
                type={programmingLanguage === 'R' ? 'primary' : 'default'}
                onClick={() => setProgrammingLanguage('R')}
                className={programmingLanguage === 'R' ? 'active' : ''}
              >
                R
              </Button>
              <Button
                type={programmingLanguage === 'SAS' ? 'primary' : 'default'}
                onClick={() => setProgrammingLanguage('SAS')}
                className={programmingLanguage === 'SAS' ? 'active' : ''}
              >
                SAS
              </Button>
            </div>
          </div>
        </div>

        {/* Right side: AI Model Configuration Group */}
        <div className="header-config-right">
          <div className="ai-model-config-group">
            <div className="config-group-header">
              <span className="config-group-icon">🤖</span>
              <span className="config-group-title">AI Configuration</span>
            </div>
            
            <div className="config-group-content">
              {/* LLM Provider */}
              <div className="config-item">
                <span className="config-label">Provider:</span>
                <Select
                  value={llmProvider}
                  onChange={(value) => setLlmProvider(value)}
                  className="config-select"
                  placeholder="Provider"
                >
                  <Select.Option value="groq">🚀 Groq</Select.Option>
                  <Select.Option value="openai">🧠 OpenAI</Select.Option>
                  <Select.Option value="anthropic">✨ Anthropic</Select.Option>
                  <Select.Option value="google">🌐 Google</Select.Option>
                  <Select.Option value="openrouter">🌟 OpenRouter</Select.Option>
                </Select>
              </div>

              {/* Model Selection (OpenRouter only) */}
              {llmProvider === 'openrouter' && (
                <div className="config-item">
                  <span className="config-label">Model:</span>
                  <Select
                    value={selectedModel}
                    onChange={(value) => setSelectedModel(value)}
                    showSearch
                    optionFilterProp="label"
                    loading={loadingModels}
                    className="config-select"
                    placeholder="Select Model"
                    notFoundContent={
                      modelError ? (
                        <div style={{ padding: '12px', color: '#ff4d4f', fontSize: '12px' }}>
                          <AlertCircle size={14} style={{ marginRight: 4 }} />
                          {modelError}
                        </div>
                      ) : (
                        <div style={{ padding: '12px', color: '#999', fontSize: '12px' }}>
                          No models available
                        </div>
                      )
                    }
                  >
                    {availableModels.map(model => (
                      <Select.Option value={model.id} label={model.name} key={model.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{model.name}</div>
                            {model.context_length && (
                              <small style={{ color: '#999' }}>
                                {Math.round(model.context_length / 1000)}K context
                              </small>
                            )}
                          </div>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </div>
              )}

              {/* Connection Test */}
              <div className="config-item config-item-test">
                <Tooltip title={llmConnectionMessage || 'Test LLM connection'}>
                  <Button
                    icon={
                      llmConnectionStatus === 'testing' ? <LoadingOutlined /> :
                      llmConnectionStatus === 'connected' ? <CheckCircleOutlined /> :
                      llmConnectionStatus === 'failed' ? <CloseCircleOutlined /> :
                      <ApiOutlined />
                    }
                    onClick={handleTestConnection}
                    loading={llmConnectionStatus === 'testing'}
                    type={llmConnectionStatus === 'connected' ? 'primary' : 'default'}
                    danger={llmConnectionStatus === 'failed'}
                    className="config-test-button"
                  >
                    {llmConnectionStatus === 'connected' ? 'Connected' : 
                     llmConnectionStatus === 'failed' ? 'Failed' : 
                     'Test Connection'}
                  </Button>
                </Tooltip>
                
                {llmConnectionStatus === 'connected' && (
                  <span className="config-status-badge success">
                    <span className="status-dot connected"></span>
                    Ready
                  </span>
                )}
                {llmConnectionStatus === 'failed' && (
                  <span className="config-status-badge error">
                    <span className="status-dot failed"></span>
                    Error
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="variables-header">
        <div className="header-left">
          <div className="header-icon">
            <FileSearch size={24} />
          </div>
          <div className="header-content">
            <h2>Variables Analysis</h2>
            <div className="header-stats-visual">
              <div className="stat-card stat-card-primary">
                <div className="stat-icon">
                  <div className="icon-circle">
                    {categorizedVariables.total_variables}
                  </div>
                </div>
                <div className="stat-info">
                  <span className="stat-label-visual">Total Variables</span>
                </div>
              </div>
              <div className="stat-card stat-card-secondary">
                <div className="stat-icon">
                  <div className="icon-circle-alt">
                    {categorizedVariables.categories.length}
                  </div>
                </div>
                <div className="stat-info">
                  <span className="stat-label-visual">Categories</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dataset Display - Centered */}
        <div className="header-center">
          <div className="dataset-badge">
            <div className="dataset-icon">📊</div>
            <div className="dataset-content">
              <span className="dataset-label">Dataset</span>
              <span className="dataset-value">{categorizedVariables?.dataset_type || 'ADSL'}</span>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button
            className="recategorize-button"
            onClick={handleCategorizeVariables}
            disabled={isCategorizingVariables}
          >
            <Loader2 size={20} className={isCategorizingVariables ? 'spinning' : ''} />
            Re-analyze Variables
          </button>

          <button
            className="refresh-button"
            onClick={handleRefresh}
            title="Reset workspace and start fresh"
          >
            <RefreshCw size={20} />
            Clear All & Restart
          </button>
        </div>
      </div>

      {sortedCategories.length > 0 ? (
        <>
          <div className="layout-toggle">
            <div className="layout-toggle-label">Workspace layout</div>
            <div className="layout-toggle-buttons">
              {layoutOptions.map(([key, preset]) => {
                const isActive = layoutPreset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`layout-toggle-button ${isActive ? 'active' : ''}`}
                    onClick={() => setLayoutPreset(key)}
                    aria-pressed={isActive}
                  >
                    <span className="layout-toggle-title">{preset.label}</span>
                    <span className="layout-toggle-subtitle">{preset.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

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
                    getAiInputsButton={
                      <Tooltip
                        title={
                          llmConnectionStatus !== 'connected'
                            ? 'Test the connection first using the "Test Connection" button in the header'
                            : bulkGenerationProgress.isGenerating
                            ? 'Generation in progress...'
                            : 'Generate code snippets for all variables using AI'
                        }
                      >
                        <button
                          className="generate-button primary-action"
                          onClick={handleGenerateCode}
                          disabled={bulkGenerationProgress.isGenerating || isCategorizingVariables || llmConnectionStatus !== 'connected'}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 20px',
                            fontSize: '14px',
                            fontWeight: 600,
                            background: (bulkGenerationProgress.isGenerating || llmConnectionStatus !== 'connected') 
                              ? '#d9d9d9' 
                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                            border: 'none',
                            color: '#fff',
                            borderRadius: '6px',
                            cursor: (bulkGenerationProgress.isGenerating || llmConnectionStatus !== 'connected') 
                              ? 'not-allowed' 
                              : 'pointer',
                            boxShadow: (bulkGenerationProgress.isGenerating || llmConnectionStatus !== 'connected') 
                              ? 'none' 
                              : '0 2px 8px rgba(59, 130, 246, 0.4)',
                            transition: 'all 0.3s ease',
                            opacity: llmConnectionStatus !== 'connected' ? 0.6 : 1,
                          }}
                          onMouseEnter={(e) => {
                            if (!bulkGenerationProgress.isGenerating && llmConnectionStatus === 'connected') {
                              e.currentTarget.style.transform = 'translateY(-1px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = (bulkGenerationProgress.isGenerating || llmConnectionStatus !== 'connected') 
                              ? 'none' 
                              : '0 2px 8px rgba(59, 130, 246, 0.4)';
                          }}
                        >
                          {bulkGenerationProgress.isGenerating ? (
                            <>
                              <Loader2 size={16} className="spinning" />
                              <span>Generating... ({bulkGenerationProgress.current}/{bulkGenerationProgress.total})</span>
                            </>
                          ) : (
                            <>
                              <Zap size={16} />
                              <span>Get AI Inputs</span>
                            </>
                          )}
                        </button>
                      </Tooltip>
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Area - Generate ADAM Code */}
          <div className="bottom-action-area" style={{
            padding: '20px 24px',
            background: 'linear-gradient(to bottom, #f8f9fa 0%, #ffffff 100%)',
            borderTop: '2px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isReadyForGeneration ? (
                <>
                  <CheckCircleOutlined style={{ fontSize: '24px', color: '#10B981' }} />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#10B981' }}>
                      Ready for Generation!
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {percentage}% of variables approved • Click the button to generate complete ADAM program
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Info size={24} color="#f59e0b" />
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b' }}>
                      Approval Progress: {percentage}%
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {80 - percentage}% more approvals needed to generate ADAM program
                    </div>
                  </div>
                </>
              )}
            </div>

            <Tooltip
              title={
                !isReadyForGeneration
                  ? `${80 - percentage}% more approvals needed (currently ${percentage}%)`
                  : 'Generate complete ADAM program from approved variables'
              }
            >
              <button
                className="generate-adam-code-button-bottom"
                onClick={handleGenerateADAMCode}
                disabled={!isReadyForGeneration || isGeneratingFinalCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '16px 40px',
                  fontSize: '18px',
                  fontWeight: 700,
                  background: isReadyForGeneration && !isGeneratingFinalCode
                    ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                    : '#d1d5db',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '10px',
                  cursor: isReadyForGeneration && !isGeneratingFinalCode ? 'pointer' : 'not-allowed',
                  boxShadow: isReadyForGeneration && !isGeneratingFinalCode
                    ? '0 8px 20px rgba(16, 185, 129, 0.5)'
                    : 'none',
                  transition: 'all 0.3s ease',
                  animation: isReadyForGeneration ? 'pulse 2s ease-in-out infinite' : 'none',
                  minWidth: '280px',
                }}
                onMouseEnter={(e) => {
                  if (isReadyForGeneration && !isGeneratingFinalCode) {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(16, 185, 129, 0.6)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isReadyForGeneration
                    ? '0 8px 20px rgba(16, 185, 129, 0.5)'
                    : 'none';
                }}
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
    </div>
  );
};
