import React, { useState } from 'react';
import { message, Tooltip } from 'antd';
import { Code2, Loader2, AlertCircle, RefreshCw, Copy, Check, Eye, EyeOff, ChevronDown, ChevronUp, Maximize2, Info } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { showRegenerateConfirmation } from './ConfirmationDialog';
import type { CodeSnippetRequest, VariableInfo } from '../types';
import './PairProgrammingArea.css';

interface PairProgrammingAreaProps {
  variables: VariableInfo[];
  categoryName: string;
  getAiInputsButton?: React.ReactNode;
}

interface GenerateSnippetOptions {
  userNote?: string;
  silent?: boolean;
}

export const PairProgrammingArea: React.FC<PairProgrammingAreaProps> = ({
  variables,
  categoryName,
  getAiInputsButton
}) => {
  const {
    projectConfig,
    pairProgramming,
    setPairProgrammingSnippet,
    setGeneratingSnippet,
    setPairProgrammingNotes,
    setPairProgrammingAcceptance,
    programmingLanguage,
    llmProvider,
    selectedModel
  } = useProjectStore();

  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set());
  const hasAnySnippets = Object.keys(pairProgramming.snippets).length > 0;
  const isAnyVariableGenerating = Object.values(pairProgramming.isGenerating).some(v => v);
  const showAdvancedColumns = hasAnySnippets;

  // Debug logging
  React.useEffect(() => {
    console.log('[PairProgrammingArea] Snippets updated:', {
      totalSnippets: Object.keys(pairProgramming.snippets).length,
      snippetKeys: Object.keys(pairProgramming.snippets),
      sampleSnippet: Object.values(pairProgramming.snippets)[0]
    });
  }, [pairProgramming.snippets]);

  // Debug logging for variables length/format
  React.useEffect(() => {
    const armVars = variables.filter(v => v.name.includes('ARM'));
    if (armVars.length > 0) {
      console.log('[PairProgrammingArea] ARM variables length/format:', armVars.map(v => ({
        name: v.name,
        type: v.type,
        length: v.length,
        format: v.format
      })));
    }
  }, [variables]);

  // Auto-detect derivation column from spec
  const getDerivationText = (variable: VariableInfo): string => {
    // Return the derivation field if available, otherwise return empty string
    return variable.derivation || 'No derivation logic specified';
  };

  const handleGenerateSnippet = async (
    variable: VariableInfo,
    options: GenerateSnippetOptions = {}
  ) => {
    if (!projectConfig.studyId || !projectConfig.adamDataset) {
      message.error('Please configure study ID and dataset first');
      return;
    }

    const existingSnippet = pairProgramming.snippets[variable.name];
    const trimmedUserNote = options.userNote?.trim();
    let cleanupRequired = false;

    try {
      setGeneratingSnippet(variable.name, true);
      cleanupRequired = true;

      const payload: CodeSnippetRequest = {
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
      };

      if (llmProvider) {
        payload.llm_provider = llmProvider;
      }
      if (selectedModel) {
        payload.model = selectedModel;
      }
      if (trimmedUserNote) {
        payload.user_note = trimmedUserNote;
      }

      const response = await adamApi.generateCodeSnippet(payload);

      const nextUserNotes = options.userNote ?? existingSnippet?.userNotes ?? '';
      const nextAcceptance = existingSnippet?.accepted ?? (trimmedUserNote ? 'modify' : 'accept');

      setPairProgrammingSnippet(variable.name, {
        variable: variable.name,
        codeSnippet: response.code_snippet,
        rationale: response.coding_rationale,
        userNotes: nextUserNotes,
        accepted: nextAcceptance,
        generatedAt: new Date(),
        language: programmingLanguage,
        metadata: response.metadata,
        error: undefined
      });

      if (!options.silent) {
        message.success(
          trimmedUserNote
            ? `Updated code for ${variable.name} using your notes`
            : `Code generated for ${variable.name}`
        );
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to generate code';
      message.error(errorMsg);

      if (!existingSnippet?.codeSnippet) {
        // Store error only if there is no previous snippet to fall back on
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
      }
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

    if (!snippet) {
      await handleGenerateSnippet(variable);
      return;
    }

    if (!snippet.codeSnippet) {
      await handleGenerateSnippet(variable);
      return;
    }

    if (snippet.accepted !== 'modify') {
      message.info('Select "Modify" in the Acceptance column to request updated code.');
      return;
    }

    const rawNote = snippet.userNotes || '';
    const trimmedNote = rawNote.trim();
    if (!trimmedNote) {
      message.warning('Add user notes to describe the desired changes before refreshing.');
      return;
    }

    await showRegenerateConfirmation(() =>
      handleGenerateSnippet(variable, { userNote: rawNote })
    );
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
          {getAiInputsButton}
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
        {!showAdvancedColumns && (
          <div className="pair-programming-hint">
            <Info size={16} />
            <div>
              <div className="hint-title">Pair programming helpers will appear after AI inputs are generated.</div>
              <div className="hint-subtitle">Click “Get AI Inputs” to reveal coding rationale, snippet previews, acceptance, and notes.</div>
            </div>
          </div>
        )}
        <table className="pair-programming-table">
          <thead>
            <tr>
              <th className="col-variable">Variable</th>
              <th className="col-label">Label</th>
              <th className="col-type">Type</th>
              <th className="col-length">Length</th>
              <th className="col-format">Format</th>
              <th className="col-origin">Origin</th>
              <th className="col-derivation">Derivation Logic</th>
              {showAdvancedColumns && (
                <>
                  <th className="col-rationale">Coding Rationale</th>
                  <th className="col-code">Code Snippet ({programmingLanguage})</th>
                  <th className="col-acceptance">Acceptance</th>
                  <th className="col-notes">User Notes</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {variables.map((variable) => {
              const snippet = pairProgramming.snippets[variable.name];
              const isGenerating = pairProgramming.isGenerating[variable.name];
              const isCopied = copiedVariable === variable.name;
              const isExpanded = expandedRationale.has(variable.name);
              const trimmedNotes = snippet?.userNotes?.trim() ?? '';
              const needsNotes = snippet?.accepted === 'modify' && !trimmedNotes;
              const canRegenerate = snippet?.accepted === 'modify' && Boolean(trimmedNotes) && Boolean(snippet?.codeSnippet);
              const regenerateDisabled = !canRegenerate || !!isGenerating;
              const regenerateTitle = (() => {
                if (isGenerating) {
                  return 'Please wait until this variable finishes generating.';
                }
                if (!snippet?.codeSnippet) {
                  return 'Generate code for this variable first.';
                }
                if (snippet?.accepted !== 'modify') {
                  return 'Select "Modify" to enable note-driven refresh.';
                }
                if (!trimmedNotes) {
                  return 'Add user notes describing the change before refreshing.';
                }
                return 'Refresh this snippet using your notes.';
              })();
              const notesHint = (() => {
                if (!snippet?.codeSnippet) {
                  return 'Generate code to start capturing notes.';
                }
                if (snippet?.accepted !== 'modify') {
                  return 'Select "Modify" when you need to guide the AI.';
                }
                if (!trimmedNotes) {
                  return 'User notes are required to request updated code.';
                }
                return 'Notes saved. Click the refresh icon to regenerate.';
              })();
              const notesPlaceholder =
                snippet?.accepted === 'modify'
                  ? 'Describe the change you expect in this snippet...'
                  : 'Select "Modify" to enable notes';

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
                  {/* Variable + Label */}
                  <td className="col-variable">
                    <div className="variable-name-cell">
                      <span className="variable-name">{variable.name}</span>
                      {variable.is_required && (
                        <span className="required-badge">Required</span>
                      )}
                    </div>
                  </td>
                  <td className="col-label">
                    <div className="label-cell">
                      {variable.label ? (
                        <Tooltip title={variable.label}>
                          <span className="variable-label">{variable.label}</span>
                        </Tooltip>
                      ) : (
                        <span className="no-data">—</span>
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

                  {/* Length */}
                  <td className="col-length">
                    <div className="length-chip">
                      {variable.length ? (
                        <span className="chip chip-length">{variable.length}</span>
                      ) : (
                        <span className="no-data">—</span>
                      )}
                    </div>
                  </td>
                  {/* Format */}
                  <td className="col-format">
                    <div className="format-chip">
                      {variable.format ? (
                        <span className="chip chip-format">{variable.format}</span>
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

                  {showAdvancedColumns && (
                    <>
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
                              {snippet?.metadata?.user_note_applied && (
                                <span
                                  className="code-badge note-applied"
                                  title={snippet?.metadata?.user_note_summary || 'Generated using user notes'}
                                >
                                  Notes applied
                                </span>
                              )}
                              <button
                                className="regenerate-button"
                                onClick={() => handleRegenerateWithConfirmation(variable)}
                                disabled={regenerateDisabled}
                                title={regenerateTitle}
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
                        <div className="notes-field">
                          <textarea
                            className={`notes-textarea ${needsNotes ? 'modify-required' : ''}`}
                            placeholder={notesPlaceholder}
                            value={snippet?.userNotes || ''}
                            onChange={(e) => handleNotesChange(variable.name, e.target.value)}
                            rows={3}
                            disabled={snippet?.accepted === 'accept' || !snippet?.codeSnippet}
                          />
                          <div className={`notes-hint ${needsNotes ? 'warning' : ''}`}>
                            {notesHint}
                          </div>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
