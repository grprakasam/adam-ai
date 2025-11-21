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
  Select,
  Space,
  Switch,
  Tag,
  Tooltip,
} from 'antd';
import { DownloadOutlined, RedoOutlined, FileDoneOutlined, CopyOutlined, CheckCircleOutlined, CloseOutlined, FileTextOutlined, SettingOutlined } from '@ant-design/icons';
import { Code2 } from 'lucide-react';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
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
    consolidatedStatus,
    consolidatedDuration,
    setCommentVerbosity,
    setExecutionMode,
    setConsolidatedCode,
    setIsGeneratingConsolidated,
    setConsolidatedProgress,
    setConsolidatedDuration,
    resetConsolidated,
    canGenerateConsolidated,
  } = useProjectStore();
  const [activeLanguage, setActiveLanguage] = useState<'R' | 'SAS'>(programmingLanguage);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  
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
    return Object.values(pairProgramming.snippets)
      .filter((snippet) => snippet.accepted === 'accept' && snippet.codeSnippet)
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
          
          // Handle required field - check both 'required' and 'is_required'
          const isRequired = meta.meta.required === true || 
                            meta.meta.required === 'true' || 
                            meta.meta.is_required === true || 
                            meta.meta.is_required === 'true';
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
            message={`Ready to generate consolidated code for ${approvedVariables.length} approved variables`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          
          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Total Variables">{approvedVariables.length}</Descriptions.Item>
            <Descriptions.Item label="Categories">{variablesByCategory.size}</Descriptions.Item>
            <Descriptions.Item label="Language">{activeLanguage}</Descriptions.Item>
            <Descriptions.Item label="Comment Level">{commentVerbosity}</Descriptions.Item>
            <Descriptions.Item label="Dataset">{projectConfig.adamDataset || 'ADSL'}</Descriptions.Item>
            <Descriptions.Item label="Options" span={1}></Descriptions.Item>
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
      message.warning('Approve all variables before generating consolidated code.');
      return;
    }

    const approvedVariables = buildApprovedVariables();
    if (!approvedVariables.length) {
      message.warning('No approved variables found.');
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

  const handleCancel = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsGeneratingConsolidated(false);
      message.info('Cancelling code generation...');
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
    const blob = new Blob([consolidatedCode.consolidated_code], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const extension = activeLanguage === 'R' ? 'R' : 'sas';
    const datasetName = projectConfig.adamDataset || 'ADAM';
    link.download = `${datasetName}_consolidated.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const summarisedOptimizations = consolidatedCode?.summary.optimizations_applied || [];
  const approvedCount = buildApprovedVariables().length;
  const hasApprovedSnippets = approvedCount > 0;

  return (
    <div className="consolidated-tab">
      {/* Header with gradient - matching Pair Programming style */}
      <div className="consolidated-header">
        <div className="header-info">
          <Code2 size={20} />
          <span className="header-title">Consolidated ADAM Code</span>
          <span className="header-subtitle">
            {approvedCount} approved • {consolidatedCode ? 'Generated' : 'Ready'}
          </span>
        </div>
        <div className="header-actions">
          <Button
            type="primary"
            icon={<FileDoneOutlined />}
            onClick={handleGenerate}
            loading={isGeneratingConsolidated}
            disabled={!hasApprovedSnippets || isGeneratingConsolidated}
            size="large"
          >
            {isGeneratingConsolidated ? 'Generating...' : 'Generate Code'}
          </Button>
        </div>
      </div>

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
                  height="500px"
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
                  <div className="info-header">Summary</div>
                  <div className="info-content">
                    <Space wrap size="small">
                      <Tag color="blue">{consolidatedCode.summary.total_variables} variables</Tag>
                      <Tag color="purple">{consolidatedCode.summary.categories_included} categories</Tag>
                      {consolidatedCode.summary.confidence_score && (
                        <Tag color="gold">Confidence {consolidatedCode.summary.confidence_score}%</Tag>
                      )}
                    </Space>
                    {summarisedOptimizations.length > 0 && (
                      <div className="optimizations-list">
                        <strong>Optimizations Applied:</strong>
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
                  <div className="info-header">Validation</div>
                  <div className="info-content">
                    <Space direction="vertical" size="small">
                      <Tag color={consolidatedCode.validation_results.syntax_valid ? 'green' : 'red'}>
                        {consolidatedCode.validation_results.syntax_valid ? '✓ Syntax Valid' : '✗ Syntax Issues'}
                      </Tag>
                      <Tag color={consolidatedCode.validation_results.cdisc_compliant ? 'green' : 'red'}>
                        {consolidatedCode.validation_results.cdisc_compliant ? '✓ CDISC Compliant' : '✗ CDISC Issues'}
                      </Tag>
                      {consolidatedCode.validation_results.warnings.length > 0 && (
                        <div className="validation-messages">
                          <strong>Warnings:</strong>
                          <ul>
                            {consolidatedCode.validation_results.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {consolidatedCode.validation_results.errors.length > 0 && (
                        <div className="validation-messages">
                          <strong>Errors:</strong>
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
                  <div className="info-header">Metadata</div>
                  <div className="info-content">
                    <div className="metadata-item">
                      <span className="meta-label">Provider:</span>
                      <span className="meta-value">{consolidatedCode.metadata.llm_provider}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">Model:</span>
                      <span className="meta-value">{consolidatedCode.metadata.model_used}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">Mode:</span>
                      <span className="meta-value">{consolidatedCode.metadata.execution_mode}</span>
                    </div>
                    <div className="metadata-item">
                      <span className="meta-label">Generated:</span>
                      <span className="meta-value">{new Date(consolidatedCode.metadata.generated_at).toLocaleString()}</span>
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
                        : 'Approval Required'}
                    </p>
                    <p style={{ fontSize: '13px', color: '#64748b' }}>
                      {canGenerateConsolidated()
                        ? 'Click "Generate Code" in the side panel to create your consolidated program.'
                        : 'Approve all variables in the Pair Programming tab first.'}
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
