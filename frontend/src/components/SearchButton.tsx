import React, { useState, useEffect } from 'react';
import { Modal, Input, List, Empty, Spin, Tag } from 'antd';
import { SearchOutlined, FileTextOutlined, CodeOutlined, FolderOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { api } from '../services/api';
import './SearchButton.css';

interface SearchResult {
  type: 'variable' | 'code' | 'study' | 'dataset' | 'help';
  title: string;
  description?: string;
  study_id?: string;
  url: string;
  relevance_score?: number;
}

export const SearchButton: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Keyboard shortcut: Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setVisible(true);
      }

      // ESC to close
      if (e.key === 'Escape' && visible) {
        setVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible]);

  // Search as user types (debounced)
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get(`/api/v1/search?q=${encodeURIComponent(query)}&limit=20`);
        setResults(response.data.results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const getResultIcon = (type: string) => {
    const icons: Record<string, any> = {
      variable: <CodeOutlined style={{ color: '#1890ff' }} />,
      code: <FileTextOutlined style={{ color: '#52c41a' }} />,
      study: <FolderOutlined style={{ color: '#faad14' }} />,
      dataset: <FileTextOutlined style={{ color: '#722ed1' }} />,
      help: <QuestionCircleOutlined style={{ color: '#eb2f96' }} />
    };
    return icons[type] || <SearchOutlined />;
  };

  const getTypeTag = (type: string) => {
    const colors: Record<string, string> = {
      variable: 'blue',
      code: 'green',
      study: 'gold',
      dataset: 'purple',
      help: 'magenta'
    };
    return <Tag color={colors[type]}>{type.toUpperCase()}</Tag>;
  };

  const handleResultClick = (result: SearchResult) => {
    window.location.href = result.url;
    setVisible(false);
    setQuery('');
  };

  return (
    <>
      <div className="search-button" onClick={() => setVisible(true)}>
        <SearchOutlined className="search-icon" />
        <span className="search-hint">Search</span>
        <kbd className="search-kbd">⌘K</kbd>
      </div>

      <Modal
        open={visible}
        onCancel={() => {
          setVisible(false);
          setQuery('');
          setResults([]);
        }}
        footer={null}
        width={700}
        className="search-modal"
        closable={false}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          placeholder="Search variables, code, studies, help..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          size="large"
          autoFocus
          className="search-input"
        />

        <div className="search-results">
          {loading ? (
            <div className="search-loading">
              <Spin tip="Searching..." />
            </div>
          ) : query.length === 0 ? (
            <div className="search-suggestions">
              <div className="search-suggestion-title">Quick Actions</div>
              <div className="search-suggestion-items">
                <div className="search-suggestion-item">
                  <SearchOutlined /> Search across all studies
                </div>
                <div className="search-suggestion-item">
                  <FileTextOutlined /> Find variables and code
                </div>
                <div className="search-suggestion-item">
                  <QuestionCircleOutlined /> Get help and documentation
                </div>
              </div>
              <div className="search-tip">
                <kbd>⌘K</kbd> to open • <kbd>↑↓</kbd> to navigate • <kbd>↵</kbd> to select • <kbd>ESC</kbd> to close
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={`No results found for "${query}"`}
              style={{ padding: '40px 20px' }}
            />
          ) : (
            <List
              dataSource={results}
              renderItem={(item, index) => (
                <div
                  className="search-result-item"
                  onClick={() => handleResultClick(item)}
                  tabIndex={index}
                >
                  <div className="search-result-icon">{getResultIcon(item.type)}</div>
                  <div className="search-result-content">
                    <div className="search-result-header">
                      <span className="search-result-title">{item.title}</span>
                      {getTypeTag(item.type)}
                    </div>
                    {item.description && (
                      <div className="search-result-desc">{item.description}</div>
                    )}
                  </div>
                </div>
              )}
            />
          )}
        </div>
      </Modal>
    </>
  );
};
