/**
 * R Execution Output Component
 *
 * Displays output from R code execution including:
 * - Console output (stdout/stderr)
 * - Plots (images)
 * - Data frames (tables)
 * - Files (download links)
 */

import React, { useState } from 'react';
import {
  Tabs,
  Card,
  Typography,
  Space,
  Button,
  Image,
  Table,
  Alert,
  Empty,
  Tag,
  Tooltip,
  message,
  Carousel,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  PictureOutlined,
  TableOutlined,
  FolderOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import type { RExecutionResult, RExecutionOutput } from '../types/rExecution';
import { adamApi } from '../services/api';
import { triggerDownload } from '../utils/downloadHelpers';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface RExecutionOutputProps {
  result: RExecutionResult;
  isExecuting?: boolean;
  consoleLines?: string[];
}

export const RExecutionOutputComponent: React.FC<RExecutionOutputProps> = ({
  result,
  isExecuting = false,
  consoleLines = [],
}) => {
  const [activeTab, setActiveTab] = useState<string>('console');
  const [downloadingPlot, setDownloadingPlot] = useState<number | null>(null);

  const output: RExecutionOutput = result.output;

  // Handle plot download
  const handleDownloadPlot = async (plotIndex: number) => {
    setDownloadingPlot(plotIndex);
    try {
      const response = await adamApi.downloadRPlot(result.run_id, plotIndex);
      const plot = output.plots.find(p => p.index === plotIndex);

      if (!plot) {
        message.error('Plot not found');
        return;
      }

      // Create blob URL and download
      const blob = new Blob([response.data], { type: response.headers['content-type'] });

      triggerDownload(
        blob,
        plot.filename,
        {
          onSuccess: () => message.success('Plot downloaded'),
          onError: (err) => message.error('Failed to download plot: ' + err.message)
        }
      );
    } catch (error: any) {
      message.error('Failed to download plot: ' + (error.message || 'Unknown error'));
    } finally {
      setDownloadingPlot(null);
    }
  };

  // Handle file download
  const handleDownloadFile = async (filename: string) => {
    try {
      const response = await adamApi.downloadROutputFile(result.run_id, filename);

      // Create blob URL and download
      const blob = new Blob([response.data], { type: response.headers['content-type'] });

      triggerDownload(
        blob,
        filename,
        {
          onSuccess: () => message.success(`Downloaded ${filename}`),
          onError: (err) => message.error('Failed to download file: ' + err.message)
        }
      );
    } catch (error: any) {
      message.error('Failed to download file: ' + (error.message || 'Unknown error'));
    }
  };

  // Get status icon and color
  const getStatusDisplay = () => {
    switch (result.status) {
      case 'succeeded':
        return <Tag icon={<CheckCircleOutlined />} color="success">Success</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">Failed</Tag>;
      case 'timeout':
        return <Tag icon={<ClockCircleOutlined />} color="warning">Timeout</Tag>;
      case 'running':
        return <Tag icon={<ClockCircleOutlined />} color="processing">Running</Tag>;
      default:
        return <Tag>{result.status}</Tag>;
    }
  };

  // Render console output
  const renderConsole = () => {
    // Use live console lines if executing, otherwise use result output
    const stdoutLines = isExecuting ? consoleLines : output.stdout;
    const stderrLines = output.stderr || [];

    if (stdoutLines.length === 0 && stderrLines.length === 0) {
      return <Empty description="No console output" />;
    }

    return (
      <Card bodyStyle={{ padding: 0 }}>
        <div style={{
          background: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: '13px',
          padding: '16px',
          maxHeight: '500px',
          overflowY: 'auto',
          lineHeight: '1.5',
        }}>
          {stdoutLines.map((line, idx) => (
            <div key={`stdout-${idx}`} style={{ marginBottom: '2px' }}>
              {line}
            </div>
          ))}
          {stderrLines.length > 0 && (
            <>
              {stderrLines.map((line, idx) => (
                <div key={`stderr-${idx}`} style={{ color: '#f48771', marginBottom: '2px' }}>
                  {line}
                </div>
              ))}
            </>
          )}
          {isExecuting && (
            <div style={{ color: '#4ec9b0', marginTop: '8px' }}>
              <ClockCircleOutlined spin /> Executing...
            </div>
          )}
        </div>
      </Card>
    );
  };

  // Render plots
  const renderPlots = () => {
    if (output.plots.length === 0) {
      return <Empty description="No plots generated" />;
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {output.plots.map((plot) => {
          // Construct plot URL
          const plotUrl = `/api/v1/r-execution/run/${result.run_id}/plots/${plot.index}`;

          return (
            <Card
              key={plot.index}
              title={
                <Space>
                  <PictureOutlined />
                  <Text strong>Plot {plot.index}</Text>
                  <Tag>{plot.format.toUpperCase()}</Tag>
                </Space>
              }
              extra={
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadPlot(plot.index)}
                  loading={downloadingPlot === plot.index}
                >
                  Download
                </Button>
              }
            >
              <Image
                src={plotUrl}
                alt={`Plot ${plot.index}`}
                style={{ maxWidth: '100%', border: '1px solid #d9d9d9' }}
                placeholder={true}
              />
            </Card>
          );
        })}
      </Space>
    );
  };

  // Render data frames
  const renderDataFrames = () => {
    if (output.data_frames.length === 0) {
      return <Empty description="No data frames created" />;
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {output.data_frames.map((df) => {
          // Create table columns
          const columns = df.column_names.map(col => ({
            title: col,
            dataIndex: col,
            key: col,
            ellipsis: true,
          }));

          return (
            <Card
              key={df.name}
              title={
                <Space>
                  <TableOutlined />
                  <Text strong>{df.name}</Text>
                  <Tag color="blue">{df.rows} rows</Tag>
                  <Tag color="green">{df.columns} columns</Tag>
                </Space>
              }
              extra={
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadFile(`${df.name}.csv`)}
                >
                  Download CSV
                </Button>
              }
            >
              <Table
                dataSource={df.preview_rows}
                columns={columns}
                size="small"
                pagination={{ pageSize: 5 }}
                scroll={{ x: true }}
                rowKey={(record, index) => `row-${index}`}
              />
              {df.rows > df.preview_rows.length && (
                <Alert
                  message={`Showing first ${df.preview_rows.length} of ${df.rows} rows`}
                  type="info"
                  showIcon
                  style={{ marginTop: '8px' }}
                />
              )}
            </Card>
          );
        })}
      </Space>
    );
  };

  // Render files
  const renderFiles = () => {
    if (output.files.length === 0) {
      return <Empty description="No files generated" />;
    }

    return (
      <Card>
        <Space direction="vertical" style={{ width: '100%' }}>
          {output.files.map((file) => (
            <Card
              key={file}
              size="small"
              hoverable
              onClick={() => handleDownloadFile(file)}
              style={{ cursor: 'pointer' }}
            >
              <Space>
                <FileTextOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                <div>
                  <Text strong>{file}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Click to download
                  </Text>
                </div>
              </Space>
            </Card>
          ))}
        </Space>
      </Card>
    );
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {/* Header */}
      <Card size="small" style={{ marginBottom: '16px' }}>
        <Space split={<span>|</span>}>
          {getStatusDisplay()}
          <Text type="secondary">
            <strong>R {result.r_version}</strong>
          </Text>
          <Text type="secondary">
            Duration: <strong>{result.execution_duration.toFixed(2)}s</strong>
          </Text>
          {output.exit_code !== undefined && (
            <Text type="secondary">
              Exit Code: <strong>{output.exit_code}</strong>
            </Text>
          )}
        </Space>
      </Card>

      {/* Error Alert */}
      {output.error_message && (
        <Alert
          message="Execution Error"
          description={output.error_message}
          type="error"
          showIcon
          closable
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* Tabbed Output */}
      <Card bodyStyle={{ padding: '16px' }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <Space>
                <FileTextOutlined />
                Console
                {(output.stdout.length > 0 || output.stderr.length > 0) && (
                  <Tag color="blue">{output.stdout.length + output.stderr.length}</Tag>
                )}
              </Space>
            }
            key="console"
          >
            {renderConsole()}
          </TabPane>

          <TabPane
            tab={
              <Space>
                <PictureOutlined />
                Plots
                {output.plots.length > 0 && <Tag color="green">{output.plots.length}</Tag>}
              </Space>
            }
            key="plots"
          >
            {renderPlots()}
          </TabPane>

          <TabPane
            tab={
              <Space>
                <TableOutlined />
                Data
                {output.data_frames.length > 0 && <Tag color="purple">{output.data_frames.length}</Tag>}
              </Space>
            }
            key="data"
          >
            {renderDataFrames()}
          </TabPane>

          <TabPane
            tab={
              <Space>
                <FolderOutlined />
                Files
                {output.files.length > 0 && <Tag color="orange">{output.files.length}</Tag>}
              </Space>
            }
            key="files"
          >
            {renderFiles()}
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default RExecutionOutputComponent;
