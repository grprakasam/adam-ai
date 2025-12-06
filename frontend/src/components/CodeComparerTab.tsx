/**
 * Code Comparer Tab Component
 * 
 * Industry-grade code comparison tool with AI-powered analysis.
 * Supports Quick, Standard, and Deep Analysis modes.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Card,
  Button,
  Select,
  Input,
  Space,
  Tag,
  Alert,
  Collapse,
  Typography,
  Row,
  Col,
  Tooltip,
  Spin,
  Switch,
  Divider,
  Progress,
  message,
  Dropdown,
  MenuProps,
} from 'antd';
import { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  PlayCircleOutlined,
  FileTextOutlined,
  DownloadOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  EyeOutlined,
  ExportOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  FileAddOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { compareCode } from '../services/api';
import { PageHeader } from './PageHeader';
import './CodeComparerTab.css';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface CodeComparisonResult {
  overall_similarity_score: number;
  classification_label: string;
  subscores: {
    code_similarity: number;
    functional_equivalence: number;
    logical_alignment: number;
    syntax_quality: number;
  };
  summary: {
    total_differences: number;
    critical_count: number;
    important_count: number;
    minor_count: number;
    executive_narrative: string;
  };
  differences: Array<{
    id: string;
    type: string;
    severity: string;
    code1_span?: { start_line: number; end_line: number };
    code2_span?: { start_line: number; end_line: number };
    title: string;
    summary: string;
    details?: string;
    recommendation?: string;
  }>;
  adam_insights?: {
    affected_variables: string[];
    cdisc_rules_referenced: string[];
    common_patterns_detected: string[];
  };
  syntax_issues: Array<{
    side: string;
    line: number;
    severity: string;
    message: string;
  }>;
  metadata: {
    comparison_mode: string;
    language_1: string;
    language_2: string;
    execution_time_ms: number;
    llm_used: boolean;
  };
}

const SAMPLE_PROGRAMS = {
  'r-nearly-identical': {
    name: 'R - Nearly Identical (95% similar)',
    code1: `# Developer Code
adsl <- sdtm$dm %>%
  mutate(
    SAFFL = if_else(!is.na(RFSTDTC), "Y", "N"),
    ITTFL = if_else(ARMCD != "SCRNFAIL", "Y", "N")
  )`,
    code2: `# QC Code
adsl <- sdtm$dm %>%
  mutate(
    SAFFL = ifelse(!is.na(RFSTDTC), "Y", "N"),  # Different function
    ITTFL = ifelse(ARMCD != "SCRNFAIL", "Y", "N")
  )`,
    language1: 'r',
    language2: 'r',
  },
  'sas-functional-diff': {
    name: 'SAS - Functional Difference (65% similar)',
    code1: `/* Developer Code */
data adsl;
  set sdtm.dm;
  if rfstdtc ne '' then saffl = 'Y';
  else saffl = 'N';
run;`,
    code2: `/* QC Code */
data adsl;
  set sdtm.dm;
  saffl = 'N';  /* Missing: Reversed logic! */
  if rfstdtc = '' then saffl = 'Y';
run;`,
    language1: 'sas',
    language2: 'sas',
  },
  'r-minor-refactor': {
    name: 'R - Minor Refactor (80% similar)',
    code1: `# Developer Code
adsl <- sdtm$dm %>%
  mutate(
    VISIT = factor(VISITNUM),
    BASE = AVAL[VISITNUM == 1],
    CHG = AVAL - BASE
  )`,
    code2: `# QC Code
adsl <- sdtm$dm %>%
  mutate(
    VISIT = as.factor(VISITNUM),  # alternate factor creation
    BASE = AVAL[VISITNUM == 1],
    CHG = AVAL - BASE
  )`,
    language1: 'r',
    language2: 'r',
  },
  'crosslang-aval-derivation': {
    name: 'Cross-language (R vs SAS) - AVAL derivation',
    code1: `# Developer (R)
