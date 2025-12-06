/**
 * Document Chatbot - Full-Featured Document Analysis Tool
 * 
 * Features:
 * - Multi-file upload (up to 20 files)
 * - File size and type validation with warnings
 * - Configurable response settings
 * - Colorful suggested questions
 * - Source citations with CONTENT PREVIEW
 * - Source preview modal for detailed viewing
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, message, Spin, Switch, Select, Tooltip, Progress, Modal } from 'antd';
import {
  FileTextOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  FileExcelOutlined,
  SendOutlined,
  RobotOutlined,
  UserOutlined,
  DeleteOutlined,
  UploadOutlined,
  CheckCircleOutlined,
  BulbOutlined,
  SettingOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  FileAddOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  FileSearchOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { PageHeader } from './PageHeader';
import './StudyChatbotTab.css';
import {
  uploadStudyFiles,
  createKnowledgeBase,
  sendChatMessage as apiSendChatMessage,
  getSuggestedQuestions,
  SourceSnippet,
} from '../services/api';

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_FILES = 20;
const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const SUPPORTED_FORMATS = ['.pdf', '.docx', '.doc', '.txt', '.csv', '.xlsx', '.xls', '.rtf', '.md'];

const RESPONSE_STYLES = [
  { value: 'concise', label: '📝 Concise', desc: 'Brief 2-3 sentence answers' },
  { value: 'detailed', label: '📖 Detailed', desc: 'Comprehensive explanations' },
  { value: 'technical', label: '🔬 Technical', desc: 'Precise with data & numbers' },
];

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: string[];
  sourceSnippets?: SourceSnippet[];
}

interface ProcessedDoc {
  id: string;
  filename: string;
  path: string;
  size: number;
}

interface ChatSettings {
  responseStyle: 'concise' | 'detailed' | 'technical';
  showSources: boolean;
  language: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return <FilePdfOutlined />;
    case 'docx':
    case 'doc': return <FileWordOutlined />;
    case 'xlsx':
    case 'xls': return <FileExcelOutlined />;
    default: return <FileTextOutlined />;
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const validateFile = (file: File): { valid: boolean; error?: string } => {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();

  if (!SUPPORTED_FORMATS.includes(ext)) {
    return { valid: false, error: `Unsupported format: ${ext}` };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: `File too large (max ${MAX_FILE_SIZE_MB}MB)` };
  }

  return { valid: true };
};

// Highlight query terms in text
const highlightText = (text: string, highlight?: string): React.ReactNode => {
  if (!highlight) return text;

  const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === highlight.toLowerCase()
      ? <mark key={i} className="highlight-text">{part}</mark>
      : part
  );
};

// ============================================================================
// SOURCE PREVIEW MODAL COMPONENT
// ============================================================================

interface SourcePreviewModalProps {
  visible: boolean;
  snippet: SourceSnippet | null;
  onClose: () => void;
}

const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({ visible, snippet, onClose }) => {
  if (!snippet) return null;

  const relevancePercent = Math.round(snippet.relevance_score * 100);
  const relevanceColor = relevancePercent >= 70 ? '#16a34a' : relevancePercent >= 40 ? '#d97706' : '#dc2626';

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
      className="source-preview-modal"
      title={null}
      closeIcon={<CloseOutlined />}
    >
      <div className="source-modal-content">
        {/* Header */}
        <div className="source-modal-header">
          <div className="source-modal-icon">
            {getFileIcon(snippet.filename)}
          </div>
          <div className="source-modal-info">
            <div className="source-modal-filename">{snippet.filename}</div>
            <div className="source-modal-meta">
              <span className="source-modal-section">📁 {snippet.section}</span>
              <span className="source-modal-page">📄 Page {snippet.page}</span>
              <span className="source-modal-relevance" style={{ color: relevanceColor }}>
                🎯 {relevancePercent}% relevant
              </span>
            </div>
          </div>
        </div>

        {/* Highlight Preview */}
        {snippet.highlight_text && (
          <div className="source-modal-highlight">
            <div className="highlight-label">
              <FileSearchOutlined /> Key Match
            </div>
            <div className="highlight-content">
              "{snippet.highlight_text}"
            </div>
          </div>
        )}

        {/* Full Content */}
        <div className="source-modal-body">
          <div className="content-label">Full Source Content</div>
          <pre className="source-content-pre">
            {snippet.content}
          </pre>
        </div>
      </div>
    </Modal>
  );
};

