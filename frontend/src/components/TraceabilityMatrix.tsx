import React, { useState, useMemo } from 'react';
import { Table, Tag, Space, Button, Tooltip, Progress, Typography, Input, Card, Collapse, Badge } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  CodeOutlined,
  BookOutlined,
  AimOutlined,
  SearchOutlined,
  FilterOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import type { TraceabilityVariable } from '../types/traceability';
import './TraceabilityMatrix.css';

const { Text } = Typography;
const { Panel } = Collapse;

interface TraceabilityMatrixProps {
  variables: TraceabilityVariable[];
  onVariableSelect?: (variable: string) => void;
}

export const TraceabilityMatrix: React.FC<TraceabilityMatrixProps> = ({
  variables,
  onVariableSelect,
}) => {
  const [filteredInfo, setFilteredInfo] = useState<Record<string, any>>({});
  const [sortedInfo, setSortedInfo] = useState<Record<string, any>>({});
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedConfidence, setSelectedConfidence] = useState<string[]>([]);

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'Subject & Study Identifiers': 'blue',
      'Demographics': 'cyan',
      'Treatment': 'purple',
      'Dates and Times': 'orange',
      'Flags': 'green',
      'Other Variables': 'default',
    };
    return colorMap[category] || 'default';
  };

  const getConfidenceStatus = (confidence: number) => {
    if (confidence > 0.8) return 'success';
    if (confidence > 0.5) return 'normal';
    return 'exception';
  };

  const truncate = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const uniqueCategories = Array.from(new Set(variables.map(v => v.category)));

  // Filter variables based on search and selected filters
  const filteredVariables = useMemo(() => {
    return variables.filter(v => {
      // Search filter
      const matchesSearch = searchText === '' || 
        v.variable_name.toLowerCase().includes(searchText.toLowerCase()) ||
        v.label.toLowerCase().includes(searchText.toLowerCase()) ||
        v.algorithm.toLowerCase().includes(searchText.toLowerCase());
      
      // Category filter
      const matchesCategory = selectedCategories.length === 0 || 
        selectedCategories.includes(v.category);
      
      // Confidence filter
      let matchesConfidence = selectedConfidence.length === 0;
      if (!matchesConfidence) {
        if (selectedConfidence.includes('high') && v.confidence > 0.8) matchesConfidence = true;
        if (selectedConfidence.includes('medium') && v.confidence >= 0.5 && v.confidence <= 0.8) matchesConfidence = true;
        if (selectedConfidence.includes('low') && v.confidence < 0.5) matchesConfidence = true;
      }
      
      return matchesSearch && matchesCategory && matchesConfidence;
    });
  }, [variables, searchText, selectedCategories, selectedConfidence]);

  // Count variables by category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    variables.forEach(v => {
      counts[v.category] = (counts[v.category] || 0) + 1;
    });
    return counts;
  }, [variables]);

  // Count by confidence
  const confidenceCounts = useMemo(() => {
    return {
      high: variables.filter(v => v.confidence > 0.8).length,
      medium: variables.filter(v => v.confidence >= 0.5 && v.confidence <= 0.8).length,
      low: variables.filter(v => v.confidence < 0.5).length,
    };
  }, [variables]);

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleConfidence = (level: string) => {
    setSelectedConfidence(prev => 
      prev.includes(level)
        ? prev.filter(c => c !== level)
        : [...prev, level]
    );
  };

  const columns: ColumnsType<TraceabilityVariable> = [
    {
      title: 'ADAM Variable',
      dataIndex: 'variable_name',
      key: 'variable',
      width: 150,
      fixed: 'left',
      sorter: (a, b) => a.variable_name.localeCompare(b.variable_name),
      sortOrder: sortedInfo.columnKey === 'variable' ? sortedInfo.order : null,
      render: (text, record) => (
        <Space>
          <Tooltip title={record.label}>
            <Text strong>{text}</Text>
          </Tooltip>
          {record.is_key && <Tag color="red">Key</Tag>}
          {record.is_required && <Tag color="blue">Required</Tag>}
        </Space>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 180,
      filters: uniqueCategories.map(c => ({ text: c, value: c })),
      filteredValue: filteredInfo.category || null,
      onFilter: (value, record) => record.category === value,
      render: (category) => (
        <Tag color={getCategoryColor(category)}>{category}</Tag>
      ),
    },
    {
      title: 'Source SDTM',
      dataIndex: 'sources',
      key: 'sources',
      width: 180,
      render: (sources) => (
        <Space direction="vertical" size={2}>
          {sources.slice(0, 2).map((s: any, i: number) => (
            <Space key={i} size={4}>
              <Tag color="blue">{s.domain}</Tag>
              {s.variable && <Text code style={{ fontSize: 11 }}>{s.variable}</Text>}
            </Space>
          ))}
          {sources.length > 2 && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              +{sources.length - 2} more
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Derivation Algorithm',
      dataIndex: 'algorithm',
      key: 'algorithm',
      ellipsis: { showTitle: false },
      render: (algorithm, record) => (
        <Tooltip title={algorithm} placement="topLeft">
          <Text style={{ fontSize: 12 }}>{truncate(algorithm, 60)}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'ADAM IG Rule',
      dataIndex: 'rule_refs',
      key: 'rule_refs',
      width: 150,
      render: (refs) => (
        <Space direction="vertical" size={2}>
          {refs.slice(0, 2).map((ref: string, i: number) => (
            <Tag
              key={i}
              color="gold"
              icon={<BookOutlined />}
              style={{ fontSize: 10 }}
            >
              {ref.split('§')[1] || ref.split('Section')[1] || 'Rule'}
            </Tag>
          ))}
          {refs.length > 2 && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              +{refs.length - 2} more
            </Text>
          )}
          {refs.length === 0 && <Text type="secondary">—</Text>}
        </Space>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code_refs',
      key: 'code_refs',
      width: 80,
      render: (refs) =>
        refs.length > 0 ? (
          <Tag icon={<CodeOutlined />} color="processing">
            {refs[0].language}
          </Tag>
        ) : (
          <Text type="secondary">—</Text>
        ),
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 140,
      sorter: (a, b) => a.confidence - b.confidence,
      sortOrder: sortedInfo.columnKey === 'confidence' ? sortedInfo.order : null,
      render: (confidence) => (
        <Progress
          percent={Math.round(confidence * 100)}
          size="small"
          status={getConfidenceStatus(confidence)}
          format={(percent) => `${percent}%`}
          style={{ marginBottom: 0 }}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onVariableSelect?.(record.variable_name)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setFilteredInfo(filters);
    setSortedInfo(sorter);
  };

  return (
    <div className="traceability-matrix-container">
      {/* Filter Sidebar */}
      <div className={`filter-sidebar ${showFilters ? 'visible' : 'hidden'}`}>
        <div className="filter-header">
          <div className="filter-title">
            <FilterOutlined /> Filters & Categories
          </div>
          <Button 
            type="text" 
            icon={<MenuFoldOutlined />} 
            onClick={() => setShowFilters(false)}
            size="small"
          />
        </div>

        {/* Search */}
        <div className="filter-section">
          <Input
            placeholder="Search variables..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            className="search-input"
          />
        </div>

        {/* Category Filter */}
        <Collapse defaultActiveKey={['categories', 'confidence']} ghost>
          <Panel header={<strong>📊 By Category</strong>} key="categories">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {uniqueCategories.map(category => (
                <div
                  key={category}
                  className={`filter-item ${selectedCategories.includes(category) ? 'active' : ''}`}
                  onClick={() => toggleCategory(category)}
                >
                  <Tag color={getCategoryColor(category)} className="category-tag">
                    {category}
                  </Tag>
                  <Badge 
                    count={categoryCounts[category] || 0} 
                    style={{ backgroundColor: '#52c41a' }}
                  />
                </div>
              ))}
            </Space>
          </Panel>

          {/* Confidence Filter */}
          <Panel header={<strong>🎯 By Confidence</strong>} key="confidence">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <div
                className={`filter-item ${selectedConfidence.includes('high') ? 'active' : ''}`}
                onClick={() => toggleConfidence('high')}
              >
                <span>🟢 High (&gt;80%)</span>
                <Badge count={confidenceCounts.high} style={{ backgroundColor: '#52c41a' }} />
              </div>
              <div
                className={`filter-item ${selectedConfidence.includes('medium') ? 'active' : ''}`}
                onClick={() => toggleConfidence('medium')}
              >
                <span>🟡 Medium (50-80%)</span>
                <Badge count={confidenceCounts.medium} style={{ backgroundColor: '#faad14' }} />
              </div>
              <div
                className={`filter-item ${selectedConfidence.includes('low') ? 'active' : ''}`}
                onClick={() => toggleConfidence('low')}
              >
                <span>🔴 Low (&lt;50%)</span>
                <Badge count={confidenceCounts.low} style={{ backgroundColor: '#ff4d4f' }} />
              </div>
            </Space>
          </Panel>
        </Collapse>

        {/* Clear Filters */}
        {(selectedCategories.length > 0 || selectedConfidence.length > 0 || searchText) && (
          <Button 
            block 
            onClick={() => {
              setSelectedCategories([]);
              setSelectedConfidence([]);
              setSearchText('');
            }}
            className="clear-filters-btn"
          >
            Clear All Filters
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className={`matrix-content ${showFilters ? 'with-sidebar' : 'full-width'}`}>
        {/* Toggle Filter Button when hidden */}
        {!showFilters && (
          <Button
            type="primary"
            icon={<MenuUnfoldOutlined />}
            onClick={() => setShowFilters(true)}
            className="show-filters-btn"
          >
            Show Filters
          </Button>
        )}

        {/* Results Info */}
        <div className="results-info">
          <Text strong>
            Showing {filteredVariables.length} of {variables.length} variables
          </Text>
          {(selectedCategories.length > 0 || selectedConfidence.length > 0 || searchText) && (
            <Tag color="blue">Filtered</Tag>
          )}
        </div>

        {/* Table */}
        <Table<TraceabilityVariable>
          columns={columns}
          dataSource={filteredVariables}
          rowKey="variable_name"
          onChange={handleTableChange}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} variables`,
            pageSizeOptions: ['25', '50', '100', '200'],
          }}
          scroll={{ x: 1200, y: 600 }}
          size="small"
          bordered
          sticky
          className="variables-table"
        />
      </div>
    </div>
  );
};
