import { useState } from 'react';
import {
  Button,
  Card,
  Typography,
  Select,
  Table,
  Tag,
  message,
  Input,
  Space,
  Upload,
  Divider,
  List,
  Radio,
} from 'antd';
import {
  InboxOutlined,
  ArrowLeftOutlined,
  RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import './CodeMigrationPage.css';

const { Title, Paragraph, Text } = Typography;
const { Dragger } = Upload;

interface MigratedVariable {
  name: string;
  derivation: string;
  category: string;
  approved: boolean;
}

const CATEGORY_OPTIONS = [
  'Identifier Variables',
  'Disposition Variables',
  'Baseline Characteristics',
  'Demographics',
  'Treatment Variables',
  'Study Dates',
  'Population Flags',
  'Derived Variables',
  'Other Category',
];

interface ChatMessage {
  role: 'assistant' | 'user';
  text: string;
}

const defaultChatWelcome: ChatMessage[] = [
  {
    role: 'assistant',
    text: 'Hi! Select a variable and ask me anything about its derivation or categorization.',
  },
];

interface CodeMigrationPageProps {
  onBack?: () => void;
}

const CodeMigrationPage = ({ onBack }: CodeMigrationPageProps) => {
  const [sourceLanguage, setSourceLanguage] = useState<'SAS' | 'R'>('SAS');
  const [targetLanguage, setTargetLanguage] = useState<'SAS' | 'R'>('R');
  const [executionMode, setExecutionMode] = useState<'api' | 'local'>('api');
  const [variables, setVariables] = useState<MigratedVariable[]>([]);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(defaultChatWelcome);
  const [chatInput, setChatInput] = useState('');
  const approvedCount = variables.filter((v) => v.approved).length;
  const canGenerate = approvedCount > 0;

  const parseCode = (content: string): MigratedVariable[] => {
    const lines = content.split(/\r?\n/);
    const vars: MigratedVariable[] = [];

    lines.forEach((line) => {
      const cleaned = line.trim();
      if (!cleaned || cleaned.startsWith('*') || cleaned.startsWith('//')) {
        return;
      }

      // Very naive heuristics just to populate UI
      const assignMatch = cleaned.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*(=|<-)/);
      if (assignMatch) {
        const name = assignMatch[1].toUpperCase();
        const derivation = cleaned.slice(assignMatch[0].length).trim();

        let category = 'Derived Variables';
        if (name.includes('DT')) category = 'Study Dates';
        else if (name.includes('FL')) category = 'Population Flags';
        else if (name.includes('AGE') || name.includes('SEX')) category = 'Demographics';

        vars.push({
          name,
          derivation: derivation || 'Derived from prior expression',
          category,
          approved: false,
        });
      }
    });

    if (vars.length === 0) {
      vars.push({
        name: 'DERIVED_VAR',
        derivation: 'Placeholder derivation logic',
        category: 'Derived Variables',
        approved: false,
      });
    }

    return vars;
  };

  const handleFileContent = async (file: File) => {
    setUploadedFileName(file.name);
    const text = await file.text();
    const extracted = parseCode(text);
    setVariables(extracted);
    message.success(`Analyzed ${extracted.length} variables from ${file.name}`);
  };

  const uploadProps: UploadProps = {
    name: 'code',
    multiple: false,
    accept: '.sas,.txt,.r',
    beforeUpload: (file) => {
      void handleFileContent(file);
      return false;
    },
    showUploadList: false,
  };

  const handleCategoryChange = (name: string, category: string) => {
    setVariables((prev) =>
      prev.map((v) => (v.name === name ? { ...v, category } : v))
    );
  };

  const toggleApproval = (name: string) => {
    setVariables((prev) =>
      prev.map((v) => (v.name === name ? { ...v, approved: !v.approved } : v))
    );
  };

  const handleGenerateOptimizedCode = () => {
    if (!canGenerate) {
      message.warning('Approve at least one variable to generate optimized code.');
      return;
    }

    const conversionLabel =
      sourceLanguage === targetLanguage
        ? `${targetLanguage}`
        : `${sourceLanguage} → ${targetLanguage}`;

    if (executionMode === 'local') {
      message.success(
        `Using local Ollama service (no API calls) to migrate ${conversionLabel} for ${approvedCount} variable(s).`
      );
    } else {
      message.success(
        `Contacting secure API to generate optimized ${targetLanguage} code (${conversionLabel}) for ${approvedCount} variable(s).`
      );
    }
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    const userMessage: ChatMessage = { role: 'user', text: chatInput.trim() };
    const assistantReply: ChatMessage = {
      role: 'assistant',
      text: 'Thanks for the question! The AI assistant will explain the derivation logic based on the uploaded code (coming soon).',
    };
    setChatMessages((prev) => [...prev, userMessage, assistantReply]);
    setChatInput('');
  };

  const columns = [
    {
      title: 'Variable',
      dataIndex: 'name',
      key: 'name',
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: 'Detected Derivation Logic',
      dataIndex: 'derivation',
      key: 'derivation',
      render: (value: string) => (
        <Paragraph ellipsis={{ rows: 2, expandable: true }}>{value}</Paragraph>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (_: string, record: MigratedVariable) => (
        <Select
          value={record.category}
          onChange={(val) => handleCategoryChange(record.name, val)}
          style={{ width: 220 }}
          options={CATEGORY_OPTIONS.map((cat) => ({ value: cat, label: cat }))}
        />
      ),
    },
    {
      title: 'Approval',
      dataIndex: 'approved',
      key: 'approved',
      render: (_: boolean, record: MigratedVariable) => (
        <Button
          type={record.approved ? 'primary' : 'default'}
          onClick={() => toggleApproval(record.name)}
        >
          {record.approved ? 'Approved' : 'Approve'}
        </Button>
      ),
    },
  ];

  return (
    <div className="migration-page">
      <div className="migration-header">
        <div className="migration-header-left">
          {onBack && (
            <Button
              icon={<ArrowLeftOutlined />}
              type="link"
              onClick={onBack}
              className="migration-back"
            >
              Back
            </Button>
          )}
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>
              AI Code Converter
            </Title>
            <Paragraph style={{ margin: 0, color: '#6b7280' }}>
              Upload existing ADAM code, review detected variables, and let AI generate an optimized program.
            </Paragraph>
          </div>
        </div>
        <div className="migration-header-controls">
          <div className="language-selectors">
            <div className="language-group">
              <Text className="label">Source Language</Text>
              <Select
                value={sourceLanguage}
                onChange={(val) => setSourceLanguage(val as 'SAS' | 'R')}
                options={[
                  { value: 'SAS', label: 'SAS' },
                  { value: 'R', label: 'R' },
                ]}
                style={{ width: 120 }}
              />
            </div>
            <div className="language-group">
              <Text className="label">Target Language</Text>
              <Select
                value={targetLanguage}
                onChange={(val) => setTargetLanguage(val as 'SAS' | 'R')}
                options={[
                  { value: 'SAS', label: 'SAS' },
                  { value: 'R', label: 'R' },
                ]}
                style={{ width: 120 }}
              />
            </div>
          </div>
          <div className="mode-toggle">
            <Text className="label">Data Security Mode</Text>
            <Radio.Group
              value={executionMode}
              onChange={(e) => setExecutionMode(e.target.value)}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="api">Secure API</Radio.Button>
              <Radio.Button value="local">Local Ollama</Radio.Button>
            </Radio.Group>
            <Paragraph style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>
              {executionMode === 'local'
                ? 'All processing stays on this device. No external calls will be made.'
                : 'Uses encrypted API calls to your configured LLM provider.'}
            </Paragraph>
          </div>
        </div>
      </div>

      <div className="migration-layout">
        <div className="migration-left">
          <Card title="Upload Existing ADAM Code" className="upload-card">
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Drag & drop SAS/R files here, or click to select</p>
              <p className="ant-upload-hint">
                Supports .sas, .r, .txt. We will parse variables and derivations for you.
              </p>
            </Dragger>
            {uploadedFileName && (
              <Paragraph style={{ marginTop: 12 }}>
                <Tag color="blue">{uploadedFileName}</Tag>
                uploaded successfully.
              </Paragraph>
            )}
          </Card>

          <Card
            className="variables-card"
            title={`Mapped Variables (${variables.length})`}
            extra={<Tag color={canGenerate ? 'green' : 'gold'}>{approvedCount} approved</Tag>}
          >
            <Table
              dataSource={variables}
              columns={columns}
              rowKey="name"
              pagination={{ pageSize: 6 }}
              locale={{
                emptyText: uploadedFileName
                  ? 'No variables detected. Please verify your file.'
                  : 'Upload code to begin analysis.',
              }}
            />
          </Card>

          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              size="large"
              disabled={!canGenerate}
              onClick={handleGenerateOptimizedCode}
            >
              Generate Optimized Code
            </Button>
            <Button
              disabled={!variables.length}
              onClick={() => {
                setVariables([]);
                setUploadedFileName(null);
                message.info('Cleared analysis session.');
              }}
            >
              Reset
            </Button>
          </Space>
        </div>

        <div className="migration-right">
          <Card
            title={
              <Space>
                <RobotOutlined />
                AI Review Assistant
              </Space>
            }
            className="chat-card"
          >
            <List
              dataSource={chatMessages}
              className="chat-messages"
              renderItem={(item, index) => (
                <List.Item
                  className={`chat-message ${item.role}`}
                  key={`${item.role}-${index}`}
                >
                  <Text>{item.text}</Text>
                </List.Item>
              )}
            />
            <Divider />
            <Space.Compact style={{ width: '100%' }}>
              <Input.TextArea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                rows={2}
                placeholder="Ask about a derivation or categorization..."
              />
              <Button type="primary" icon={<SendOutlined />} onClick={handleSendChat}>
                Ask
              </Button>
            </Space.Compact>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CodeMigrationPage;
