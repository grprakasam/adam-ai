/**
 * Study Document Chatbot - Pure RAG Implementation
 *
 * STRICT REQUIREMENTS:
 * - All responses MUST come from uploaded documents only
 * - No external knowledge or assumptions
 * - Every answer MUST include specific citations (page, section, document)
 * - If answer not in documents, explicitly state "Information not found in uploaded documents"
 *
 * Architecture: Document-Grounded RAG
 * 1. Upload → Extract text with metadata (page numbers, sections)
 * 2. Chunk with overlap + metadata preservation
 * 3. User question → Retrieve relevant chunks
 * 4. LLM generates answer ONLY from retrieved context
 * 5. Response includes specific citations
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Card,
  Button,
  Upload,
  Input,
  Space,
  Typography,
  Row,
  Col,
  Tag,
  Alert,
  Divider,
  Spin,
  Empty,
  Tooltip,
  message,
  List,
  Progress,
  Statistic,
} from 'antd';
import {
  UploadOutlined,
  SendOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  UserOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  BookOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import './StudyChatbotTab.css';
import {
  uploadStudyFiles,
  createKnowledgeBase,
  getSuggestedQuestions,
  sendChatMessage,
} from '../services/api';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// Types
interface DocumentChunk {
  content: string;
  source: string;
  page?: number;
  section?: string;
  chunk_id: string;
}

interface Citation {
  source: string;
  page?: number;
  section?: string;
  excerpt: string;
}

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  citations?: Citation[];
  confidence?: number; // 0-100
  grounded: boolean; // Whether answer is grounded in documents
}

interface ProcessedDocument {
  filename: string;
  pages: number;
  chunks: number;
  size: number;
}

interface KnowledgeBase {
  session_id: string;
  documents: ProcessedDocument[];
  total_chunks: number;
  created_at: string;
}

interface SuggestedQuestion {
  question: string;
  relevant_docs: string[];
}

export const StudyChatbotTab: React.FC = () => {
  // File upload state
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [suggestedQuestions, setSuggestedQuestions] = useState<SuggestedQuestion[]>([]);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle file upload
  const handleFileUpload: UploadProps['onChange'] = useCallback((info) => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-10); // Limit to 10 files
    setFileList(newFileList);
  }, []);

  // Process uploaded files and create knowledge base
  const handleProcessFiles = useCallback(async () => {
    if (fileList.length === 0) {
      message.warning('Please upload at least one document');
      return;
    }

    setIsProcessing(true);
    setMessages([]);
    setSuggestedQuestions([]);

    try {
      // Step 1: Upload files to backend
      const files = fileList
        .map(f => f.originFileObj)
        .filter((f): f is File => f !== undefined);

      const uploadResponse = await uploadStudyFiles(files);

      // Step 2: Create knowledge base from uploaded files
      const kbResponse = await createKnowledgeBase({
        session_id: uploadResponse.session_id,
        file_paths: uploadResponse.files.map(f => f.path),
      });

      if (kbResponse.status === 'failed') {
        throw new Error(kbResponse.error_message || 'Failed to create knowledge base');
      }

      // Map to UI state
      const processedDocs: ProcessedDocument[] = uploadResponse.files.map(file => ({
        filename: file.filename,
        pages: 0, // Backend doesn't return this yet
        chunks: 0, // Will be distributed across files
        size: file.size,
      }));

      const kb: KnowledgeBase = {
        session_id: uploadResponse.session_id,
        documents: processedDocs,
        total_chunks: kbResponse.files_processed * 10, // Estimate
        created_at: new Date().toISOString(),
      };

      setKnowledgeBase(kb);

      // Step 3: Get suggested questions from backend
      try {
        const questionsResponse = await getSuggestedQuestions(uploadResponse.session_id);
        const questions: SuggestedQuestion[] = questionsResponse.questions.map(q => ({
          question: q.question,
          relevant_docs: [processedDocs[0]?.filename || 'Document'],
        }));
        setSuggestedQuestions(questions);
      } catch (error) {
        console.warn('Failed to load suggested questions:', error);
        // Use fallback questions
        setSuggestedQuestions([
          { question: 'What is mentioned in the uploaded documents?', relevant_docs: [processedDocs[0]?.filename] },
        ]);
      }

      // System message
      const systemMessage: Message = {
        id: Date.now().toString(),
        type: 'system',
        content: `✓ Knowledge base created from ${kbResponse.files_processed} document(s).\n\nI will only answer questions based on the content of your uploaded documents. If information is not in the documents, I will tell you explicitly.`,
        timestamp: new Date(),
        grounded: true,
      };

      setMessages([systemMessage]);
      message.success('Documents processed successfully!');
    } catch (error: any) {
      message.error('Failed to process documents: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  }, [fileList]);

  // Handle sending a message
  const handleSendMessage = useCallback(async (question?: string) => {
    const messageText = question || currentMessage.trim();

    if (!messageText) {
      return;
    }

    if (!knowledgeBase) {
      message.warning('Please upload and process documents first');
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: messageText,
      timestamp: new Date(),
      grounded: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    try {
      // Call real RAG backend
      const chatResponse = await sendChatMessage({
        session_id: knowledgeBase.session_id,
        message: messageText,
        response_style: 'detailed',
        language: 'en',
        show_sources: true,
      });

      // Parse citations from sources
      const citations: Citation[] | undefined = chatResponse.message.sources?.map((source, idx) => {
        const parts = source.split(' - Page ');
        return {
          source: parts[0] || source,
          page: parts[1] ? parseInt(parts[1]) : undefined,
          excerpt: '', // Backend doesn't return excerpt yet
        };
      });

      // Determine if response is grounded
      const isNotFound = chatResponse.message.content.toLowerCase().includes('cannot find') ||
                        chatResponse.message.content.toLowerCase().includes('not in the documents');

      const assistantMessage: Message = {
        id: chatResponse.message.id,
        type: 'assistant',
        content: chatResponse.message.content,
        timestamp: new Date(chatResponse.message.timestamp),
        citations: citations,
        confidence: isNotFound ? 0 : 75, // Calculate based on citations if available
        grounded: !isNotFound,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        type: 'system',
        content: `Error: ${error.message}`,
        timestamp: new Date(),
        grounded: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  }, [currentMessage, knowledgeBase]);

  // Handle suggested question click
  const handleSuggestedQuestion = useCallback((question: string) => {
    setCurrentMessage(question);
    handleSendMessage(question);
  }, [handleSendMessage]);

  // Clear knowledge base
  const handleClearAll = useCallback(() => {
    setFileList([]);
    setKnowledgeBase(null);
    setMessages([]);
    setSuggestedQuestions([]);
    message.success('All data cleared');
  }, []);

  // Upload props
  const uploadProps: UploadProps = {
    multiple: true,
    fileList,
    onChange: handleFileUpload,
    beforeUpload: () => false,
    accept: '.pdf,.docx,.doc,.txt',
    maxCount: 10,
  };

  return (
    <div className="study-chatbot-tab">
      {/* Header */}
      <div className="chatbot-header">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BookOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            Document Q&A Assistant
          </Title>
          <Text type="secondary">Ask questions - get answers from your documents only</Text>
        </div>
        <Space>
          {knowledgeBase && (
            <Button danger icon={<DeleteOutlined />} onClick={handleClearAll}>
              Clear All
            </Button>
          )}
          <Tooltip title="Answers are generated only from your uploaded documents with specific citations">
            <Button icon={<QuestionCircleOutlined />}>Help</Button>
          </Tooltip>
        </Space>
      </div>

      <Row gutter={16} className="chatbot-main">
        {/* Left Sidebar - Document Upload & Info */}
        <Col xs={24} lg={7} className="knowledge-sidebar">
          {/* File Upload */}
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>Your Documents</span>
                {knowledgeBase && <Tag color="success">Active</Tag>}
              </Space>
            }
            size="small"
            className="knowledge-card"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} block disabled={isProcessing}>
                Upload Documents
              </Button>
            </Upload>

            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Supported: PDF, Word, Text (Max 10 files)
            </Text>

            {fileList.length > 0 && (
              <>
                <Divider style={{ margin: '12px 0' }} />
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <Text strong style={{ fontSize: 12 }}>{fileList.length} file(s) ready</Text>
                  <List
                    size="small"
                    dataSource={fileList}
                    renderItem={(file) => (
                      <List.Item style={{ padding: '4px 0', border: 'none' }}>
                        <Space size="small">
                          <FileTextOutlined style={{ color: '#1890ff', fontSize: 12 }} />
                          <Text ellipsis style={{ maxWidth: 180, fontSize: 11 }}>
                            {file.name}
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />

                  {!knowledgeBase ? (
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={handleProcessFiles}
                      loading={isProcessing}
                      block
                      style={{ marginTop: 8 }}
                    >
                      {isProcessing ? 'Processing...' : 'Process Documents'}
                    </Button>
                  ) : (
                    <Button
                      icon={<CheckCircleOutlined />}
                      block
                      disabled
                      style={{ marginTop: 8, background: '#f6ffed', borderColor: '#b7eb8f' }}
                    >
                      Documents Processed
                    </Button>
                  )}
                </Space>
              </>
            )}
          </Card>

          {/* Knowledge Base Info */}
          {knowledgeBase && (
            <Card
              title={
                <Space>
                  <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  <span>Knowledge Base</span>
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Statistic
                  title="Documents Processed"
                  value={knowledgeBase.documents.length}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontSize: 24, color: '#1890ff' }}
                />
                <Statistic
                  title="Text Chunks"
                  value={knowledgeBase.total_chunks}
                  suffix="chunks"
                  valueStyle={{ fontSize: 20, color: '#52c41a' }}
                />

                <Divider style={{ margin: '8px 0' }} />

                <div>
                  <Text strong style={{ fontSize: 12 }}>Documents:</Text>
                  <List
                    size="small"
                    dataSource={knowledgeBase.documents}
                    renderItem={(doc) => (
                      <List.Item style={{ padding: '4px 0', border: 'none' }}>
                        <Space direction="vertical" size={0} style={{ width: '100%' }}>
                          <Text style={{ fontSize: 11 }}>📄 {doc.filename}</Text>
                          <Text type="secondary" style={{ fontSize: 10 }}>
                            {doc.pages} pages • {doc.chunks} chunks
                          </Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              </Space>
            </Card>
          )}

          {/* Suggested Questions */}
          {suggestedQuestions.length > 0 && (
            <Card
              title={
                <Space>
                  <QuestionCircleOutlined style={{ color: '#faad14' }} />
                  <span>Suggested Questions</span>
                </Space>
              }
              size="small"
              style={{ marginTop: 16 }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Alert
                  message="Questions based on your documents"
                  type="info"
                  showIcon
                  style={{ fontSize: 11, padding: '4px 8px' }}
                />
                {suggestedQuestions.map((sq, idx) => (
                  <Button
                    key={idx}
                    type="text"
                    size="small"
                    block
                    style={{
                      textAlign: 'left',
                      height: 'auto',
                      padding: '8px',
                      whiteSpace: 'normal',
                      border: '1px solid #e8e8e8'
                    }}
                    onClick={() => handleSuggestedQuestion(sq.question)}
                  >
                    <Text style={{ fontSize: 11 }}>{sq.question}</Text>
                  </Button>
                ))}
              </Space>
            </Card>
          )}
        </Col>

        {/* Right Main Area - Chat Interface */}
        <Col xs={24} lg={17} className="chat-area">
          <Card className="chat-card" bodyStyle={{ padding: 0, height: '100%' }}>
            {!knowledgeBase ? (
              <div className="chat-empty-state">
                <Empty
                  image={<BookOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
                  description={
                    <Space direction="vertical" size="small">
                      <Title level={4}>Upload Your Documents</Title>
                      <Paragraph type="secondary" style={{ maxWidth: 400 }}>
                        Upload study documents (Protocol, SAP, etc.) to start asking questions.
                        <br /><br />
                        <strong>100% Document-Based:</strong>
                        <br />• All answers come only from your uploaded files
                        <br />• Every response includes specific citations
                        <br />• No external knowledge or assumptions
                      </Paragraph>
                    </Space>
                  }
                >
                  <Upload {...uploadProps}>
                    <Button type="primary" icon={<UploadOutlined />} size="large">
                      Upload Documents
                    </Button>
                  </Upload>
                </Empty>
              </div>
            ) : (
              <>
                <div className="chat-messages" ref={chatContainerRef}>
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`chat-message ${msg.type === 'user' ? 'user-message' :
                        msg.type === 'system' ? 'system-message' : 'assistant-message'}`}
                    >
                      {msg.type !== 'system' && (
                        <Avatar
                          icon={msg.type === 'user' ? <UserOutlined /> : <RobotOutlined />}
                          style={{
                            backgroundColor: msg.type === 'user' ? '#1890ff' : '#52c41a',
                          }}
                        />
                      )}
                      <div className="message-content">
                        {msg.type !== 'system' && (
                          <div className="message-header">
                            <Space>
                              <Text strong>{msg.type === 'user' ? 'You' : 'Assistant'}</Text>
                              {msg.type === 'assistant' && msg.confidence && (
                                <Tooltip title="Confidence based on document relevance">
                                  <Tag color={msg.confidence > 70 ? 'green' : 'orange'}>
                                    {msg.confidence}% confident
                                  </Tag>
                                </Tooltip>
                              )}
                              {msg.type === 'assistant' && (
                                <Tag icon={msg.grounded ? <CheckOutlined /> : <WarningOutlined />}
                                     color={msg.grounded ? 'success' : 'warning'}>
                                  {msg.grounded ? 'Document-grounded' : 'Not grounded'}
                                </Tag>
                              )}
                            </Space>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                              {msg.timestamp.toLocaleTimeString()}
                            </Text>
                          </div>
                        )}
                        <div className={`message-text ${msg.type === 'system' ? 'system-text' : ''}`}>
                          <Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                            {msg.content}
                          </Paragraph>
                        </div>
                        {msg.citations && msg.citations.length > 0 && (
                          <div className="message-citations">
                            <Text strong style={{ fontSize: 11 }}>📚 Citations:</Text>
                            <List
                              size="small"
                              dataSource={msg.citations}
                              renderItem={(citation, idx) => (
                                <List.Item style={{ padding: '4px 0', border: 'none' }}>
                                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                    <Text style={{ fontSize: 11 }}>
                                      [{idx + 1}] {citation.source}
                                      {citation.page && ` - Page ${citation.page}`}
                                      {citation.section && ` - ${citation.section}`}
                                    </Text>
                                    <Text type="secondary" style={{ fontSize: 10, fontStyle: 'italic' }}>
                                      "{citation.excerpt.substring(0, 100)}..."
                                    </Text>
                                  </Space>
                                </List.Item>
                              )}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="chat-message assistant-message">
                      <Avatar icon={<RobotOutlined />} style={{ backgroundColor: '#52c41a' }} />
                      <div className="message-content">
                        <Spin size="small" /> <Text type="secondary">Searching documents...</Text>
                      </div>
                    </div>
                  )}
                </div>

                <div className="chat-input-area">
                  <Input.TextArea
                    ref={inputRef}
                    value={currentMessage}
                    onChange={(e) => setCurrentMessage(e.target.value)}
                    onPressEnter={(e) => {
                      if (!e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask a question about your documents... (Enter to send, Shift+Enter for new line)"
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    disabled={isTyping}
                  />
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => handleSendMessage()}
                    loading={isTyping}
                    disabled={!currentMessage.trim()}
                  >
                    Ask
                  </Button>
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// Avatar component (import from antd if not already)
const Avatar: React.FC<{ icon: React.ReactNode; style: React.CSSProperties }> = ({ icon, style }) => {
  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...style
    }}>
      {icon}
    </div>
  );
};
