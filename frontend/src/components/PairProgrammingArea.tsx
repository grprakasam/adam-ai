import React, { useState } from 'react';
import { message, Tooltip } from 'antd';
import { Code2, Copy, Check, Loader2, AlertCircle, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Maximize2, Info } from 'lucide-react';
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
  const [expandedCode, setExpandedCode] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const hasAnySnippets = Object.keys(pairProgramming.snippets).length > 0;
  const isAnyVariableGenerating = Object.values(pairProgramming.isGenerating).some(v => v);

  // Debug logging
  React.useEffect(() => {
    console.log('[PairProgrammingArea] Snippets updated:', {
      totalSnippets: Object.keys(pairProgramming.snippets).length,
      snippetKeys: Object.keys(pairProgramming.snippets),
      sampleSnippet: Object.values(pairProgramming.snippets)[0]
    });
  }, [pairProgramming.snippets]);

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
        accepted: 'accept',
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
        accepted: null,
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

  const handleAcceptanceChange = (variable: string, accepted: 'accept' | 'modify') => {
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
            disabled={!hasAnySnippets || isAnyVariableGenerating}
            title={!hasAnySnippets ? 'Run "Get AI Inputs" to populate this panel before refreshing.' : undefined}
          >
            <Code2 size={16} />
            {hasAnySnippets ? 'Refresh Visible' : 'Awaiting AI Inputs'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="pair-programming-table-container">
        <table className="pair-programming-table">
          <thead>
            <tr>
              <th className="col-variable">Variable Name</th>
              <th className="col-type">Type</th>
              <th className="col-length-format">Length/Format</th>
              <th className="col-origin">Origin</th>
              <th className="col-derivation">Derivation Logic</th>
              <th className="col-rationale">Coding Rationale</th>
              <th className="col-code">Code Snippet ({programmingLanguage})</th>
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

              // Debug log for first few variables
              if (variables.indexOf(variable) < 3) {
                console.log(`[PairProgrammingArea] Variable ${variable.name}:`, {
                  hasSnippet: !!snippet,
                  snippet: snippet,
                  codeSnippet: snippet?.codeSnippet,
                  rationale: snippet?.rationale,
                  error: snippet?.error
                });
              }

              return (
                <tr key={variable.name} className={`variable-row ${snippet?.accepted === 'modify' ? 'needs-modification' : ''}`}>
                  {/* Variable Name */}
                  <td className="col-variable">
                    <div className="variable-name-cell">
                      <span className="variable-name">{variable.name}</span>
                      {variable.is_required && (
                        <span className="required-badge">Required</span>
                      )}
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

                  {/* Length/Format */}
                  <td className="col-length-format">
                    <div className="length-format-cell">
                      {variable.length || variable.format ? (
                        <>
                          <span>{variable.length || '—'}</span>
                          <span className="separator">/</span>
                          <span>{variable.format || '—'}</span>
                        </>
                      ) : (
                        <span className="no-data">—</span>
                      )}
                    </div>
                  </td>

                  {/* Origin */}
                  <td className="col-origin">
                    <div className="origin-cell">
                      {variable.origin || variable.extra?.Origin || variable.extra?.origin ? (
                        <span className="origin-text">
                          {variable.origin || variable.extra?.Origin || variable.extra?.origin}
                        </span>
                      ) : (
                        <span className="no-data">—</span>
                      )}
                    </div>
                  </td>

                  {/* Derivation Logic */}
                  <td className="col-derivation">
                    <div className="derivation-text">
                      {getDerivationText(variable)}
                    </div>
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
                            className="regenerate-button"
                            onClick={() => handleRegenerateWithConfirmation(variable)}
                            disabled={snippet?.accepted === 'accept'}
                            title={snippet?.accepted === 'accept' ? 'Refresh disabled - Code is accepted. Select "Modify" to enable refresh.' : 'Regenerate code snippet'}
                          >
                            <RefreshCw size={14} />
                          </button>
                        </div>
                        <pre className="code-block">
                          <code>{snippet.codeSnippet}</code>
                        </pre>
                      </div>
                    ) : (
                      <div className="code-placeholder">
                        —
                      </div>
                    )}
                  </td>

                  {/* Acceptance */}
                  <td className="col-acceptance">
                    <div className="acceptance-cell">
                      <div className="radio-group">
                        <label className="radio-option">
                          <input
                            type="radio"
                            name={`acceptance-${variable.name}`}
                            value="accept"
                            checked={snippet?.accepted === 'accept'}
                            onChange={() => handleAcceptanceChange(variable.name, 'accept')}
                            disabled={!snippet?.codeSnippet}
                          />
                          <span className="radio-label">Accept</span>
                        </label>
                        <label className="radio-option">
                          <input
                            type="radio"
                            name={`acceptance-${variable.name}`}
                            value="modify"
                            checked={snippet?.accepted === 'modify'}
                            onChange={() => handleAcceptanceChange(variable.name, 'modify')}
                            disabled={!snippet?.codeSnippet}
                          />
                          <span className="radio-label">Modify</span>
                        </label>
                      </div>
                    </div>
                  </td>

                  {/* User Notes */}
                  <td className="col-notes">
                    <textarea
                      className={`notes-textarea ${snippet?.accepted === 'modify' ? 'modify-required' : ''}`}
                      placeholder={snippet?.accepted === 'modify' ? 'Notes required for modifications...' : 'Add notes...'}
                      value={snippet?.userNotes || ''}
                      onChange={(e) => handleNotesChange(variable.name, e.target.value)}
                      rows={3}
                      disabled={snippet?.accepted === 'accept' || !snippet?.codeSnippet}
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
