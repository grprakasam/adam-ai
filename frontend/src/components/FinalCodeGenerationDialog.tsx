import React, { useState, useMemo } from 'react';
import { Modal, Button, Alert, Collapse, Checkbox, Input, Statistic, Tag, Divider } from 'antd';
import { Download, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { detectConflictingNotes, hasBlockingConflicts } from '../utils/notesConflictDetector';
import type { ConflictDetection } from '../utils/notesConflictDetector';
import './FinalCodeGenerationDialog.css';

const { Panel } = Collapse;

export interface GenerationPreferences {
  language: 'R' | 'SAS';
  rPackages?: string[];
  sasProcs?: string[];
  customOptions?: string;
}

interface FinalCodeGenerationDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (preferences: GenerationPreferences) => void;
  programmingLanguage: 'R' | 'SAS';
}

export const FinalCodeGenerationDialog: React.FC<FinalCodeGenerationDialogProps> = ({
  visible,
  onCancel,
  onConfirm,
  programmingLanguage,
}) => {
  const categorizedVariables = useProjectStore((state) => state.categorizedVariables);
  const snippets = useProjectStore((state) => state.pairProgramming.snippets);

  const [preferences, setPreferences] = useState<GenerationPreferences>({
    language: programmingLanguage,
    rPackages: ['tidyverse'],
    sasProcs: ['SQL'],
    customOptions: '',
  });

  // Get approved variables and their notes
  const approvedData = useMemo(() => {
    const approved: Array<{ name: string; category: string; notes?: string }> = [];
    const notes: Record<string, string> = {};

    if (categorizedVariables) {
      Object.entries(categorizedVariables).forEach(([category, variables]) => {
        if (Array.isArray(variables)) {
          variables.forEach((variable) => {
            const varName = variable.name || variable.variable_name;
            if (varName && snippets[varName]?.accepted) {
              approved.push({
                name: varName,
                category,
                notes: snippets[varName]?.userNotes,
              });
              if (snippets[varName]?.userNotes?.trim()) {
                notes[varName] = snippets[varName].userNotes;
              }
            }
          });
        }
      });
    }

    return { approved, notes };
  }, [categorizedVariables, snippets]);

  // Group approved variables by category
  const groupedVariables = useMemo(() => {
    const groups: Record<string, string[]> = {};
    approvedData.approved.forEach((item) => {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category].push(item.name);
    });
    return groups;
  }, [approvedData.approved]);

  // Detect conflicts in user notes
  const conflicts: ConflictDetection[] = useMemo(() => {
    return detectConflictingNotes(approvedData.notes);
  }, [approvedData.notes]);

  const hasBlocking = useMemo(() => hasBlockingConflicts(conflicts), [conflicts]);

  const variablesWithNotes = Object.keys(approvedData.notes).length;
  const totalApproved = approvedData.approved.length;

  const handleConfirm = () => {
    if (hasBlocking) {
      return; // Don't proceed if there are blocking conflicts
    }
    onConfirm(preferences);
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Download size={20} />
          <span>Generate ADAM Code - Final Confirmation</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={hasBlocking || totalApproved === 0}
          icon={<CheckCircle size={16} />}
        >
          {hasBlocking ? 'Resolve Conflicts First' : 'Generate Code'}
        </Button>,
      ]}
      className="final-code-generation-dialog"
    >
      {/* Summary Statistics */}
      <div className="dialog-stats">
        <Statistic title="Approved Variables" value={totalApproved} />
        <Statistic title="Variables with Notes" value={variablesWithNotes} />
        <Statistic
          title="Estimated Time"
          value={`${Math.ceil(totalApproved / 2)}`}
          suffix="sec"
        />
      </div>

      <Divider />

      {/* Approved Variables by Category */}
      <section className="dialog-section">
        <h3>
          <Info size={18} style={{ marginRight: '8px' }} />
          Approved Variables ({totalApproved})
        </h3>
        <Collapse bordered={false} defaultActiveKey={Object.keys(groupedVariables)}>
          {Object.entries(groupedVariables).map(([category, variables]) => (
            <Panel
              header={`${category} (${variables.length} variables)`}
              key={category}
              className="category-panel"
            >
              <div className="variable-chips">
                {variables.map((varName) => (
                  <Tag key={varName} color="blue">
                    {varName}
                  </Tag>
                ))}
              </div>
            </Panel>
          ))}
        </Collapse>
      </section>

      {/* User Notes Summary */}
      {variablesWithNotes > 0 && (
        <Alert
          message={`${variablesWithNotes} variables have custom notes`}
          description="These notes will be incorporated into the generated code"
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* Conflicts Warning */}
      {conflicts.length > 0 && (
        <Alert
          message={`${conflicts.length} potential ${hasBlocking ? 'conflicts' : 'warnings'} detected`}
          description={
            <div className="conflicts-list">
              {conflicts.map((conflict, idx) => (
                <div key={idx} className="conflict-item">
                  <strong>{conflict.variable}:</strong> {conflict.issue}
                  <div className="conflict-notes">"{conflict.notes.substring(0, 100)}..."</div>
                </div>
              ))}
              {hasBlocking && (
                <div style={{ marginTop: '12px', fontWeight: 'bold', color: '#d32f2f' }}>
                  Please review and resolve contradictory instructions before proceeding.
                </div>
              )}
            </div>
          }
          type={hasBlocking ? 'error' : 'warning'}
          showIcon
          icon={<AlertTriangle size={20} />}
          style={{ marginBottom: '16px' }}
        />
      )}

      {/* Programming Preferences */}
      <section className="dialog-section">
        <h3>Programming Preferences</h3>
        {preferences.language === 'R' && (
          <div className="preferences-content">
            <h4>R Packages</h4>
            <Checkbox.Group
              options={[
                { label: 'tidyverse (recommended)', value: 'tidyverse' },
                { label: 'data.table', value: 'data.table' },
                { label: 'haven (for SDTM)', value: 'haven' },
                { label: 'Base R only', value: 'base' },
              ]}
              value={preferences.rPackages}
              onChange={(checked) =>
                setPreferences({
                  ...preferences,
                  rPackages: checked as string[],
                })
              }
            />
            <Input
              placeholder="Additional packages (comma-separated)"
              value={preferences.customOptions}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  customOptions: e.target.value,
                })
              }
              style={{ marginTop: '12px' }}
            />
          </div>
        )}

        {preferences.language === 'SAS' && (
          <div className="preferences-content">
            <h4>SAS Procedures</h4>
            <Checkbox.Group
              options={[
                { label: 'PROC SQL (recommended)', value: 'SQL' },
                { label: 'Data Step only', value: 'DataStep' },
                { label: 'PROC FORMAT', value: 'FORMAT' },
                { label: 'PROC SORT', value: 'SORT' },
              ]}
              value={preferences.sasProcs}
              onChange={(checked) =>
                setPreferences({
                  ...preferences,
                  sasProcs: checked as string[],
                })
              }
            />
            <Input
              placeholder="Macro preferences or custom options"
              value={preferences.customOptions}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  customOptions: e.target.value,
                })
              }
              style={{ marginTop: '12px' }}
            />
          </div>
        )}
      </section>

      {/* Generation Plan */}
      <section className="dialog-section">
        <h3>Generation Plan</h3>
        <div className="generation-plan">
          <ol>
            <li>Load ADAM rules and CDISC standards</li>
            <li>Process {totalApproved} approved variables in dependency order</li>
            {variablesWithNotes > 0 && (
              <li>Apply custom user notes to {variablesWithNotes} variables</li>
            )}
            <li>
              Generate complete {preferences.language} program with:
              <ul>
                <li>Professional header with study metadata</li>
                <li>SDTM data input section</li>
                <li>All variable derivations with detailed comments</li>
                <li>Data quality checks</li>
                <li>Output to ADAM dataset</li>
              </ul>
            </li>
          </ol>
        </div>
      </section>

      {totalApproved === 0 && (
        <Alert
          message="No variables approved"
          description="Please approve at least one variable before generating code"
          type="warning"
          showIcon
          style={{ marginTop: '16px' }}
        />
      )}
    </Modal>
  );
};
