/**
 * Document Chatbot - Simple, Working Version
 * 
 * Uses real API calls for document processing and chat.
 * Clean white theme with colorful suggestions in sidebar.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button, message, Spin } from 'antd';
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
} from '@ant-design/icons';
import type { UploadFile, RcFile } from 'antd/es/upload/interface';
import { PageHeader } from './PageHeader';
import './StudyChatbotTab.css';
import {
  uploadStudyFiles,
  createKnowledgeBase,
  sendChatMessage as apiSendChatMessage,
  getSuggestedQuestions,
} from '../services/api';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sources?: string[];
}

interface ProcessedDoc {
  id: string;
  filename: string;
  path: string;
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

// Colorful gradients for suggestion buttons
const SUGGESTION_COLORS = [
  { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', hover: '#5a67d8' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', hover: '#e53e3e' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', hover: '#0bc5ea' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', hover: '#38a169' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', hover: '#ed8936' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export const StudyChatbotTab: React.FC = () => {
  // File state
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<ProcessedDoc[]>([]);

  // Suggested questions (shown in sidebar)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle file selection
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadFile[] = Array.from(files).map((file, idx) => ({
      uid: `${Date.now()}-${idx}`,
      name: file.name,
      size: file.size,
      type: file.type,
      status: 'done' as const,
      originFileObj: file as RcFile,
    }));

    setFileList(prev => [...prev, ...newFiles].slice(-10));
    e.target.value = '';
  }, []);

  // Remove file
  const handleRemoveFile = useCallback((uid: string) => {
    setFileList(prev => prev.filter(f => f.uid !== uid));
  }, []);

  // Send a specific question (for clickable suggestions)
  const handleAskQuestion = useCallback(async (question: string) => {
    if (!question || !sessionId || isTyping) return;

    // Add user message
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
        response_style: 'detailed',
        show_sources: true,
      });

      const assistantMessage: Message = {
        id: response.message.id,
        type: 'assistant',
        content: response.message.content,
        timestamp: new Date(response.message.timestamp),
        sources: response.message.sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: `Sorry, I couldn't process that. Error: ${error.message || 'Unknown error'}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [sessionId, isTyping]);

  // Process documents - REAL API CALL
  const handleProcessDocuments = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning('Please upload at least one document');
      return;
    }

    setIsProcessing(true);

    try {
      const files: File[] = fileList
        .map(f => f.originFileObj as File | undefined)
        .filter((f): f is File => f !== undefined);

      if (files.length === 0) {
        throw new Error('No valid files to upload');
      }

      // Step 1: Upload files
      const uploadResponse = await uploadStudyFiles(files);
      console.log('Upload response:', uploadResponse);

      // Step 2: Create knowledge base
      const kbResponse = await createKnowledgeBase({
        session_id: uploadResponse.session_id,
        file_paths: uploadResponse.files.map(f => f.path),
      });
      console.log('KB response:', kbResponse);

      if (kbResponse.status === 'failed') {
        throw new Error(kbResponse.error_message || 'Failed to create knowledge base');
      }

      // Save session
      setSessionId(uploadResponse.session_id);
      setDocuments(uploadResponse.files.map(f => ({
        id: f.path,
        filename: f.filename,
        path: f.path,
      })));

      // Add welcome message
      setMessages([{
        id: 'welcome',
        type: 'system',
        content: `✨ Ready! ${kbResponse.files_processed} document(s) processed. Ask me anything or click a suggested question.`,
        timestamp: new Date(),
      }]);

      // Get suggested questions for sidebar
      try {
        const suggestionsResponse = await getSuggestedQuestions(uploadResponse.session_id);
        if (suggestionsResponse.questions.length > 0) {
          const questionList = suggestionsResponse.questions.slice(0, 5).map(q => q.question);
          setSuggestedQuestions(questionList);
        }
      } catch (e) {
        console.log('Could not get suggestions:', e);
      }

      message.success('Documents ready!');
    } catch (error: any) {
      console.error('Processing error:', error);
      message.error(error.message || 'Failed to process documents');
    } finally {
      setIsProcessing(false);
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
  }, []);

  const isReady = sessionId !== null;

  return (
    <div className="chatbot-container">
      <PageHeader
        title="Document Chat"
        subtitle="Ask questions about your documents"
        icon={<FileTextOutlined />}
        actions={
          isReady && (
            <Button size="small" icon={<DeleteOutlined />} onClick={handleClear}>
              Clear
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
                  <FileTextOutlined className="chatbot-panel-title-icon" />
                  Documents
                </span>
                {isReady && <span className="chatbot-panel-badge">Ready</span>}
              </div>
              <div className="chatbot-panel-body">
                {!isReady ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.txt,.xlsx,.xls,.csv,.rtf,.md"
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
                          const newFiles: UploadFile[] = Array.from(files).map((file, idx) => ({
                            uid: `${Date.now()}-${idx}`,
                            name: file.name,
                            size: file.size,
                            type: file.type,
                            status: 'done' as const,
                            originFileObj: file as RcFile,
                          }));
                          setFileList(prev => [...prev, ...newFiles].slice(-10));
                        }
                      }}
                    >
                      <UploadOutlined className="chatbot-upload-icon" />
                      <div className="chatbot-upload-text">Drop files or click</div>
                      <div className="chatbot-upload-hint">PDF, Word, Text, Excel</div>
                    </div>

                    {fileList.length > 0 && (
                      <div className="chatbot-file-list" style={{ marginTop: 12 }}>
                        {fileList.map(file => (
                          <div key={file.uid} className="chatbot-file-item">
                            <span className="chatbot-file-icon">{getFileIcon(file.name)}</span>
                            <div className="chatbot-file-info">
                              <div className="chatbot-file-name">{file.name}</div>
                            </div>
                            <DeleteOutlined
                              className="chatbot-file-remove"
                              onClick={() => handleRemoveFile(file.uid)}
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <button
                      className="chatbot-process-btn"
                      onClick={handleProcessDocuments}
                      disabled={fileList.length === 0 || isProcessing}
                      style={{ marginTop: 16 }}
                    >
                      {isProcessing ? (
                        <><Spin size="small" /> Processing...</>
                      ) : (
                        <>Start Chat</>
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
                            Processed
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Suggested Questions Panel - Only show when ready */}
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
                      style={{
                        background: SUGGESTION_COLORS[idx % SUGGESTION_COLORS.length].bg,
                      }}
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
                      {documents.length} document(s)
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!isReady ? (
              <div className="chatbot-empty">
                <FileTextOutlined className="chatbot-empty-icon" />
                <div className="chatbot-empty-title">Upload Documents</div>
                <div className="chatbot-empty-text">
                  Upload documents and I'll answer questions about their content.
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

                        {msg.sources && msg.sources.length > 0 && (
                          <div className="chatbot-citations">
                            <div className="chatbot-citations-header">Sources</div>
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
                          <span className="chatbot-typing-text">Thinking...</span>
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
                      placeholder="Ask about your documents..."
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
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyChatbotTab;
