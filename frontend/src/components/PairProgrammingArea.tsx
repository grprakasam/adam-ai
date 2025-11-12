import React, { useState } from 'react';
import { message } from 'antd';
import { Code2, Copy, Check, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { showRegenerateConfirmation } from './ConfirmationDialog';
import type { VariableInfo } from '../types';
import './PairProgrammingArea.css';

interface PairProgrammingAreaProps {
  variables: VariableInfo[];
  categoryName: string;
}

export const PairProgrammingArea: React.FC<PairProgrammingAreaProps> = ({
  variables,
  categoryName
}) => {
  const {
    projectConfig,
    pairProgramming,
    setPairProgrammingSnippet,
    setGeneratingSnippet,
    setPairProgrammingNotes,
    setPairProgrammingAcceptance,
    programmingLanguage
  } = useProjectStore();

  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set());

  // Auto-detect derivation column from spec
  const getDerivationText = (variable: VariableInfo): string => {
    // Return the derivation field if available, otherwise return empty string
    return variable.derivation || 'No derivation logic specified';
  };

  const handleGenerateSnippet = async (variable: VariableInfo) => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      message.error('Please configure study ID and dataset first');
      return;
    }

    let cleanupRequired = false;

    try {
      setGeneratingSnippet(variable.name, true);
      cleanupRequired = true;

      const response = await adamApi.generateCodeSnippet({
        study_id: projectConfig.studyId,
        dataset: projectConfig.adamDataset,
        variable: variable.name,
        derivation: getDerivationText(variable),
        spec_row: {
          Variable: variable.name,
          Label: variable.label || '',
          Type: variable.type || '',
          Length: variable.length || '',
          Format: variable.format || '',
          'Source/Derivation': getDerivationText(variable)
        },
        standards: {
          sdtm_version: projectConfig.sdtmVersion || '3.4',
          adam_ig_version: projectConfig.adamIgVersion || '1.3',
          meddra_version: projectConfig.medraVersion || '26.0'
        },
        language: programmingLanguage,
        context: {
          available_sdtm_domains: ['DM', 'EX', 'AE', 'LB', 'DS'],
          required_variables: [variable.name],
          category: categoryName
        }
      });

      setPairProgrammingSnippet(variable.name, {
        variable: variable.name,
        codeSnippet: response.code_snippet,
        rationale: response.coding_rationale,
        userNotes: '',
        accepted: false,
        generatedAt: new Date(),
        language: programmingLanguage,
        metadata: response.metadata
      });

      message.success(`Code generated for ${variable.name}`);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to generate code';
      message.error(errorMsg);

      // Store error in snippet
      setPairProgrammingSnippet(variable.name, {
        variable: variable.name,
        codeSnippet: '',
        rationale: '',
        userNotes: '',
        accepted: false,
        generatedAt: new Date(),
        language: programmingLanguage,
        error: errorMsg
      });
    } finally {
      // Always clean up loading state
      if (cleanupRequired) {
        setGeneratingSnippet(variable.name, false);
      }
    }
  };

  const handleGenerateAll = async () => {
    const ungenerated = variables.filter(v => !pairProgramming.snippets[v.name]);

    if (ungenerated.length === 0) {
      message.info('All variables already have generated code');
      return;
    }

    const executeGeneration = async () => {
      message.info(`Generating code for ${ungenerated.length} variables...`);

      // Generate sequentially to avoid overwhelming the API
      for (const variable of ungenerated) {
        if (!pairProgramming.isGenerating[variable.name]) {
          await handleGenerateSnippet(variable);
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      message.success('Code generation completed for all variables');
    };

    // If there are already some generated snippets, show confirmation
    const generatedCount = Object.keys(pairProgramming.snippets).length;
    if (generatedCount > 0) {
      await showRegenerateConfirmation(executeGeneration);
    } else {
      await executeGeneration();
    }
  };

  const handleCopyCode = async (variable: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedVariable(variable);
      message.success('Code copied to clipboard');
      setTimeout(() => setCopiedVariable(null), 2000);
    } catch (error) {
      message.error('Failed to copy code');
    }
  };

  const handleNotesChange = (variable: string, notes: string) => {
    setPairProgrammingNotes(variable, notes);
  };

  const handleAcceptanceChange = (variable: string, accepted: boolean) => {
    setPairProgrammingAcceptance(variable, accepted);
  };

  const toggleRationale = (variable: string) => {
    const newExpanded = new Set(expandedRationale);
    if (newExpanded.has(variable)) {
      newExpanded.delete(variable);
    } else {
      newExpanded.add(variable);
    }
    setExpandedRationale(newExpanded);
  };

  const handleRegenerateWithConfirmation = async (variable: VariableInfo) => {
    const snippet = pairProgramming.snippets[variable.name];

    // If code exists, show confirmation before regenerating
    if (snippet?.codeSnippet) {
      await showRegenerateConfirmation(() => handleGenerateSnippet(variable));
    } else {
      // No existing code, generate directly
      await handleGenerateSnippet(variable);
    }
  };

  if (variables.length === 0) {
    return (
      <div className="pair-programming-empty">
        <Code2 size={48} />
        <p>No variables in this category</p>
      </div>
    );
  }

  return (
    <div className="pair-programming-area">
      {/* Header with actions */}
      <div className="pair-programming-header">
        <div className="header-info">
          <Code2 size={20} />
          <span className="header-title">Pair Programming Area</span>
          <span className="header-subtitle">
            {variables.length} variables • {Object.keys(pairProgramming.snippets).length} generated
          </span>
        </div>
        <div className="header-actions">
          <button 
            className="generate-all-button"
            onClick={handleGenerateAll}
            disabled={Object.values(pairProgramming.isGenerating).some(v => v)}
          >
            <Code2 size={16} />
            Generate All Visible
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="pair-programming-table-container">
        <table className="pair-programming-table">
          <thead>
            <tr>
              <th className="col-variable">Variable Name</th>
              <th className="col-derivation">Derivation Logic</th>
              <th className="col-type">Type</th>
              <th className="col-code">Code Snippet ({programmingLanguage})</th>
              <th className="col-rationale">Coding Rationale</th>
              <th className="col-acceptance">Acceptance</th>
              <th className="col-notes">User Notes</th>
            </tr>
          </thead>
          <tbody>
            {variables.map((variable) => {
              const snippet = pairProgramming.snippets[variable.name];
              const isGenerating = pairProgramming.isGenerating[variable.name];
              const isCopied = copiedVariable === variable.name;
              const isExpanded = expandedRationale.has(variable.name);

              return (
                <tr key={variable.name} className="variable-row">
                  {/* Variable Name */}
                  <td className="col-variable">
                    <div className="variable-name-cell">
                      <span className="variable-name">{variable.name}</span>
                      {variable.is_required && (
                        <span className="required-badge">Required</span>
                      )}
                    </div>
                  </td>

                  {/* Derivation Logic */}
                  <td className="col-derivation">
                    <div className="derivation-text">
                      {getDerivationText(variable)}
                    </div>
                  </td>

                  {/* Type */}
                  <td className="col-type">
                    <div className="type-cell">
                      {variable.type ? (
                        <span className={`type-badge type-${variable.type.toLowerCase()}`}>
                          {variable.type}
                        </span>
                      ) : (
                        <span className="no-data">—</span>
                      )}
                    </div>
                  </td>

                  {/* Code Snippet */}
                  <td className="col-code">
                    {isGenerating ? (
                      <div className="code-loading">
                        <Loader2 size={20} className="spinning" />
                        <span>Generating code...</span>
                      </div>
                    ) : snippet?.error ? (
                      <div className="code-error">
                        <AlertCircle size={16} />
                        <span>{snippet.error}</span>
                        <button 
                          className="retry-button"
                          onClick={() => handleGenerateSnippet(variable)}
                        >
                          <RefreshCw size={14} />
                          Retry
                        </button>
                      </div>
                    ) : snippet?.codeSnippet ? (
                      <div className="code-snippet-cell">
                        <div className="code-actions">
                          <button
                            className="copy-button"
                            onClick={() => handleCopyCode(variable.name, snippet.codeSnippet)}
                          >
                            {isCopied ? <Check size={14} /> : <Copy size={14} />}
                            {isCopied ? 'Copied' : 'Copy'}
                          </button>
                          <button
                            className="regenerate-button"
                            onClick={() => handleRegenerateWithConfirmation(variable)}
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                        <pre className="code-block">
                          <code>{snippet.codeSnippet}</code>
                        </pre>
                      </div>
                    ) : (
                      <button
                        className="generate-button"
                        onClick={() => handleGenerateSnippet(variable)}
                      >
                        <Code2 size={16} />
                        Generate Code
                      </button>
                    )}
                  </td>

                  {/* Coding Rationale */}
                  <td className="col-rationale">
                    {snippet?.rationale ? (
                      <div className="rationale-cell">
                        <div className={`rationale-text ${isExpanded ? 'expanded' : ''}`}>
                          {snippet.rationale}
                        </div>
                        {snippet.rationale.length > 150 && (
                          <button
                            className="expand-button"
                            onClick={() => toggleRationale(variable.name)}
                          >
                            {isExpanded ? 'Show less' : 'Show more'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="no-data">—</span>
                    )}
                  </td>

                  {/* Acceptance */}
                  <td className="col-acceptance">
                    <div className="acceptance-cell">
                      <label className="acceptance-checkbox">
                        <input
                          type="checkbox"
                          checked={snippet?.accepted || false}
                          onChange={(e) => handleAcceptanceChange(variable.name, e.target.checked)}
                          disabled={!snippet?.codeSnippet}
                        />
                        <span className="checkbox-label">
                          {snippet?.accepted ? 'Accepted' : 'Accept'}
                        </span>
                      </label>
                    </div>
                  </td>

                  {/* User Notes */}
                  <td className="col-notes">
                    <textarea
                      className="notes-textarea"
                      placeholder="Add notes..."
                      value={snippet?.userNotes || ''}
                      onChange={(e) => handleNotesChange(variable.name, e.target.value)}
                      rows={3}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
