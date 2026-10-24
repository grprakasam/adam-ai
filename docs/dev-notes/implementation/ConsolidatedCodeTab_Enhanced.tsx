/**
 * Enhanced ConsolidatedCodeTab Component
 *
 * This is the improved version of ConsolidatedCodeTab with:
 * - Pre-generation confirmation modal
 * - Real-time progress tracking with elapsed time
 * - Professional UI/UX with better visual feedback
 * - Enhanced error handling and validation
 * - Category-wise variable organization
 *
 * To use: Replace the existing ConsolidatedCodeTab.tsx with this file
 */

import { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Card,
  Empty,
  message,
  Progress,
  Radio,
  Select,
  Space,
  Statistic,
  Tag,
  Tooltip,
  Typography,
  Modal,
  Alert,
  Divider,
} from 'antd';
import {
  DownloadOutlined,
  RedoOutlined,
  FileDoneOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { Loader2, AlertCircle, CheckCircle, Info, Sparkles } from 'lucide-react';
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
  const [showPreGenerationModal, setShowPreGenerationModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Real-time elapsed time counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isGeneratingConsolidated && startTime) {
      interval = setInterval(() => {
        setElapsedTime((Date.now() - startTime) / 1000);
      }, 100);
    } else {
      setElapsedTime(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGeneratingConsolidated, startTime]);

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

  const approvedVariables = buildApprovedVariables();
  const totalVariables = Object.keys(pairProgramming.snippets).length;
  const approvedCount = approvedVariables.length;
  const approvalPercentage = totalVariables > 0 ? Math.round((approvedCount / totalVariables) * 100) : 0;

  // Group variables by category
  const variablesByCategory = useMemo(() => {
    const groups = new Map<string, ConsolidatedVariable[]>();
    approvedVariables.forEach((variable) => {
      const category = variable.category || 'Uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(variable);
    });
    return groups;
  }, [approvedVariables]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins}m ${secs.toString().padStart(2, '0')}s`;
    }
    return `${secs.toFixed(1)}s`;
  };

  const showPreGenerationSummary = () => {
    setShowPreGenerationModal(true);
  };

  const handleGenerate = async () => {
    if (!canGenerateConsolidated()) {
      message.warning('All variables must be approved before generating consolidated code.');
      return;
    }

    if (!approvedVariables.length) {
      message.warning('No approved variables found.');
      return;
    }

    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      message.warning('Please complete project configuration and dataset selection.');
      return;
    }

    setShowPreGenerationModal(false);

    const request: ConsolidatedCodeRequest = {
      study_id: projectConfig.studyId,
      dataset: (projectConfig.adamDataset.toUpperCase() as ConsolidatedCodeRequest['dataset']) || 'ADSL',
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
    setStartTime(start);
    setIsGeneratingConsolidated(true);
    setConsolidatedProgress(5, 'Initializing code generation...');
    setConsolidatedDuration(null);

    const progressKey = 'consolidated-generation';

    // Simulated progress updates for better UX
    const progressSteps = [
      { progress: 10, status: 'Collecting approved variable snippets...', delay: 500 },
      { progress: 25, status: 'Organizing code by category...', delay: 800 },
      { progress: 40, status: 'Applying optimization rules...', delay: 1000 },
      { progress: 60, status: 'Removing redundant code...', delay: 1200 },
      { progress: 75, status: 'Implementing error handling...', delay: 1000 },
      { progress: 85, status: 'Generating documentation...', delay: 800 },
      { progress: 95, status: 'Validating CDISC compliance...', delay: 600 },
    ];

    let progressIndex = 0;
    const progressInterval = setInterval(() => {
      if (progressIndex < progressSteps.length) {
        const step = progressSteps[progressIndex];
        setConsolidatedProgress(step.progress, step.status);

        const elapsed = (Date.now() - start) / 1000;
        const currentPercent = step.progress;

        message.open({
          key: progressKey,
          type: 'loading',
          duration: 0,
          content: (
            <div style={{ width: '360px' }}>
              <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>
                <RocketOutlined style={{ marginRight: 8, color: '#667eea' }} />
                Generating Consolidated Code
              </div>

              <Progress
                percent={currentPercent}
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

              <div style={{ fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                {step.status}
              </div>

              <div style={{
                fontSize: '11px',
                color: '#999',
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>⏱️ {formatDuration(elapsed)}</span>
                <span style={{ color: '#667eea', fontWeight: 500 }}>{currentPercent}%</span>
              </div>
            </div>
          ),
        });

        progressIndex++;
      }
    }, progressSteps[0]?.delay || 1000);

    try {
      const response = await adamApi.generateConsolidatedCode(request);

      clearInterval(progressInterval);

      if (response.status !== 'success' || !response.data) {
        throw new Error(response.message || 'Failed to generate consolidated code.');
      }

      setConsolidatedCode(response.data as ConsolidatedCodeData);
      setConsolidatedProgress(100, 'Generation complete');
      const duration = (Date.now() - start) / 1000;
      setConsolidatedDuration(duration);

      message.success({
        key: progressKey,
        content: (
          <div>
            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            <strong>Consolidated code generated successfully!</strong>
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              {response.data.summary.total_variables} variables • {response.data.summary.lines_of_code} lines • {formatDuration(duration)}
            </div>
          </div>
        ),
        duration: 5,
      });
    } catch (error: any) {
      clearInterval(progressInterval);

      const detail = error?.response?.data?.detail || error.message || 'Failed to generate consolidated code.';

      message.error({
        key: progressKey,
        content: (
          <div>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
            <strong>Generation failed</strong>
            <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
              {detail}
            </div>
          </div>
        ),
        duration: 7,
      });

      setConsolidatedProgress(0, 'Generation failed');
    } finally {
      clearInterval(progressInterval);
      setIsGeneratingConsolidated(false);
      setStartTime(null);
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
    const timestamp = new Date().toISOString().split('T')[0];
    link.download = `${datasetName}_consolidated_${timestamp}.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    message.success(`Downloaded as ${datasetName}_consolidated_${timestamp}.${extension}`);
  };

  const summarisedOptimizations = consolidatedCode?.summary.optimizations_applied || [];

  return (
    <div className="consolidated-tab">
      {/* Header Section */}
      <div className="consolidated-header">
        <div className="header-content">
          <div className="header-icon">
            <Sparkles size={24} style={{ color: '#ffffff' }} />
          </div>
          <div>
            <Title level={3} style={{ marginBottom: 8 }}>
              Consolidated ADAM Code Generator
            </Title>
            <Paragraph style={{ marginBottom: 0, fontSize: '15px', color: '#6b7280' }}>
              Generate production-ready, optimized ADAM code from your approved variables with industry-standard best practices.
            </Paragraph>
          </div>
        </div>

        <Space size="middle">
          {consolidatedCode && (
            <Tooltip title="Clear the generated code and start fresh">
              <Button
                icon={<RedoOutlined />}
                disabled={isGeneratingConsolidated}
                onClick={resetConsolidated}
                size="large"
              >
                Reset
              </Button>
            </Tooltip>
          )}
          <Tooltip
            title={
              !canGenerateConsolidated()
                ? 'All variables must be approved before generation'
                : 'Generate consolidated code with applied optimizations'
            }
          >
            <Button
              type="primary"
              icon={isGeneratingConsolidated ? <Loader2 size={16} className="spinning" /> : <FileDoneOutlined />}
              onClick={showPreGenerationSummary}
              loading={isGeneratingConsolidated}
              disabled={!canGenerateConsolidated() || isGeneratingConsolidated}
              size="large"
              style={{
                background: canGenerateConsolidated() && !isGeneratingConsolidated
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : undefined,
                border: 'none',
                fontWeight: 600,
                height: '44px',
                padding: '0 28px',
              }}
            >
              {isGeneratingConsolidated ? 'Generating…' : 'Generate Consolidated Code'}
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Readiness Status Banner */}
      {!canGenerateConsolidated() && (
        <Alert
          message="Approval Required"
          description={
            <div>
              <strong>{approvedCount} of {totalVariables} variables approved ({approvalPercentage}%)</strong>
              <br />
              All variables must be approved in the pair programming panel before generating consolidated code.
            </div>
          }
          type="warning"
          icon={<ExclamationCircleOutlined />}
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {canGenerateConsolidated() && !consolidatedCode && (
        <Alert
          message="Ready to Generate"
          description={
            <div>
              <strong>All {approvedCount} variables approved!</strong>
              <br />
              Click "Generate Consolidated Code" to create your production-ready ADAM program.
            </div>
          }
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginBottom: 20 }}
        />
      )}

      {/* Configuration Controls */}
      <Card className="consolidated-controls-card" title="Generation Configuration">
        <div className="consolidated-controls">
          <div className="control-group">
            <Text strong className="label">Target Language</Text>
            <Select<'R' | 'SAS'>
              value={activeLanguage}
              onChange={(val) => setActiveLanguage(val)}
              options={[
                { value: 'R', label: '📊 R Programming' },
                { value: 'SAS', label: '📈 SAS Programming' },
              ]}
              style={{ width: 180 }}
              size="large"
              disabled={isGeneratingConsolidated}
            />
          </div>

          <div className="control-group">
            <Text strong className="label">Comment Verbosity</Text>
            <Select
              value={commentVerbosity}
              onChange={setCommentVerbosity}
              options={[
                { value: 'low', label: 'Low - Minimal comments' },
                { value: 'medium', label: 'Medium - Balanced documentation' },
                { value: 'high', label: 'High - Comprehensive comments' },
              ]}
              style={{ width: 260 }}
              size="large"
              disabled={isGeneratingConsolidated}
            />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {commentVerbosity === 'low' && 'Minimal inline comments for clean code'}
              {commentVerbosity === 'medium' && 'Balanced documentation with key insights'}
              {commentVerbosity === 'high' && 'Comprehensive documentation for maintainability'}
            </Text>
          </div>

          <div className="control-group">
            <Text strong className="label">Execution Mode</Text>
            <Radio.Group
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
              size="large"
              disabled={isGeneratingConsolidated}
            >
              <Radio.Button value="api">
                <ThunderboltOutlined /> Secure API
              </Radio.Button>
              <Radio.Button value="local">
                <CodeOutlined /> Local Ollama
              </Radio.Button>
            </Radio.Group>
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              {executionMode === 'local'
                ? '🔒 All processing happens locally; no external API calls'
                : '☁️ Routes through configured LLM provider with secure APIs'}
            </Text>
          </div>
        </div>
      </Card>

      {/* Progress Card */}
      {(isGeneratingConsolidated || consolidatedCode) && (
        <Card className="progress-card">
          <div className="progress-grid">
            <Statistic
              title="Approved Variables"
              value={approvedCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            />
            <Statistic
              title="Generation Progress"
              value={`${consolidatedProgress}%`}
              prefix={isGeneratingConsolidated ? <Loader2 size={16} className="spinning" /> : null}
            />
            <Statistic
              title="Duration"
              value={
                isGeneratingConsolidated
                  ? formatDuration(elapsedTime)
                  : consolidatedDuration
                  ? formatDuration(consolidatedDuration)
                  : '—'
              }
              prefix={<ClockCircleOutlined />}
            />
            <Statistic
              title="Status"
              value={consolidatedStatus || (consolidatedCode ? 'Complete' : 'Idle')}
              valueStyle={{
                color: consolidatedCode ? '#52c41a' : isGeneratingConsolidated ? '#1890ff' : '#8c8c8c',
                fontSize: 16,
              }}
            />
          </div>
          {isGeneratingConsolidated && (
            <div style={{ marginTop: 16 }}>
              <Progress
                percent={consolidatedProgress}
                status="active"
                strokeColor={{
                  '0%': '#667eea',
                  '100%': '#764ba2',
                }}
                strokeWidth={12}
              />
            </div>
          )}
        </Card>
      )}

      {/* Generated Code Display */}
      {consolidatedCode ? (
        <>
          <Card
            className="code-viewer-card"
            title={
              <Space>
                <CheckCircle size={20} style={{ color: '#52c41a' }} />
                <span>Production-Ready Consolidated Program</span>
              </Space>
            }
            extra={
              <Space>
                <Button icon={<CopyOutlined />} onClick={handleCopy} size="large">
                  Copy Code
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  size="large"
                  style={{
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    border: 'none',
                  }}
                >
                  Download Program
                </Button>
              </Space>
            }
          >
            <Editor
              height="500px"
              language={activeLanguage === 'R' ? 'r' : 'sas'}
              value={consolidatedCode.consolidated_code}
              options={{
                readOnly: true,
                minimap: { enabled: true },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                theme: 'vs-light',
              }}
            />
          </Card>

          {/* Summary Cards Grid */}
          <div className="summary-grid">
            <Card title="📊 Code Summary" className="summary-card">
              <Space wrap>
                <Tag color="blue" style={{ fontSize: 13, padding: '4px 12px' }}>
                  {consolidatedCode.summary.total_variables} variables
                </Tag>
                <Tag color="purple" style={{ fontSize: 13, padding: '4px 12px' }}>
                  {consolidatedCode.summary.categories_included} categories
                </Tag>
                <Tag color="green" style={{ fontSize: 13, padding: '4px 12px' }}>
                  {consolidatedCode.summary.lines_of_code} LOC
                </Tag>
                <Tag color="cyan" style={{ fontSize: 13, padding: '4px 12px' }}>
                  {consolidatedCode.summary.file_size_kb.toFixed(1)} KB
                </Tag>
                {consolidatedCode.summary.confidence_score && (
                  <Tag color="gold" style={{ fontSize: 13, padding: '4px 12px' }}>
                    {consolidatedCode.summary.confidence_score}% confidence
                  </Tag>
                )}
              </Space>

              <Divider />

              <Paragraph>
                <ClockCircleOutlined /> Generation time: <strong>{consolidatedCode.summary.generation_time_seconds.toFixed(1)}s</strong>
              </Paragraph>

              {summarisedOptimizations.length > 0 && (
                <>
                  <Text strong style={{ fontSize: 14 }}>✨ Applied Optimizations:</Text>
                  <ul style={{ marginTop: 8 }}>
                    {summarisedOptimizations.map((opt, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <CheckCircle size={14} style={{ color: '#52c41a', marginRight: 6 }} />
                        {opt}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="✅ Validation Results" className="summary-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Tag
                  color={consolidatedCode.validation_results.syntax_valid ? 'green' : 'red'}
                  style={{ fontSize: 13, padding: '6px 14px', width: '100%', textAlign: 'center' }}
                >
                  {consolidatedCode.validation_results.syntax_valid ? (
                    <><CheckCircleOutlined /> Syntax Valid</>
                  ) : (
                    <><ExclamationCircleOutlined /> Syntax Issues Detected</>
                  )}
                </Tag>

                <Tag
                  color={consolidatedCode.validation_results.cdisc_compliant ? 'green' : 'red'}
                  style={{ fontSize: 13, padding: '6px 14px', width: '100%', textAlign: 'center' }}
                >
                  {consolidatedCode.validation_results.cdisc_compliant ? (
                    <><CheckCircleOutlined /> CDISC Compliant</>
                  ) : (
                    <><ExclamationCircleOutlined /> CDISC Compliance Issues</>
                  )}
                </Tag>

                {consolidatedCode.validation_results.warnings.length > 0 && (
                  <>
                    <Divider />
                    <Text strong>⚠️ Warnings:</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      {consolidatedCode.validation_results.warnings.map((warning, idx) => (
                        <li key={`warn-${idx}`} style={{ marginBottom: 4 }}>
                          <Text type="warning">{warning}</Text>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {consolidatedCode.validation_results.errors.length > 0 && (
                  <>
                    <Divider />
                    <Text strong style={{ color: '#ff4d4f' }}>❌ Errors:</Text>
                    <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                      {consolidatedCode.validation_results.errors.map((err, idx) => (
                        <li key={`err-${idx}`} style={{ marginBottom: 4 }}>
                          <Text type="danger">{err}</Text>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {consolidatedCode.validation_results.warnings.length === 0 &&
                 consolidatedCode.validation_results.errors.length === 0 && (
                  <Alert
                    message="No issues detected"
                    type="success"
                    showIcon
                    icon={<CheckCircle size={16} />}
                    style={{ marginTop: 12 }}
                  />
                )}
              </Space>
            </Card>

            <Card title="🔧 Generation Metadata" className="summary-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">LLM Provider:</Text>
                  <br />
                  <Text strong style={{ fontSize: 14 }}>{consolidatedCode.metadata.llm_provider.toUpperCase()}</Text>
                </div>

                <div>
                  <Text type="secondary">Model Used:</Text>
                  <br />
                  <Text strong style={{ fontSize: 14 }}>{consolidatedCode.metadata.model_used}</Text>
                </div>

                <div>
                  <Text type="secondary">Execution Mode:</Text>
                  <br />
                  <Tag color={consolidatedCode.metadata.execution_mode === 'api' ? 'blue' : 'green'}>
                    {consolidatedCode.metadata.execution_mode === 'api' ? '☁️ Secure API' : '🔒 Local'}
                  </Tag>
                </div>

                <div>
                  <Text type="secondary">Generated:</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>
                    {new Date(consolidatedCode.metadata.generated_at).toLocaleString()}
                  </Text>
                </div>
              </Space>
            </Card>
          </div>
        </>
      ) : (
        <Card>
          <Empty
            image={<Info size={64} style={{ color: '#d9d9d9' }} />}
            description={
              <div style={{ maxWidth: 480, margin: '0 auto' }}>
                <Title level={4} style={{ color: '#595959' }}>
                  {canGenerateConsolidated()
                    ? 'Ready to Generate Consolidated Code'
                    : 'Approve Variables to Continue'}
                </Title>
                <Paragraph style={{ color: '#8c8c8c' }}>
                  {canGenerateConsolidated()
                    ? 'Click "Generate Consolidated Code" above to create a production-ready, optimized ADAM program from your approved variables.'
                    : 'Approve all variables in the pair programming panel to enable consolidated code generation. All variables must be marked as "Accept" to proceed.'}
                </Paragraph>
              </div>
            }
          />
        </Card>
      )}

      {/* Pre-Generation Confirmation Modal */}
      <Modal
        title={
          <Space>
            <RocketOutlined style={{ color: '#667eea', fontSize: 20 }} />
            <span>Confirm Code Generation</span>
          </Space>
        }
        open={showPreGenerationModal}
        onOk={handleGenerate}
        onCancel={() => setShowPreGenerationModal(false)}
        okText="Generate Code"
        cancelText="Cancel"
        okButtonProps={{
          size: 'large',
          icon: <FileDoneOutlined />,
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
          },
        }}
        cancelButtonProps={{ size: 'large' }}
        width={700}
      >
        <div style={{ padding: '12px 0' }}>
          <Alert
            message="Generation Summary"
            description={
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Variables to Include:</strong> {approvedCount} approved variables
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Categories:</strong> {variablesByCategory.size}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Target Language:</strong> {activeLanguage}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>Comment Level:</strong> {commentVerbosity.charAt(0).toUpperCase() + commentVerbosity.slice(1)}
                </div>
                <div>
                  <strong>Execution Mode:</strong> {executionMode === 'api' ? 'Secure API' : 'Local Ollama'}
                </div>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Title level={5}>Variables by Category:</Title>
          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6, padding: 12 }}>
            {Array.from(variablesByCategory.entries()).map(([category, vars]) => (
              <div key={category} style={{ marginBottom: 16 }}>
                <Tag color="blue" style={{ marginBottom: 8 }}>
                  {category} ({vars.length})
                </Tag>
                <div style={{ paddingLeft: 12, fontSize: 13 }}>
                  {vars.map((v) => (
                    <div key={v.name} style={{ marginBottom: 4, color: '#595959' }}>
                      • {v.name}
                      {v.metadata?.label && (
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                          - {v.metadata.label}
                        </Text>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Paragraph style={{ marginTop: 16, marginBottom: 0, color: '#666' }}>
            The system will consolidate all approved code snippets, apply optimizations, remove redundancies,
            and generate a clean, production-ready ADAM program.
          </Paragraph>
        </div>
      </Modal>
    </div>
  );
};

export default ConsolidatedCodeTab;
