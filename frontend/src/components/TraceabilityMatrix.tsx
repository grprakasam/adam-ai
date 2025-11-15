import React, { useState } from 'react';
import { Table, Tag, Space, Button, Tooltip, Progress, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EyeOutlined,
  CodeOutlined,
  BookOutlined,
  AimOutlined,
} from '@ant-design/icons';
import type { TraceabilityVariable } from '../types/traceability';

const { Text } = Typography;

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
    <Table<TraceabilityVariable>
      columns={columns}
      dataSource={variables}
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
    />
  );
};