// ============================================================================
// SOURCE CITATION CARD COMPONENT
// ============================================================================

interface SourceCardProps {
  snippet: SourceSnippet;
  onViewClick: (snippet: SourceSnippet) => void;
}

const SourceCard: React.FC<SourceCardProps> = ({ snippet, onViewClick }) => {
  const relevancePercent = Math.round(snippet.relevance_score * 100);
  const relevanceClass = relevancePercent >= 70 ? 'high' : relevancePercent >= 40 ? 'medium' : 'low';

  return (
    <div className="source-card" onClick={() => onViewClick(snippet)}>
      <div className="source-card-left">
        <div className="source-card-icon">{getFileIcon(snippet.filename)}</div>
        <div className="source-card-info">
          <div className="source-card-filename">{snippet.filename}</div>
          <div className="source-card-meta">
            {snippet.section} • Page {snippet.page}
          </div>
        </div>
      </div>
      <div className="source-card-right">
        <div className={`source-card-relevance ${relevanceClass}`}>
          {relevancePercent}%
        </div>
        <div className="source-card-view">
          <EyeOutlined /> View
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const StudyChatbotTab: React.FC = () => {
  // File state
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProcessedDoc[]>([]);

  // Suggested questions (shown in sidebar)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Chat settings
  const [settings, setSettings] = useState<ChatSettings>({
    responseStyle: 'detailed',
    showSources: true,
    language: 'en',
  });

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Source preview modal
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<SourceSnippet | null>(null);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Open source preview modal
  const handleViewSource = useCallback((snippet: SourceSnippet) => {
    setSelectedSnippet(snippet);
    setPreviewModalVisible(true);
  }, []);

  // Handle file selection with validation
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const errors: string[] = [];
    const validFiles: UploadFile[] = [];

    Array.from(files).forEach((file, idx) => {
      if (fileList.length + validFiles.length >= MAX_FILES) {
        errors.push(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      const validation = validateFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      validFiles.push({
        uid: `${Date.now()}-${idx}`,
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'done' as const,
        originFileObj: file as RcFile,
      });
    });

    if (errors.length > 0) {
      setFileErrors(errors);
      setTimeout(() => setFileErrors([]), 5000);
    }

    if (validFiles.length > 0) {
      setFileList(prev => [...prev, ...validFiles]);
    }

    e.target.value = '';
  }, [fileList.length]);

  // Remove file
  const handleRemoveFile = useCallback((uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
  }, []);

  // Send a specific question (for clickable suggestions)
  const handleAskQuestion = useCallback(async (question: string) => {
    if (!question || !sessionId || isTyping) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await apiSendChatMessage({
        session_id: sessionId,
        message: question,
        response_style: settings.responseStyle,
        show_sources: settings.showSources,
        language: settings.language,
      });

      const assistantMessage: Message = {
        id: response.message.id,
        type: 'assistant',
        content: response.message.content,
        timestamp: new Date(response.message.timestamp),
        sources: settings.showSources ? response.message.sources : undefined,
        sourceSnippets: settings.showSources ? response.message.source_snippets : undefined,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: `Sorry, I couldn't process that. ${error.message || 'Please try again.'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId, isTyping, settings]);

  // Process documents
  const handleProcessDocuments = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning('Please upload at least one document');
      return;
    }

    setIsProcessing(true);
    setUploadProgress(10);

    try {
      const files: File[] = fileList
        .map(f => f.originFileObj as File | undefined)
        .filter((f): f is File => f !== undefined);

      if (files.length === 0) {
        throw new Error('No valid files to upload');
      }

      setUploadProgress(30);

      // Step 1: Upload files
      const uploadResponse = await uploadStudyFiles(files);
      console.log('Upload response:', uploadResponse);

      setUploadProgress(60);

      // Step 2: Create knowledge base
      const kbResponse = await createKnowledgeBase({
        session_id: uploadResponse.session_id,
        file_paths: uploadResponse.files.map(f => f.path),
      });
      console.log('KB response:', kbResponse);

      setUploadProgress(90);

      if (kbResponse.status === 'failed') {
        throw new Error(kbResponse.error_message || 'Failed to create knowledge base');
      }

      // Save session
      setSessionId(uploadResponse.session_id);
      setDocuments(uploadResponse.files.map(f => ({
        id: f.path,
        filename: f.filename,
        path: f.path,
        size: f.size,
      })));

      // Calculate total size
      const totalSize = uploadResponse.files.reduce((sum, f) => sum + f.size, 0);

      // Add welcome message
      setMessages([{
        id: 'welcome',
        type: 'system',
        content: `✨ Ready! ${kbResponse.files_processed} document(s) processed (${formatFileSize(totalSize)} total).\n\nAsk me anything about your documents. Click on any source to see the exact content!`,
        timestamp: new Date(),
      }]);

      setUploadProgress(100);

      // Get suggested questions
      try {
        const suggestionsResponse = await getSuggestedQuestions(uploadResponse.session_id);
        if (suggestionsResponse.questions.length > 0) {
          setSuggestedQuestions(suggestionsResponse.questions.slice(0, 5).map(q => q.question));
        }
      } catch (e) {
        console.log('Could not get suggestions:', e);
      }

      message.success(`${kbResponse.files_processed} document(s) ready!`);
    } catch (error: any) {
      console.error('Processing error:', error);
      message.error(error.message || 'Failed to process documents');
    } finally {
      setIsProcessing(false);
      setUploadProgress(0);
    }
  }, [fileList]);

  // Send typed message
  const handleSendMessage = useCallback(async () => {
    const text = currentMessage.trim();
    if (!text || !sessionId) return;

    setCurrentMessage('');
    await handleAskQuestion(text);
  }, [currentMessage, sessionId, handleAskQuestion]);

  // Clear all
  const handleClear = useCallback(() => {
    setFileList([]);
    setSessionId(null);
    setDocuments([]);
    setMessages([]);
    setCurrentMessage('');
    setSuggestedQuestions([]);
    setFileErrors([]);
  }, []);

  const isReady = sessionId !== null;
  const totalFileSize = fileList.reduce((sum, f) => sum + (f.size || 0), 0);

  return (
    <div className="chatbot-container">
      <PageHeader
        title="Document Chat"
        subtitle="Upload documents and ask questions"
        icon={<FileTextOutlined />}
        actions={
          isReady && (
            <Button size="small" icon={<DeleteOutlined />} onClick={handleClear}>
              New Session
            </Button>
          )
        }
      />

      <div className="chatbot-content">
        <div className="chatbot-main">
          {/* Sidebar */}
          <div className="chatbot-sidebar">
            {/* Documents Panel */}
            <div className="chatbot-panel">
              <div className="chatbot-panel-header">
                <span className="chatbot-panel-title">
                  <CloudUploadOutlined className="chatbot-panel-title-icon" />
                  Documents
                </span>
                {isReady ? (
                  <span className="chatbot-panel-badge">{documents.length} loaded</span>
                ) : fileList.length > 0 ? (
                  <span className="chatbot-panel-badge pending">{fileList.length}/{MAX_FILES}</span>
                ) : null}
              </div>
              <div className="chatbot-panel-body">
                {!isReady ? (
                  <>
                    {/* File limits info */}
                    <div className="chatbot-limits-info">
                      <InfoCircleOutlined />
                      <span>Up to {MAX_FILES} files, {MAX_FILE_SIZE_MB}MB each</span>
                    </div>

                    {/* Supported formats */}
                    <div className="chatbot-formats">
                      <span className="format-tag">PDF</span>
                      <span className="format-tag">Word</span>
                      <span className="format-tag excel">Excel ★</span>
                      <span className="format-tag">Text</span>
                      <span className="format-tag">CSV</span>
                    </div>

                    {/* Excel specification hint */}
                    <div className="chatbot-excel-hint">
                      <strong>📊 Excel Specifications:</strong> Full support for specifications with 20+ columns and 100+ rows.
                      All columns analyzed with unique values, data types & statistics.
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={SUPPORTED_FORMATS.join(',')}
                      onChange={handleFileInputChange}
                      style={{ display: 'none' }}
                    />

                    <div
                      className="chatbot-upload-zone"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const files = e.dataTransfer.files;
                        if (files.length > 0) {
                          const errors: string[] = [];
                          const validFiles: UploadFile[] = [];

                          Array.from(files).forEach((file, idx) => {
                            if (fileList.length + validFiles.length >= MAX_FILES) {
                              errors.push(`Maximum ${MAX_FILES} files allowed`);
                              return;
                            }
                            const validation = validateFile(file);
                            if (!validation.valid) {
                              errors.push(`${file.name}: ${validation.error}`);
                              return;
                            }
                            validFiles.push({
                              uid: `${Date.now()}-${idx}`,
                              name: file.name,
                              size: file.size,
                              type: file.type,
                              status: 'done' as const,
                              originFileObj: file as RcFile,
                            });
                          });

                          if (errors.length > 0) {
                            setFileErrors(errors);
                            setTimeout(() => setFileErrors([]), 5000);
                          }
                          if (validFiles.length > 0) {
                            setFileList(prev => [...prev, ...validFiles]);
                          }
                        }
                      }}
                    >
                      <UploadOutlined className="chatbot-upload-icon" />
                      <div className="chatbot-upload-text">Drop files or click to upload</div>
                      <div className="chatbot-upload-hint">Multiple files supported</div>
                    </div>

                    {/* File errors */}
                    {fileErrors.length > 0 && (
                      <div className="chatbot-errors">
                        {fileErrors.map((err, i) => (
                          <div key={i} className="chatbot-error-item">
                            <WarningOutlined /> {err}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* File list */}
                    {fileList.length > 0 && (
                      <>
                        <div className="chatbot-file-summary">
                          <FileAddOutlined />
                          <span>{fileList.length} file(s) selected ({formatFileSize(totalFileSize)})</span>
                        </div>
                        <div className="chatbot-file-list">
                          {fileList.map(file => (
                            <div key={file.uid} className="chatbot-file-item">
                              <span className="chatbot-file-icon">{getFileIcon(file.name)}</span>
                              <div className="chatbot-file-info">
                                <div className="chatbot-file-name">{file.name}</div>
                                <div className="chatbot-file-meta">{formatFileSize(file.size || 0)}</div>
                              </div>
                              <DeleteOutlined
                                className="chatbot-file-remove"
                                onClick={() => handleRemoveFile(file.uid)}
                              />
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Progress bar */}
                    {isProcessing && (
                      <Progress
                        percent={uploadProgress}
                        size="small"
                        status="active"
                        style={{ marginTop: 12 }}
                      />
                    )}

                    <button
                      className="chatbot-process-btn"
                      onClick={handleProcessDocuments}
                      disabled={fileList.length === 0 || isProcessing}
                      style={{ marginTop: 16 }}
                    >
                      {isProcessing ? (
                        <><Spin size="small" /> Processing {fileList.length} file(s)...</>
                      ) : (
                        <>🚀 Analyze Documents</>
                      )}
                    </button>
                  </>
                ) : (
                  <div className="chatbot-file-list">
                    {documents.map(doc => (
                      <div key={doc.id} className="chatbot-file-item">
                        <span className="chatbot-file-icon">{getFileIcon(doc.filename)}</span>
                        <div className="chatbot-file-info">
                          <div className="chatbot-file-name">{doc.filename}</div>
                          <div className="chatbot-file-meta">
                            <CheckCircleOutlined style={{ color: '#16a34a', marginRight: 4 }} />
                            {formatFileSize(doc.size)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Settings Panel - Only show when ready */}
            {isReady && (
              <div className="chatbot-panel settings-panel">
                <div className="chatbot-panel-header">
                  <span className="chatbot-panel-title">
                    <SettingOutlined className="chatbot-panel-title-icon" />
                    Response Settings
                  </span>
                </div>
                <div className="chatbot-panel-body settings-body">
                  {/* Response Style */}
                  <div className="setting-item">
                    <label className="setting-label">Answer Style</label>
                    <Select
                      value={settings.responseStyle}
                      onChange={(val) => setSettings(s => ({ ...s, responseStyle: val }))}
                      style={{ width: '100%' }}
                      options={RESPONSE_STYLES.map(s => ({
                        value: s.value,
                        label: (
                          <Tooltip title={s.desc} placement="right">
                            <span>{s.label}</span>
                          </Tooltip>
                        ),
                      }))}
                    />
                  </div>

                  {/* Show Sources */}
                  <div className="setting-item row">
                    <label className="setting-label">Show Sources</label>
                    <Switch
                      checked={settings.showSources}
                      onChange={(checked) => setSettings(s => ({ ...s, showSources: checked }))}
                      size="small"
                    />
                  </div>

                  <div className="setting-hint">
                    <EyeOutlined style={{ marginRight: 4 }} />
                    Click any source to preview the exact content
                  </div>
                </div>
              </div>
            )}

            {/* Suggested Questions Panel */}
            {isReady && suggestedQuestions.length > 0 && (
              <div className="chatbot-panel suggestions-panel">
                <div className="chatbot-panel-header suggestions-header">
                  <span className="chatbot-panel-title">
                    <BulbOutlined className="chatbot-panel-title-icon suggestions-icon" />
                    Quick Questions
                  </span>
                </div>
                <div className="chatbot-panel-body suggestions-body">
                  {suggestedQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      className="chatbot-suggestion-btn"
                      onClick={() => handleAskQuestion(question)}
                      disabled={isTyping}
                    >
                      <span className="suggestion-number">{idx + 1}</span>
                      <span className="suggestion-text">{question}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chat Area */}
          <div className="chatbot-chat">
            <div className="chatbot-chat-header">
              <div className="chatbot-chat-title">
                <div className="chatbot-chat-icon">
                  <RobotOutlined />
                </div>
                <div>
                  <div className="chatbot-chat-name">Document Assistant</div>
                  {isReady && (
                    <div className="chatbot-chat-status">
                      Analyzing {documents.length} document(s)
                    </div>
                  )}
                </div>
              </div>
              {isReady && (
                <div className="chatbot-style-badge">
                  {settings.responseStyle === 'concise' ? '📝' :
                    settings.responseStyle === 'detailed' ? '📖' : '🔬'}
                  {settings.responseStyle}
                </div>
              )}
            </div>

            {!isReady ? (
              <div className="chatbot-empty">
                <CloudUploadOutlined className="chatbot-empty-icon" />
                <div className="chatbot-empty-title">Upload Your Documents</div>
                <div className="chatbot-empty-text">
                  Upload up to {MAX_FILES} documents and I'll answer any questions about their content.
                </div>
                <div className="chatbot-empty-formats">
                  Supports PDF, Word, Excel, Text, CSV, and more
                </div>
              </div>
            ) : (
              <>
                <div className="chatbot-messages" ref={chatContainerRef}>
                  {messages.map(msg => (
                    <div key={msg.id} className={`chatbot-message ${msg.type}`}>
                      <div className="chatbot-avatar">
                        {msg.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      </div>
                      <div className="chatbot-message-content">
                        {msg.type !== 'system' && (
                          <div className="chatbot-message-header">
                            <span className="chatbot-message-name">
                              {msg.type === 'user' ? 'You' : 'Assistant'}
                            </span>
                            <span className="chatbot-message-time">
                              {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        <div
                          className="chatbot-message-bubble"
                          dangerouslySetInnerHTML={{
                            __html: msg.content
                              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                              .replace(/\n/g, '<br />')
                          }}
                        />

                        {/* Source Snippets with Preview */}
                        {msg.sourceSnippets && msg.sourceSnippets.length > 0 && (
                          <div className="chatbot-source-cards">
                            <div className="source-cards-header">
                              <FileSearchOutlined /> Click to view source content
                            </div>
                            {msg.sourceSnippets.map(snippet => (
                              <SourceCard
                                key={snippet.id}
                                snippet={snippet}
                                onViewClick={handleViewSource}
                              />
                            ))}
                          </div>
                        )}

                        {/* Fallback to simple sources if no snippets */}
                        {!msg.sourceSnippets && msg.sources && msg.sources.length > 0 && (
                          <div className="chatbot-citations">
                            <div className="chatbot-citations-header">📄 Sources</div>
                            {msg.sources.map((s, i) => (
                              <div key={i} className="chatbot-citation-item">{s}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="chatbot-message assistant">
                      <div className="chatbot-avatar"><RobotOutlined /></div>
                      <div className="chatbot-message-content">
                        <div className="chatbot-typing">
                          <div className="chatbot-typing-dots">
                            <div className="chatbot-typing-dot" />
                            <div className="chatbot-typing-dot" />
                            <div className="chatbot-typing-dot" />
                          </div>
                          <span className="chatbot-typing-text">Analyzing documents...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="chatbot-input-area">
                  <div className="chatbot-input-wrapper">
                    <textarea
                      className="chatbot-input"
                      value={currentMessage}
                      onChange={e => setCurrentMessage(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Ask anything about your documents..."
                      disabled={isTyping}
                    />
                    <button
                      className="chatbot-send-btn"
                      onClick={handleSendMessage}
                      disabled={!currentMessage.trim() || isTyping}
                    >
                      <SendOutlined />
                    </button>
                  </div>
                  <div className="chatbot-input-hint">
                    Press Enter to send • Shift+Enter for new line
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Source Preview Modal */}
      <SourcePreviewModal
        visible={previewModalVisible}
        snippet={selectedSnippet}
        onClose={() => setPreviewModalVisible(false)}
      />
    </div>
  );
};

export default StudyChatbotTab;
