import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Tag,
  Alert,
  Spin,
  Tooltip,
  Modal,
  Typography
} from 'antd';
import {
  DatabaseOutlined,
  FileTextOutlined,
  SyncOutlined,
  DownloadOutlined,
  FilterOutlined,
  FullscreenOutlined,
  QuestionCircleOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { LineageGraph } from './LineageGraph';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { TraceabilityDetailDrawer } from './TraceabilityDetailDrawer';
import { TraceabilityExportModal } from './TraceabilityExportModal';

export const TraceabilityTab: React.FC = () => {
  const {
    traceabilityMatrix,
    isGeneratingTraceability,
    traceabilityError,
    selectedTraceabilityVariable,
    projectConfig,
    specificationFile,
    pairProgramming,
    generateTraceability,
    setSelectedTraceabilityVariable,
  } = useProjectStore();

  const [showGraph, setShowGraph] = useState(true);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Auto-generate on mount if snippets are ready
  useEffect(() => {
    if (!traceabilityMatrix && !isGeneratingTraceability) {
      const snippets = Object.values(pairProgramming.snippets);
      const hasAcceptedSnippets = snippets.some(s => s.accepted === 'accept');

      if (hasAcceptedSnippets && specificationFile) {
        // Don't auto-generate, let user click button
        // generateTraceability();
      }
    }
  }, []);

  const handleVariableSelect = (variable: string) => {
    setSelectedTraceabilityVariable(variable);
    setDetailDrawerVisible(true);
  };

  const handleRefresh = async () => {
    await generateTraceability();
  };

  const openLeftTab = (tab: 'project' | 'specification' | 'dataset' | 'standards') => {
    try {
      const event = new CustomEvent('adam-ai:open-left-tab', { detail: { tab } });
      window.dispatchEvent(event);
    } catch (e) {
      // no-op
    }
  };

  // Calculate metrics
  const tracedCount = traceabilityMatrix?.traced_variables || 0;
  const totalCount = traceabilityMatrix?.total_variables || 0;
  const avgConfidence = traceabilityMatrix?.average_confidence || 0;

  const getConfidenceIcon = () => {
    if (avgConfidence > 0.8) return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (avgConfidence > 0.5) return <WarningOutlined style={{ color: '#faad14' }} />;
    return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
  };

  const canGenerate = !!(specificationFile && projectConfig.studyId && projectConfig.adamDataset);

  // Prerequisites checklist for intuitive guidance
  const prereqs = [
    { key: 'studyId', label: 'Study ID', ok: !!projectConfig.studyId, action: () => openLeftTab('project') },
    { key: 'dataset', label: 'ADaM Dataset', ok: !!projectConfig.adamDataset, action: () => openLeftTab('dataset') },
    { key: 'spec', label: 'Specification File', ok: !!specificationFile, action: () => openLeftTab('specification') },
  ] as const;
  const missing = prereqs.filter(p => !p.ok);

  return (
    <div style={{ padding: '20px', height: '100%', overflow: 'auto' }}>
      {/* Overview Strip */}
      <Card bordered={false} style={{ marginBottom: 20 }}>
        <Row gutter={16}>
          {/* Study Context */}
          <Col span={6}>
            <Statistic
              title="Study ID"
              value={projectConfig.studyId || 'Not Set'}
              prefix={<DatabaseOutlined />}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>

          {/* Dataset Info */}
          <Col span={6}>
            <Statistic
              title="Dataset"
              value={projectConfig.adamDataset || 'Not Selected'}
              prefix={<FileTextOutlined />}
              valueStyle={{ fontSize: 16 }}
            />
          </Col>

          {/* Traceability Metrics */}
          <Col span={6}>
            <Statistic
              title="Variables Traced"
              value={tracedCount}
              suffix={totalCount > 0 ? `/ ${totalCount}` : ''}
              valueStyle={{
                fontSize: 16,
                color: tracedCount === totalCount && totalCount > 0 ? '#3f8600' : '#cf1322'
              }}
            />
          </Col>

          {/* Confidence Score */}
          <Col span={6}>
            <Statistic
              title="Avg Confidence"
              value={(avgConfidence * 100).toFixed(1)}
              suffix="%"
              prefix={getConfidenceIcon()}
              valueStyle={{ fontSize: 16 }}
            />
            <Tooltip title="Based on spec + code confirmation">
              <QuestionCircleOutlined style={{ marginLeft: 8, color: '#8c8c8c' }} />
            </Tooltip>
          </Col>
        </Row>

        {/* Action Bar */}
        <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
          <Space>
            <Tooltip
              open={canGenerate ? false : undefined}
              title={
                !canGenerate && (
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 6 }}>Complete prerequisites to enable generation:</div>
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                      {missing.map((m) => (
                        <li key={m.key}>{m.label}</li>
                      ))}
                    </ul>
                  </div>
                )
              }
            >
              <Button
                type="primary"
                icon={<SyncOutlined spin={isGeneratingTraceability} />}
                onClick={handleRefresh}
                loading={isGeneratingTraceability}
                disabled={!canGenerate}
              >
                {isGeneratingTraceability ? 'Generating...' : 'Generate Traceability'}
              </Button>
            </Tooltip>

            <Button
              icon={<DownloadOutlined />}
              onClick={() => setExportModalVisible(true)}
              disabled={!traceabilityMatrix}
            >
              Export
            </Button>

            <Button
              icon={<FullscreenOutlined />}
              onClick={() => setShowGraph(!showGraph)}
              disabled={!traceabilityMatrix}
            >
              {showGraph ? 'Show Matrix' : 'Show Graph'}
            </Button>

            {/* Confidence Legend */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Tag color="success">High (&gt;80%)</Tag>
              <Tag color="warning">Medium (50-80%)</Tag>
              <Tag color="error">Low (&lt;50%)</Tag>
            </div>
          </Space>
        </div>

        {/* Prerequisites checklist */}
        {!isGeneratingTraceability && (
          <div style={{ marginTop: 8 }}>
            <Space size={[8, 8]} wrap>
              <span style={{ color: '#8c8c8c' }}>Prerequisites:</span>
              {prereqs.map((p) => (
                <Tag
                  key={p.key}
                  color={p.ok ? 'success' : 'default'}
                  onClick={!p.ok ? p.action : undefined}
                  style={{ cursor: p.ok ? 'default' : 'pointer' }}
                >
                  {p.ok ? (
                    <span><CheckCircleOutlined style={{ marginRight: 6 }} />{p.label}</span>
                  ) : (
                    <span><CloseCircleOutlined style={{ marginRight: 6 }} />{p.label}</span>
                  )}
                </Tag>
              ))}
            </Space>
          </div>
        )}

        {/* Error Alert */}
        {traceabilityError && (
          <div style={{ marginTop: 16 }}>
            <Alert
              message="Traceability generation failed"
              description={
                <div>
                  <div style={{ marginBottom: 8 }}>{traceabilityError}</div>
                  <Space wrap>
                    <Button size="small" onClick={() => openLeftTab('project')}>Open Setup</Button>
                    <Button size="small" onClick={() => openLeftTab('dataset')}>Choose Dataset</Button>
                    <Button size="small" onClick={() => openLeftTab('specification')}>Open Specification</Button>
                    <Button size="small" onClick={() => setShowErrorDetails((v) => !v)}>
                      {showErrorDetails ? 'Hide details' : 'Show details'}
                    </Button>
                  </Space>
                  {showErrorDetails && (
                    <div style={{ marginTop: 12, background: '#fafafa', padding: 12, border: '1px dashed #e5e5e5', borderRadius: 6 }}>
                      <Typography.Paragraph style={{ marginBottom: 6 }}>
                        <strong>Study ID:</strong> {projectConfig.studyId || 'Not set'}
                      </Typography.Paragraph>
                      <Typography.Paragraph style={{ marginBottom: 6 }}>
                        <strong>Dataset:</strong> {projectConfig.adamDataset || 'Not selected'}
                      </Typography.Paragraph>
                      <Typography.Paragraph style={{ marginBottom: 0 }}>
                        <strong>Specification Path:</strong> {specificationFile?.path || 'Not selected'}
                      </Typography.Paragraph>
                    </div>
                  )}
                </div>
              }
              type="error"
              showIcon
              closable
            />
          </div>
        )}

        {/* Help Message */}
        {!canGenerate && !traceabilityError && (
          <Alert
            message="Configuration Required"
            description={
              <div>
                <div style={{ marginBottom: 8 }}>
                  Please ensure Study ID is set, ADaM dataset is selected, and a specification file is uploaded before generating traceability.
                </div>
                <Space wrap>
                  <Button size="small" onClick={() => openLeftTab('project')}>Open Setup</Button>
                  <Button size="small" onClick={() => openLeftTab('dataset')}>Choose Dataset</Button>
                  <Button size="small" onClick={() => openLeftTab('specification')}>Open Specification</Button>
                </Space>
              </div>
            }
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      {/* Main Content */}
      {isGeneratingTraceability && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#8c8c8c' }}>
            Generating traceability matrix...
            <br />
            This may take a moment.
          </div>
        </div>
      )}

      {!isGeneratingTraceability && traceabilityMatrix && (
        <>
          {showGraph ? (
            <Card
              title={
                <Space>
                  <LinkOutlined />
                  <span>Lineage Graph</span>
                  <Tag color="blue">{traceabilityMatrix.variables.length} variables</Tag>
                </Space>
              }
              bordered={false}
            >
              <LineageGraph
                graphData={traceabilityMatrix.graph_data}
                onVariableSelect={handleVariableSelect}
              />
            </Card>
          ) : (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span>Traceability Matrix</span>
                  <Tag color="blue">{traceabilityMatrix.variables.length} variables</Tag>
                </Space>
              }
              bordered={false}
            >
              <TraceabilityMatrix
                variables={traceabilityMatrix.variables}
                onVariableSelect={handleVariableSelect}
              />
            </Card>
          )}
        </>
      )}

      {!isGeneratingTraceability && !traceabilityMatrix && !traceabilityError && (
        <Card bordered={false}>
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#8c8c8c' }}>
            <LinkOutlined style={{ fontSize: 48, marginBottom: 16 }} />
            <h3>No Traceability Matrix Generated</h3>
            <p>Click "Generate Traceability" to create the SDTM-ADaM lineage documentation.</p>
          </div>
        </Card>
      )}

      {/* Detail Drawer */}
      {traceabilityMatrix && selectedTraceabilityVariable && (
        <TraceabilityDetailDrawer
          visible={detailDrawerVisible}
          variable={traceabilityMatrix.variables.find(
            v => v.variable_name === selectedTraceabilityVariable
          )}
          onClose={() => {
            setDetailDrawerVisible(false);
            setSelectedTraceabilityVariable(null);
          }}
        />
      )}

      {/* Export Modal */}
      <TraceabilityExportModal
        visible={exportModalVisible}
        matrix={traceabilityMatrix}
        onClose={() => setExportModalVisible(false)}
      />
    </div>
  );
};
