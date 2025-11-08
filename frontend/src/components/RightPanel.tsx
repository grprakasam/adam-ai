import { Card, Button, Space, Empty } from 'antd';
import { CopyOutlined, SaveOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import type { GenerationResponse, ProgrammingLanguage } from '../types';
import './RightPanel.css';

interface RightPanelProps {
  generationResult: GenerationResponse | null;
  language: ProgrammingLanguage;
}

const RightPanel = ({ generationResult, language }: RightPanelProps) => {
  if (!generationResult) {
    return (
      <div className="right-panel">
        <Card className="empty-state">
          <Empty 
            description={
              <div style={{ color: '#6b7280' }}>
                <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>
                  No code generated yet
                </div>
                <div style={{ fontSize: '13px' }}>
                  Configure your study settings and click "Generate ADSL Code" to begin
                </div>
              </div>
            }
          />
        </Card>
      </div>
    );
  }

  const validationStats = {
    pass: generationResult.validationResults.filter(v => v.status === 'pass').length,
    warning: generationResult.validationResults.filter(v => v.status === 'warning').length,
    error: generationResult.validationResults.filter(v => v.status === 'error').length,
  };

  return (
    <div className="right-panel">
      {/* Generated Code */}
      <Card 
        title="Generated Code"
        extra={
          <Space>
            <Button icon={<CopyOutlined />} size="small">Copy</Button>
            <Button icon={<SaveOutlined />} size="small">Save</Button>
            <Button icon={<ReloadOutlined />} size="small">Regenerate</Button>
          </Space>
        }
        className="code-card"
      >
        <Editor
          height="400px"
          language={language.toLowerCase()}
          value={generationResult.code}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            readOnly: true,
            scrollBeyondLastLine: false,
          }}
        />
      </Card>

      {/* Validation Results */}
      <Card 
        title="Validation Results"
        extra={
          <Space size="small">
            <span style={{ color: '#16a34a', fontSize: '12px' }}>✓ {validationStats.pass}</span>
            <span style={{ color: '#ca8a04', fontSize: '12px' }}>! {validationStats.warning}</span>
            <span style={{ color: '#dc2626', fontSize: '12px' }}>✗ {validationStats.error}</span>
          </Space>
        }
        size="small"
        className="validation-card"
      >
        <div className="validation-grid">
          <ValidationItem icon="✓" status="pass" label="CDISC Compliance" message="All rules passed" />
          <ValidationItem icon="✓" status="pass" label="Required Variables" message="Complete" />
          <ValidationItem icon="!" status="warning" label="Data Types" message="1 warning" />
          <ValidationItem icon="✓" status="pass" label="Derivation Logic" message="Valid" />
          <ValidationItem icon="✓" status="pass" label="Syntax Check" message="No errors" />
          <ValidationItem icon="✓" status="pass" label="Dependencies" message="Resolved" />
        </div>
      </Card>

      {/* Derivation Sequence */}
      <Card title="Derivation Sequence" size="small">
        <div className="sequence-list">
          {generationResult.derivationSequence.map((step) => (
            <div key={step.sequence} className="sequence-item">
              <div className="sequence-number">{step.sequence}</div>
              <div className="sequence-details">
                <div className="sequence-var">{step.variable}</div>
                <div className="sequence-deps">{step.dependencies}</div>
              </div>
            </div>
          ))}
          {generationResult.derivationSequence.length === 0 && (
            <div className="sequence-item">
              <div className="sequence-number">1</div>
              <div className="sequence-details">
                <div className="sequence-var">STUDYID, USUBJID, SUBJID</div>
                <div className="sequence-deps">Source: DM (no dependencies)</div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Quality Metrics */}
      <Card title="Code Quality Metrics" size="small">
        <div className="metrics-grid">
          <MetricCard label="Compliance" value={`${generationResult.qualityMetrics.compliance}%`} />
          <MetricCard label="Efficiency" value={`${generationResult.qualityMetrics.efficiency}%`} />
          <MetricCard label="Coverage" value={generationResult.qualityMetrics.coverage} />
          <MetricCard label="Readability" value={generationResult.qualityMetrics.readability} />
        </div>
      </Card>
    </div>
  );
};

const ValidationItem = ({ icon, status, label, message }: { icon: string; status: string; label: string; message: string }) => (
  <div className={`validation-item ${status}`}>
    <div className={`validation-icon ${status}`}>{icon}</div>
    <div className="validation-info">
      <div className="validation-label">{label}</div>
      <div className="validation-status">{message}</div>
    </div>
  </div>
);

const MetricCard = ({ label, value }: { label: string; value: string }) => (
  <div className="metric-card">
    <div className="metric-label">{label}</div>
    <div className="metric-value">{value}</div>
  </div>
);

export default RightPanel;
