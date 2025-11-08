import { useState } from 'react';
import { Card, Input, Button } from 'antd';
import { MessageOutlined, CloseOutlined } from '@ant-design/icons';
import './ChatPanel.css';

interface ChatPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

const ChatPanel = ({ isOpen, onToggle }: ChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'ai',
      content: 'Hello! I can help you with ADSL derivations, rule clarifications, and code suggestions.'
    }
  ]);
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (!inputValue.trim()) return;

    setMessages([...messages, { role: 'user', content: inputValue }]);
    setInputValue('');

    // Simulate AI response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: 'I understand your question. Let me help you with that...'
      }]);
    }, 1000);
  };

  return (
    <>
      {!isOpen && (
        <Button
          type="primary"
          shape="circle"
          size="large"
          icon={<MessageOutlined />}
          onClick={onToggle}
          className="chat-toggle"
        />
      )}

      {isOpen && (
        <Card
          title="AI Assistant"
          extra={<Button type="text" icon={<CloseOutlined />} onClick={onToggle} size="small" />}
          className="chat-panel"
          styles={{ body: { padding: 0, height: '100%', display: 'flex', flexDirection: 'column' } }}
        >
          <div className="chat-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>
          <div className="chat-input-container">
            <Input
              placeholder="Ask a question..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onPressEnter={handleSend}
              suffix={
                <Button type="primary" size="small" onClick={handleSend}>
                  Send
                </Button>
              }
            />
          </div>
        </Card>
      )}
    </>
  );
};

export default ChatPanel;
