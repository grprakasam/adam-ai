// @ts-nocheck
import React, { useState, useEffect } from 'react';
import {
  Button,
  Tag,
  Alert,
  Spin,
  Empty,
  Radio,
  Progress
} from 'antd';
import {
  SyncOutlined,
  DownloadOutlined,
  LinkOutlined,
  FileTextOutlined,
  SettingOutlined,
  FileExcelOutlined,
  SwapOutlined
} from '@ant-design/icons';
import { Network } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { useStudyStore } from '../store/studyStore';
import { LineageGraph } from './LineageGraph';
import { TraceabilityMatrix } from './TraceabilityMatrix';
import { TraceabilityDetailDrawer } from './TraceabilityDetailDrawer';
import { TraceabilityExportModal } from './TraceabilityExportModal';
import { SpecificationSelectionModal } from './SpecificationSelectionModal';
import { findAllSpecificationDocuments } from '../utils/studyDocumentSync';
import { PageHeader } from './PageHeader';
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

  const [showGraph, setShowGraph] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [specModalVisible, setSpecModalVisible] = useState(false);

  // Get study documents for specification selection
  const currentStudyId = useStudyStore((state) => state.currentStudyId);
  const documents = useStudyStore((state) => state.documents);
  const specificationDocuments = currentStudyId
    ? findAllSpecificationDocuments(documents[currentStudyId] || [])
    : [];

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

  // Calculate metrics
  const totalCount = traceabilityMatrix?.total_variables || 0;

  // Calculate percentage of variables with dataset references
  const variablesWithDatasets = traceabilityMatrix?.variables?.filter(v =>
    v.source_datasets && v.source_datasets.length > 0
  ).length || 0;
  const datasetMappingPercentage = totalCount > 0 ? (variablesWithDatasets / totalCount) * 100 : 0;

  const canGenerate = !!(specificationFile && projectConfig.studyId && projectConfig.adamDataset);

  return (
    <div className="traceability-tab">
      {/* Blue Header */}
      <PageHeader
        title="Traceability Intelligence"
        subtitle={`${totalCount} variables • ${traceabilityMatrix ? 'Generated' : 'Ready'}`}
        icon={<LinkOutlined />}
        actions={
          <Button
            type="primary"
            icon={<SyncOutlined spin={isGeneratingTraceability} />}
            onClick={handleRefresh}
            loading={isGeneratingTraceability}
            disabled={!canGenerate || isGeneratingTraceability}
            size="large"
          >
            {isGeneratingTraceability ? 'Generating...' : 'Generate Traceability'}
          </Button>
        }
      />

      {/* Split layout: Controls Panel + Main Content */}
      <div className="traceability-layout">
        {/* Side Panel: Controls */}
        <div className="traceability-controls-panel">
          <div className="controls-section">
            <div className="section-header">
              <SettingOutlined />
              <span>View Settings</span>
            </div>

            <div className="control-item">
              <label className="control-label">Display Mode</label>
              <Radio.Group
                value={showGraph ? 'graph' : 'matrix'}
                onChange={(e) => setShowGraph(e.target.value === 'graph')}
                buttonStyle="solid"
                style={{ width: '100%', display: 'flex' }}
                disabled={!traceabilityMatrix}
              >
                <Radio.Button value="graph" style={{ flex: 1, textAlign: 'center', fontSize: '13px' }}>
                  <LinkOutlined /> Graph
                </Radio.Button>
                <Radio.Button value="matrix" style={{ flex: 1, textAlign: 'center', fontSize: '13px' }}>
                  <FileTextOutlined /> Matrix
                </Radio.Button>
              </Radio.Group>
            </div>
          </div>

          {/* Specification Section */}
          <div className="controls-section">
            <div className="section-header">
              <FileExcelOutlined />
              <span>Specification</span>
            </div>
            <div className="spec-info">
              {specificationFile ? (
                <>
                  <div className="spec-file-name" title={specificationFile.name}>
                    <FileExcelOutlined style={{ color: '#52c41a', marginRight: 8 }} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '180px',
                      display: 'inline-block'
                    }}>
                      {specificationFile.name}
                    </span>
                  </div>
                  <Button
                    icon={<SwapOutlined />}
                    size="small"
                    onClick={() => setSpecModalVisible(true)}
                    style={{ marginTop: 8 }}
                    block
                  >
                    Change Specification
                  </Button>
                </>
              ) : (
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  onClick={() => setSpecModalVisible(true)}
                  block
                >
                  Select Specification
                </Button>
              )}
            </div>
          </div>

          <div className="controls-section">
            <div className="section-header">
              <FileTextOutlined />
              <span>Dataset Mapping</span>
            </div>

            <div className="info-sections">
              <div className="info-item">
                <span className="info-label">Total Variables</span>
                <span className="info-value">{totalCount}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Mapped to Datasets</span>
                <span className="info-value">{variablesWithDatasets}</span>
              </div>
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="info-label">Mapping Coverage</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <Progress
                    percent={datasetMappingPercentage}
                    strokeColor={{
                      '0%': '#10b981',
                      '100%': '#059669',
                    }}
                    size="small"
                    style={{ flex: 1 }}
                  />
                  <span className="info-value" style={{ minWidth: '50px' }}>{datasetMappingPercentage.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="controls-section">
            <div className="section-header">
              <DownloadOutlined />
              <span>Export</span>
            </div>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => setExportModalVisible(true)}
              disabled={!traceabilityMatrix}
              block
            >
              Export Matrix
            </Button>
          </div>

          {isGeneratingTraceability && (
            <div className="controls-section">
              <div className="section-header">
                <SyncOutlined spin />
                <span>Progress</span>
              </div>
              <div className="progress-section">
                <Progress percent={50} status="active" size="small" />
                <div className="progress-info">Analyzing specifications...</div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="traceability-main-content">
          {/* Error Alert */}
          {traceabilityError && (
            <Alert
              message="Traceability generation failed"
              description={traceabilityError}
              type="error"
              showIcon
              closable
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Configuration Required Alert */}
          {!canGenerate && !traceabilityError && !traceabilityMatrix && (
            <Alert
              message="Configuration Required"
              description="Please configure Study ID, ADaM dataset, and upload specification file."
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* Loading State */}
          {isGeneratingTraceability && (
            <div className="loading-content">
              <Spin size="large" />
              <h3>Generating Traceability Matrix...</h3>
              <p>Analyzing specifications and building lineage graph</p>
            </div>
          )}

          {/* Traceability Viewer */}
          {!isGeneratingTraceability && traceabilityMatrix && (
            <div className="traceability-viewer">
              {showGraph ? (
                <>
                  <div className="viewer-header">
                    <LinkOutlined />
                    <span>Lineage Graph</span>
                    <Tag color="blue">{traceabilityMatrix.variables.length} variables</Tag>
                  </div>
                  <LineageGraph
                    graphData={traceabilityMatrix.graph_data}
                    onVariableSelect={handleVariableSelect}
                  />
                </>
              ) : (
                <>
                  <div className="viewer-header">
                    <FileTextOutlined />
                    <span>Traceability Matrix</span>
                    <Tag color="blue">{traceabilityMatrix.variables.length} variables</Tag>
                  </div>
                  <TraceabilityMatrix
                    variables={traceabilityMatrix.variables}
                    onVariableSelect={handleVariableSelect}
                  />
                </>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isGeneratingTraceability && !traceabilityMatrix && !traceabilityError && (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <h3 style={{ margin: '16px 0 8px', fontSize: '16px' }}>Ready to Generate Traceability</h3>
                  <p style={{ color: '#8c8c8c', margin: 0 }}>Click Generate Traceability to create comprehensive lineage documentation</p>
                </div>
              }
            />
          )}
        </div>
      </div>

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

      {/* Specification Selection Modal */}
      <SpecificationSelectionModal
        visible={specModalVisible}
        studyId={currentStudyId || ''}
        specificationDocuments={specificationDocuments}
        onClose={() => setSpecModalVisible(false)}
        onSelect={(documentId, sheetName) => {
          console.log('Specification selected:', documentId, sheetName);
        }}
      />
    </div>
  );
};
