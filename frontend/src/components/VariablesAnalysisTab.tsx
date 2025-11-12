import React, { useEffect, useState } from 'react';
import { Tabs, message, Modal, Tooltip } from 'antd';
import { FileSearch, AlertCircle, Loader2, Info, Zap, CheckCircle, Download } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import type { VariableCategory, VariableInfo } from '../types';
import { PairProgrammingArea } from './PairProgrammingArea';
import { useApprovalProgress } from '../hooks/useApprovalProgress';
import { FinalCodeGenerationDialog, GenerationPreferences } from './FinalCodeGenerationDialog';
import { ProgramDownloadModal } from './ProgramDownloadModal';
import './VariablesAnalysisTab.css';

const { TabPane } = Tabs;

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
    sdtmVersion,
    adamIgVersion,
    medraVersion,
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

  // Final code generation state
  const [showFinalGenerationDialog, setShowFinalGenerationDialog] = useState(false);
  const [isGeneratingFinalCode, setIsGeneratingFinalCode] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [finalProgramCode, setFinalProgramCode] = useState('');

  // Get approval progress
  const { percentage, isReadyForGeneration } = useApprovalProgress();

  useEffect(() => {
    // Auto-categorize when spec file is uploaded
    if (specificationFile && !categorizedVariables && !isCategorizingVariables && projectConfig.adamDataset) {
      handleCategorizeVariables();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specificationFile, categorizedVariables, isCategorizingVariables, projectConfig.adamDataset]);

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
      
      const result = await adamApi.categorizeSpecification(
        specificationFile.path,
        projectConfig.adamDataset
      );

      console.log('=== CATEGORIZATION RESULT ===');
      console.log('Total variables:', result.total_variables);
      console.log('Categories:', result.categories.length);
      console.log('Spec columns:', result.spec_columns);
      console.log('First variable sample:', result.categories[0]?.variables[0]);

      setCategorizedVariables(result);
      message.success(
        `Successfully categorized ${result.total_variables} variables into ${result.categories.length} categories`
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

    if (!projectConfig.studyId) {
      message.warning('Please configure Study ID in Project Configuration first');
      return;
    }

    // Count total variables
    const totalVariables = categorizedVariables.total_variables;
    const estimatedTime = Math.ceil(totalVariables / 2); // Rough estimate: 2 variables per second

    Modal.confirm({
      title: <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Zap size={20} color="#1890ff" />
        <span>Generate AI Code for All Variables</span>
      </div>,
      width: 600,
      content: (
        <div style={{ padding: '16px 0' }}>
          <p style={{ marginBottom: '12px' }}>
            This will generate code snippets for <strong>{totalVariables} variables</strong> using Google Gemini AI.
          </p>
          <div style={{ 
            background: '#f0f5ff', 
            padding: '12px', 
            borderRadius: '6px',
            marginBottom: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <Info size={16} color="#1890ff" />
              <strong>What to expect:</strong>
            </div>
            <ul style={{ margin: '8px 0', paddingLeft: '24px' }}>
              <li>Code will be generated in <strong>{programmingLanguage}</strong></li>
              <li>Estimated time: <strong>~{estimatedTime} seconds</strong></li>
              <li>Each variable will get code + rationale</li>
              <li>You can review and edit in Pair Programming Area</li>
            </ul>
          </div>
          <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
            💡 Tip: Variables with similar derivations may be cached for faster generation.
          </p>
        </div>
      ),
      okText: 'Generate Code',
      cancelText: 'Cancel',
      okButtonProps: { 
        type: 'primary',
        icon: <Zap size={14} />,
        style: { height: '36px' }
      },
      cancelButtonProps: { style: { height: '36px' } },
      onOk: async () => {
        try {
          setIsGenerating(true);
          setBulkGenerationProgress({
            isGenerating: true,
            current: 0,
            total: totalVariables,
            currentVariable: 'Initializing...',
          });

          // Show progress message
          const hideProgress = message.loading({
            content: `Generating code for ${totalVariables} variables...`,
            duration: 0,
          });

          // Call bulk generation API
          const results = await adamApi.generateCodeBulk({
            categorized_variables: categorizedVariables,
            study_id: projectConfig.studyId,
            dataset: projectConfig.adamDataset || 'ADSL',
            language: programmingLanguage,
            standards: {
              sdtm_version: sdtmVersion,
              adam_ig_version: adamIgVersion,
              meddra_version: medraVersion,
            },
          });

          // Update store with all generated snippets
          setBulkCodeSnippets(results);

          // Hide progress and show success
          hideProgress();
          
          const successCount = results.filter(r => !r.error).length;
          const errorCount = results.filter(r => r.error).length;

          if (errorCount === 0) {
            message.success({
              content: (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} />
                  <span>Successfully generated code for all {successCount} variables!</span>
                </div>
              ),
              duration: 5,
            });
          } else {
            message.warning({
              content: `Generated code for ${successCount} variables. ${errorCount} failed.`,
              duration: 6,
            });
          }

          setBulkGenerationProgress({
            isGenerating: false,
            current: 0,
            total: 0,
            currentVariable: '',
          });

        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || err.message || 'Failed to generate code';
          message.error(`Code generation failed: ${errorMsg}`);
          console.error('Bulk generation error:', err);
          
          setBulkGenerationProgress({
            isGenerating: false,
            current: 0,
            total: 0,
            currentVariable: '',
          });
        } finally {
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
        .filter(([_, snippet]) => snippet.accepted)
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

  const getTypeBadge = (type?: string) => {
    if (!type) return <span className="type-badge type-unknown">N/A</span>;
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes('CHAR') || typeUpper.includes('TEXT')) {
      return <span className="type-badge type-char">Text</span>;
    }
    if (typeUpper.includes('NUM') || typeUpper.includes('NUMBER')) {
      return <span className="type-badge type-num">Numeric</span>;
    }
    if (typeUpper.includes('DATE')) {
      return <span className="type-badge type-date">Date</span>;
    }
    return <span className="type-badge type-other">{type}</span>;
  };

  const renderVariablesTable = (variables: VariableInfo[], extraCols: string[]) => {
    // Build dynamic grid template: base 5 columns + extras
    const baseTemplate = '200px 120px 100px 150px 1fr';
    const extraTemplate = extraCols.map(() => '180px').join(' ');
    const gridTemplate = extraTemplate ? `${baseTemplate} ${extraTemplate}` : baseTemplate;

    return (
      <div className="variables-table">
        <div className="table-header" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="col-variable">Variable Name</div>
          <div className="col-type">Type</div>
          <div className="col-length">Length</div>
          <div className="col-format">Format</div>
          <div className="col-label">Label / Description</div>
          {extraCols.map((col) => (
            <div key={`h-${col}`} className="col-extra">{col}</div>
          ))}
        </div>
        <div className="table-body">
          {variables.map((variable) => (
            <div key={variable.name} className="table-row" style={{ gridTemplateColumns: gridTemplate }}>
              <div className="col-variable">
                <div className="variable-name-wrapper">
                  <span className="variable-name">{variable.name}</span>
                  {variable.is_required && (
                    <span className="required-indicator" title="Required Variable">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <circle cx="6" cy="6" r="5" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
              <div className="col-type">
                {getTypeBadge(variable.type)}
              </div>
              <div className="col-length">
                {variable.length ? (
                  <span className="length-value">{variable.length}</span>
                ) : (
                  <span className="na-value">—</span>
                )}
              </div>
              <div className="col-format">
                {variable.format ? (
                  <code className="format-code">{variable.format}</code>
                ) : (
                  <span className="na-value">—</span>
                )}
              </div>
              <div className="col-label">
                <div className="label-content">
                  {variable.label && (
                    <span className="label-text">{variable.label}</span>
                  )}
                  {variable.derivation && (
                    <div className="derivation-info">
                      <Info size={12} />
                      <span>{variable.derivation}</span>
                    </div>
                  )}
                </div>
              </div>
              {/* Extra columns from specification */}
              {extraCols.map((col) => (
                <div key={`${variable.name}-${col}`} className="col-extra">
                  {variable.extra && variable.extra[col] ? (
                    <span className="label-text">{variable.extra[col]}</span>
                  ) : (
                    <span className="na-value">—</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCategoryContent = (category: VariableCategory) => {
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
  // Get active category for pair programming panel and analysis table
  const activeCategoryData = categorizedVariables?.categories[parseInt(activeCategory)] || null;

  // Build list of extra columns from spec for analysis table
  const specCols = categorizedVariables?.spec_columns || [];
  const baseCols = new Set(
    ['variable', 'variable name', 'name', 'label', 'description', 'type', 'length', 'format']
      .map((s) => s.toLowerCase())
  );
  const extraCols = specCols.filter((c) => !baseCols.has(String(c).toLowerCase()));

  return (
    <div className="variables-analysis-tab">
      <div className="variables-header">
        <div className="header-left">
          <div className="header-icon">
            <FileSearch size={24} />
          </div>
          <div className="header-content">
            <h2>Variables Analysis</h2>
            <div className="header-stats">
              <div className="stat-item">
                <span className="stat-value">{categorizedVariables.total_variables}</span>
                <span className="stat-label">Total Variables</span>
              </div>
              <div className="stat-divider">•</div>
              <div className="stat-item">
                <span className="stat-value">{categorizedVariables.categorized_count}</span>
                <span className="stat-label">Categorized</span>
              </div>
              <div className="stat-divider">•</div>
              <div className="stat-item">
                <span className="stat-value">{categorizedVariables.categories.length}</span>
                <span className="stat-label">Categories</span>
              </div>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button
            className="generate-button primary-action"
            onClick={handleGenerateCode}
            disabled={bulkGenerationProgress.isGenerating || isCategorizingVariables}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 24px',
              fontSize: '15px',
              fontWeight: 600,
              background: bulkGenerationProgress.isGenerating ? '#d9d9d9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              color: '#fff',
              borderRadius: '8px',
              cursor: bulkGenerationProgress.isGenerating ? 'not-allowed' : 'pointer',
              boxShadow: bulkGenerationProgress.isGenerating ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!bulkGenerationProgress.isGenerating) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.5)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = bulkGenerationProgress.isGenerating ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)';
            }}
          >
            {bulkGenerationProgress.isGenerating ? (
              <>
                <Loader2 size={18} className="spinning" />
                <span>Generating... ({bulkGenerationProgress.current}/{bulkGenerationProgress.total})</span>
              </>
            ) : (
              <>
                <Zap size={18} />
                <span>Get AI Inputs</span>
              </>
            )}
          </button>

          {/* Generate ADAM Code Button */}
          <Tooltip
            title={
              !isReadyForGeneration
                ? `${80 - percentage}% more approvals needed (currently ${percentage}%)`
                : 'Generate complete ADAM program from approved variables'
            }
          >
            <button
              className="generate-adam-code-button"
              onClick={handleGenerateADAMCode}
              disabled={!isReadyForGeneration || isGeneratingFinalCode}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 24px',
                fontSize: '15px',
                fontWeight: 600,
                background: isReadyForGeneration && !isGeneratingFinalCode
                  ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                  : '#d1d5db',
                border: 'none',
                color: '#fff',
                borderRadius: '8px',
                cursor: isReadyForGeneration && !isGeneratingFinalCode ? 'pointer' : 'not-allowed',
                boxShadow: isReadyForGeneration && !isGeneratingFinalCode
                  ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                  : 'none',
                transition: 'all 0.3s ease',
                animation: isReadyForGeneration ? 'pulse 2s ease-in-out infinite' : 'none',
              }}
              onMouseEnter={(e) => {
                if (isReadyForGeneration && !isGeneratingFinalCode) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = isReadyForGeneration
                  ? '0 4px 12px rgba(16, 185, 129, 0.4)'
                  : 'none';
              }}
            >
              {isGeneratingFinalCode ? (
                <>
                  <Loader2 size={18} className="spinning" />
                  <span>Generating Program...</span>
                </>
              ) : (
                <>
                  <Download size={18} />
                  <span>Generate ADAM Code</span>
                </>
              )}
            </button>
          </Tooltip>

          <button
            className="recategorize-button"
            onClick={handleCategorizeVariables}
            disabled={isCategorizingVariables}
          >
            <Loader2 size={16} className={isCategorizingVariables ? 'spinning' : ''} />
            Re-categorize
          </button>
        </div>
      </div>

      {categorizedVariables.categories.length > 0 ? (
        <>
          {/* Top Section: Tabs (30%) + Pair Programming (70%) */}
          <div className="tabs-and-pair-programming">
            <div className="category-tabs-container">
              <Tabs
                activeKey={activeCategory}
                onChange={setActiveCategory}
                type="card"
                tabPosition="left"
                className="category-tabs category-tabs-vertical"
                tabBarGutter={8}
              >
                {categorizedVariables.categories.map((category, index) => (
                  <TabPane
                    tab={
                      <div className="tab-label">
                        <span className="tab-name">{category.name}</span>
                        <span className="tab-count">{category.count}</span>
                      </div>
                    }
                    key={index.toString()}
                  >
                    {renderCategoryContent(category)}
                  </TabPane>
                ))}
              </Tabs>
            </div>

            {/* Pair Programming Panel - 70% on the right */}
            <div className="pair-programming-container">
              {activeCategoryData && (
                <div className="pair-programming-panel" role="region" aria-label="Pair Programming Area">
                  <PairProgrammingArea
                    variables={activeCategoryData.variables}
                    categoryName={activeCategoryData.name}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Bottom Section: Analysis Table (Full Width) */}
          {activeCategoryData && (
            <div className="analysis-table-section">
              <div className="analysis-panel" role="region" aria-label="Variables Analysis Table">
                {renderVariablesTable(activeCategoryData.variables, extraCols)}
              </div>
            </div>
          )}
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
