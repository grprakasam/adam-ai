import { useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  message,
  Modal,
  Progress,
  Radio,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { DownloadOutlined, RedoOutlined, FileDoneOutlined, CopyOutlined, CheckCircleOutlined, CloseOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import type { ConsolidatedCodeRequest, ConsolidatedCodeData, ConsolidatedVariable } from '../types';
import './ConsolidatedCodeTab.css';

const { Title, Paragraph, Text } = Typography;

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
        return {
          name: snippet.variable,
          category: meta?.category || 'Other Category',
          code_snippet: snippet.codeSnippet,
          user_notes: snippet.userNotes,
          derivation_logic: snippet.rationale,
          metadata: meta?.meta,
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
            <Descriptions.Item label="Execution Mode">{executionMode}</Descriptions.Item>
            <Descriptions.Item label="Dataset">{projectConfig.adamDataset || 'ADSL'}</Descriptions.Item>
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
        optimization_level: 'standard',
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

  return (
    <div className="consolidated-tab">
      <div className="consolidated-header">
        <div>
          <Title level={4}>Consolidated ADAM Code</Title>
          <Paragraph>
            Generate a clean, performance-optimised program using the approved variables from pair programming.
          </Paragraph>
        </div>

        <Space>
          {consolidatedCode && (
            <Tooltip title="Clear the last generated code">
              <Button
                icon={<RedoOutlined />}
                disabled={isGeneratingConsolidated}
                onClick={resetConsolidated}
              >
                Reset Output
              </Button>
            </Tooltip>
          )}
          <Button
            type="primary"
            icon={<FileDoneOutlined />}
            onClick={handleGenerate}
            loading={isGeneratingConsolidated}
            disabled={!canGenerateConsolidated() || isGeneratingConsolidated}
          >
            {isGeneratingConsolidated ? 'Generating…' : 'Generate Consolidated Code'}
          </Button>
        </Space>
      </div>

      <Card className="consolidated-controls-card">
        <div className="consolidated-controls">
          <div>
            <Text className="label">Target Language</Text>
            <Select<'R' | 'SAS'>
              value={activeLanguage}
              onChange={(val) => setActiveLanguage(val)}
              options={[
                { value: 'R', label: 'R' },
                { value: 'SAS', label: 'SAS' },
              ]}
              style={{ width: 140 }}
            />
          </div>
          <div>
            <Text className="label">Comment Verbosity</Text>
            <Select
              value={commentVerbosity}
              onChange={setCommentVerbosity}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
              style={{ width: 160 }}
            />
          </div>
          <div>
            <Text className="label">Execution Mode</Text>
            <Radio.Group
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
            >
              <Radio.Button value="api">Secure API</Radio.Button>
              <Radio.Button value="local">Local Ollama</Radio.Button>
            </Radio.Group>
            <Paragraph style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>
              {executionMode === 'local'
                ? 'All processing happens locally; no API calls will be made.'
                : 'Routes through configured LLM provider with secure APIs.'}
            </Paragraph>
          </div>
        </div>
      </Card>

      <Card className="progress-card">
        <div className="progress-grid">
          <Statistic title="Approved Variables" value={buildApprovedVariables().length} />
          <Statistic title="Progress" value={`${consolidatedProgress}%`} />
          <Statistic
            title="Last Duration"
            value={
              consolidatedDuration
                ? `${consolidatedDuration.toFixed(1)}s`
                : '—'
            }
          />
          <Statistic
            title="Status"
            value={
              isGeneratingConsolidated
                ? `${consolidatedStatus || 'Generating'}... (${elapsedTime}s elapsed)`
                : (consolidatedStatus || 'Idle')
            }
          />
        </div>
        {isGeneratingConsolidated && (
          <>
            <Progress percent={consolidatedProgress} status="active" />
            <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 12 }}>
              <div style={{ color: '#1890ff', fontSize: '13px' }}>
                {consolidatedProgress}% complete • {elapsedTime}s elapsed
              </div>
              <Button
                danger
                icon={<CloseOutlined />}
                size="small"
                onClick={handleCancel}
                style={{ marginLeft: 'auto' }}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </Card>

      {consolidatedCode ? (
        <>
          <Card
            className="code-viewer-card"
            title="Optimized Consolidated Program"
            extra={
              <Space>
                <Button icon={<CopyOutlined />} onClick={handleCopy}>
                  Copy
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleDownload}>
                  Download
                </Button>
              </Space>
            }
          >
            <Editor
              height="420px"
              language={activeLanguage === 'R' ? 'r' : 'sas'}
              value={consolidatedCode.consolidated_code}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          </Card>

          <div className="summary-grid">
            <Card title="Summary">
              <Space wrap>
                <Tag color="blue">{consolidatedCode.summary.total_variables} variables</Tag>
                <Tag color="purple">{consolidatedCode.summary.categories_included} categories</Tag>
                <Tag color="green">{consolidatedCode.summary.lines_of_code} LOC</Tag>
                <Tag color="cyan">{consolidatedCode.summary.file_size_kb.toFixed(1)} KB</Tag>
                {consolidatedCode.summary.confidence_score && (
                  <Tag color="gold">Confidence {consolidatedCode.summary.confidence_score}%</Tag>
                )}
              </Space>
              <Paragraph style={{ marginTop: 12 }}>
                Generation time: {consolidatedCode.summary.generation_time_seconds.toFixed(1)}s
              </Paragraph>
              {summarisedOptimizations.length > 0 && (
                <>
                  <Text strong>Optimizations:</Text>
                  <ul>
                    {summarisedOptimizations.map((opt) => (
                      <li key={opt}>{opt}</li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="Validation Results">
              <Space direction="vertical">
                <Tag color={consolidatedCode.validation_results.syntax_valid ? 'green' : 'red'}>
                  {consolidatedCode.validation_results.syntax_valid ? 'Syntax Valid' : 'Syntax Issues'}
                </Tag>
                <Tag color={consolidatedCode.validation_results.cdisc_compliant ? 'green' : 'red'}>
                  {consolidatedCode.validation_results.cdisc_compliant ? 'CDISC Compliant' : 'CDISC Issues'}
                </Tag>
                {consolidatedCode.validation_results.warnings.length > 0 && (
                  <div>
                    <Text strong>Warnings:</Text>
                    <ul>
                      {consolidatedCode.validation_results.warnings.map((warning, idx) => (
                        <li key={`warn-${idx}`}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {consolidatedCode.validation_results.errors.length > 0 && (
                  <div>
                    <Text strong>Errors:</Text>
                    <ul>
                      {consolidatedCode.validation_results.errors.map((err, idx) => (
                        <li key={`err-${idx}`}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Space>
            </Card>

            <Card title="Generation Metadata">
              <Paragraph>
                Provider: <strong>{consolidatedCode.metadata.llm_provider}</strong>
              </Paragraph>
              <Paragraph>
                Model: <strong>{consolidatedCode.metadata.model_used}</strong>
              </Paragraph>
              <Paragraph>
                Execution Mode: <strong>{consolidatedCode.metadata.execution_mode}</strong>
              </Paragraph>
              <Paragraph>
                Generated At: {new Date(consolidatedCode.metadata.generated_at).toLocaleString()}
              </Paragraph>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <Empty
            description={
              canGenerateConsolidated()
                ? 'Click "Generate Consolidated Code" to assemble the final program.'
                : 'Approve all variables in the pair programming tab to enable consolidated generation.'
            }
          />
        </Card>
      )}
    </div>
  );
};

export default ConsolidatedCodeTab;
