import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Radio,
  Space,
  Button,
  Empty,
  Tag,
  Tooltip,
  Popconfirm,
  message,
  Spin,
  Typography,
} from 'antd';
import {
  DatabaseOutlined,
  DeleteOutlined,
  FileOutlined,
  ReloadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { adamApi } from '../services/api';
import './CodeValidator.css';

const { Text } = Typography;

interface TestDatasetInfo {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  project_id?: string;
  file_count: number;
  total_size_bytes: number;
  files: Array<{
    filename: string;
    size_bytes: number;
    uploaded_at: string;
  }>;
}

interface DatasetSelectorProps {
  selectedDatasetId: string | null;
  onSelectDataset: (datasetId: string | null) => void;
  onOpenUploadModal: () => void;
  projectId?: string;
  refreshTrigger?: number;
}

export const DatasetSelector: React.FC<DatasetSelectorProps> = ({
  selectedDatasetId,
  onSelectDataset,
  onOpenUploadModal,
  projectId,
  refreshTrigger = 0,
}) => {
  const [datasets, setDatasets] = useState<TestDatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Load datasets
  const loadDatasets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adamApi.listTestDatasets(projectId);
      setDatasets(response.datasets);
    } catch (error: any) {
      console.error('Failed to load datasets:', error);
      message.error('Failed to load test datasets. Please try again or contact support.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Load datasets on mount and when refresh trigger changes
  useEffect(() => {
    loadDatasets();
  }, [loadDatasets, refreshTrigger]);

  // Delete dataset
  const handleDelete = async (datasetId: string) => {
    setDeleting(datasetId);
    try {
      await adamApi.deleteTestDataset(datasetId);
      message.success('Dataset deleted successfully');
      
      // If deleted dataset was selected, clear selection
      if (selectedDatasetId === datasetId) {
        onSelectDataset(null);
      }
      
      // Reload datasets
      await loadDatasets();
    } catch (error: any) {
      console.error('Failed to delete dataset:', error);
      message.error('Failed to delete dataset. Please ensure no active processes are using this dataset.');
    } finally {
      setDeleting(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Format date
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <Card
      size="small"
      title={
        <Space>
          <DatabaseOutlined aria-hidden="true" />
          <Text strong>Test Datasets</Text>
          <Tag color="blue" aria-label={`${datasets.length} datasets available`}>
            {datasets.length}
          </Tag>
        </Space>
      }
      extra={
        <Space>
          <Tooltip title="Refresh dataset list to see newly uploaded datasets">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              onClick={loadDatasets}
              loading={loading}
              aria-label="Refresh datasets"
            />
          </Tooltip>
          <Tooltip title="Upload new SDTM dataset files for validation">
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={onOpenUploadModal}
              aria-label="Upload new dataset"
            >
              Upload
            </Button>
          </Tooltip>
        </Space>
      }
      className="dataset-selector-card"
      aria-label="Test dataset selector"
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }} role="status" aria-live="polite">
          <Spin aria-label="Loading datasets" />
          <div style={{ marginTop: 8, color: '#666', fontSize: '12px' }}>Loading datasets...</div>
        </div>
      ) : datasets.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <Text>No test datasets available</Text>
              <div style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
                Upload SDTM datasets to enable code validation with real data.
                Datasets are stored securely and can be reused across sessions.
              </div>
            </div>
          }
          aria-label="No datasets available"
        >
          <Tooltip title="Upload your first dataset to get started">
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={onOpenUploadModal}
              aria-label="Upload your first dataset"
            >
              Upload Dataset
            </Button>
          </Tooltip>
        </Empty>
      ) : (
        <div role="radiogroup" aria-label="Select dataset for code execution">
          <div style={{ marginBottom: 16, padding: '8px 12px', background: '#f0f7ff', borderRadius: '4px', fontSize: '12px' }}>
            <strong>Tip:</strong> Select a dataset to mount data files into the execution environment, 
            or choose "No Dataset" for syntax-only validation.
          </div>
          <Radio.Group
            value={selectedDatasetId}
            onChange={(e) => onSelectDataset(e.target.value)}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* None option */}
              <div
                className={`dataset-item ${
                  selectedDatasetId === null ? 'dataset-item-selected' : ''
                }`}
                onClick={() => onSelectDataset(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectDataset(null);
                  }
                }}
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                aria-label="No dataset - validation only mode"
              >
                <div className="dataset-item-header">
                  <Radio value={null} aria-label="No dataset option">
                    <Text strong>No Dataset (Validation Only)</Text>
                  </Radio>
                </div>
                <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginLeft: 24 }}>
                  Execute code without mounting any test datasets. Suitable for syntax checking and logic validation.
                </Text>
              </div>

              {/* Dataset options */}
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  className={`dataset-item ${
                    selectedDatasetId === dataset.id ? 'dataset-item-selected' : ''
                  }`}
                  onClick={() => onSelectDataset(dataset.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDataset(dataset.id);
                    }
                  }}
                  tabIndex={0}
                  style={{ cursor: 'pointer' }}
                  aria-label={`Dataset: ${dataset.name}, ${dataset.file_count} files, ${formatFileSize(dataset.total_size_bytes)}`}
                >
                  <div className="dataset-item-header">
                    <Radio value={dataset.id} aria-label={`Select dataset ${dataset.name}`}>
                      <Text strong className="dataset-item-name">
                        {dataset.name}
                      </Text>
                    </Radio>
                    <Tooltip title="Delete this dataset permanently. This action cannot be undone.">
                      <Popconfirm
                        title="Delete Dataset?"
                        description={
                          <div style={{ maxWidth: 300 }}>
                            <p>Are you sure you want to delete <strong>{dataset.name}</strong>?</p>
                            <p style={{ marginBottom: 0 }}>
                              This action cannot be undone and will permanently remove all {dataset.file_count} file(s).
                            </p>
                          </div>
                        }
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          handleDelete(dataset.id);
                        }}
                        okText="Delete Permanently"
                        cancelText="Cancel"
                        okButtonProps={{ danger: true }}
                        placement="topRight"
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={deleting === dataset.id}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Delete dataset ${dataset.name}`}
                        />
                      </Popconfirm>
                    </Tooltip>
                  </div>

                  {dataset.description && (
                    <Text 
                      type="secondary" 
                      style={{ fontSize: '12px', display: 'block', marginLeft: 24, marginTop: 4 }}
                    >
                      {dataset.description}
                    </Text>
                  )}

                  <div className="dataset-item-meta" style={{ marginLeft: 24, marginTop: 8 }}>
                    <Tooltip title="Number of data files in this dataset">
                      <Tag icon={<FileOutlined />} color="blue">
                        {dataset.file_count} file{dataset.file_count !== 1 ? 's' : ''}
                      </Tag>
                    </Tooltip>
                    <Tooltip title="Total size of all files">
                      <Tag color="green">{formatFileSize(dataset.total_size_bytes)}</Tag>
                    </Tooltip>
                    <Tooltip title="Upload date and time">
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {formatDate(dataset.created_at)}
                      </Text>
                    </Tooltip>
                  </div>

                  {dataset.files && dataset.files.length > 0 && (
                    <details style={{ marginLeft: 24, marginTop: 8 }}>
                      <summary 
                        style={{ cursor: 'pointer', fontSize: '12px', color: '#1890ff', userSelect: 'none' }}
                      >
                        View {dataset.files.length} file{dataset.files.length !== 1 ? 's' : ''}
                      </summary>
                      <ul className="dataset-files-list" style={{ marginTop: 8 }}>
                        {dataset.files.map((file, idx) => (
                          <li key={idx}>
                            <FileOutlined aria-hidden="true" /> {file.filename}{' '}
                            <Text type="secondary">({formatFileSize(file.size_bytes)})</Text>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </Space>
          </Radio.Group>
        </div>
      )}
    </Card>
  );
};
