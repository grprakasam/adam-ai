import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Upload,
  Button,
  Typography,
  Space,
  Segmented,
  Tag,
  List,
  Progress,
  Empty,
} from 'antd';
import {
  UploadOutlined,
  LineChartOutlined,
  ClusterOutlined,
  AlertOutlined,
  AimOutlined,
  UserSwitchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd/es/upload/interface';
import { PageHeader } from './PageHeader';
import './AdamAnalyticsTab.css';
import {
  uploadAdamAnalyticsFiles,
  getAdamAnalyticsOverview,
  getAdamAnalyticsRoleInsights,
  getAdamAnalyticsTrendSeries,
  type AdamAnalyticsDatasetSummary,
  type AdamAnalyticsInsightItem,
  type AdamAnalyticsTrendPoint,
  type AnalyticsRole,
  getAdamAnalyticsOutliers,
  getAdamAnalyticsCorrelations,
  type AdamAnalyticsOutlierResponse,
  type AdamAnalyticsCorrelationResponse,
} from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const { Text, Paragraph } = Typography;

interface RoleConfig {
  key: AnalyticsRole;
  label: string;
  description: string;
}

const ROLE_OPTIONS: RoleConfig[] = [
  {
    key: 'developerStatistician',
    label: 'Developer Statistician',
    description: 'Endpoint-focused summaries, treatment effects, and variability.',
  },
  {
    key: 'clinician',
    label: 'Clinician',
    description: 'Patient-centric trends, safety signals, and outcomes.',
  },
  {
    key: 'standardsProgrammer',
    label: 'Standards Programmer',
    description: 'Variable roles, IG alignment, and structure health.',
  },
  {
    key: 'studyProgrammer',
    label: 'Study Programmer',
    description: 'Analysis-ready status, key variables, and merge keys.',
  },
  {
    key: 'clinicalDataManager',
    label: 'Clinical Data Manager',
    description: 'Data quality, anomalies, missingness, and edit check signals.',
  },
  {
    key: 'dataScientist',
    label: 'Data Scientist',
    description: 'Correlations, patterns, segments, and model-readiness.',
  },
];

interface DatasetSummary {
  name: string;
  records: number;
  subjects: number;
  variables: number;
  domainType: 'ADSL' | 'BDS' | 'OCCDS' | 'Other';
  status: 'Analyzed' | 'Pending';
}

export const AdamAnalyticsTab: React.FC = () => {
  const [role, setRole] = useState<AnalyticsRole>('developerStatistician');
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<AdamAnalyticsDatasetSummary[]>([]);
  const [activeDataset, setActiveDataset] = useState<string | null>(null);
  const [insights, setInsights] = useState<AdamAnalyticsInsightItem[]>([]);
  const [trendPoints, setTrendPoints] = useState<AdamAnalyticsTrendPoint[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [outlierSummary, setOutlierSummary] = useState<AdamAnalyticsOutlierResponse | null>(null);
  const [correlationSummary, setCorrelationSummary] = useState<AdamAnalyticsCorrelationResponse | null>(null);

  const uploadProps: UploadProps = {
    multiple: true,
    fileList,
    beforeUpload: () => false,
    onChange: async (info) => {
      const updatedList = info.fileList.slice(-10);
      setFileList(updatedList);

      const files: File[] = updatedList
        .map((f) => f.originFileObj)
        .filter((f): f is File => !!f);

      if (files.length === 0) {
        return;
      }

      setIsUploading(true);
      try {
        const uploadResponse = await uploadAdamAnalyticsFiles(files);
        setSessionId(uploadResponse.session_id);
        setDatasets(uploadResponse.datasets || []);
        const first = uploadResponse.datasets[0];
        setActiveDataset(first ? first.name : null);
      } finally {
        setIsUploading(false);
      }
    },
    accept: '.xpt,.sas7bdat,.csv,.parquet',
  };

  const roleConfig = ROLE_OPTIONS.find((r) => r.key === role)!;

  const hasFiles = fileList.length > 0;

  useEffect(() => {
    const loadInsights = async () => {
      if (!activeDataset || !sessionId) {
        setInsights([]);
        return;
      }
      setIsLoadingInsights(true);
      try {
        const response = await getAdamAnalyticsRoleInsights(activeDataset, role);
        setInsights(response.items || []);
      } finally {
        setIsLoadingInsights(false);
      }
    };

    loadInsights();
  }, [activeDataset, role]);

  useEffect(() => {
    const loadTrend = async () => {
      if (!activeDataset || !sessionId) {
        setTrendPoints([]);
        return;
      }
      try {
        const response = await getAdamAnalyticsTrendSeries(activeDataset, sessionId);
        const firstSeries = response.series && response.series.length > 0 ? response.series[0] : null;
        setTrendPoints(firstSeries ? firstSeries.points : []);
      } finally {
        // keep overview loader controlled by overview / dataset list
      }
    };

    loadTrend();
  }, [activeDataset, sessionId]);

  useEffect(() => {
    const loadOutliersAndCorrelations = async () => {
      if (!activeDataset || !sessionId) {
        setOutlierSummary(null);
        setCorrelationSummary(null);
        return;
      }
      try {
        const [outliers, correlations] = await Promise.all([
          getAdamAnalyticsOutliers(activeDataset, sessionId),
          getAdamAnalyticsCorrelations(activeDataset, sessionId),
        ]);
        setOutlierSummary(outliers);
        setCorrelationSummary(correlations);
      } catch {
        setOutlierSummary(null);
        setCorrelationSummary(null);
      }
    };

    loadOutliersAndCorrelations();
  }, [activeDataset, sessionId]);

  const renderInsightsList = () => {
    if (!activeDataset) {
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Select a dataset from the left to view analytics.
        </Text>
      );
    }

    if (isLoadingInsights) {
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Loading insights for {activeDataset}...
        </Text>
      );
    }

    if (!insights.length) {
      return (
        <Text type="secondary" style={{ fontSize: 12 }}>
          No insights available yet for this combination of role and dataset.
        </Text>
      );
    }

    return (
      <List
        size="small"
        dataSource={insights}
        renderItem={(item) => (
          <List.Item>
            <List.Item.Meta
              title={<Text strong>{item.title}</Text>}
              description={
                <>
                  <Text type="secondary">{item.text}</Text>
                  {item.citations && item.citations.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {item.citations.map((c) => (
                        <Tag key={c} color="default" style={{ fontSize: 10 }}>
                          {c}
                        </Tag>
                      ))}
                    </div>
                  )}
                </>
              }
            />
          </List.Item>
        )}
      />
    );
  };

  return (
    <div className="adam-analytics-tab">
      {/* Blue Header */}
      <PageHeader
        title="ADAM Analytics"
        subtitle="Role-based analytics and insights for ADaM datasets"
        icon={<LineChartOutlined />}
      />

      <Row gutter={16} style={{ marginTop: 16 }}>
        {/* Left: Upload + Datasets */}
        <Col xs={24} lg={7}>
          <Card
            size="small"
            title={
              <Space>
                <TableOutlined />
                <span>ADaM Datasets</span>
              </Space>
            }
            extra={
              <Tag color={hasFiles ? 'green' : 'default'}>
                {hasFiles ? `${fileList.length} file(s)` : 'No files'}
              </Tag>
            }
            className="adam-analytics-card"
          >
            <Upload {...uploadProps}>
              <Button icon={<UploadOutlined />} block>
                {isUploading ? 'Uploading and analyzing…' : 'Upload ADaM Datasets'}
              </Button>
            </Upload>
            <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>
              Accepts .xpt, .sas7bdat, .csv, .parquet. Files are analyzed only within this workspace.
            </Paragraph>

            {hasFiles ? (
              <List
                size="small"
                dataSource={fileList}
                style={{ marginTop: 8 }}
                renderItem={(file) => (
                  <List.Item style={{ padding: '4px 0' }}>
                    <Space size="small">
                      <Tag>{file.name}</Tag>
                    </Space>
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ marginTop: 16 }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Start by uploading one or more ADaM datasets.
                    </Text>
                  }
                />
              </div>
            )}
          </Card>

          <Card
            size="small"
            title={
              <Space>
                <LineChartOutlined />
                <span>Dataset Overview</span>
              </Space>
            }
            className="adam-analytics-card"
            style={{ marginTop: 16 }}
          >
            {isLoadingOverview && !datasets.length ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Loading datasets...
              </Text>
            ) : datasets.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                No datasets available yet.
              </Text>
            ) : (
              <List
                size="small"
                dataSource={datasets}
                renderItem={(ds) => (
                  <List.Item
                    style={{
                      padding: '6px 4px',
                      cursor: 'pointer',
                      background: activeDataset === ds.name ? '#eff6ff' : undefined,
                      borderRadius: 4,
                    }}
                    onClick={() => setActiveDataset(ds.name)}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      <Space size="small" style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Text strong>{ds.name}</Text>
                        <Tag color={ds.status === 'Analyzed' ? 'green' : 'orange'}>{ds.status}</Tag>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {ds.subjects} subjects · {ds.records} records · {ds.variables} variables · {ds.domain_type}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Right: Role-based analytics storyboard */}
        <Col xs={24} lg={17}>
          <Card
            size="small"
            title={
              <Space>
                <UserSwitchOutlined />
                <span>Role & Perspective</span>
              </Space>
            }
            className="adam-analytics-card"
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Segmented
                block
                value={role}
                onChange={(val) => setRole(val as AnalyticsRole)}
                options={ROLE_OPTIONS.map((r) => ({
                  label: r.label,
                  value: r.key,
                }))}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {roleConfig.description}
              </Text>
            </Space>
          </Card>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} md={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <AimOutlined />
                    <span>What is this dataset about?</span>
                  </Space>
                }
                className="adam-analytics-card"
              >
                <Paragraph style={{ marginBottom: 8 }}>
                  This workspace provides a role‑aware summary of the currently selected ADaM dataset
                  {activeDataset && (
                    <>
                      {' '}
                      (<Text code>{activeDataset}</Text>)
                    </>
                  )}
                  , answering core questions about its content, structure, and behavior.
                </Paragraph>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Future iterations will derive this description directly from your uploaded files and
                  show citations to supporting records.
                </Text>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card
                size="small"
                title={
                  <Space>
                    <ClusterOutlined />
                    <span>Analysis Readiness</span>
                  </Space>
                }
                className="adam-analytics-card"
              >
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  <div>
                    <Text strong style={{ fontSize: 12 }}>Overall readiness</Text>
                    <Progress percent={82} size="small" status="active" />
                  </div>
                  <div className="adam-analytics-readiness-grid">
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Key variables detected</Text>
                      <Text strong>{datasets.length > 0 ? datasets[0].variables : 0}</Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Potential outliers</Text>
                      <Text strong>
                        {outlierSummary
                          ? outlierSummary.variables.reduce((sum, v) => sum + v.total_outliers, 0)
                          : 0}
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Strong correlations</Text>
                      <Text strong>{correlationSummary ? correlationSummary.pairs.length : 0}</Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>Anomaly clusters</Text>
                      <Text strong>3</Text>
                    </div>
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>

          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col xs={24} md={14}>
              <Card
                size="small"
                title={
                  <Space>
                    <LineChartOutlined />
                    <span>Key trends & patterns</span>
                  </Space>
                }
                className="adam-analytics-card"
              >
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  In the full implementation this panel will render role-specific charts (time trends,
                  response curves, lab trajectories, etc.) based on your uploaded datasets. For now, it
                  renders a simple time trend using the uploaded data when available.
                </Paragraph>
                {trendPoints.length === 0 ? (
                  <div className="adam-analytics-trend-placeholder">
                    <div className="adam-analytics-trend-line" />
                    <div className="adam-analytics-trend-line secondary" />
                    <div className="adam-analytics-trend-axis" />
                  </div>
                ) : (
                  <div style={{ width: '100%', height: 180 }}>
                    <ResponsiveContainer>
                      <LineChart data={trendPoints}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="x" />
                        <YAxis />
                        <RechartsTooltip />
                        <Line type="monotone" dataKey="y" stroke="#2563eb" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </Col>

            <Col xs={24} md={10}>
              <Card
                size="small"
                title={
                  <Space>
                    <AlertOutlined />
                    <span>Outliers, anomalies & recommendations</span>
                  </Space>
                }
                className="adam-analytics-card"
              >
                {renderInsightsList()}
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
    </div>
  );
};
