import React, { useState, useEffect } from 'react';
import { message, Tooltip, Button, Dropdown, Checkbox, Segmented } from 'antd';
import { Code2, Loader2, AlertCircle, RefreshCw, Info, Columns, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import { showRegenerateConfirmation } from './ConfirmationDialog';
import type { CodeSnippetRequest, VariableInfo } from '../types';
import './PairProgrammingArea.css';
import { FileDoneOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';

interface PairProgrammingAreaProps {
  variables: VariableInfo[];
  categoryName: string;
  getAiInputsButton?: React.ReactNode;
  onOpenValidation?: () => void;
  onOpenConsolidated?: () => void;
  canOpenConsolidated?: boolean;
}

interface GenerateSnippetOptions {
  userNote?: string;
  silent?: boolean;
}

// Define all available columns
type ColumnId = 'variable' | 'label' | 'type' | 'length' | 'format' | 'origin' | 'derivation' | 'rationale' | 'code' | 'acceptance' | 'notes';

interface ColumnDefinition {
  id: ColumnId;
  label: string;
  alwaysVisible: boolean;
  isAdvanced: boolean; // Only shown when snippets are generated
}

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { id: 'variable', label: 'Variable', alwaysVisible: true, isAdvanced: false },
  { id: 'label', label: 'Label', alwaysVisible: false, isAdvanced: false },
  { id: 'type', label: 'Type', alwaysVisible: false, isAdvanced: false },
  { id: 'length', label: 'Length', alwaysVisible: false, isAdvanced: false },
  { id: 'format', label: 'Format', alwaysVisible: false, isAdvanced: false },
  { id: 'origin', label: 'Origin', alwaysVisible: false, isAdvanced: false },
  { id: 'derivation', label: 'Derivation Logic', alwaysVisible: false, isAdvanced: false },
  { id: 'rationale', label: 'Coding Rationale', alwaysVisible: false, isAdvanced: true },
  { id: 'code', label: 'Code Snippet', alwaysVisible: false, isAdvanced: true },
  { id: 'acceptance', label: 'Acceptance', alwaysVisible: false, isAdvanced: true },
  { id: 'notes', label: 'User Notes', alwaysVisible: false, isAdvanced: true },
];

const STORAGE_KEY = 'pairProgramming_visibleColumns_v1';

export const PairProgrammingArea: React.FC<PairProgrammingAreaProps> = ({
  variables,
  categoryName,
  getAiInputsButton,
  onOpenValidation,
  onOpenConsolidated,
  canOpenConsolidated,
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

  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set());
  const [columnDropdownOpen, setColumnDropdownOpen] = useState(false);
  const hasAnySnippets = Object.keys(pairProgramming.snippets).length > 0;
  const showAdvancedColumns = hasAnySnippets;
  
  // View density state (compact/comfortable/spacious)
  const [viewDensity, setViewDensity] = useState<'compact' | 'comfortable' | 'spacious'>('comfortable');
  
  // Column width preset state (narrow/standard/wide)
  const [columnWidthPreset, setColumnWidthPreset] = useState<'narrow' | 'standard' | 'wide'>('standard');

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Set<ColumnId>>(() => {
    // Load from localStorage or default to all columns visible
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed);
      }
    } catch (error) {
      console.error('Failed to load column visibility preferences:', error);
    }
    // Default: all columns visible
    return new Set(COLUMN_DEFINITIONS.map(col => col.id));
  });

  // Save column visibility to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(visibleColumns)));
      console.log('[PairProgrammingArea] Saved column visibility to localStorage:', Array.from(visibleColumns));
    } catch (error) {
      console.error('Failed to save column visibility preferences:', error);
    }
  }, [visibleColumns]);

  // Debug: Log when visible columns change
  useEffect(() => {
    console.log('[PairProgrammingArea] Visible columns updated:', {
      count: visibleColumns.size,
      columns: Array.from(visibleColumns)
    });
  }, [visibleColumns]);

  // Toggle column visibility
  const toggleColumn = (columnId: ColumnId) => {
    const column = COLUMN_DEFINITIONS.find(col => col.id === columnId);
    if (column?.alwaysVisible) {
      console.log(`[PairProgrammingArea] Cannot toggle always-visible column: ${columnId}`);
      return; // Cannot hide always-visible columns
    }

    setVisibleColumns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(columnId)) {
        newSet.delete(columnId);
        console.log(`[PairProgrammingArea] Column hidden: ${columnId}. Visible columns:`, Array.from(newSet));
      } else {
        newSet.add(columnId);
        console.log(`[PairProgrammingArea] Column shown: ${columnId}. Visible columns:`, Array.from(newSet));
      }
      return newSet;
    });
  };

  // Check if a column should be rendered
  const isColumnVisible = (columnId: ColumnId): boolean => {
    const column = COLUMN_DEFINITIONS.find(col => col.id === columnId);
    if (!column) return false;
    
    // Always show if it's marked as always visible
    if (column.alwaysVisible) return true;
    
    // For advanced columns, check if snippets are generated AND if user wants to see them
    if (column.isAdvanced) {
      return showAdvancedColumns && visibleColumns.has(columnId);
    }
    
    // For basic columns, just check if user wants to see them
    return visibleColumns.has(columnId);
  };

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

  // Handle scroll indicators
  React.useEffect(() => {
    const container = document.querySelector('.pair-programming-table-container');
    if (!container) return;

    const handleScroll = () => {
      if (container.scrollLeft > 20) {
        container.classList.add('scrolled-left');
      } else {
        container.classList.remove('scrolled-left');
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

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
          {Object.keys(pairProgramming.snippets).length > 0 && (
            <Button
              type="default"
              icon={<CheckCircleOutlined />}
              onClick={onOpenValidation}
            >
              My Validation
            </Button>
          )}
          <Button
            type="primary"
            icon={<FileDoneOutlined />}
            className="consolidated-nav-button"
            onClick={onOpenConsolidated}
            disabled={!canOpenConsolidated}
          >
            Consolidated Code
          </Button>
        </div>
      </div>

      {/* Column Selector Toolbar */}
      <div className="column-selector-toolbar">
        <Dropdown
          open={columnDropdownOpen}
          onOpenChange={(open) => setColumnDropdownOpen(open)}
          menu={{
            items: COLUMN_DEFINITIONS.map(column => ({
              key: column.id,
              label: (
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!column.alwaysVisible && !(column.isAdvanced && !showAdvancedColumns)) {
                      toggleColumn(column.id);
                    }
                  }}
                  style={{ width: '100%', cursor: 'pointer' }}
                >
                  <Checkbox
                    checked={visibleColumns.has(column.id)}
                    disabled={column.alwaysVisible || (column.isAdvanced && !showAdvancedColumns)}
                    style={{ pointerEvents: 'none' }}
                  >
                    {column.label}
                    {column.alwaysVisible && ' (Always visible)'}
                    {column.isAdvanced && !showAdvancedColumns && ' (Generate snippets first)'}
                  </Checkbox>
                </div>
              ),
              onClick: () => {
                // Prevent menu from closing
                return false;
              }
            }))
          }}
          trigger={['click']}
        >
          <Button icon={<Columns size={16} />}>
            Customize Columns ({visibleColumns.size}/{COLUMN_DEFINITIONS.length})
          </Button>
        </Dropdown>
        <span className="toolbar-hint">
          Select which columns to display in the table
        </span>
      </div>

      {/* Visibility Controls Toolbar */}
      <div className="visibility-controls-toolbar">
        <div className="control-group">
          <span className="control-label">View Density:</span>
          <Segmented
            value={viewDensity}
            onChange={(value) => setViewDensity(value as 'compact' | 'comfortable' | 'spacious')}
            options={[
              { label: 'Compact', value: 'compact', icon: <ZoomOut size={14} /> },
              { label: 'Comfortable', value: 'comfortable', icon: <Maximize2 size={14} /> },
              { label: 'Spacious', value: 'spacious', icon: <ZoomIn size={14} /> }
            ]}
          />
        </div>
        
        <div className="control-group">
          <span className="control-label">Column Width:</span>
          <Segmented
            value={columnWidthPreset}
            onChange={(value) => setColumnWidthPreset(value as 'narrow' | 'standard' | 'wide')}
            options={[
              { label: 'Narrow', value: 'narrow' },
              { label: 'Standard', value: 'standard' },
              { label: 'Wide', value: 'wide' }
            ]}
          />
        </div>
        
        <div className="scroll-hint">
          <Info size={14} />
          <span>Use horizontal scrollbar below to view all columns</span>
        </div>
      </div>

      {/* Table */}
      <div className={`pair-programming-table-container density-${viewDensity} width-${columnWidthPreset}`}>
        {!showAdvancedColumns && (
          <div className="pair-programming-hint">
            <Info size={16} />
            <div>
              <div className="hint-title">Pair programming helpers will appear after AI inputs are generated.</div>
              <div className="hint-subtitle">Click "Get AI Inputs" to reveal coding rationale, snippet previews, acceptance, and notes.</div>
            </div>
          </div>
        )}
        <table className="pair-programming-table">
          <thead>
            <tr>
              {isColumnVisible('variable') && <th className="col-variable">Variable</th>}
              {isColumnVisible('label') && <th className="col-label">Label</th>}
              {isColumnVisible('type') && <th className="col-type">Type</th>}
              {isColumnVisible('length') && <th className="col-length">Length</th>}
              {isColumnVisible('format') && <th className="col-format">Format</th>}
              {isColumnVisible('origin') && <th className="col-origin">Origin</th>}
              {isColumnVisible('derivation') && <th className="col-derivation">Derivation Logic</th>}
              {isColumnVisible('rationale') && <th className="col-rationale">Coding Rationale</th>}
              {isColumnVisible('code') && <th className="col-code">Code Snippet ({programmingLanguage})</th>}
              {isColumnVisible('acceptance') && <th className="col-acceptance">Acceptance</th>}
              {isColumnVisible('notes') && <th className="col-notes">User Notes</th>}
            </tr>
          </thead>
          <tbody>
            {variables.map((variable) => {
              const snippet = pairProgramming.snippets[variable.name];
              const isGenerating = pairProgramming.isGenerating[variable.name];
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
                  {/* Variable */}
                  {isColumnVisible('variable') && (
                    <td className="col-variable">
                      <div className="variable-name-cell">
                        <span className="variable-name">{variable.name}</span>
                        {variable.is_required && (
                          <span className="required-badge">Required</span>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* Label */}
                  {isColumnVisible('label') && (
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
                  )}

                  {/* Type */}
                  {isColumnVisible('type') && (
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
                  )}

                  {/* Length */}
                  {isColumnVisible('length') && (
                    <td className="col-length">
                      <div className="length-chip">
                        {variable.length ? (
                          <span className="chip chip-length">{variable.length}</span>
                        ) : (
                          <span className="no-data">—</span>
                        )}
                      </div>
                    </td>
                  )}
                  
                  {/* Format */}
                  {isColumnVisible('format') && (
                    <td className="col-format">
                      <div className="format-chip">
                        {variable.format ? (
                          <span className="chip chip-format">{variable.format}</span>
                        ) : (
                          <span className="no-data">—</span>
                        )}
                      </div>
                    </td>
                  )}

                  {/* Origin */}
                  {isColumnVisible('origin') && (
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
                  )}

                  {/* Derivation Logic */}
                  {isColumnVisible('derivation') && (
                    <td className="col-derivation">
                      <div className="derivation-text">
                        {getDerivationText(variable)}
                      </div>
                    </td>
                  )}

                  {/* Coding Rationale */}
                  {isColumnVisible('rationale') && (
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
                  )}

                  {/* Code Snippet */}
                  {isColumnVisible('code') && (
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
                  )}

                  {/* Acceptance */}
                  {isColumnVisible('acceptance') && (
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
                  )}

                  {/* User Notes */}
                  {isColumnVisible('notes') && (
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