adsl <- sdtm$dm %>%
  mutate(
    AVAL = as.numeric(LBBASE),
    CHG = AVAL - BASE
  )`,
    code2: `/* QC (SAS) */
data adsl;
  set sdtm.dm;
  aval = input(lbbaseline, best.);
  chg = aval - base;
run;`,
    language1: 'r',
    language2: 'sas',
  },
};

export const CodeComparerTab: React.FC = () => {
  const { projectConfig } = useProjectStore();

  // Input state
  const [code1, setCode1] = useState('');
  const [code2, setCode2] = useState('');
  const [language1, setLanguage1] = useState<'sas' | 'r' | 'auto'>('auto');
  const [language2, setLanguage2] = useState<'sas' | 'r' | 'auto'>('auto');

  // Comparison options
  const [comparisonMode, setComparisonMode] = useState<'quick' | 'standard' | 'deep'>('standard');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(true);
  const [ignoreComments, setIgnoreComments] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);

  // UI state
  const [isComparing, setIsComparing] = useState(false);
  const [showOnlyDifferences, setShowOnlyDifferences] = useState(false);
  const [activeDifferenceId, setActiveDifferenceId] = useState<string | null>(null);
  const [activePanels, setActivePanels] = useState<string[]>(['summary', 'top-differences']);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);

  // Results
  const [result, setResult] = useState<CodeComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Editor refs
  const diffEditorRef = useRef<editor.IDiffEditor | null>(null);
  const [diffNavigator, setDiffNavigator] = useState<any>(null);

  const filteredDifferences = useMemo(() => {
    if (!result) return [];
    let diffs = result.differences;
    if (severityFilter.length > 0) {
      diffs = diffs.filter((d) => severityFilter.includes(d.severity));
    }
    return diffs;
  }, [result, severityFilter]);

  const topDifferences = useMemo(() => {
    if (filteredDifferences.length > 0) {
      return filteredDifferences.slice(0, 3);
    }
    return result ? result.differences.slice(0, 3) : [];
  }, [filteredDifferences, result]);

  // Handle comparison
  const handleCompare = useCallback(async () => {
    if (!code1.trim() || !code2.trim()) {
      message.warning('Please provide both code snippets to compare');
      return;
    }

    setIsComparing(true);
    setError(null);
    setResult(null);

    try {
      const response = await compareCode({
        code_1: code1,
        code_2: code2,
        language_1: language1,
        language_2: language2,
        comparison_mode: comparisonMode,
        options: {
          ignore_whitespace: ignoreWhitespace,
          ignore_comments: ignoreComments,
          case_sensitive: caseSensitive,
        },
        context: projectConfig?.studyId ? {
          study_id: projectConfig.studyId,
          dataset: projectConfig.adamDataset,
        } : undefined,
      });

      setResult(response);
      message.success('Comparison completed successfully');

      // Auto-expand top differences
      if (response.differences.length > 0) {
        setActivePanels(['summary', 'top-differences']);
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Comparison failed';
      setError(errorMsg);
      message.error(errorMsg);
    } finally {
      setIsComparing(false);
    }
  }, [code1, code2, language1, language2, comparisonMode, ignoreWhitespace, ignoreComments, caseSensitive, projectConfig]);

  // Load sample program
  const loadSample = useCallback((sampleKey: keyof typeof SAMPLE_PROGRAMS) => {
    const sample = SAMPLE_PROGRAMS[sampleKey];
    setCode1(sample.code1);
    setCode2(sample.code2);
    setLanguage1(sample.language1 as 'sas' | 'r');
    setLanguage2(sample.language2 as 'sas' | 'r');
    message.info('Sample program loaded. Click "Compare" to analyze.');
  }, []);

  // Navigate to difference
  const navigateToDifference = useCallback((differenceId: string, difference: any) => {
    setActiveDifferenceId(differenceId);

    if (diffEditorRef.current && difference.code1_span) {
      const line = difference.code1_span.start_line;
      diffEditorRef.current.getOriginalEditor().revealLineInCenter(line);
      diffEditorRef.current.getModifiedEditor().revealLineInCenter(difference.code2_span?.start_line || line);
    }
  }, []);

  // Navigate next/previous difference
  const navigateDifference = useCallback((direction: 'next' | 'prev') => {
    const sourceDiffs = filteredDifferences.length ? filteredDifferences : (result?.differences ?? []);
    if (!result || sourceDiffs.length === 0) return;

    const currentIndex = sourceDiffs.findIndex(d => d.id === activeDifferenceId);
    let newIndex: number;

    if (direction === 'next') {
      newIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % sourceDiffs.length;
    } else {
      newIndex = currentIndex === -1
        ? sourceDiffs.length - 1
        : (currentIndex - 1 + sourceDiffs.length) % sourceDiffs.length;
    }

    const diff = sourceDiffs[newIndex];
    navigateToDifference(diff.id, diff);
  }, [result, filteredDifferences, activeDifferenceId, navigateToDifference]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'n') {
        e.preventDefault();
        navigateDifference('next');
      } else if (e.altKey && e.key === 'p') {
        e.preventDefault();
        navigateDifference('prev');
      } else if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        setShowOnlyDifferences(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [navigateDifference]);

  // DiffEditor mount handler
  const handleEditorMount = useCallback((editor: editor.IDiffEditor) => {
    diffEditorRef.current = editor;

    // Create diff navigator
    try {
      if (window.monaco && window.monaco.editor && typeof window.monaco.editor.createDiffNavigator === 'function') {
        const navigator = window.monaco.editor.createDiffNavigator(editor, {
          followsCaret: true,
          ignoreCharChanges: true,
        });
        setDiffNavigator(navigator);
      }
    } catch (error) {
      console.warn('Failed to create diff navigator:', error);
      // Navigator is optional, continue without it
    }
  }, []);

  const diffEditorOptions = useMemo(() => ({
    readOnly: true,
    renderSideBySide: !showOnlyDifferences,
    minimap: { enabled: !showOnlyDifferences && code1.length < 10000 && code2.length < 10000 },
    fontSize: 13,
    wordWrap: 'off',
    scrollBeyondLastLine: false,
    accessibilitySupport: 'on',
    ariaLabel: 'Code comparison diff editor',
  }), [showOnlyDifferences, code1.length, code2.length]);

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'important': return 'orange';
      case 'minor': return 'blue';
      default: return 'default';
    }
  };

  // Export menu
  const exportMenu: MenuProps = {
    items: [
      {
        key: 'pdf',
        label: 'Export PDF',
        icon: <DownloadOutlined />,
        onClick: () => message.info('PDF export coming soon'),
      },
      {
        key: 'html',
        label: 'Export HTML',
        icon: <DownloadOutlined />,
        onClick: () => message.info('HTML export coming soon'),
      },
      {
        key: 'json',
        label: 'Export JSON',
        icon: <DownloadOutlined />,
        onClick: () => {
          if (result) {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `code_comparison_${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            message.success('JSON exported');
          }
        },
      },
    ],
  };

  // Sample programs menu
  const sampleMenu: MenuProps = {
    items: Object.entries(SAMPLE_PROGRAMS).map(([key, sample]) => ({
      key,
      label: sample.name,
      onClick: () => loadSample(key as keyof typeof SAMPLE_PROGRAMS),
    })),
  };

  return (
    <div className="code-comparer-tab" role="region" aria-label="Code comparer workspace">
      {/* Blue Header */}
      <PageHeader
        title="Code Comparer"
        subtitle="Compare SAS/R programs for ADaM datasets"
        icon={<FileTextOutlined />}
        actions={
          <Space>
            <Select
              value={comparisonMode}
              onChange={setComparisonMode}
              style={{ width: 150 }}
              size="large"
            >
              <Option value="quick">Quick</Option>
              <Option value="standard">Standard (Default)</Option>
              <Option value="deep">Deep Analysis</Option>
            </Select>
            <Tooltip title="Settings">
              <Button icon={<SettingOutlined />} />
            </Tooltip>
          </Space>
        }
      />

      {/* Context Bar */}
      {projectConfig?.studyId && (
        <Alert
          message={
            <Space>
              <FileTextOutlined />
              <span>Study: {projectConfig.studyId}</span>
              {projectConfig.adamDataset && (
                <>
                  <span>|</span>
                  <span>Dataset: {projectConfig.adamDataset}</span>
                </>
              )}
              {result && (
                <>
                  <span>|</span>
                  <span>{result.summary.critical_count} Critical Differences</span>
                </>
              )}
            </Space>
          }
          type="info"
          showIcon={false}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Editors Section */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            size="small"
            title={
              <Space>
                <span>Code 1: Developer</span>
                <Select
                  value={language1}
                  onChange={setLanguage1}
                  size="small"
                  style={{ width: 100 }}
                >
                  <Option value="auto">Auto</Option>
                  <Option value="r">R</Option>
                  <Option value="sas">SAS</Option>
                </Select>
                <Dropdown menu={sampleMenu} trigger={['click']}>
                  <Button size="small" icon={<FileAddOutlined />}>Samples</Button>
                </Dropdown>
              </Space>
            }
            extra={
              <Space>
                <Tooltip title="Paste">
                  <Button size="small" icon={<CopyOutlined />} onClick={() => {
                    navigator.clipboard.readText().then(text => setCode1(text));
                  }} />
                </Tooltip>
              </Space>
            }
          >
            <TextArea
              value={code1}
              onChange={(e) => setCode1(e.target.value)}
              placeholder="Paste or type code 1 here..."
              rows={15}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            size="small"
            title={
              <Space>
                <span>Code 2: QC</span>
                <Select
                  value={language2}
                  onChange={setLanguage2}
                  size="small"
                  style={{ width: 100 }}
                >
                  <Option value="auto">Auto</Option>
                  <Option value="r">R</Option>
                  <Option value="sas">SAS</Option>
                </Select>
              </Space>
            }
            extra={
              <Tooltip title="Paste">
                <Button size="small" icon={<CopyOutlined />} onClick={() => {
                  navigator.clipboard.readText().then(text => setCode2(text));
                }} />
              </Tooltip>
            }
          >
            <TextArea
              value={code2}
              onChange={(e) => setCode2(e.target.value)}
              placeholder="Paste or type code 2 here..."
              rows={15}
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Action Bar */}
      <div className="code-comparer-action-bar">
        <Space align="center" wrap>
          <Switch
            checked={showOnlyDifferences}
            onChange={setShowOnlyDifferences}
            aria-label="Show only differences"
            checkedChildren="Show only differences"
            unCheckedChildren="Show all"
          />
          <Select
            mode="multiple"
            allowClear
            placeholder="Filter severity"
            aria-label="Filter differences by severity"
            value={severityFilter}
            onChange={(values) => setSeverityFilter(values as string[])}
            size="small"
            style={{ minWidth: 200 }}
          >
            <Option value="critical">Critical</Option>
            <Option value="important">Important</Option>
            <Option value="minor">Minor</Option>
            <Option value="informational">Informational</Option>
          </Select>
          <Button
            icon={<LeftOutlined />}
            onClick={() => navigateDifference('prev')}
            disabled={!result || (filteredDifferences.length || result.differences.length) === 0}
            aria-keyshortcuts="Alt+P"
          >
            Prev
          </Button>
          <Button
            icon={<RightOutlined />}
            onClick={() => navigateDifference('next')}
            disabled={!result || (filteredDifferences.length || result.differences.length) === 0}
            aria-keyshortcuts="Alt+N"
          >
            Next
          </Button>
          <Divider type="vertical" />
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleCompare}
            loading={isComparing}
            disabled={!code1.trim() || !code2.trim()}
            size="large"
          >
            Compare
          </Button>
          {result && (
            <Dropdown menu={exportMenu} trigger={['click']}>
              <Button icon={<ExportOutlined />}>Export</Button>
            </Dropdown>
          )}
        </Space>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{ fontSize: 12, color: '#595959' }}
        >
          {isComparing
            ? 'Comparing code...'
            : result
              ? `${severityFilter.length ? filteredDifferences.length : result.summary.total_differences} differences found${severityFilter.length ? ' (after filter)' : ''}`
              : 'Ready to compare'}
        </div>
      </div>

      {/* Diff Editor (shown after comparison) */}
      {result && (
        <Card
          title="Visual Diff"
          style={{ marginBottom: 16 }}
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Use Alt+N / Alt+P to navigate differences
            </Text>
          }
        >
          <div style={{ height: '400px', border: '1px solid #d9d9d9' }}>
            <DiffEditor
              original={code1}
              modified={code2}
              language={result.metadata.language_1 === 'r' ? 'r' : 'sas'}
              theme="vs"
              options={diffEditorOptions}
              onMount={handleEditorMount}
            />
          </div>
        </Card>
      )}

      {/* Results Panel */}
      {error && (
        <Alert
          message="Comparison Failed"
          description={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {result && (
        <Collapse
          activeKey={activePanels}
          onChange={setActivePanels}
          ghost
        >
          {/* Summary Panel */}
          <Panel
            key="summary"
            header={
              <Space>
                <InfoCircleOutlined />
                <span>Summary</span>
                <Tag color={result.overall_similarity_score >= 90 ? 'green' : result.overall_similarity_score >= 70 ? 'blue' : 'orange'}>
                  {result.overall_similarity_score.toFixed(1)}% Similar
                </Tag>
                <Tag color="red">{result.summary.critical_count} Critical</Tag>
                <Tag color="orange">{result.summary.important_count} Important</Tag>
                <Tag color="blue">{result.summary.minor_count} Minor</Tag>
              </Space>
            }
          >
            <div style={{ marginBottom: 16 }}>
              <Text>{result.summary.executive_narrative}</Text>
            </div>
            <Row gutter={16}>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                    {result.subscores.code_similarity.toFixed(1)}%
                  </div>
                  <div style={{ color: '#8c8c8c' }}>Code Similarity</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                    {result.subscores.functional_equivalence.toFixed(1)}%
                  </div>
                  <div style={{ color: '#8c8c8c' }}>Functional Equivalence</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#faad14' }}>
                    {result.subscores.logical_alignment.toFixed(1)}%
                  </div>
                  <div style={{ color: '#8c8c8c' }}>Logical Alignment</div>
                </div>
              </Col>
              <Col span={6}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#722ed1' }}>
                    {result.subscores.syntax_quality.toFixed(1)}%
                  </div>
                  <div style={{ color: '#8c8c8c' }}>Syntax Quality</div>
                </div>
              </Col>
            </Row>
          </Panel>

          {/* Top Differences */}
          <Panel
            key="top-differences"
            header={
              <Space>
                <WarningOutlined />
                <span>Top Differences</span>
                <Tag>
                  ({Math.min(3, severityFilter.length ? filteredDifferences.length : result.differences.length)} of {severityFilter.length ? filteredDifferences.length : result.differences.length})
                </Tag>
              </Space>
            }
          >
            {topDifferences.map((diff) => (
              <Card
                key={diff.id}
                size="small"
                style={{
                  marginBottom: 12,
                  borderLeft: `4px solid ${diff.severity === 'critical' ? '#ff4d4f' :
                    diff.severity === 'important' ? '#fa8c16' : '#1890ff'
                    }`,
                  cursor: 'pointer',
                }}
                onClick={() => navigateToDifference(diff.id, diff)}
                className={activeDifferenceId === diff.id ? 'difference-active' : ''}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Tag color={getSeverityColor(diff.severity)}>{diff.severity}</Tag>
                    <Tag>{diff.type}</Tag>
                    <strong>{diff.title}</strong>
                    {diff.code1_span && (
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        (Line {diff.code1_span.start_line})
                      </Text>
                    )}
                  </div>
                  <Text>{diff.summary}</Text>
                  {diff.details && <Text type="secondary">{diff.details}</Text>}
                  {diff.recommendation && (
                    <Tag color={diff.recommendation.includes('Fix') ? 'red' : 'default'}>
                      {diff.recommendation}
                    </Tag>
                  )}
                </Space>
              </Card>
            ))}
          </Panel>

          {/* All Differences */}
          {(filteredDifferences.length > 0 ? filteredDifferences.length > 3 : result.differences.length > 3) && (
            <Panel
              key="all-differences"
              header={
                <Space>
                  <FileTextOutlined />
                  <span>All Differences</span>
                  <Tag>({filteredDifferences.length || result.differences.length} total)</Tag>
                </Space>
              }
            >
              {(filteredDifferences.length ? filteredDifferences : result.differences).map((diff) => (
                <Card
                  key={diff.id}
                  size="small"
                  style={{
                    marginBottom: 8,
                    borderLeft: `3px solid ${diff.severity === 'critical' ? '#ff4d4f' :
                      diff.severity === 'important' ? '#fa8c16' : '#1890ff'
                      }`,
                    cursor: 'pointer',
                  }}
                  onClick={() => navigateToDifference(diff.id, diff)}
                  className={activeDifferenceId === diff.id ? 'difference-active' : ''}
                >
                  <Space>
                    <Tag color={getSeverityColor(diff.severity)} size="small">{diff.severity}</Tag>
                    <Text strong>{diff.title}</Text>
                    {diff.code1_span && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Line {diff.code1_span.start_line}
                      </Text>
                    )}
                  </Space>
                </Card>
              ))}
            </Panel>
          )}

          {result && filteredDifferences.length === 0 && severityFilter.length > 0 && (
            <Alert
              message="No differences match the selected severity filter"
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
            />
          )}

          {/* ADaM Insights (Deep mode only) */}
          {result.adam_insights && (
            <Panel
              key="adam-insights"
              header={
                <Space>
                  <CheckCircleOutlined />
                  <span>ADaM Domain Insights</span>
                </Space>
              }
            >
              {result.adam_insights.affected_variables.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Affected Variables: </Text>
                  {result.adam_insights.affected_variables.map(v => (
                    <Tag key={v} color="blue" style={{ marginRight: 4 }}>{v}</Tag>
                  ))}
                </div>
              )}
              {result.adam_insights.common_patterns_detected.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong>Common Patterns: </Text>
                  {result.adam_insights.common_patterns_detected.map(p => (
                    <Tag key={p} color="green" style={{ marginRight: 4 }}>{p}</Tag>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {/* Syntax Issues */}
          {result.syntax_issues.length > 0 && (
            <Panel
              key="syntax-issues"
              header={
                <Space>
                  <CloseCircleOutlined />
                  <span>Syntax Issues</span>
                  <Tag color="red">({result.syntax_issues.length})</Tag>
                </Space>
              }
            >
              {result.syntax_issues.map((issue, idx) => (
                <Alert
                  key={idx}
                  message={`${issue.side.toUpperCase()}: Line ${issue.line}`}
                  description={issue.message}
                  type={issue.severity === 'error' ? 'error' : 'warning'}
                  showIcon
                  style={{ marginBottom: 8 }}
                />
              ))}
            </Panel>
          )}
        </Collapse>
      )}

      {/* Empty State */}
      {!result && !isComparing && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
            <Title level={4}>Get Started</Title>
            <Text type="secondary">
              Paste or type your code in both editors, then click "Compare" to analyze differences.
            </Text>
            <div style={{ marginTop: 24 }}>
              <Dropdown menu={sampleMenu} trigger={['click']}>
                <Button type="primary" icon={<FileAddOutlined />}>
                  Try an Example
                </Button>
              </Dropdown>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

// Extend window for Monaco types
declare global {
  interface Window {
    monaco?: typeof import('monaco-editor');
  }
}










