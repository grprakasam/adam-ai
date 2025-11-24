/**
 * Interactive Code Executor Tab
 *
 * REPL-style code editor for executing R/SAS code snippets:
 * - Monaco editor for writing code
 * - Execute button to run code
 * - Real-time output display
 * - Execution history
 * - Support for multi-line code blocks
 */

import React, { useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { message } from 'antd';
import { useProjectStore } from '../store/projectStore';
import { api } from '../services/api';
import './CodeReviewTab.css';

interface ExecutionResult {
  id: string;
  code: string;
  output: string;
  error: string | null;
  timestamp: Date;
  status: 'success' | 'error' | 'running';
  executionTime?: number;
}

export const CodeReviewTab: React.FC = () => {
  const { programmingLanguage, projectConfig } = useProjectStore();

  const [code, setCode] = useState<string>('# Write your R code here\nprint("Hello, ADAM!")\n');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState<number | null>(null);
  const editorRef = useRef<any>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;

    // Add Ctrl+Enter to execute code
    editor.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.Enter, () => {
      handleExecuteCode();
    });
  };

  const handleExecuteCode = async () => {
    if (!code.trim()) {
      message.warning('Please enter some code to execute');
      return;
    }

    if (isExecuting) {
      message.warning('Code is already executing. Please wait...');
      return;
    }

    const executionId = `exec-${Date.now()}`;
    const startTime = Date.now();

    // Add to history as "running"
    const newExecution: ExecutionResult = {
      id: executionId,
      code: code,
      output: '',
      error: null,
      timestamp: new Date(),
      status: 'running',
    };

    setExecutionHistory(prev => [newExecution, ...prev]);
    setIsExecuting(true);

    try {
      // Call the backend API to execute the code using the proper API method
      const result = await api.executeCodeSnippet({
        code: code,
        language: programmingLanguage,
        snippet_id: executionId,
        test_dataset_ids: [],
        timeout: 300, // 5 minutes timeout for Docker execution
        execution_env: 'docker'
      });

      const executionTime = Date.now() - startTime;

      // Parse the response according to CodeExecutionResult model
      const outputText = result.console_output?.join('\n') || '';
      const errorText = result.errors?.join('\n') || '';
      const warningText = result.warnings?.join('\n') || '';

      // Combine output with warnings if present
      const fullOutput = warningText 
        ? `${outputText}\n\nWarnings:\n${warningText}`
        : outputText;

      // Update history with results
      setExecutionHistory(prev =>
        prev.map(item =>
          item.id === executionId
            ? {
                ...item,
                output: fullOutput || (result.status === 'success' ? 'Executed successfully (no output)' : ''),
                error: errorText || null,
                status: result.status === 'success' ? 'success' : 'error',
                executionTime: executionTime,
              }
            : item
        )
      );

      if (result.status === 'success') {
        message.success(`Code executed successfully in ${(executionTime / 1000).toFixed(2)}s`);
      } else {
        message.error('Code execution failed. Check output for details.');
      }

      // Scroll output to view
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
    } catch (err: any) {
      const executionTime = Date.now() - startTime;
      const errorMessage = err.response?.data?.detail || err.message || 'Execution failed';

      setExecutionHistory(prev =>
        prev.map(item =>
          item.id === executionId
            ? {
                ...item,
                output: '',
                error: errorMessage,
                status: 'error',
                executionTime: executionTime,
              }
            : item
        )
      );

      message.error(errorMessage);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleClearHistory = () => {
    setExecutionHistory([]);
    setSelectedHistoryIndex(null);
    message.success('Execution history cleared');
  };

  const handleLoadFromHistory = (index: number) => {
    const execution = executionHistory[index];
    if (execution) {
      setCode(execution.code);
      setSelectedHistoryIndex(index);
      message.success('Code loaded from history');
    }
  };

  const handleClearCode = () => {
    setCode('');
    message.success('Editor cleared');
  };


  return (
    <div className="code-review-tab code-executor">
      {/* Header */}
      <div className="review-header">
        <div className="review-info">
          <h2>🖥️ Interactive Code Executor</h2>
          <span className="language-badge">{programmingLanguage}</span>
        </div>

        <div className="review-actions">
          <button
            onClick={handleExecuteCode}
            disabled={isExecuting || !code.trim()}
            className="btn btn-primary"
            title="Execute code (Ctrl+Enter)"
          >
            {isExecuting ? (
              <>
                <span className="spinner-small"></span> Executing...
              </>
            ) : (
              <>▶️ Run Code</>
            )}
          </button>
          <button
            onClick={handleClearCode}
            disabled={isExecuting}
            className="btn btn-secondary"
            title="Clear editor"
          >
            🗑️ Clear
          </button>
          <button
            onClick={handleClearHistory}
            disabled={executionHistory.length === 0}
            className="btn btn-secondary"
            title="Clear execution history"
          >
            📋 Clear History
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="info-banner">
        💡 Write {programmingLanguage} code and press <kbd>Ctrl+Enter</kbd> or click <strong>Run Code</strong> to execute. Results will appear below.
      </div>

      {/* Main Content: Editor + Output */}
      <div className="review-content executor-layout">
        {/* Code Editor */}
        <div className="editor-panel">
          <div className="editor-header">
            <span>Code Editor</span>
            <span className="editor-hint">Press Ctrl+Enter to execute</span>
          </div>
          <Editor
            height="400px"
            language={programmingLanguage.toLowerCase() === 'r' ? 'r' : 'sas'}
            value={code}
            onChange={(value) => setCode(value || '')}
            theme="vs-dark"
            options={{
              fontSize: 14,
              lineNumbers: 'on',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
            }}
            onMount={handleEditorMount}
          />
        </div>

        {/* Output Panel */}
        <div className="output-panel" ref={outputRef}>
          <div className="output-header">
            <span>Output & Results</span>
            {executionHistory.length > 0 && (
              <span className="execution-count">
                {executionHistory.length} execution{executionHistory.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="output-content">
            {executionHistory.length === 0 ? (
              <div className="no-output">
                <p>No executions yet. Write some code and click Run to see results.</p>
                <div className="example-code">
                  <strong>Example:</strong>
                  <pre>{programmingLanguage === 'R' 
                    ? '# Simple calculation\nx <- 1:10\nmean(x)\n\n# Print output\nprint("Hello from R!")'
                    : '/* SAS example */\ndata test;\n  x = 1;\n  y = 2;\nrun;'
                  }</pre>
                </div>
              </div>
            ) : (
              <div className="execution-results">
                {executionHistory.map((execution, index) => (
                  <div
                    key={execution.id}
                    className={`execution-item ${execution.status} ${
                      selectedHistoryIndex === index ? 'selected' : ''
                    }`}
                  >
                    <div className="execution-header-item">
                      <div className="execution-info">
                        <span className={`status-dot ${execution.status}`}></span>
                        <span className="execution-time">
                          {execution.timestamp.toLocaleTimeString()}
                        </span>
                        {execution.executionTime && (
                          <span className="execution-duration">
                            ({(execution.executionTime / 1000).toFixed(2)}s)
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleLoadFromHistory(index)}
                        className="btn-link"
                        title="Load this code into editor"
                      >
                        📝 Load
                      </button>
                    </div>

                    <div className="execution-code">
                      <strong>Code:</strong>
                      <pre>{execution.code}</pre>
                    </div>

                    {execution.status === 'running' && (
                      <div className="execution-output running">
                        <span className="spinner-small"></span> Executing...
                      </div>
                    )}

                    {execution.status === 'success' && execution.output && (
                      <div className="execution-output success">
                        <strong>✅ Output:</strong>
                        <pre>{execution.output}</pre>
                      </div>
                    )}

                    {execution.status === 'error' && execution.error && (
                      <div className="execution-output error">
                        <strong>❌ Error:</strong>
                        <pre>{execution.error}</pre>
                      </div>
                    )}

                    {execution.status === 'success' && !execution.output && (
                      <div className="execution-output success">
                        <em>✅ Executed successfully (no output)</em>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CodeReviewTab;
