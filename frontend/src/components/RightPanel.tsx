import { Card, Button, Space, message } from 'antd';
import { CopyOutlined, SaveOutlined, ReloadOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { useState, useCallback, useRef } from 'react';
import type { GenerationResponse, ProgrammingLanguage } from '../types';
import { api } from '../services/api';
import { VariablesAnalysisTab } from './VariablesAnalysisTab';
import './RightPanel.css';

interface RightPanelProps {
  generationResult: GenerationResponse | null;
  language: ProgrammingLanguage;
  isUnlocked: boolean;
  completionPercentage: number;
  onUnlock: () => void;
}

const RightPanel = ({ generationResult, language, isUnlocked, completionPercentage, onUnlock }: RightPanelProps) => {
  const [editedCode, setEditedCode] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<any>(null);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  if (!isUnlocked) {
    const progressLabel =
      completionPercentage >= 80
        ? 'You can now start generating code'
        : `Complete ${80 - completionPercentage}% more to unlock pair programming`;

    return (
      <div className="right-panel locked">
        <div className="locked-panel">
          <h3>Pair Programming Locked</h3>
          <p>{progressLabel}</p>
          <div className="locked-progress">
            <div className="locked-progress-bar">
              <div
                className="locked-progress-fill"
                style={{ width: `${Math.min(completionPercentage, 100)}%` }}
              />
            </div>
            <span>{completionPercentage}% complete</span>
          </div>
          <Button
            type="primary"
            size="large"
            disabled={completionPercentage < 80}
            onClick={onUnlock}
          >
            Start Programming
          </Button>
        </div>
      </div>
    );
  }

  if (!generationResult) {
    return (
      <div className="right-panel">
        <VariablesAnalysisTab />
      </div>
    );
  }

  // Handle code editing
  const handleCodeChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditedCode(value);
      
      // Debounce validation
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
      
      validationTimeoutRef.current = setTimeout(() => {
        validateCode(value);
      }, 1000); // Validate after 1 second of inactivity
    }
  }, []);

  const validateCode = async (code: string) => {
    if (!code.trim()) return;
    
    setIsValidating(true);
    try {
      const result = await api.validateCode(code, language);
      setValidationResults(result);
    } catch (error) {
      console.error('Validation failed:', error);
      message.error('Code validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const handleCopyCode = () => {
    const codeToCopy = isEditing ? editedCode : generationResult.code;
    navigator.clipboard.writeText(codeToCopy);
    message.success('Code copied to clipboard');
  };

  const handleSaveCode = () => {
    const codeToSave = isEditing ? editedCode : generationResult.code;
    const blob = new Blob([codeToSave], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `generated_code.${language.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Code saved');
  };

  const toggleEditMode = () => {
    if (!isEditing) {
      setEditedCode(generationResult.code);
    }
    setIsEditing(!isEditing);
  };

  const currentValidationResults = validationResults || generationResult.validationResults || [];
  const validationStats = {
    pass: currentValidationResults.filter((v: any) => v.status === 'pass').length,
    warning: currentValidationResults.filter((v: any) => v.status === 'warning').length,
    error: currentValidationResults.filter((v: any) => v.status === 'error').length,
  };

  return (
    <div className="right-panel">
      {/* Generated Code */}
      <Card 
        title={
          <Space>
            Generated Code
            {isValidating && <span style={{ fontSize: '12px', color: '#faad14' }}>(Validating...)</span>}
            {validationResults && !isValidating && (
              <span style={{ fontSize: '12px', color: validationResults.isValid ? '#52c41a' : '#ff4d4f' }}>
                {validationResults.isValid ? '\u2713 Valid' : '\u2717 Issues Found'}
              </span>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button 
              icon={isEditing ? <CheckOutlined /> : <EditOutlined />} 
              size="small"
              type={isEditing ? 'primary' : 'default'}
              onClick={toggleEditMode}
            >
              {isEditing ? 'Done' : 'Edit'}
            </Button>
            <Button icon={<CopyOutlined />} size="small" onClick={handleCopyCode}>Copy</Button>
            <Button icon={<SaveOutlined />} size="small" onClick={handleSaveCode}>Save</Button>
            <Button icon={<ReloadOutlined />} size="small">Regenerate</Button>
          </Space>
        }
        className="code-card"
      >
        <Editor
          height="400px"
          language={language.toLowerCase()}
          value={isEditing ? editedCode : generationResult.code}
          onChange={handleCodeChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            readOnly: !isEditing,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </Card>

      {/* Variables Analysis below the generated code */}
      <VariablesAnalysisTab />

      {/* Validation Results */}
      <Card 
        title="Validation Results"
        extra={
          <Space size="small">
            <span style={{ color: '#16a34a', fontSize: '12px' }}>
              <CheckCircleOutlined /> {validationStats.pass}
            </span>
            <span style={{ color: '#ca8a04', fontSize: '12px' }}>
              <WarningOutlined /> {validationStats.warning}
            </span>
            <span style={{ color: '#dc2626', fontSize: '12px' }}>
              <CloseCircleOutlined /> {validationStats.error}
            </span>
          </Space>
        }
        size="small"
        className="validation-card"
      >
        {validationResults && validationResults.issues && validationResults.issues.length > 0 ? (
          <div className="validation-issues-list">
            {validationResults.issues.map((issue: any, idx: number) => (
              <div key={idx} className={`validation-issue ${issue.severity}`}>
                <div className="issue-header">
                  <span className={`severity-badge ${issue.severity}`}>
                    {issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '!' : 'ℹ'}
                  </span>
                  <span className="issue-location">Line {issue.line}{issue.column ? `, Col ${issue.column}` : ''}</span>
                </div>
                <div className="issue-message">{issue.message}</div>
                {issue.suggestion && <div className="issue-suggestion">💡 {issue.suggestion}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="validation-grid">
            <ValidationItem icon="OK" status="pass" label="CDISC Compliance" message="All rules passed" />
            <ValidationItem icon="OK" status="pass" label="Required Variables" message="Complete" />
            <ValidationItem icon="OK" status="pass" label="Derivation Logic" message="Valid" />
            <ValidationItem icon="OK" status="pass" label="Syntax Check" message="No errors" />
            <ValidationItem icon="OK" status="pass" label="Dependencies" message="Resolved" />
          </div>
        )}
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
