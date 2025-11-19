// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Button,
  Space,
  Tag,
  Alert,
  Spin,
  Tooltip,
  Typography,
  Progress,
  Steps
} from 'antd';
import {
  DatabaseOutlined,
  FileTextOutlined,
  SyncOutlined,
  DownloadOutlined,
  FullscreenOutlined,
  LinkOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  CloseCircleOutlined,
  ThunderboltOutlined,
  RocketOutlined,
  AimOutlined,
  TrophyOutlined
} from '@ant-design/icons';
import { useProjectStore } from '../store/projectStore';
import { LineageGraph } from './LineageGraph';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { TraceabilityDetailDrawer } from './TraceabilityDetailDrawer';
import { TraceabilityExportModal } from './TraceabilityExportModal';
import './TraceabilityTab.css';

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
    if (!traceabilityMatrix && !isGeneratingTraceability && pairProgramming?.snippets) {
      const snippets = Object.values(pairProgramming.snippets);
      const hasAcceptedSnippets = snippets.some(s => s.accepted === 'accept');

      if (hasAcceptedSnippets && specificationFile) {
        // Don't auto-generate, let user click button
        // generateTraceability();
      }
    }
  }, [traceabilityMatrix, isGeneratingTraceability, pairProgramming?.snippets, specificationFile]);

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
    <div className="traceability-tab-container">
      {/* Hero Intelligence Dashboard */}
      <div className="intelligence-dashboard">
        <div className="dashboard-header">
          <div className="header-title">
            <AimOutlined className="title-icon" />
            <h1>Traceability Intelligence Dashboard</h1>
          </div>
          <div className="header-subtitle">
            Transform your ADAM specifications into comprehensive lineage documentation
          </div>
        </div>

        <Row gutter={[24, 24]} className="metrics-row">
          {/* Completeness Card */}
          <Col xs={24} sm={12} lg={8}>
            <Card className="metric-card completeness-card" bordered={false}>
              <div className="metric-icon">
                <TrophyOutlined />
              </div>
              <div className="metric-content">
                <div className="metric-label">Completeness</div>
                <div className="metric-value">
                  {tracedCount}/{totalCount}
                </div>
                <Progress
                  percent={totalCount > 0 ? Math.round((tracedCount / totalCount) * 100) : 0}
                  strokeColor={{
                    '0%': '#667eea',
                    '100%': '#764ba2',
                  }}
                  showInfo={false}
                  className="metric-progress"
                />
                <div className="metric-detail">
                  {totalCount - tracedCount} remaining
                </div>
              </div>
            </Card>
          </Col>

          {/* Confidence Card */}
          <Col xs={24} sm={12} lg={8}>
            <Card className="metric-card confidence-card" bordered={false}>
              <div className="metric-icon">
                {getConfidenceIcon()}
              </div>
              <div className="metric-content">
                <div className="metric-label">Confidence</div>
                <div className="metric-value">
                  {(avgConfidence * 100).toFixed(1)}%
                </div>
                <div className="confidence-quality">
                  {avgConfidence > 0.8 ? 'High Quality' : avgConfidence > 0.5 ? 'Medium Quality' : 'Needs Review'}
                </div>
                <Space size={4} className="confidence-breakdown">
                  <Tag color="success" className="confidence-tag">
                    🟢 {traceabilityMatrix?.high_confidence_count || 0} High
                  </Tag>
                  <Tag color="warning" className="confidence-tag">
                    🟡 {traceabilityMatrix?.medium_confidence_count || 0} Med
                  </Tag>
                  <Tag color="error" className="confidence-tag">
                    🔴 {traceabilityMatrix?.low_confidence_count || 0} Low
                  </Tag>
                </Space>
              </div>
            </Card>
          </Col>

          {/* Status Card */}
          <Col xs={24} sm={24} lg={8}>
            <Card className="metric-card status-card" bordered={false}>
              <div className="metric-icon">
                <RocketOutlined />
              </div>
              <div className="metric-content">
                <div className="metric-label">Status</div>
                <div className="metric-value">
                  {isGeneratingTraceability ? 'Generating...' : traceabilityMatrix ? '✓ Ready' : 'Not Generated'}
                </div>
                <div className="status-info">
                  {traceabilityMatrix && traceabilityMatrix.generated_at && (
                    <span>Last: {new Date(traceabilityMatrix.generated_at).toLocaleString()}</span>
                  )}
                  {!traceabilityMatrix && !isGeneratingTraceability && (
                    <span>Click Generate to start</span>
                  )}
                </div>
                <div className="context-breadcrumb">
                  <Tag icon={<DatabaseOutlined />}>{projectConfig.studyId || 'No Study'}</Tag>
                  <Tag icon={<FileTextOutlined />}>{projectConfig.adamDataset || 'No Dataset'}</Tag>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Prerequisites Panel */}
      <Card className="prerequisites-panel" bordered={false}>
        <div className="panel-header">
          <ThunderboltOutlined className="panel-icon" />
          <h2>Generation Readiness</h2>
        </div>

        <Steps
          current={prereqs.filter(p => p.ok).length}
          status={missing.length === 0 ? 'finish' : 'process'}
          className="prerequisites-steps"
        >
          {prereqs.map((p) => (
            <Steps.Step
              key={p.key}
              title={p.label}
              status={p.ok ? 'finish' : 'wait'}
              icon={p.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              description={
                p.key === 'studyId' ? (projectConfig.studyId || 'Not configured') :
                p.key === 'dataset' ? (projectConfig.adamDataset || 'Not selected') :
                p.key === 'spec' ? (specificationFile ? `${specificationFile.name}` : 'Not uploaded') :
                'Configure'
              }
              onClick={!p.ok ? p.action : undefined}
              style={{ cursor: p.ok ? 'default' : 'pointer' }}
            />
          ))}
        </Steps>

        <div className="action-bar">
          <Space size="middle">
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
                size="large"
                icon={<SyncOutlined spin={isGeneratingTraceability} />}
                onClick={handleRefresh}
                loading={isGeneratingTraceability}
                disabled={!canGenerate}
                className="generate-button"
              >
                {isGeneratingTraceability ? 'Generating Traceability...' : '🎯 Generate Traceability'}
              </Button>
            </Tooltip>

            <Button
              icon={<DownloadOutlined />}
              onClick={() => setExportModalVisible(true)}
              disabled={!traceabilityMatrix}
              size="large"
            >
              Export
            </Button>

            <Button
              icon={<FullscreenOutlined />}
              onClick={() => setShowGraph(!showGraph)}
              disabled={!traceabilityMatrix}
              size="large"
            >
              {showGraph ? 'Show Matrix' : 'Show Graph'}
            </Button>
          </Space>

          {/* Confidence Legend */}
          <div className="confidence-legend">
            <span className="legend-label">Confidence:</span>
            <Tag color="success">High (&gt;80%)</Tag>
            <Tag color="warning">Medium (50-80%)</Tag>
            <Tag color="error">Low (&lt;50%)</Tag>
          </div>
        </div>
      </Card>

        {/* Error Alert */}
        {traceabilityError && (
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
            className="error-alert"
          />
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
            className="info-alert"
          />
        )}

      {/* Main Content */}
      {isGeneratingTraceability && (
        <Card className="loading-card" bordered={false}>
          <div className="loading-content">
            <Spin size="large" />
            <h3>🔄 Generating Traceability Matrix...</h3>
            <p>This may take a moment while we analyze your specifications</p>
            <div className="loading-steps">
              <div className="loading-step completed">✓ Parsed specification file</div>
              <div className="loading-step completed">✓ Loaded SDTM datasets</div>
              <div className="loading-step active">⟳ Analyzing algorithms...</div>
              <div className="loading-step">⋯ Building lineage graph</div>
              <div className="loading-step">⋯ Calculating confidence scores</div>
            </div>
          </div>
        </Card>
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
        <Card className="empty-state-card" bordered={false}>
          <div className="empty-state-content">
            <div className="empty-state-icon">🎯</div>
            <h2>Ready to Generate Traceability?</h2>
            <p className="empty-state-description">
              Transform your ADAM specifications into a comprehensive lineage documentation 
              that traces every variable back to its SDTM source with full regulatory compliance.
            </p>
            
            <div className="benefits-box">
              <h3>What You'll Get:</h3>
              <ul className="benefits-list">
                <li>✓ Complete SDTM → ADAM variable mapping</li>
                <li>✓ Derivation algorithms with step-by-step logic</li>
                <li>✓ ADAM IG rule references and compliance checks</li>
                <li>✓ Interactive graph visualization of data flow</li>
                <li>✓ Confidence scoring for each variable</li>
                <li>✓ AI-powered anomaly detection</li>
                <li>✓ Export to PDF, Excel, or Word for submission</li>
              </ul>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={handleRefresh}
              disabled={!canGenerate}
              className="empty-state-button"
            >
              🚀 Generate Traceability
            </Button>

            <div className="empty-state-footer">
              <Button
                type="link"
                style={{ color: '#1890ff', padding: 0 }}
                onClick={() => {
                  import('antd').then(({ Modal }) => {
                    Modal.info({
                      title: 'About Traceability Matrix',
                      width: 600,
                      content: (
                        <div style={{ lineHeight: 1.8 }}>
                          <p><strong>What is Traceability?</strong></p>
                          <p>The Traceability Matrix provides a complete audit trail from SDTM source variables to ADAM analysis variables, essential for regulatory submissions.</p>
                          <p><strong>Key Features:</strong></p>
                          <ul>
                            <li>Automatic SDTM source variable detection</li>
                            <li>Derivation algorithm documentation</li>
                            <li>ADAM IG compliance validation</li>
                            <li>Interactive lineage visualization</li>
                            <li>Export to regulatory submission formats</li>
                          </ul>
                          <p><strong>Best Practice:</strong> Generate traceability after approving your variable code snippets in the Pair Programming tab.</p>
                        </div>
                      ),
                    });
                  });
                }}
              >
                Learn more about this feature
              </Button>
            </div>
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
