/**
 * Dataset Comparer Tab Component
 *
 * Professional dataset comparison tool for ADAM QC workflows.
 * Compares Developer vs QC datasets with comprehensive validation.
 *
 * Design Philosophy: QC-First, Results-Driven
 * - Progressive disclosure (simple → advanced)
 * - Clear visual feedback
 * - Actionable results
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Button,
  Upload,
  Radio,
  Space,
  Collapse,
  Typography,
  Row,
  Col,
  Alert,
  Progress,
  Table,
  Tag,
  Statistic,
  Divider,
  Select,
  InputNumber,
  Checkbox,
  Tooltip,
  message,
  Dropdown,
  MenuProps,
  Tabs,
} from 'antd';
import {
  UploadOutlined,
  PlayCircleOutlined,
  DownloadOutlined,
  SettingOutlined,
  FileExcelOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  EyeOutlined,
  FileAddOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import './DatasetComparerTab.css';

const { Text, Title } = Typography;
const { Panel } = Collapse;
const { Option } = Select;

// Types
interface DatasetMetadata {
  filename: string;
  observations: number;
  variables: number;
  creationDate?: string;
  modificationDate?: string;
  label?: string;
  format?: string;
}

interface ComparisonResult {
  overallMatch: number;
  metadata: {
    match: boolean;
    differences?: string[];
  };
  structure: {
    match: boolean;
    commonVariables: number;
    uniqueToDataset1: string[];
    uniqueToDataset2: string[];
    typeMismatches: Array<{ variable: string; type1: string; type2: string }>;
  };
  observations: {
    totalDataset1: number;
    totalDataset2: number;
    commonCount: number;
    equalCount: number;
    differenceCount: number;
    uniqueToDataset1: number;
    uniqueToDataset2: number;
  };
  values: {
    matchingVariables: number;
    totalVariables: number;
    differences: Array<{
      variable: string;
      type: string;
      diffCount: number;
      details: Array<{
        key: string;
        value1: any;
        value2: any;
        difference?: number;
      }>;
    }>;
  };
  statistics?: {
    numericSummary: Array<{
      variable: string;
      mean1: number;
      mean2: number;
      maxDiff: number;
      stdDiff: number;
    }>;
  };
  executionTime: number;
}

export const DatasetComparerTab: React.FC = () => {
  // Dataset state
  const [dataset1, setDataset1] = useState<UploadFile | null>(null);
  const [dataset2, setDataset2] = useState<UploadFile | null>(null);
  const [dataset1Meta, setDataset1Meta] = useState<DatasetMetadata | null>(null);
  const [dataset2Meta, setDataset2Meta] = useState<DatasetMetadata | null>(null);

  // Comparison settings
  const [comparisonMode, setComparisonMode] = useState<'quick' | 'standard' | 'comprehensive'>('standard');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Advanced options
  const [variableSelection, setVariableSelection] = useState<'all' | 'selected' | 'exclude-meta'>('all');
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const [numericComparison, setNumericComparison] = useState<'exact' | 'tolerance' | 'relative'>('exact');
  const [numericTolerance, setNumericTolerance] = useState(1e-8);
  const [relativeDiffThreshold, setRelativeDiffThreshold] = useState(0.01);
  const [missingValueHandling, setMissingValueHandling] = useState<'different' | 'equal' | 'ignore'>('different');
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [keyVariable, setKeyVariable] = useState('USUBJID');

  // UI state
  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [activeResultTab, setActiveResultTab] = useState('summary');
  const [expandedDifferences, setExpandedDifferences] = useState<string[]>([]);

  // Handle dataset upload
  const handleDataset1Upload = useCallback((file: UploadFile) => {
    setDataset1(file);
    // Mock metadata extraction - in real implementation, parse file
    setDataset1Meta({
      filename: file.name,
      observations: 450,
      variables: 52,
      format: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
    });
    message.success(`Loaded: ${file.name}`);
    return false; // Prevent auto upload
  }, []);

  const handleDataset2Upload = useCallback((file: UploadFile) => {
    setDataset2(file);
    setDataset2Meta({
      filename: file.name,
      observations: 450,
      variables: 52,
      format: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
    });
    message.success(`Loaded: ${file.name}`);
    return false;
  }, []);

  // Handle comparison
  const handleCompare = useCallback(async () => {
    if (!dataset1 || !dataset2) {
      message.warning('Please upload both datasets');
      return;
    }

    setIsComparing(true);

    try {
      // Mock API call - replace with actual backend integration
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock result
      const mockResult: ComparisonResult = {
        overallMatch: 98.5,
        metadata: {
          match: true,
        },
        structure: {
          match: true,
          commonVariables: 52,
          uniqueToDataset1: [],
          uniqueToDataset2: [],
          typeMismatches: [],
        },
        observations: {
          totalDataset1: 450,
          totalDataset2: 450,
          commonCount: 450,
          equalCount: 448,
          differenceCount: 2,
          uniqueToDataset1: 0,
          uniqueToDataset2: 0,
        },
        values: {
          matchingVariables: 50,
          totalVariables: 52,
          differences: [
            {
              variable: 'AGE',
              type: 'Numeric',
              diffCount: 2,
              details: [
                { key: '01-001', value1: 45, value2: 46, difference: 1 },
                { key: '01-015', value1: 32, value2: 33, difference: 1 },
              ],
            },
            {
              variable: 'ETHNIC',
              type: 'Character',
              diffCount: 1,
              details: [
                { key: '01-007', value1: 'NOT HISPANIC OR LATINO', value2: 'HISPANIC OR LATINO' },
              ],
            },
          ],
        },
        statistics: comparisonMode === 'comprehensive' ? {
          numericSummary: [
            { variable: 'AGE', mean1: 45.2, mean2: 45.3, maxDiff: 1, stdDiff: 0.1 },
          ],
        } : undefined,
        executionTime: 2340,
      };

      setResult(mockResult);
      setActiveResultTab('summary');
      message.success('Comparison completed successfully');
    } catch (error: any) {
      message.error(error.message || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  }, [dataset1, dataset2, comparisonMode]);

  // Load sample datasets
  const loadSample = useCallback(() => {
    const mockFile1: UploadFile = {
      uid: 'sample-1',
      name: 'ADSL_Developer.sas7bdat',
      status: 'done',
    };
    const mockFile2: UploadFile = {
      uid: 'sample-2',
      name: 'ADSL_QC.sas7bdat',
      status: 'done',
    };
    handleDataset1Upload(mockFile1);
    handleDataset2Upload(mockFile2);
  }, [handleDataset1Upload, handleDataset2Upload]);

  // Export menu
  const exportMenu: MenuProps = {
    items: [
      {
        key: 'pdf',
        label: 'Export PDF Report',
        icon: <DownloadOutlined />,
        onClick: () => message.info('PDF export coming soon'),
      },
      {
        key: 'excel',
        label: 'Export Excel',
        icon: <FileExcelOutlined />,
        onClick: () => message.info('Excel export coming soon'),
      },
      {
        key: 'csv',
        label: 'Export CSV',
        icon: <DownloadOutlined />,
        onClick: () => message.info('CSV export coming soon'),
      },
    ],
  };

  // Render dataset card
  const renderDatasetCard = (
    title: string,
    dataset: UploadFile | null,
    metadata: DatasetMetadata | null,
    onUpload: (file: UploadFile) => boolean
  ) => (
    <Card
      title={<Space><FileExcelOutlined />{title}</Space>}
      size="small"
      style={{ height: '100%' }}
    >
      <Upload
        beforeUpload={onUpload}
        maxCount={1}
        accept=".csv,.xlsx,.xls,.sas7bdat,.xpt,.rds,.rdata"
        showUploadList={false}
      >
        <Button icon={<UploadOutlined />} block size="large">
          Upload/Browse
        </Button>
      </Upload>

      {metadata && (
        <Card size="small" style={{ marginTop: 16, background: '#f5f5f5' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
            <Text strong>{metadata.filename}</Text>
          </div>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="Observations"
                value={metadata.observations}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="Variables"
                value={metadata.variables}
                valueStyle={{ fontSize: 20 }}
              />
            </Col>
          </Row>
          {metadata.format && (
            <Tag color="blue" style={{ marginTop: 8 }}>{metadata.format}</Tag>
          )}
        </Card>
      )}
    </Card>
  );

  // Render results
  const renderResults = () => {
    if (!result) return null;

    const getMatchColor = (match: number) => {
      if (match >= 95) return '#52c41a';
      if (match >= 80) return '#faad14';
      return '#ff4d4f';
    };

    const resultTabs = [
      {
        key: 'summary',
        label: 'Summary',
        children: (
          <div>
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={24}>
                <Card>
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <Title level={2} style={{ color: getMatchColor(result.overallMatch), margin: 0 }}>
                      {result.overallMatch.toFixed(1)}%
                    </Title>
                    <Text type="secondary">Overall Match</Text>
                  </div>
                  <Progress
                    percent={result.overallMatch}
                    strokeColor={getMatchColor(result.overallMatch)}
                    size="large"
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Dataset Metadata"
                    value={result.metadata.match ? 'Match' : 'Mismatch'}
                    prefix={result.metadata.match ? <CheckCircleOutlined /> : <WarningOutlined />}
                    valueStyle={{ color: result.metadata.match ? '#52c41a' : '#faad14' }}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Structure"
                    value={result.structure.match ? 'Match' : 'Mismatch'}
                    prefix={result.structure.match ? <CheckCircleOutlined /> : <WarningOutlined />}
                    valueStyle={{ color: result.structure.match ? '#52c41a' : '#faad14' }}
                  />
                  <Text type="secondary">{result.structure.commonVariables} common variables</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Observations"
                    value={`${result.observations.equalCount}/${result.observations.commonCount}`}
                    prefix={result.observations.differenceCount === 0 ? <CheckCircleOutlined /> : <WarningOutlined />}
                    valueStyle={{ color: result.observations.differenceCount === 0 ? '#52c41a' : '#faad14' }}
                  />
                  <Text type="secondary">{result.observations.differenceCount} differences</Text>
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="Values"
                    value={`${result.values.matchingVariables}/${result.values.totalVariables}`}
                    prefix={result.values.differences.length === 0 ? <CheckCircleOutlined /> : <WarningOutlined />}
                    valueStyle={{ color: result.values.differences.length === 0 ? '#52c41a' : '#faad14' }}
                  />
                  <Text type="secondary">{result.values.differences.length} variables with differences</Text>
                </Card>
              </Col>
            </Row>

            <Divider />

            <Text type="secondary">
              Execution Time: {result.executionTime}ms | Mode: {comparisonMode}
            </Text>
          </div>
        ),
      },
      {
        key: 'values',
        label: (
          <Space>
            Values
            {result.values.differences.length > 0 && (
              <Tag color="orange">{result.values.differences.length}</Tag>
            )}
          </Space>
        ),
        children: (
          <div>
            {result.values.differences.length === 0 ? (
              <Alert
                message="All Values Match"
                description="No differences found in any variable values."
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
              />
            ) : (
              <>
                <Alert
                  message={`${result.values.differences.length} Variable(s) with Differences`}
                  description="Click on a variable to view detailed differences"
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                <Collapse
                  activeKey={expandedDifferences}
                  onChange={(keys) => setExpandedDifferences(keys as string[])}
                >
                  {result.values.differences.map((diff) => (
                    <Panel
                      key={diff.variable}
                      header={
                        <Space>
                          <Tag color="blue">{diff.type}</Tag>
                          <Text strong>{diff.variable}</Text>
                          <Tag color="orange">{diff.diffCount} differences</Tag>
                        </Space>
                      }
                    >
                      <Table
                        size="small"
                        dataSource={diff.details}
                        rowKey="key"
                        columns={[
                          {
                            title: keyVariable,
                            dataIndex: 'key',
                            key: 'key',
                            width: 150,
                          },
                          {
                            title: 'Developer Value',
                            dataIndex: 'value1',
                            key: 'value1',
                            render: (val) => <Text code>{String(val)}</Text>,
                          },
                          {
                            title: 'QC Value',
                            dataIndex: 'value2',
                            key: 'value2',
                            render: (val) => <Text code>{String(val)}</Text>,
                          },
                          ...(diff.type === 'Numeric' ? [{
                            title: 'Difference',
                            dataIndex: 'difference',
                            key: 'difference',
                            render: (val: number) => (
                              <Tag color={Math.abs(val) > 1 ? 'red' : 'orange'}>
                                {val > 0 ? '+' : ''}{val}
                              </Tag>
                            ),
                          }] : []),
                          {
                            title: 'Actions',
                            key: 'actions',
                            width: 150,
                            render: () => (
                              <Space>
                                <Button size="small" type="link">Flag</Button>
                                <Button size="small" type="link">Note</Button>
                              </Space>
                            ),
                          },
                        ]}
                        pagination={{ pageSize: 10 }}
                      />
                    </Panel>
                  ))}
                </Collapse>
              </>
            )}
          </div>
        ),
      },
      {
        key: 'structure',
        label: 'Structure',
        children: (
          <div>
            <Row gutter={16}>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Common Variables"
                    value={result.structure.commonVariables}
                    prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Unique to Developer"
                    value={result.structure.uniqueToDataset1.length}
                    prefix={result.structure.uniqueToDataset1.length > 0 ? <WarningOutlined style={{ color: '#faad14' }} /> : <InfoCircleOutlined />}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card>
                  <Statistic
                    title="Unique to QC"
                    value={result.structure.uniqueToDataset2.length}
                    prefix={result.structure.uniqueToDataset2.length > 0 ? <WarningOutlined style={{ color: '#faad14' }} /> : <InfoCircleOutlined />}
                  />
                </Card>
              </Col>
            </Row>

            {result.structure.typeMismatches.length > 0 && (
              <>
                <Divider />
                <Alert
                  message="Type Mismatches Detected"
                  description={
                    <Table
                      size="small"
                      dataSource={result.structure.typeMismatches}
                      columns={[
                        { title: 'Variable', dataIndex: 'variable', key: 'variable' },
                        { title: 'Developer Type', dataIndex: 'type1', key: 'type1' },
                        { title: 'QC Type', dataIndex: 'type2', key: 'type2' },
                      ]}
                      pagination={false}
                    />
                  }
                  type="error"
                  showIcon
                />
              </>
            )}
          </div>
        ),
      },
    ];

    if (comparisonMode === 'comprehensive' && result.statistics) {
      resultTabs.push({
        key: 'statistics',
        label: 'Statistics',
        children: (
          <Table
            size="small"
            dataSource={result.statistics.numericSummary}
            columns={[
              { title: 'Variable', dataIndex: 'variable', key: 'variable' },
              { title: 'Mean (Dev)', dataIndex: 'mean1', key: 'mean1', render: (val) => val.toFixed(2) },
              { title: 'Mean (QC)', dataIndex: 'mean2', key: 'mean2', render: (val) => val.toFixed(2) },
              { title: 'Max Diff', dataIndex: 'maxDiff', key: 'maxDiff', render: (val) => val.toFixed(4) },
              { title: 'Std Diff', dataIndex: 'stdDiff', key: 'stdDiff', render: (val) => val.toFixed(4) },
            ]}
            pagination={{ pageSize: 20 }}
          />
        ),
      });
    }

    return (
      <Card
        title="Comparison Results"
        extra={
          <Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Completed at {new Date().toLocaleTimeString()}
            </Text>
            <Dropdown menu={exportMenu} trigger={['click']}>
              <Button icon={<DownloadOutlined />}>Export</Button>
            </Dropdown>
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <Tabs
          activeKey={activeResultTab}
          onChange={setActiveResultTab}
          items={resultTabs}
        />
      </Card>
    );
  };

  return (
    <div className="dataset-comparer-tab">
      {/* Header */}
      <div className="dataset-comparer-header">
        <Title level={3}>Dataset Comparer</Title>
        <Space>
          <Button
            icon={<FileAddOutlined />}
            onClick={loadSample}
          >
            Load Sample Datasets
          </Button>
          <Tooltip title="Help & Documentation">
            <Button icon={<InfoCircleOutlined />} />
          </Tooltip>
        </Space>
      </div>

      {/* Dataset Loading Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={11}>
          {renderDatasetCard('Developer Dataset', dataset1, dataset1Meta, handleDataset1Upload)}
        </Col>
        <Col span={2} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ fontSize: 24, color: '#1890ff' }}>VS</Text>
        </Col>
        <Col span={11}>
          {renderDatasetCard('QC Dataset', dataset2, dataset2Meta, handleDataset2Upload)}
        </Col>
      </Row>

      {/* Comparison Settings */}
      <Card title="Comparison Settings" style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Text strong>Comparison Mode:</Text>
          <Radio.Group
            value={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.value)}
            style={{ marginTop: 8, display: 'block' }}
          >
            <Space direction="vertical">
              <Radio value="quick">
                <Space>
                  <Text strong>Quick Check</Text>
                  <Text type="secondary">- Metadata & structure only (&lt;1s)</Text>
                </Space>
              </Radio>
              <Radio value="standard">
                <Space>
                  <Text strong>Standard QC</Text>
                  <Tag color="blue">Recommended</Tag>
                  <Text type="secondary">- Recommended for routine QC (2-5s)</Text>
                </Space>
              </Radio>
              <Radio value="comprehensive">
                <Space>
                  <Text strong>Comprehensive</Text>
                  <Text type="secondary">- Full validation with statistics (10s+)</Text>
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </div>

        {/* Advanced Options */}
        <Collapse
          ghost
          activeKey={showAdvanced ? ['advanced'] : []}
          onChange={(keys) => setShowAdvanced(keys.includes('advanced'))}
        >
          <Panel
            key="advanced"
            header={
              <Space>
                <SettingOutlined />
                <Text strong>Advanced Options</Text>
              </Space>
            }
          >
            <Row gutter={[24, 16]}>
              <Col span={12}>
                <Text strong>Variable Selection</Text>
                <Radio.Group
                  value={variableSelection}
                  onChange={(e) => setVariableSelection(e.target.value)}
                  style={{ marginTop: 8, display: 'block' }}
                >
                  <Space direction="vertical">
                    <Radio value="all">Compare all variables</Radio>
                    <Radio value="selected">
                      Compare selected variables only
                      {variableSelection === 'selected' && (
                        <Select
                          mode="multiple"
                          placeholder="Select variables"
                          style={{ width: 300, marginLeft: 8 }}
                          value={selectedVariables}
                          onChange={setSelectedVariables}
                        >
                          <Option value="USUBJID">USUBJID</Option>
                          <Option value="AGE">AGE</Option>
                          <Option value="SEX">SEX</Option>
                        </Select>
                      )}
                    </Radio>
                    <Radio value="exclude-meta">Exclude metadata variables (timestamps, dates)</Radio>
                  </Space>
                </Radio.Group>
              </Col>

              <Col span={12}>
                <Text strong>Numeric Comparison</Text>
                <Radio.Group
                  value={numericComparison}
                  onChange={(e) => setNumericComparison(e.target.value)}
                  style={{ marginTop: 8, display: 'block' }}
                >
                  <Space direction="vertical">
                    <Radio value="exact">Exact match</Radio>
                    <Radio value="tolerance">
                      Tolerance-based
                      {numericComparison === 'tolerance' && (
                        <InputNumber
                          value={numericTolerance}
                          onChange={(val) => setNumericTolerance(val || 1e-8)}
                          step={1e-8}
                          style={{ marginLeft: 8, width: 120 }}
                          placeholder="Epsilon"
                        />
                      )}
                    </Radio>
                    <Radio value="relative">
                      Relative difference
                      {numericComparison === 'relative' && (
                        <InputNumber
                          value={relativeDiffThreshold}
                          onChange={(val) => setRelativeDiffThreshold(val || 0.01)}
                          step={0.01}
                          min={0}
                          max={100}
                          formatter={(value) => `${value}%`}
                          parser={(value) => value?.replace('%', '') as any}
                          style={{ marginLeft: 8, width: 100 }}
                        />
                      )}
                    </Radio>
                  </Space>
                </Radio.Group>
              </Col>

              <Col span={12}>
                <Text strong>Missing Value Handling</Text>
                <Radio.Group
                  value={missingValueHandling}
                  onChange={(e) => setMissingValueHandling(e.target.value)}
                  style={{ marginTop: 8, display: 'block' }}
                >
                  <Space direction="vertical">
                    <Radio value="different">Treat missing values as different</Radio>
                    <Radio value="equal">Treat missing values as equal</Radio>
                    <Radio value="ignore">Ignore observations with missing values</Radio>
                  </Space>
                </Radio.Group>
              </Col>

              <Col span={12}>
                <Text strong>Character Comparison</Text>
                <div style={{ marginTop: 8 }}>
                  <Space direction="vertical">
                    <Checkbox checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)}>
                      Case-sensitive
                    </Checkbox>
                    <Checkbox checked={trimWhitespace} onChange={(e) => setTrimWhitespace(e.target.checked)}>
                      Trim whitespace
                    </Checkbox>
                  </Space>
                </div>

                <Divider style={{ margin: '16px 0' }} />

                <Text strong>Observation Matching</Text>
                <div style={{ marginTop: 8 }}>
                  <Text>Key Variable: </Text>
                  <Select
                    value={keyVariable}
                    onChange={setKeyVariable}
                    style={{ width: 150, marginLeft: 8 }}
                  >
                    <Option value="USUBJID">USUBJID</Option>
                    <Option value="SUBJID">SUBJID</Option>
                    <Option value="STUDYID">STUDYID</Option>
                  </Select>
                </div>
              </Col>
            </Row>
          </Panel>
        </Collapse>

        {/* Compare Button */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={handleCompare}
            loading={isComparing}
            disabled={!dataset1 || !dataset2}
          >
            {isComparing ? 'Comparing...' : 'Compare Datasets'}
          </Button>
        </div>
      </Card>

      {/* Results */}
      {renderResults()}

      {/* Empty State */}
      {!result && !isComparing && (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <FileExcelOutlined style={{ fontSize: 64, color: '#d9d9d9', marginBottom: 16 }} />
            <Title level={4}>Ready to Compare</Title>
            <Text type="secondary">
              Upload both datasets and click "Compare Datasets" to begin validation.
            </Text>
            <div style={{ marginTop: 24 }}>
              <Button type="primary" icon={<FileAddOutlined />} onClick={loadSample}>
                Try Sample Datasets
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
