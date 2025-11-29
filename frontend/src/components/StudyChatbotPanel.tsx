import React, { useState, useEffect, useRef } from 'react';
import { Send, FileText, Loader2 } from 'lucide-react';
import { useStudyStore } from '../store/studyStore';
import './StudyChatbotPanel.css';

interface StudyChatbotPanelProps {
  studyId: string;
  compact?: boolean;
}

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
                {msg.source_document_ids && msg.source_document_ids.length > 0 && (
                  <div className="message-sources">
                    <FileText size={12} />
                    {msg.source_document_ids.length} source(s)
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
              {msg.source_document_ids && msg.source_document_ids.length > 0 && (
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
    </div>
  );
};


