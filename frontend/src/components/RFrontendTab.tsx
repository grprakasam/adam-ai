/**
 * R Frontend - Professional R Code Execution Environment
 *
 * A SaaS-grade R programming interface with:
 * - Monaco editor with R syntax highlighting
 * - Real-time code execution via Docker
 * - Split-pane layout (Editor | Output)
 * - Execution history
 * - Code snippets library
 * - Professional UI/UX
 */

import React, { useState, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import {
  Button,
  Space,
  Card,
  Tabs,
  message,
  Tooltip,
  Tag,
  Alert,
  Collapse,
  Select,
  Badge,
  Divider
} from 'antd';
import {
  PlayCircleOutlined,
  ClearOutlined,
  DownloadOutlined,
  UploadOutlined,
  HistoryOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CopyOutlined,
  FileTextOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { api } from '../services/api';
import './RFrontendTab.css';

const { Panel } = Collapse;
const { Option } = Select;

interface ExecutionResult {
  id: string;
  code: string;
  output: string;
  errors: string[];
  warnings: string[];
  timestamp: Date;
  executionTime: number;
  status: 'success' | 'error' | 'running';
}

interface CodeSnippet {
  id: string;
  name: string;
  description: string;
  code: string;
  category: string;
}

const CODE_SNIPPETS: CodeSnippet[] = [
  {
    id: 'hello',
    name: 'Hello World',
    description: 'Simple print statement',
    category: 'Basics',
    code: '# Hello World\nprint("Hello from R!")\n'
  },
  {
    id: 'dataframe',
    name: 'Create DataFrame',
    description: 'Create and display a data frame',
    category: 'Data Structures',
    code: '# Create a data frame\ndf <- data.frame(\n  Name = c("Alice", "Bob", "Charlie"),\n  Age = c(25, 30, 35),\n  Score = c(85.5, 92.3, 78.9)\n)\nprint(df)\nsummary(df)\n'
  },
  {
    id: 'plot',
    name: 'Simple Plot',
    description: 'Create a basic scatter plot',
    category: 'Visualization',
    code: '# Simple scatter plot\nx <- 1:10\ny <- x^2\nplot(x, y, type="b", col="blue", main="Simple Plot")\n'
  },
  {
    id: 'stats',
    name: 'Statistical Summary',
    description: 'Calculate statistics',
    category: 'Statistics',
    code: '# Statistical summary\ndata <- rnorm(100, mean=50, sd=10)\ncat("Mean:", mean(data), "\\n")\ncat("Median:", median(data), "\\n")\ncat("SD:", sd(data), "\\n")\ncat("Range:", range(data), "\\n")\nhist(data, main="Distribution", col="lightblue")\n'
  },
  {
    id: 'loop',
    name: 'For Loop',
    description: 'Loop through data',
    category: 'Control Flow',
    code: '# For loop example\nfor (i in 1:5) {\n  cat("Iteration", i, "- Value:", i^2, "\\n")\n}\n'
  },
  {
    id: 'function',
    name: 'Custom Function',
    description: 'Define and use a function',
    category: 'Functions',
    code: '# Custom function\ncalculate_bmi <- function(weight_kg, height_m) {\n  bmi <- weight_kg / (height_m ^ 2)\n  return(round(bmi, 2))\n}\n\n# Test the function\ncat("BMI:", calculate_bmi(70, 1.75), "\\n")\n'
  },
  {
    id: 'packages',
    name: 'Install & Load Package',
    description: 'Package management',
    category: 'Packages',
    code: '# Install and load packages\n# install.packages("dplyr")  # Uncomment to install\nlibrary(dplyr)\n\n# Use dplyr\ndata <- data.frame(x = 1:5, y = 6:10)\nresult <- data %>% mutate(z = x + y)\nprint(result)\n'
  }
];

export const RFrontendTab: React.FC = () => {
  const [code, setCode] = useState<string>('# Welcome to R Frontend!\n# Write your R code here and press Ctrl+Enter to execute\n\nprint("Hello from R!")\n');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [currentOutput, setCurrentOutput] = useState<string>('');
  const [currentErrors, setCurrentErrors] = useState<string[]>([]);
  const [currentWarnings, setCurrentWarnings] = useState<string[]>([]);
  const [selectedSnippet, setSelectedSnippet] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState<'vs-dark' | 'vs-light'>('vs-dark');

  const editorRef = useRef<any>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;

    // Ctrl+Enter to execute
    editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, () => {
      handleExecute();
    });

    // Ctrl+Shift+C to clear
    editor.addCommand(
      window.monaco.KeyMod.CtrlCmd | window.monaco.KeyMod.Shift | window.monaco.KeyCode.KeyC,
      () => {
        handleClear();
      }
    );
  };

  const handleExecute = useCallback(async () => {
    if (!code.trim()) {
      message.warning('Please enter some R code to execute');
      return;
    }

    if (isExecuting) {
      message.warning('Code is already executing...');
      return;
    }

    const executionId = `exec-${Date.now()}`;
    const startTime = Date.now();

    setIsExecuting(true);
    setCurrentOutput('');
    setCurrentErrors([]);
    setCurrentWarnings([]);

    try {
      message.loading({ content: 'Executing R code...', key: 'execute', duration: 0 });

      const result = await api.executeCodeSnippet({
        code: code,
        language: 'R',
        snippet_id: executionId,
        test_dataset_ids: [],
        timeout: 120, // 2 minutes timeout
        execution_env: 'docker'
      });

      const executionTime = Date.now() - startTime;

      // Parse results
      const output = result.console_output?.join('\n') || '';
      const errors = result.errors || [];
      const warnings = result.warnings || [];

      setCurrentOutput(output);
      setCurrentErrors(errors);
      setCurrentWarnings(warnings);

      // Add to history
      const historyEntry: ExecutionResult = {
        id: executionId,
        code: code,
        output: output,
        errors: errors,
        warnings: warnings,
        timestamp: new Date(),
        executionTime: executionTime,
        status: result.status === 'success' ? 'success' : 'error'
      };

      setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 49)]); // Keep last 50

      message.destroy('execute');
      if (result.status === 'success') {
        message.success({
          content: `✓ Executed successfully in ${(executionTime / 1000).toFixed(2)}s`,
          duration: 3
        });
      } else {
        message.error({
          content: '✗ Execution failed - check errors below',
          duration: 5
        });
      }

      // Scroll to output
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      const errorMsg = err.response?.data?.detail || err.message || 'Execution failed';

      setCurrentErrors([errorMsg]);
      setCurrentOutput('');

      message.destroy('execute');
      message.error({
        content: `✗ ${errorMsg}`,
        duration: 5
      });

      // Add failed execution to history
      setExecutionHistory(prev => [
        {
          id: executionId,
          code: code,
          output: '',
          errors: [errorMsg],
          warnings: [],
          timestamp: new Date(),
          executionTime: executionTime,
          status: 'error'
        },
        ...prev.slice(0, 49)
      ]);
    } finally {
      setIsExecuting(false);
    }
  }, [code, isExecuting]);

  const handleClear = () => {
    setCode('');
    setCurrentOutput('');
    setCurrentErrors([]);
    setCurrentWarnings([]);
    message.success('Editor cleared');
  };

  const handleClearHistory = () => {
    setExecutionHistory([]);
    message.success('History cleared');
  };

  const handleLoadSnippet = (snippet: CodeSnippet) => {
    setCode(snippet.code);
    setSelectedSnippet(snippet.id);
    message.success(`Loaded: ${snippet.name}`);
  };

  const handleLoadFromHistory = (execution: ExecutionResult) => {
    setCode(execution.code);
    message.success('Code loaded from history');
  };

  const handleDownloadCode = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `r_script_${Date.now()}.R`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('Code downloaded');
  };

  const handleUploadCode = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.R,.r,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setCode(content);
          message.success(`Loaded: ${file.name}`);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleCopyOutput = () => {
    navigator.clipboard.writeText(currentOutput);
    message.success('Output copied to clipboard');
  };

  const snippetsByCategory = CODE_SNIPPETS.reduce((acc, snippet) => {
    if (!acc[snippet.category]) {
      acc[snippet.category] = [];
    }
    acc[snippet.category].push(snippet);
    return acc;
  }, {} as Record<string, CodeSnippet[]>);

  return (
    <div className="r-frontend-container">
      {/* Header */}
      <div className="r-frontend-header">
        <div className="header-left">
          <ThunderboltOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <div className="header-title">
            <h2>R Frontend</h2>
            <span className="header-subtitle">Professional R Execution Environment</span>
          </div>
        </div>
        <div className="header-actions">
          <Space size="middle">
            <Tooltip title="Download code (.R file)">
              <Button icon={<DownloadOutlined />} onClick={handleDownloadCode} size="small">
                Download
              </Button>
            </Tooltip>
            <Tooltip title="Upload R file">
              <Button icon={<UploadOutlined />} onClick={handleUploadCode} size="small">
                Upload
              </Button>
            </Tooltip>
            <Tooltip title="Theme">
              <Select
                value={theme}
                onChange={setTheme}
                size="small"
                style={{ width: 120 }}
              >
                <Option value="vs-dark">Dark</Option>
                <Option value="vs-light">Light</Option>
              </Select>
            </Tooltip>
            <Tooltip title="Font size">
              <Select
                value={fontSize}
                onChange={setFontSize}
                size="small"
                style={{ width: 80 }}
              >
                {[10, 12, 14, 16, 18, 20].map(size => (
                  <Option key={size} value={size}>{size}px</Option>
                ))}
              </Select>
            </Tooltip>
          </Space>
        </div>
      </div>

      {/* Info Banner */}
      <Alert
        message={
          <span>
            💡 <strong>Quick Start:</strong> Write R code in the editor and press{' '}
            <kbd>Ctrl+Enter</kbd> to execute. Results appear in real-time on the right panel.
          </span>
        }
        type="info"
        showIcon={false}
        closable
        style={{ marginBottom: 16 }}
      />

      {/* Main Content */}
      <div className="r-frontend-content">
        {/* Left Panel - Editor & Tools */}
        <div className="editor-section">
          <Card
            className="editor-card"
            bodyStyle={{ padding: 0, height: '100%' }}
            title={
              <Space>
                <CodeOutlined />
                <span>Code Editor</span>
                <Tag color="blue">R</Tag>
              </Space>
            }
            extra={
              <Space size="small">
                <Tooltip title="Execute code (Ctrl+Enter)">
                  <Button
                    type="primary"
                    icon={isExecuting ? <LoadingOutlined /> : <PlayCircleOutlined />}
                    onClick={handleExecute}
                    disabled={isExecuting || !code.trim()}
                    loading={isExecuting}
                  >
                    {isExecuting ? 'Running...' : 'Run'}
                  </Button>
                </Tooltip>
                <Tooltip title="Clear editor (Ctrl+Shift+C)">
                  <Button
                    icon={<ClearOutlined />}
                    onClick={handleClear}
                    disabled={isExecuting}
                  >
                    Clear
                  </Button>
                </Tooltip>
              </Space>
            }
          >
            <Editor
              height="calc(100vh - 350px)"
              language="r"
              value={code}
              onChange={(value) => setCode(value || '')}
              theme={theme}
              options={{
                fontSize: fontSize,
                minimap: { enabled: true },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                lineNumbers: 'on',
                folding: true,
                glyphMargin: true,
                contextmenu: true,
                quickSuggestions: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                tabCompletion: 'on',
                formatOnPaste: true,
                formatOnType: true,
              }}
              onMount={handleEditorMount}
            />
          </Card>

          {/* Code Snippets */}
          <Card
            size="small"
            title={
              <Space>
                <FileTextOutlined />
                <span>Code Snippets</span>
                <Badge count={CODE_SNIPPETS.length} showZero color="#1890ff" />
              </Space>
            }
            className="snippets-card"
            style={{ marginTop: 16 }}
          >
            <Collapse accordion ghost>
              {Object.entries(snippetsByCategory).map(([category, snippets]) => (
                <Panel
                  header={
                    <Space>
                      <strong>{category}</strong>
                      <Badge count={snippets.length} showZero />
                    </Space>
                  }
                  key={category}
                >
                  <div className="snippets-list">
                    {snippets.map(snippet => (
                      <div
                        key={snippet.id}
                        className={`snippet-item ${selectedSnippet === snippet.id ? 'selected' : ''}`}
                        onClick={() => handleLoadSnippet(snippet)}
                      >
                        <div className="snippet-header">
                          <strong>{snippet.name}</strong>
                          <CodeOutlined />
                        </div>
                        <div className="snippet-description">{snippet.description}</div>
                      </div>
                    ))}
                  </div>
                </Panel>
              ))}
            </Collapse>
          </Card>
        </div>

        {/* Right Panel - Output & History */}
        <div className="output-section" ref={outputRef}>
          <Card
            className="output-card"
            bodyStyle={{ padding: 0, height: '100%' }}
            title={
              <Space>
                {isExecuting ? (
                  <LoadingOutlined spin style={{ color: '#1890ff' }} />
                ) : currentErrors.length > 0 ? (
                  <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                ) : (
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                )}
                <span>Output & Results</span>
                {executionHistory.length > 0 && (
                  <Tag color="cyan">{executionHistory.length} execution(s)</Tag>
                )}
              </Space>
            }
            extra={
              <Space size="small">
                {currentOutput && (
                  <Tooltip title="Copy output">
                    <Button
                      icon={<CopyOutlined />}
                      size="small"
                      onClick={handleCopyOutput}
                    />
                  </Tooltip>
                )}
                {executionHistory.length > 0 && (
                  <Button
                    icon={<HistoryOutlined />}
                    size="small"
                    onClick={handleClearHistory}
                  >
                    Clear History
                  </Button>
                )}
              </Space>
            }
          >
            <Tabs
              defaultActiveKey="current"
              className="output-tabs"
              items={[
                {
                  key: 'current',
                  label: 'Current Output',
                  children: (
                    <div className="output-content">
                      {!currentOutput && !isExecuting && currentErrors.length === 0 && (
                        <div className="output-placeholder">
                          <ThunderboltOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                          <p>No output yet</p>
                          <p style={{ fontSize: 12, opacity: 0.6 }}>
                            Execute some R code to see results here
                          </p>
                        </div>
                      )}

                      {isExecuting && (
                        <div className="output-loading">
                          <LoadingOutlined spin style={{ fontSize: 32, color: '#1890ff' }} />
                          <p>Executing R code...</p>
                        </div>
                      )}

                      {currentWarnings.length > 0 && (
                        <Alert
                          message="Warnings"
                          description={
                            <pre className="output-warnings">
                              {currentWarnings.join('\n')}
                            </pre>
                          }
                          type="warning"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      {currentErrors.length > 0 && (
                        <Alert
                          message="Errors"
                          description={
                            <pre className="output-errors">
                              {currentErrors.join('\n')}
                            </pre>
                          }
                          type="error"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      {currentOutput && (
                        <div className="output-success">
                          <Divider orientation="left">Console Output</Divider>
                          <pre className="output-text">{currentOutput}</pre>
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  key: 'history',
                  label: `History (${executionHistory.length})`,
                  children: (
                    <div className="history-content">
                      {executionHistory.length === 0 ? (
                        <div className="output-placeholder">
                          <HistoryOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                          <p>No execution history</p>
                        </div>
                      ) : (
                        <div className="history-list">
                          {executionHistory.map((execution) => (
                            <Card
                              key={execution.id}
                              size="small"
                              className={`history-item ${execution.status}`}
                              style={{ marginBottom: 8 }}
                              title={
                                <Space>
                                  {execution.status === 'success' ? (
                                    <CheckCircleOutlined style={{ color: '#52c41a' }} />
                                  ) : (
                                    <CloseCircleOutlined style={{ color: '#ff4d4f' }} />
                                  )}
                                  <span>{execution.timestamp.toLocaleTimeString()}</span>
                                  <Tag color="blue">{(execution.executionTime / 1000).toFixed(2)}s</Tag>
                                </Space>
                              }
                              extra={
                                <Button
                                  size="small"
                                  type="link"
                                  onClick={() => handleLoadFromHistory(execution)}
                                >
                                  Load Code
                                </Button>
                              }
                            >
                              <div className="history-code">
                                <strong>Code:</strong>
                                <pre>{execution.code.substring(0, 200)}
                                  {execution.code.length > 200 ? '...' : ''}
                                </pre>
                              </div>
                              {execution.output && (
                                <div className="history-output">
                                  <strong>Output:</strong>
                                  <pre>{execution.output}</pre>
                                </div>
                              )}
                              {execution.errors.length > 0 && (
                                <div className="history-errors">
                                  <strong>Errors:</strong>
                                  <pre>{execution.errors.join('\n')}</pre>
                                </div>
                              )}
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
};

export default RFrontendTab;
