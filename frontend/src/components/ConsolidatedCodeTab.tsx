import { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Empty,
  message,
  Modal,
  Progress,
  Radio,
  Space,
  Switch,
  Tag,
} from 'antd';
import { DownloadOutlined, FileDoneOutlined, CopyOutlined, CheckCircleOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons';
import { Code2 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { triggerDownload } from '../utils/downloadHelpers';
import type { ConsolidatedCodeRequest, ConsolidatedCodeData, ConsolidatedVariable } from '../types';
import './ConsolidatedCodeTab.css';

export const ConsolidatedCodeTab: React.FC = () => {
  const {
    projectConfig,
    categorizedVariables,
    pairProgramming,
    programmingLanguage,
    commentVerbosity,
    executionMode,
    consolidatedCode,
    isGeneratingConsolidated,
    consolidatedProgress,
    codeReviewStatus,
    consolidatedStatus,
    setCommentVerbosity,
    setConsolidatedCode,
    setIsGeneratingConsolidated,
    setConsolidatedProgress,
    setConsolidatedDuration,
    canGenerateConsolidated,
  } = useProjectStore();
  const [activeLanguage, setActiveLanguage] = useState<'R' | 'SAS'>(programmingLanguage);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [, setAbortController] = useState<AbortController | null>(null);
  
  // Additional ADAM-specific settings
  const [includeMetadata, setIncludeMetadata] = useState<boolean>(true);
  const [includeTraceability, setIncludeTraceability] = useState<boolean>(true);
  const [includeValidation, setIncludeValidation] = useState<boolean>(true);
  const [sortVariables, setSortVariables] = useState<boolean>(true);

  // Real-time elapsed time tracking
  useEffect(() => {
    if (isGeneratingConsolidated && !consolidatedCode) {
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
      return () => {
        clearInterval(interval);
      };
    } else {
      setElapsedTime(0);
    }
  }, [isGeneratingConsolidated, consolidatedCode]);

  const categorizedMap = useMemo(() => {
    const map = new Map<string, { category: string; meta: { type?: string; length?: string; format?: string; label?: string; required?: boolean } }>();
    categorizedVariables?.categories?.forEach((category) => {
      category.variables.forEach((variable) => {
        map.set(variable.name, {
          category: category.name,
          meta: {
            type: variable.type,
            length: variable.length,
            format: variable.format,
            label: variable.label,
            required: variable.is_required,
          },
        });
      });
    });
    return map;
  }, [categorizedVariables]);

  const buildApprovedVariables = (): ConsolidatedVariable[] => {
    // Include ALL variables with code, regardless of approval status
    // This allows generating consolidated code even for variables marked as 'modify' or not yet approved
    return Object.values(pairProgramming.snippets)
      .filter((snippet) => {
        // Include any variable that has code (regardless of approval status)
        return !!snippet.codeSnippet && !snippet.error;
      })
      .map((snippet) => {
        const meta = categorizedMap.get(snippet.variable);
        // Transform metadata to match backend VariableMetadata schema
        // Backend requires: name (str), type (str), and optional fields
        let transformedMetadata = undefined;
        if (meta?.meta) {
          const metadataObj: any = {
            name: snippet.variable, // Required field
            type: meta.meta.type || 'text', // Required field
          };
          
          // Handle optional fields with proper type conversion
          if (meta.meta.length) {
            const lengthValue = typeof meta.meta.length === 'string' ? parseInt(meta.meta.length, 10) : meta.meta.length;
            if (!isNaN(lengthValue as number)) {
              metadataObj.length = lengthValue;
            }
          }
          
          if (meta.meta.format) {
            metadataObj.format = meta.meta.format;
          }
          
          if (meta.meta.label) {
            metadataObj.label = meta.meta.label;
          }

          // Handle required field
          const isRequired = meta.meta.required === true;
          if (isRequired) {
            metadataObj.required = true;
          }
          
          transformedMetadata = metadataObj;
        }
        
        return {
          name: snippet.variable,
          category: meta?.category || 'Other Category',
          code_snippet: snippet.codeSnippet,
          user_notes: snippet.userNotes && snippet.userNotes.trim() ? snippet.userNotes.trim() : undefined,
          derivation_logic: snippet.rationale && snippet.rationale.trim() ? snippet.rationale.trim() : undefined,
          metadata: transformedMetadata,
        };
      });
  };

  const showPreGenerationSummary = () => {
    const approvedVariables = buildApprovedVariables();
    const variablesByCategory = new Map<string, string[]>();
    approvedVariables.forEach(v => {
      const vars = variablesByCategory.get(v.category) || [];
      vars.push(v.name);
      variablesByCategory.set(v.category, vars);
    });

    Modal.confirm({
      title: 'Confirm Consolidated Code Generation',
      width: 650,
      icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
      content: (
        <div>
          <Alert
            message={`Ready to generate consolidated code for ${approvedVariables.length} variables with code`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Total Variables">{approvedVariables.length}</Descriptions.Item>
            <Descriptions.Item label="Categories">{variablesByCategory.size}</Descriptions.Item>
            <Descriptions.Item label="Language">{activeLanguage}</Descriptions.Item>
            <Descriptions.Item label="Comment Level">{commentVerbosity}</Descriptions.Item>
            <Descriptions.Item label="Dataset" span={2}>{projectConfig.adamDataset || 'ADSL'}</Descriptions.Item>
            <Descriptions.Item label="Metadata" span={2}>
              {includeMetadata ? '✓' : '✗'} Headers, 
              {includeTraceability ? ' ✓' : ' ✗'} Traceability, 
              {includeValidation ? ' ✓' : ' ✗'} Validation, 
              {sortVariables ? ' ✓' : ' ✗'} Sorted
            </Descriptions.Item>
          </Descriptions>
          
          <Divider style={{ margin: '12px 0' }}>Variables by Category</Divider>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {Array.from(variablesByCategory).map(([category, vars]) => (
              <div key={category} style={{ marginBottom: 8 }}>
                <Tag color="blue" style={{ marginBottom: 4 }}>{category}</Tag>
                <div style={{ fontSize: '12px', color: '#666', marginLeft: 8 }}>
                  {vars.join(', ')}
                </div>
              </div>
            ))}
          </div>
          
          <Alert
            message="Estimated time: 30-60 seconds"
            type="warning"
            showIcon
            style={{ marginTop: 16 }}
          />
        </div>
      ),
      okText: 'Generate Consolidated Code',
      cancelText: 'Cancel',
      onOk: performGeneration,
    });
  };

  const handleGenerate = async () => {
    if (!canGenerateConsolidated()) {
      message.warning('No variables with code found. Please generate code for at least one variable first.');
      return;
    }

    const approvedVariables = buildApprovedVariables();
    if (!approvedVariables.length) {
      message.warning('No variables with code found. Please generate code for variables first.');
      return;
    }

    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      message.warning('Please complete project configuration and dataset selection.');
      return;
    }

    showPreGenerationSummary();
  };

  const performGeneration = async () => {
    const approvedVariables = buildApprovedVariables();
    const datasetName = ((projectConfig.adamDataset || 'ADSL').toUpperCase() as ConsolidatedCodeRequest['dataset']);

    const request: ConsolidatedCodeRequest = {
      study_id: projectConfig.studyId,
      dataset: datasetName,
      language: activeLanguage,
      comment_verbosity: commentVerbosity,
      execution_mode: executionMode,
      approved_variables: approvedVariables,
      user_preferences: {
        include_metadata: includeMetadata,
        include_traceability: includeTraceability,
        include_validation: includeValidation,
        sort_variables: sortVariables,
      },
      standards_version: {
        adam: projectConfig.adamIgVersion,
        sdtm: projectConfig.sdtmVersion,
        medra: projectConfig.medraVersion,
      },
    };

    const start = Date.now();
    setIsGeneratingConsolidated(true);
    setConsolidatedProgress(5, 'Preparing generation request…');
    setConsolidatedDuration(null);

    // Create new abort controller for this generation
    const controller = new AbortController();
    setAbortController(controller);

    try {
      // Use streaming endpoint with real-time progress updates
      const response = await adamApi.generateConsolidatedCodeStream(
        request,
        (progress) => {
          setConsolidatedProgress(progress.progress_pct, progress.message);
          const elapsedMs = Date.now() - start;
          setConsolidatedDuration(elapsedMs / 1000);
        },
        controller.signal
      );

      if (response.status !== 'success' || !response.data) {
        throw new Error(response.message || 'Failed to generate consolidated code.');
      }
      setConsolidatedCode(response.data as ConsolidatedCodeData);
      setConsolidatedProgress(100, 'Generation complete');
      setConsolidatedDuration((Date.now() - start) / 1000);
      message.success('Consolidated code generated successfully.');
    } catch (error: any) {
      if (error.message === 'Generation cancelled by user') {
        message.info('Code generation cancelled.');
        setConsolidatedProgress(0, 'Cancelled');
      } else {
        const detail = error?.response?.data?.detail || error.message || 'Failed to generate consolidated code.';
        message.error(detail);
        setConsolidatedProgress(0, 'Generation failed');
      }
    } finally {
      setIsGeneratingConsolidated(false);
      setAbortController(null);
    }
  };

  const handleCopy = () => {
    if (consolidatedCode?.consolidated_code) {
      navigator.clipboard.writeText(consolidatedCode.consolidated_code);
      message.success('Consolidated code copied to clipboard.');
    }
  };

  const handleDownload = () => {
    if (!consolidatedCode?.consolidated_code) return;

    const extension = activeLanguage === 'R' ? 'R' : 'sas';
    const datasetName = projectConfig.adamDataset || 'ADAM';

    triggerDownload(
      new Blob([consolidatedCode.consolidated_code], { type: 'text/plain;charset=utf-8' }),
      `${datasetName}_consolidated.${extension}`,
      {
        onError: (err) => message.error('Failed to download: ' + err.message)
      }
    );
  };

  const summarisedOptimizations = consolidatedCode?.summary.optimizations_applied || [];
  const variablesWithCode = buildApprovedVariables().length;
  const hasCodeSnippets = variablesWithCode > 0;
  const reviewStatus = codeReviewStatus || 'not_started';
  const showReviewWarning = reviewStatus !== 'approved';

  const totalWarnings = consolidatedCode?.validation_results.warnings.length ?? 0;
  const totalErrors = consolidatedCode?.validation_results.errors.length ?? 0;

  return (
    <div className="consolidated-tab">
      {/* Header with gradient - matching Pair Programming style */}
      <div className="consolidated-header">
        <div className="header-info">
          <Code2 size={20} />
          <span className="header-title">Consolidated ADAM Code</span>
          <span className="header-subtitle">
            {variablesWithCode} variables with code • {consolidatedCode ? 'Generated' : 'Ready'}
          </span>
        </div>
        <div className="header-actions">
          <Button
            type="primary"
            icon={<FileDoneOutlined />}
            onClick={handleGenerate}
            loading={isGeneratingConsolidated}
            disabled={!hasCodeSnippets || isGeneratingConsolidated}
            size="large"
          >
            {isGeneratingConsolidated ? 'Generating...' : 'Generate Code'}
          </Button>
        </div>
      </div>

      {/* Code Review Status Banner (warning only, generation still allowed) */}
      {showReviewWarning && (
        <Alert
          type="warning"
          showIcon
          message="Code review not approved"
          description="You can generate consolidated code, but it will be treated as draft until the Code Review tab is approved."
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Split layout: Controls Panel + Main Content */}
      <div className="consolidated-layout">
        {/* Side Panel: Controls */}
        <div className="consolidated-controls-panel">
          <div className="controls-section">
            <div className="section-header">
              <FileTextOutlined />
              <span>Generation Settings</span>
            </div>

            <div className="control-item">
              <label className="control-label">Target Language</label>
              <Radio.Group
                value={activeLanguage}
                onChange={(e) => setActiveLanguage(e.target.value)}
                buttonStyle="solid"
                style={{ width: '100%' }}
              >
                <Radio.Button value="R" style={{ width: '50%', textAlign: 'center' }}>
                  R
                </Radio.Button>
                <Radio.Button value="SAS" style={{ width: '50%', textAlign: 'center' }}>
                  SAS
                </Radio.Button>
              </Radio.Group>
            </div>

            <div className="control-item">
              <label className="control-label">Comment Verbosity</label>
              <Radio.Group
                value={commentVerbosity}
                onChange={(e) => setCommentVerbosity(e.target.value)}
                buttonStyle="solid"
                style={{ width: '100%', display: 'flex' }}
              >
                <Radio.Button value="low" style={{ flex: 1, textAlign: 'center' }}>
                  Low
                </Radio.Button>
                <Radio.Button value="medium" style={{ flex: 1, textAlign: 'center' }}>
                  Medium
                </Radio.Button>
                <Radio.Button value="high" style={{ flex: 1, textAlign: 'center' }}>
                  High
                </Radio.Button>
              </Radio.Group>
            </div>
          </div>

          <div className="controls-section">
            <div className="section-header">
              <SettingOutlined />
              <span>ADAM Options</span>
            </div>

            <div className="control-item switch-item">
              <div className="switch-row">
                <label className="switch-label">Include Metadata Headers</label>
                <Switch 
                  checked={includeMetadata} 
                  onChange={setIncludeMetadata}
                  size="small"
                />
              </div>
              <span className="switch-hint">Add dataset metadata and attributes</span>
            </div>

            <div className="control-item switch-item">
              <div className="switch-row">
                <label className="switch-label">Include Traceability</label>
                <Switch 
                  checked={includeTraceability} 
                  onChange={setIncludeTraceability}
                  size="small"
                />
              </div>
              <span className="switch-hint">Link to SDTM source variables</span>
            </div>

            <div className="control-item switch-item">
              <div className="switch-row">
                <label className="switch-label">Add Data Validation</label>
                <Switch 
                  checked={includeValidation} 
                  onChange={setIncludeValidation}
                  size="small"
                />
              </div>
              <span className="switch-hint">Include validation checks in code</span>
            </div>

            <div className="control-item switch-item">
              <div className="switch-row">
                <label className="switch-label">Sort Variables by Order</label>
                <Switch 
                  checked={sortVariables} 
                  onChange={setSortVariables}
                  size="small"
                />
              </div>
              <span className="switch-hint">Arrange by category and alphabetically</span>
            </div>
          </div>

          {isGeneratingConsolidated && (
            <div className="controls-section">
              <div className="section-header">
                <CheckCircleOutlined />
                <span>Progress</span>
              </div>
              <div className="progress-section">
                <Progress percent={consolidatedProgress} status="active" size="small" />
                <div className="progress-info">
                  {consolidatedStatus || 'Generating'} • {elapsedTime}s
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="consolidated-main-content">
          {consolidatedCode ? (
            <>
              <div className="code-viewer-header">
                <div className="viewer-title">
                  <FileTextOutlined />
                  <span>Generated Program</span>
                  <Tag color="green">{consolidatedCode.summary.lines_of_code} lines</Tag>
                  <Tag color="blue">{consolidatedCode.summary.file_size_kb.toFixed(1)} KB</Tag>
                </div>
                <Space>
                  <Button icon={<CopyOutlined />} onClick={handleCopy} size="small">
                    Copy
                  </Button>
                  <Button icon={<DownloadOutlined />} onClick={handleDownload} size="small">
                    Download
                  </Button>
                </Space>
              </div>

              <div className="code-viewer">
                <Editor
                  height="calc(100vh - 220px)"
                  language={activeLanguage === 'R' ? 'r' : 'sas'}
                  value={consolidatedCode.consolidated_code}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                  }}
                />
              </div>

              <div className="info-sections">
                <div className="info-section">
                  <div className="info-header">Program Summary</div>
                  <div className="info-content">
                    <Space wrap size="small">
                      <Tag color="blue">{consolidatedCode.summary.total_variables} variables</Tag>
                      <Tag color="purple">{consolidatedCode.summary.categories_included} categories</Tag>
                      <Tag color="geekblue">{consolidatedCode.summary.lines_of_code} lines of code</Tag>
                    </Space>
                    {summarisedOptimizations.length > 0 && (
                      <div className="optimizations-list">
                        <strong>Optimizations applied to this run:</strong>
                        <ul>
                          {summarisedOptimizations.map((opt, idx) => (
                            <li key={idx}>{opt}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                <div className="info-section">
                  <div className="info-header">Validation Snapshot</div>
                  <div className="info-content">
                    <Space direction="vertical" size="small">
                      <Space wrap size="small">
                        <Tag color={consolidatedCode.validation_results.syntax_valid ? 'green' : 'red'}>
                          {consolidatedCode.validation_results.syntax_valid ? '✓ Syntax valid' : '✗ Syntax issues'}
                        </Tag>
                        <Tag color={consolidatedCode.validation_results.cdisc_compliant ? 'green' : 'red'}>
                          {consolidatedCode.validation_results.cdisc_compliant ? '✓ CDISC compliant' : '✗ CDISC issues'}
                        </Tag>
                        <Tag color={totalWarnings > 0 ? 'gold' : 'default'}>
                          {totalWarnings} warning{totalWarnings === 1 ? '' : 's'}
                        </Tag>
                        <Tag color={totalErrors > 0 ? 'red' : 'default'}>
                          {totalErrors} error{totalErrors === 1 ? '' : 's'}
                        </Tag>
                      </Space>

                      {consolidatedCode.validation_results.warnings.length > 0 && (
                        <div className="validation-messages">
                          <strong>Key warnings to review in code:</strong>
                          <ul>
                            {consolidatedCode.validation_results.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {consolidatedCode.validation_results.errors.length > 0 && (
                        <div className="validation-messages">
                          <strong>Blocking issues:</strong>
                          <ul>
                            {consolidatedCode.validation_results.errors.map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Space>
                  </div>
                </div>

                <div className="info-section">
                  <div className="info-header">Run Context</div>
                  <div className="info-content">
                    <div className="metadata-item">
                      <span className="meta-label">Study / Dataset:</span>
                      <span className="meta-value">
                        {projectConfig.studyId || 'N/A'} • {projectConfig.adamDataset || 'ADSL'}
                      </span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">Language:</span>
                      <span className="meta-value">{activeLanguage}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">LLM provider / model:</span>
                      <span className="meta-value">
                        {consolidatedCode.metadata.llm_provider} • {consolidatedCode.metadata.model_used}
                      </span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">Execution mode:</span>
                      <span className="meta-value">{consolidatedCode.metadata.execution_mode}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">Generated at:</span>
                      <span className="meta-value">
                        {new Date(consolidatedCode.metadata.generated_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 500, marginBottom: '8px' }}>
                      {canGenerateConsolidated()
                        ? 'Ready to Generate'
                        : 'No Code Available'}
                    </p>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      {canGenerateConsolidated()
                        ? 'Click "Generate Code" to create your consolidated program from all variables with code.'
                        : 'Generate code for variables in the Pair Programming tab first.'}
                    </p>
                  </div>
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsolidatedCodeTab;
