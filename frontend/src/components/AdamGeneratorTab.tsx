
import React, { useState, useEffect } from 'react';
import { Layout, Row, Col, Tabs, message, Button, Space, Typography, Spin, Card, Table, Tag } from 'antd';
import { RocketOutlined, CodeOutlined, DatabaseOutlined, ExperimentOutlined, ThunderboltOutlined, CheckCircleOutlined, TableOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';

// Sub-components
import { AdamDataUploader, UploadedSdtmFile } from './AdamDataUploader';
import { AdamRCodeEditor } from './AdamRCodeEditor';
import { AdamExecutionMonitor } from './AdamExecutionMonitor';
import { AdamGenerationResults } from './AdamGenerationResults';

const { Content } = Layout;
const { Title, Text } = Typography;

const AdamGeneratorTab: React.FC = () => {
  const { projectConfig, adamExecution, setAdamExecution } = useProjectStore();

  // Local State
  const [uploadedFiles, setUploadedFiles] = useState<UploadedSdtmFile[]>([]);
  const [code, setCode] = useState<string>('# Enter your ADAM generation code here\n# or generate from SDTM data\n\n');
  const [rVersion, setRVersion] = useState<string>('4.3.2');
  const [activeLeftTab, setActiveLeftTab] = useState('sdtm');
  const [activeRightTab, setActiveRightTab] = useState('status');
  const [sdtmDataSummaries, setSdtmDataSummaries] = useState<Record<string, { columns: string[], rows: any[], rowCount: number }>>({});

  // Execution Handler
  const handleExecute = async () => {
    if (!code.trim()) {
      message.warning('Please enter some R code to execute.');
      return;
    }
    if (adamExecution.status === 'running') {
      message.warning('Execution is already in progress.');
      return;
    }

    try {
      // Reset State
      setAdamExecution({
        status: 'running',
        progress: 0,
        logs: [`[${new Date().toLocaleTimeString()}] Starting execution...`],
        result: null,
        error: null
      });
      setActiveRightTab('status');

      // Create Code File blob
      const codeFile = new File([code], 'main.R', { type: 'text/plain' });

      // Get Data Files
      const dataFiles = uploadedFiles.map(f => f.file);

      // Call API
      const response = await adamApi.runADAMGeneration(codeFile, dataFiles);

      // Update Run ID to start monitoring
      setAdamExecution({ runId: response.run_id });
      message.success('Execution started successfully');

    } catch (error: any) {
      console.error('Execution failed to start', error);
      setAdamExecution({
        status: 'failed',
        error: error.message || 'Failed to start execution'
      });
    }
  };

  // Preprocessing Generation Handler
  const handleGeneratePreprocessing = async () => {
    if (uploadedFiles.length === 0) {
      message.warning('Please upload SDTM files first.');
      return;
    }

    console.log('[AdamGenerator] Starting preprocessing code generation...');
    console.log('[AdamGenerator] Uploaded files:', uploadedFiles.map(f => ({ name: f.name, size: f.size, domain: f.domain })));

    const hide = message.loading('Generating data loading code...', 0);
    try {
      const files = uploadedFiles.map(f => f.file);
      console.log('[AdamGenerator] Calling API with files:', files.map(f => f.name));

      const response = await adamApi.generatePreprocessingCode(files);
      console.log('[AdamGenerator] API response:', response);

      if (response && response.code) {
        const newCode = `${response.code}\n\n${code}`;
        setCode(newCode);
        message.success('Preprocessing code generated and prepended!');
        setActiveLeftTab('editor'); // Switch to editor
        console.log('[AdamGenerator] Code successfully generated and prepended');
      } else {
        console.error('[AdamGenerator] No code in response:', response);
        message.error('No code generated from server');
      }
    } catch (error: any) {
      console.error('[AdamGenerator] Preprocessing generation failed:', error);
      console.error('[AdamGenerator] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });

      const errorMsg = error.response?.data?.detail || error.message || 'Failed to generate code';
      message.error(`Failed to generate code: ${errorMsg}`);
    } finally {
      hide();
    }
  };

  // Helper function to parse CSV data
  const parseCSVData = async (file: File, domain: string) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length === 0) return;

      // Parse header
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

      // Parse rows (limit to first 100 for preview)
      const rows = lines.slice(1, Math.min(101, lines.length)).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      });

      setSdtmDataSummaries(prev => ({
        ...prev,
        [domain]: {
          columns: headers,
          rows: rows,
          rowCount: lines.length - 1 // Total rows excluding header
        }
      }));

      console.log(`[AdamGenerator] Parsed ${domain}: ${headers.length} columns, ${lines.length - 1} rows`);
    } catch (error) {
      console.error(`[AdamGenerator] Failed to parse ${domain}:`, error);
    }
  };

  // Watch for file uploads and parse CSV files
  useEffect(() => {
    uploadedFiles.forEach(file => {
      if (file.format.includes('CSV') && !sdtmDataSummaries[file.domain]) {
        parseCSVData(file.file, file.domain);
      }
    });
  }, [uploadedFiles]);


  return (
    <Content style={{ padding: '24px', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <Space align="center" size="middle">
          <RocketOutlined style={{ fontSize: 24, color: '#1890ff' }} />
          <div>
            <Title level={4} style={{ margin: 0 }}>ADAM Generator</Title>
            <Text type="secondary">Build, Test, and Execute R Programs for ADAM Datasets</Text>
          </div>
        </Space>
      </div>

      <Row gutter={16} style={{ height: 'calc(100vh - 140px)' }}>

        {/* Left Panel: Inputs & Code */}
        <Col span={12} style={{ height: '100%' }}>
          <Card bodyStyle={{ padding: 0, height: '100%' }} style={{ height: '100%' }}>
            <Tabs
              activeKey={activeLeftTab}
              onChange={setActiveLeftTab}
              type="card"
              size="small"
              items={[
                {
                  label: <span><DatabaseOutlined /> SDTM Data</span>,
                  key: 'sdtm',
                  children: (
                    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
                      <AdamDataUploader
                        uploadedFiles={uploadedFiles}
                        setUploadedFiles={setUploadedFiles}
                        onUploadStart={() => { }}
                        onUploadEnd={() => { }}
                      />

                      {uploadedFiles.length > 0 && (
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                          <Button
                            type="dashed"
                            icon={<ThunderboltOutlined />}
                            onClick={handleGeneratePreprocessing}
                            size="large"
                          >
                            Generate Loading Code
                          </Button>
                          <div style={{ marginTop: 8 }}>
                            <Text type="secondary">Create R code to load these files</Text>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  label: <span><CodeOutlined /> R Program</span>,
                  key: 'editor',
                  children: (
                    <div style={{ height: 'calc(100vh - 280px)', display: 'flex', flexDirection: 'column', padding: 16 }}>
                      <AdamRCodeEditor
                        code={code}
                        setCode={setCode}
                        rVersion={rVersion}
                        setRVersion={setRVersion}
                        onRun={handleExecute}
                        isExecuting={adamExecution.status === 'running'}
                        progress={adamExecution.progress}
                        currentStep={adamExecution.logs?.[adamExecution.logs.length - 1] || ''}
                        lastResult={adamExecution.result}
                        lastError={adamExecution.error}
                        onLoadTemplate={(tmpl) => setCode(prev => prev + '\n' + tmpl)}
                      />
                    </div>
                  )
                }
              ]}
              style={{ height: '100%' }}
              tabBarStyle={{ margin: 0, paddingLeft: 8, paddingTop: 8 }}
            />
          </Card>
        </Col>

        {/* Right Panel: Execution & Results */}
        <Col span={12} style={{ height: '100%' }}>
          <Card bodyStyle={{ padding: 0, height: '100%' }} style={{ height: '100%' }}>
            <Tabs
              activeKey={activeRightTab}
              onChange={setActiveRightTab}
              type="card"
              size="small"
              items={[
                {
                  label: <span><ExperimentOutlined /> Execution Status</span>,
                  key: 'status',
                  children: (
                    <div style={{ padding: 16 }}>
                      <AdamExecutionMonitor />
                    </div>
                  )
                },
                {
                  label: <span><DatabaseOutlined /> SDTM Loaded Data</span>,
                  key: 'loaded-data',
                  children: (
                    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
                      {uploadedFiles.length === 0 ? (
                        <Card>
                          <Text type="secondary">No SDTM datasets loaded yet. Upload files in the SDTM Data tab.</Text>
                        </Card>
                      ) : (
                        <div>
                          <Title level={5}>Loaded SDTM Datasets ({uploadedFiles.length})</Title>
                          <Table
                            dataSource={uploadedFiles}
                            rowKey="id"
                            size="small"
                            pagination={false}
                            columns={[
                              {
                                title: 'Domain',
                                dataIndex: 'domain',
                                key: 'domain',
                                width: 100,
                                render: (domain: string) => (
                                  <Tag color="blue" style={{ fontWeight: 600 }}>{domain}</Tag>
                                ),
                              },
                              {
                                title: 'File Name',
                                dataIndex: 'name',
                                key: 'name',
                                ellipsis: true,
                              },
                              {
                                title: 'Format',
                                dataIndex: 'format',
                                key: 'format',
                                width: 150,
                              },
                              {
                                title: 'Size',
                                dataIndex: 'size',
                                key: 'size',
                                width: 100,
                                render: (size: number) => {
                                  if (size < 1024) return `${size} B`;
                                  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
                                  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
                                },
                              },
                              {
                                title: 'Status',
                                dataIndex: 'status',
                                key: 'status',
                                width: 100,
                                render: (status: string) => (
                                  <Tag color={status === 'success' ? 'green' : status === 'error' ? 'red' : 'orange'}>
                                    {status.toUpperCase()}
                                  </Tag>
                                ),
                              },
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  label: <span><TableOutlined /> SDTM Data Summary</span>,
                  key: 'data-summary',
                  children: (
                    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
                      {Object.keys(sdtmDataSummaries).length === 0 ? (
                        <Card>
                          <Text type="secondary">
                            No SDTM data parsed yet. Upload CSV files in the SDTM Data tab to see data summaries.
                          </Text>
                        </Card>
                      ) : (
                        <div>
                          <Title level={5}>SDTM Data Summary ({Object.keys(sdtmDataSummaries).length} domains)</Title>
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            {Object.entries(sdtmDataSummaries).map(([domain, data]) => (
                              <Card
                                key={domain}
                                size="small"
                                title={
                                  <Space>
                                    <Tag color="blue">{domain}</Tag>
                                    <Text type="secondary">
                                      {data.columns.length} columns × {data.rowCount} rows
                                      {data.rows.length < data.rowCount && ` (showing first ${data.rows.length})`}
                                    </Text>
                                  </Space>
                                }
                              >
                                <Table
                                  dataSource={data.rows}
                                  columns={data.columns.slice(0, 10).map(col => ({
                                    title: col,
                                    dataIndex: col,
                                    key: col,
                                    ellipsis: true,
                                    width: 150,
                                  }))}
                                  size="small"
                                  scroll={{ x: 'max-content', y: 300 }}
                                  pagination={false}
                                />
                                {data.columns.length > 10 && (
                                  <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                                    Showing first 10 of {data.columns.length} columns
                                  </Text>
                                )}
                              </Card>
                            ))}
                          </Space>
                        </div>
                      )}
                    </div>
                  )
                },
                {
                  label: <span><CheckCircleOutlined /> System Health</span>,
                  key: 'health',
                  children: (
                    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
                      <Title level={5}>System Health Status</Title>
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Card size="small">
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                            <div>
                              <Text strong>Backend Server</Text>
                              <br />
                              <Text type="secondary">Running on port 8002</Text>
                            </div>
                          </Space>
                        </Card>
                        <Card size="small">
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                            <div>
                              <Text strong>Frontend Server</Text>
                              <br />
                              <Text type="secondary">Running on port 3000</Text>
                            </div>
                          </Space>
                        </Card>
                        <Card size="small">
                          <Space>
                            <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 20 }} />
                            <div>
                              <Text strong>R Version</Text>
                              <br />
                              <Text type="secondary">{rVersion}</Text>
                            </div>
                          </Space>
                        </Card>
                        <Card size="small">
                          <Space>
                            <DatabaseOutlined style={{ color: '#1890ff', fontSize: 20 }} />
                            <div>
                              <Text strong>Loaded Datasets</Text>
                              <br />
                              <Text type="secondary">{uploadedFiles.length} SDTM file(s)</Text>
                            </div>
                          </Space>
                        </Card>
                        <Card size="small">
                          <Space>
                            <CodeOutlined style={{ color: '#722ed1', fontSize: 20 }} />
                            <div>
                              <Text strong>R Code</Text>
                              <br />
                              <Text type="secondary">{code.trim() ? `${code.split('\n').length} lines` : 'No code yet'}</Text>
                            </div>
                          </Space>
                        </Card>
                      </Space>
                    </div>
                  )
                },
                {
                  label: <span><DatabaseOutlined /> Results</span>,
                  key: 'results',
                  disabled: !adamExecution.result,
                  children: (
                    <div style={{ padding: 16, height: '100%', overflowY: 'auto' }}>
                      <AdamGenerationResults result={adamExecution.result} />
                    </div>
                  )
                }
              ]}
              style={{ height: '100%' }}
              tabBarStyle={{ margin: 0, paddingLeft: 8, paddingTop: 8 }}
            />
          </Card>
        </Col>

      </Row>

    </Content>
  );
};

export default AdamGeneratorTab;
