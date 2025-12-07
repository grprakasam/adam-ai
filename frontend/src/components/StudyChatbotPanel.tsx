import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Loader2, Eye, X, BookOpen, File, FileSpreadsheet } from 'lucide-react';
import { useStudyStore, Citation } from '../store/studyStore';
import './StudyChatbotPanel.css';

interface StudyChatbotPanelProps {
  studyId: string;
  compact?: boolean;
}

// Helper to get file icon based on document name
const getDocumentIcon = (docName: string) => {
  const lower = docName.toLowerCase();
  if (lower.includes('.xlsx') || lower.includes('.xls') || lower.includes('.csv')) {
    return <FileSpreadsheet size={16} className="source-icon excel" />;
  }
  if (lower.includes('.pdf')) {
    return <File size={16} className="source-icon pdf" />;
  }
  if (lower.includes('.docx') || lower.includes('.doc')) {
    return <FileText size={16} className="source-icon word" />;
  }
  return <BookOpen size={16} className="source-icon" />;
};

// Source Preview Modal Component
interface SourcePreviewModalProps {
  citation: Citation | null;
  onClose: () => void;
}

const SourcePreviewModal: React.FC<SourcePreviewModalProps> = ({ citation, onClose }) => {
  if (!citation) return null;

  return (
    <div className="source-modal-overlay" onClick={onClose}>
      <div className="source-modal" onClick={(e) => e.stopPropagation()}>
        <div className="source-modal-header">
          <div className="source-modal-title">
            {getDocumentIcon(citation.document_name)}
            <span>{citation.document_name}</span>
          </div>
          <button className="source-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="source-modal-meta">
          {citation.section && (
            <span className="source-meta-item">
              📁 {citation.section}
            </span>
          )}
          {citation.page_number && (
            <span className="source-meta-item">
              📄 Page {citation.page_number}
            </span>
          )}
        </div>

        <div className="source-modal-content">
          <div className="source-content-label">Source Content</div>
          <pre className="source-content-text">
            {citation.chunk_text || 'No content preview available.'}
          </pre>
        </div>
      </div>
    </div>
  );
};

// Source Card Component
interface SourceCardProps {
  citation: Citation;
  index: number;
  onViewClick: (citation: Citation) => void;
}

const SourceCard: React.FC<SourceCardProps> = ({ citation, onViewClick }) => {
  return (
    <div className="source-card" onClick={() => onViewClick(citation)}>
      <div className="source-card-left">
        {getDocumentIcon(citation.document_name)}
        <div className="source-card-info">
          <div className="source-card-name">{citation.document_name}</div>
          <div className="source-card-meta">
            {citation.section && <span>{citation.section}</span>}
            {citation.page_number && <span>Page {citation.page_number}</span>}
          </div>
        </div>
      </div>
      <div className="source-card-view">
        <Eye size={14} />
        <span>View</span>
      </div>
    </div>
  );
};

export const StudyChatbotPanel: React.FC<StudyChatbotPanelProps> = ({
  studyId,
  compact = false
}) => {
  const {
    sendChatMessage,
    chatMessages,
    activeChatSession,
    loadChatSessions,
    loadChatMessages
  } = useStudyStore();

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (studyId) {
      loadChatSessions(studyId);
    }
  }, [studyId, loadChatSessions]);

  useEffect(() => {
    if (activeChatSession) {
      loadChatMessages(studyId, activeChatSession);
    }
  }, [activeChatSession, studyId, loadChatMessages]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activeChatSession]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const message = input.trim();
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      await sendChatMessage(studyId, message, activeChatSession || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.');
      console.error('Error sending message:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleViewSource = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const currentMessages = activeChatSession ? (chatMessages[activeChatSession] || []) : [];

  if (compact) {
    return (
      <div className="study-chatbot-panel-compact">
        <div className="chat-messages-compact">
          {currentMessages.length === 0 ? (
            <div className="chat-empty">Start a conversation about your study documents</div>
          ) : (
            currentMessages.map((msg, idx) => (
              <div key={idx} className={`chat-message-compact ${msg.role}`}>
                <div className="message-content">{msg.content}</div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="message-sources-compact">
                    <FileText size={12} />
                    <span>{msg.citations.length} source(s) - click to view</span>
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="chat-message-compact assistant">
              <Loader2 className="spinner" size={16} />
            </div>
          )}
        </div>
        <div className="chat-input-compact">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about your study..."
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send size={16} />
          </button>
        </div>
        {error && <div className="chat-error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="study-chatbot-panel">
      <div className="chatbot-header">
        <h3>Study Assistant</h3>
        <p className="chatbot-subtitle">
          Ask questions about your study documents. Answers are based strictly on uploaded documents.
        </p>
      </div>

      <div className="chat-messages">
        {currentMessages.length === 0 ? (
          <div className="chat-empty">
            <FileText size={48} />
            <h4>No messages yet</h4>
            <p>Start a conversation by asking a question about your study documents.</p>
            <div className="suggested-questions">
              <p>Try asking:</p>
              <ul>
                <li>"What is the primary endpoint?"</li>
                <li>"What are the inclusion criteria?"</li>
                <li>"Describe the study design"</li>
              </ul>
            </div>
          </div>
        ) : (
          currentMessages.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.role}`}>
              <div className="message-header">
                <span className="message-role">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <span className="message-time">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="message-content">{msg.content}</div>

              {/* Source Cards with View Button */}
              {(() => {
                if (msg.role === 'assistant' && msg.citations) {
                  console.log(`Msg citations debug:`, msg.citations);
                }
                return null;
              })()}

              {msg.citations && msg.citations.length > 0 && (
                <div className="message-source-cards">
                  <div className="source-cards-header">
                    <BookOpen size={14} />
                    <span>Click to view source content</span>
                  </div>
                  {msg.citations.map((citation, cidx) => (
                    <SourceCard
                      key={cidx}
                      citation={citation}
                      index={cidx}
                      onViewClick={handleViewSource}
                    />
                  ))}
                </div>
              )}

              {/* Fallback: Show simple source indicator if no citations but has document_ids */}
              {(!msg.citations || msg.citations.length === 0) &&
                msg.source_document_ids && msg.source_document_ids.length > 0 && (
                  <div className="message-sources">
                    <FileText size={14} />
                    <span>Based on {msg.source_document_ids.length} document(s)</span>
                  </div>
                )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="chat-message assistant">
            <div className="message-content">
              <Loader2 className="spinner" size={20} />
              <span>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="chat-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask a question about your study documents..."
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
          className="send-button"
        >
          {isLoading ? <Loader2 className="spinner" size={20} /> : <Send size={20} />}
        </button>
      </div>

      {/* Source Preview Modal */}
      <SourcePreviewModal
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />
    </div>
  );
};

