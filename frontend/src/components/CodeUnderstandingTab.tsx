import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  List,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import {
  AimOutlined,
  BulbOutlined,
  BranchesOutlined,
  FileTextOutlined,
  ReadOutlined,
  PlayCircleOutlined,
  RadarChartOutlined,
  ReloadOutlined,
  SafetyOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import ReactFlow, { Background, Controls, MarkerType, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  analyzeCodeUnderstanding,
  chatCodeUnderstanding,
  CodeUnderstandingEdge,
  CodeUnderstandingLanguage,
  CodeUnderstandingNode,
  CodeUnderstandingResponse,
  CodeUnderstandingChatResponse,
} from '../services/api';
import { PageHeader } from './PageHeader';
import './CodeUnderstandingTab.css';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const SAMPLE_PROGRAMS: Record<
  'sas_adsl' | 'r_bds',
  { name: string; code: string; language: CodeUnderstandingLanguage }
> = {
  sas_adsl: {
    name: 'SAS - ADSL core derivations',
    language: 'SAS',
    code: `/* Derive ADSL flags */
data adsl;
  set sdtm.dm;
  if not missing(rfstdtc) then saffl = 'Y';
  else saffl = 'N';
  if armcd ne 'SCRNFAIL' then ittfl = 'Y';
  else ittfl = 'N';
  trtstdt = input(rfstdtc, yymmdd10.);
  trtspdt = trtstdt + 6;
run;`,
  },
  r_bds: {
    name: 'R - BDS change-from-baseline',
    language: 'R',
    code: `library(dplyr)
adqs <- qs %>%
  filter(ANL01FL == "Y") %>%
  group_by(USUBJID) %>%
  arrange(ADY) %>%
  mutate(
    BASE = first(AVAL),
    CHG = AVAL - BASE,
    PCHG = if_else(!is.na(BASE) & BASE != 0, (AVAL - BASE) / BASE * 100, NA_real_)
  )`,
  },
};

const buildNodeStyle = (type?: string) => {
  const palette: Record<string, string> = {
    input: '#e0f2fe',
    transform: '#fef3c7',
    output: '#ecfdf3',
    other: '#f4f4f5',
  };
  const border: Record<string, string> = {
    input: '#3b82f6',
    transform: '#f59e0b',
    output: '#22c55e',
    other: '#6b7280',
  };
  const colorKey = type || 'transform';
  return {
    padding: 10,
    border: `2px solid ${border[colorKey] || '#94a3b8'}`,
    background: palette[colorKey] || '#f4f4f5',
    borderRadius: 8,
    fontWeight: 600,
  };
};

export const CodeUnderstandingTab: React.FC = () => {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<CodeUnderstandingLanguage>('auto');
  const [audience, setAudience] = useState<'non-technical' | 'developer' | 'reviewer'>('non-technical');
  const [activeTab, setActiveTab] = useState('two-line');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CodeUnderstandingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; content: string; bullets?: string[]; assumptions?: string[] }[]
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) {
      message.warning('Paste or upload SAS/R code to analyze.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await analyzeCodeUnderstanding({
        code,
        language,
        audience,
      });
      setResult(response);
      setActiveTab('ten-line');
      message.success('AI analysis ready');
    } catch (err: any) {
      const msg = err?.message || 'Analysis failed. Please try again.';
      if (msg.includes('Not Found')) {
        setError('Service not found. Please restart the backend to load the new Code Understanding API.');
        message.error('Backend may need a restart to load /api/v1/code-understanding.');
        setChatMessages([]);
        setChatInput('');
        return;
      }
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [audience, code, language]);

  const handleSendChat = useCallback(async () => {
    if (!code.trim()) {
      message.warning('Paste or upload SAS/R code first.');
      return;
    }
    if (!chatInput.trim()) return;

    const question = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: question }]);
    setChatLoading(true);
    setActiveTab('chat');
    setError(null);

    try {
      const response: CodeUnderstandingChatResponse = await chatCodeUnderstanding({
        code,
        language,
        audience,
        question,
      });
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.answer,
          bullets: response.bullets,
          assumptions: response.assumptions,
        },
      ]);
    } catch (err: any) {
      const msg = err?.message || 'Chat failed. Please try again.';
      setError(msg);
      message.error(msg);
    } finally {
      setChatLoading(false);
    }
  }, [audience, code, language, chatInput]);

  const handleReset = useCallback(() => {
    setCode('');
    setResult(null);
    setError(null);
    setFileName(null);
    setActiveTab('two-line');
    setChatMessages([]);
    setChatInput('');
  }, []);

  const loadSample = useCallback((key: keyof typeof SAMPLE_PROGRAMS) => {
    const sample = SAMPLE_PROGRAMS[key];
    setCode(sample.code);
    setLanguage(sample.language);
    setFileName(sample.name);
    message.info(`Loaded sample: ${sample.name}`);
  }, []);

  const beforeUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result?.toString() || '';
      setCode(text);
      setFileName(file.name);
      message.success(`Loaded ${file.name}`);
    };
    reader.onerror = () => {
      message.error('Unable to read file');
    };
    reader.readAsText(file);
    return false; // Prevent auto-upload
  }, []);

  const flowNodes = useMemo(() => {
    if (!result?.visual_flow?.nodes) return [];
    return result.visual_flow.nodes.map((node: CodeUnderstandingNode, idx: number) => ({
      id: node.id,
      data: {
        label: node.label,
        description: node.description,
        type: node.type,
      },
      position: {
        x: (idx % 3) * 240,
        y: Math.floor(idx / 3) * 140,
      },
      style: buildNodeStyle(node.type),
    }));
  }, [result]);

  const flowEdges = useMemo(() => {
    if (!result?.visual_flow?.edges) return [];
    return result.visual_flow.edges.map((edge: CodeUnderstandingEdge, idx: number) => ({
      id: edge.source && edge.target ? `${edge.source}-${edge.target}-${idx}` : `edge-${idx}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' },
      style: { stroke: '#475569', strokeWidth: 2 },
    }));
  }, [result]);

  const renderSummaryList = (items?: string[]) => {
    if (!items || items.length === 0) {
      return <Empty description="No summary available yet." image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }
    return (
      <List
        size="small"
        bordered
        dataSource={items}
        renderItem={(item, idx) => (
          <List.Item>
            <Space>
              <Tag color="blue">{idx + 1}</Tag>
              <span>{item}</span>
            </Space>
          </List.Item>
        )}
      />
    );
  };

  const tabs = [
    {
      key: 'two-line',
      label: '2-Line Summary',
      children: (
        <Card size="small" bordered={false}>
          {result ? (
            <Paragraph className="two-line-summary">{result.two_line_summary}</Paragraph>
          ) : (
            <Empty description="Run analysis to see the 2-line summary." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      ),
    },
    {
      key: 'ten-line',
      label: '10-Line Summary',
      children: (
        <Card size="small" bordered={false}>
          {renderSummaryList(result?.ten_line_summary)}
        </Card>
      ),
    },
    {
      key: 'detailed',
      label: 'Detailed Summary',
      children: (
        <Card size="small" bordered={false}>
          {result ? (
            <>
              <Paragraph>{result.detailed_summary}</Paragraph>
              <Divider />
              <Row gutter={[12, 12]}>
                <Col span={12}>
                  <Title level={5}>Key Insights</Title>
                  {renderSummaryList(result.key_insights)}
                </Col>
                <Col span={12}>
                  <Title level={5}>Risks & Edge Cases</Title>
                  {renderSummaryList(result.risks)}
                </Col>
              </Row>
              {result.assumptions && result.assumptions.length > 0 && (
                <>
                  <Divider />
                  <Title level={5}>Assumptions</Title>
                  {renderSummaryList(result.assumptions)}
                </>
              )}
            </>
          ) : (
            <Empty description="Run analysis to view the detailed summary." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      ),
    },
    {
      key: 'visual',
      label: 'Visual Flow',
      children: (
        <Card size="small" bordered={false}>
          {result ? (
            <>
              <Paragraph style={{ marginBottom: 12 }}>{result.visual_flow?.text_walkthrough}</Paragraph>
              <div className="visual-flow-shell">
                {flowNodes.length > 0 ? (
                  <ReactFlow nodes={flowNodes} edges={flowEdges} fitView className="visual-flow-canvas">
                    <MiniMap />
                    <Controls />
                    <Background gap={16} color="#f0f0f0" />
                  </ReactFlow>
                ) : (
                  <Empty
                    description="AI did not return a graph. Try re-running with more context."
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )}
              </div>
            </>
          ) : (
            <Empty description="Run analysis to see the visual flow." image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Card>
      ),
    },
    {
      key: 'chat',
      label: 'Ask the Code',
      children: (
        <Card size="small" bordered={false}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="Ask anything about this code"
              description="The chat uses the same uploaded code context to answer in plain language."
              type="info"
              showIcon
            />
            <div className="chat-window">
              {chatMessages.length === 0 ? (
                <Empty
                  description="Ask a question to get started."
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              ) : (
                <List
                  dataSource={chatMessages}
                  renderItem={(msg) => (
                    <List.Item className={`chat-message ${msg.role}`}>
                      <div className="chat-bubble">
                        <Text strong>{msg.role === 'user' ? 'You' : 'AI'}</Text>
                        <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>{msg.content}</div>
                        {msg.bullets && msg.bullets.length > 0 && (
                          <ul className="chat-bullets">
                            {msg.bullets.map((b, i) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        )}
                        {msg.assumptions && msg.assumptions.length > 0 && (
                          <div className="chat-assumptions">
                            <Text type="secondary">Assumptions:</Text>
                            <ul>
                              {msg.assumptions.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about this code..."
                onPressEnter={() => handleSendChat()}
                disabled={chatLoading}
              />
              <Button
                type="primary"
                onClick={() => handleSendChat()}
                loading={chatLoading}
                disabled={!chatInput.trim() || !code.trim()}
              >
                Send
              </Button>
            </Space.Compact>
            {!code.trim() && (
              <Text type="secondary">Paste or upload code first to enable chat.</Text>
            )}
          </Space>
        </Card>
      ),
    },
  ];

  return (
    <div className="code-understanding-page">
      <PageHeader
        title="Code Understanding"
        subtitle="Upload SAS/R code, get layered summaries and a visual flow"
        icon={<BulbOutlined />}
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              Reset
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              loading={loading}
              onClick={handleAnalyze}
            >
              Analyze Code
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="Input" className="code-understanding-card">
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Upload.Dragger
                accept=".sas,.txt,.r"
                beforeUpload={beforeUpload}
                showUploadList={false}
                disabled={loading}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text">Drop SAS/R file here or click to upload</p>
                {fileName && <p className="ant-upload-hint">Loaded: {fileName}</p>}
              </Upload.Dragger>

              <div>
                <div className="field-label">Language</div>
                <Select
                  value={language}
                  onChange={(val) => setLanguage(val as CodeUnderstandingLanguage)}
                  style={{ width: '100%' }}
                >
                  <Option value="auto">Auto-detect</Option>
                  <Option value="SAS">SAS</Option>
                  <Option value="R">R</Option>
                </Select>
              </div>

              <div>
                <div className="field-label">Audience</div>
                <Select
                  value={audience}
                  onChange={(val) => setAudience(val as typeof audience)}
                  style={{ width: '100%' }}
                >
                  <Option value="non-technical">Non-technical (default)</Option>
                  <Option value="developer">Developer</Option>
                  <Option value="reviewer">Reviewer / Stakeholder</Option>
                </Select>
              </div>

              <div>
                <div className="field-label">Code</div>
                <TextArea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  rows={12}
                  placeholder="Paste SAS or R code here..."
                  className="code-input-area"
                />
              </div>

              <Space wrap>
                <Button icon={<FileTextOutlined />} onClick={() => loadSample('sas_adsl')}>
                  Sample: SAS ADSL
                </Button>
                <Button icon={<FileTextOutlined />} onClick={() => loadSample('r_bds')}>
                  Sample: R BDS
                </Button>
              </Space>
            </Space>
          </Card>

          <Card title="What you get" size="small">
            <Space direction="vertical">
              <span><BulbOutlined /> 2-line, 10-line, and detailed summaries</span>
              <span><BranchesOutlined /> Visual flow graph of the code steps</span>
              <span><SafetyOutlined /> Risks, assumptions, and data checks</span>
              <span><RadarChartOutlined /> Language auto-detection + tone control</span>
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card className="code-understanding-card">
            {error && (
              <Alert
                type="error"
                showIcon
                message="Unable to analyze code"
                description={error}
                style={{ marginBottom: 12 }}
              />
            )}

            <div className="analysis-meta">
              <Space wrap>
                <Tag icon={<AimOutlined />} color="blue">
                  {result?.language_detected || language || 'Auto'}
                </Tag>
                {result?.tokens_used ? (
                  <Tag icon={<BulbOutlined />} color="purple">
                    {result.tokens_used} tokens
                  </Tag>
                ) : null}
                {result && (
                  <Tag icon={<ReadOutlined />} color="green">
                    Summaries ready
                  </Tag>
                )}
              </Space>
            </div>

            <Spin spinning={loading}>
              <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={tabs}
                destroyInactiveTabPane={false}
              />
            </Spin>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CodeUnderstandingTab;

