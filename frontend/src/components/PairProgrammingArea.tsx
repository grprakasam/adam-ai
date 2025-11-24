import React, { useState, useMemo, useRef, useEffect } from 'react';
import { message, Dropdown, Checkbox } from 'antd';
import { Code2, Loader2, AlertCircle, Search, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import type { VariableInfo } from '../types';
import './PairProgrammingArea.css';

interface PairProgrammingAreaProps {
  variables: VariableInfo[];
  categoryName: string;
}

// Commented out - was used by handleGenerateSnippet which is currently disabled
// interface GenerateSnippetOptions {
//   userNote?: string;
//   silent?: boolean;
// }

// Field visibility configuration
type FieldId = 'type' | 'length' | 'format' | 'origin' | 'derivation' | 'rationale' | 'pseudo' | 'code';

interface FieldDefinition {
  id: FieldId;
  label: string;
  alwaysVisible: boolean;
  requiresSnippet: boolean; // Only shown when snippets are generated
}

const FIELD_DEFINITIONS: FieldDefinition[] = [
  { id: 'type', label: 'Type', alwaysVisible: false, requiresSnippet: false },
  { id: 'length', label: 'Length', alwaysVisible: false, requiresSnippet: false },
  { id: 'format', label: 'Format', alwaysVisible: false, requiresSnippet: false },
  { id: 'origin', label: 'Origin', alwaysVisible: false, requiresSnippet: false },
  { id: 'derivation', label: 'Derivation Logic', alwaysVisible: false, requiresSnippet: false },
  { id: 'rationale', label: 'Coding Rationale', alwaysVisible: false, requiresSnippet: true },
  { id: 'pseudo', label: 'Pseudo-Code', alwaysVisible: false, requiresSnippet: true },
  { id: 'code', label: 'Code Snippet', alwaysVisible: false, requiresSnippet: true },
];

const STORAGE_KEYS = {
  viewDensity: 'pairProgramming_viewDensity',
  cardSizePreset: 'pairProgramming_cardSizePreset',
  visibleFields: 'pairProgramming_visibleFields_v1',
};


// Simple syntax highlighting function for R and SAS
const highlightCode = (code: string, language: string): string => {
  let highlighted = code;

  // Escape HTML
  highlighted = highlighted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (language === 'R') {
    // R Keywords
    const rKeywords = /\b(library|require|function|if|else|for|while|repeat|in|next|break|return|TRUE|FALSE|NULL|NA|NaN|Inf|c|data\.frame|list|matrix|vector|factor|as\.numeric|as\.character|as\.Date|merge|subset|transform|mutate|select|filter|arrange|group_by|summarise|summarize|left_join|inner_join|full_join|anti_join)\b/g;
    highlighted = highlighted.replace(rKeywords, '<span class="keyword">$&</span>');

    // R Assignment operators
    highlighted = highlighted.replace(/(&lt;-|&lt;&lt;-|-&gt;|-&gt;&gt;)/g, '<span class="operator">$&</span>');

    // R Functions (word followed by parenthesis)
    highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9._]*)\s*(?=\()/g, '<span class="function">$1</span>');

    // Variables with $ accessor
    highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9._]*)\$/g, '<span class="variable">$1</span>$');

    // Strings
    highlighted = highlighted.replace(/(&quot;[^&quot;]*&quot;|'[^']*')/g, '<span class="string">$&</span>');

    // Numbers
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$&</span>');

    // Comments
    highlighted = highlighted.replace(/(#[^\n]*)/g, '<span class="comment">$&</span>');

  } else if (language === 'SAS') {
    // SAS Keywords
    const sasKeywords = /\b(data|set|merge|by|if|then|else|do|end|proc|run|quit|output|input|infile|cards|datalines|length|format|label|retain|drop|keep|where|sort|means|freq|print|sql|select|from|join|on|create|table|as|into|insert|update|delete|grant|revoke)\b/gi;
    highlighted = highlighted.replace(sasKeywords, '<span class="keyword">$&</span>');

    // SAS Assignment
    highlighted = highlighted.replace(/=/g, '<span class="operator">=</span>');

    // SAS Functions (word followed by parenthesis)
    highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/g, '<span class="function">$1</span>');

    // Strings
    highlighted = highlighted.replace(/(&quot;[^&quot;]*&quot;|'[^']*')/g, '<span class="string">$&</span>');

    // Numbers
    highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="number">$&</span>');

    // Comments (both * and /* */ style)
    highlighted = highlighted.replace(/(\*[^\n;]*;)/g, '<span class="comment">$&</span>');
    highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="comment">$&</span>');
  }

  return highlighted;
};

export const PairProgrammingArea: React.FC<PairProgrammingAreaProps> = ({
  variables,
  categoryName,
}) => {
  const {
    pairProgramming,
    setPairProgrammingNotes,
    setPairProgrammingAcceptance,
    programmingLanguage,
    categorizedVariables
  } = useProjectStore();

  // Get ALL variables from all categories for accurate counts
  const allVariables = useMemo(() => {
    if (!categorizedVariables?.categories) return [];
    return categorizedVariables.categories.flatMap(category => 
      category.variables || []
    );
  }, [categorizedVariables]);

  // Commented out - not currently used but may be useful in future
  // Create a map of variable name to category for quick lookup
  // const variableCategoryMap = useMemo(() => {
  //   const map = new Map<string, string>();
  //   if (categorizedVariables?.categories) {
  //     categorizedVariables.categories.forEach(category => {
  //       if (category.variables) {
  //         category.variables.forEach(variable => {
  //           map.set(variable.name, category.name);
  //         });
  //       }
  //     });
  //   }
  //   return map;
  // }, [categorizedVariables]);

  // Helper function to get category name for a variable
  // Commented out - not currently used but may be useful in future
  // const getVariableCategory = (variableName: string): string => {
  //   return variableCategoryMap.get(variableName) || 'Unknown';
  // };

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

  // Commented out - not currently used but preserved for reference
  // This function was part of an earlier implementation and may be needed again in future
  /*
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
      const nextAcceptance = existingSnippet?.accepted === 'modify'
        ? 'modify'
        : 'accept';

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
      if (cleanupRequired) {
        setGeneratingSnippet(variable.name, false);
      }
    }
  };
  */

  const handleNotesChange = (variable: string, notes: string) => {
    setPairProgrammingNotes(variable, notes);
  };

  const handleAcceptanceChange = (variable: string, accepted: 'accept' | 'modify') => {
    setPairProgrammingAcceptance(variable, accepted);
    // Provide immediate feedback
    if (accepted === 'accept') {
      message.success(`${variable} approved`, 1.5);
    } else {
      message.info(`${variable} marked for modification`, 1.5);
    }
  };

  // Commented out - not currently used but may be useful in future
  // const handleRegenerateWithConfirmation = async (variable: VariableInfo) => {
  //   const snippet = pairProgramming.snippets[variable.name];
  //
  //   if (!snippet) {
  //     await handleGenerateSnippet(variable);
  //     return;
  //   }
  //
  //   if (!snippet.codeSnippet) {
  //     await handleGenerateSnippet(variable);
  //     return;
  //   }
  //
  //   // Check if user notes are required for regeneration
  //   const trimmedNotes = snippet.userNotes?.trim() ?? '';
  //
  //   if (snippet.accepted === 'modify' && !trimmedNotes) {
  //     message.warning('Add user notes to describe the desired changes before regenerating.');
  //     return;
  //   }
  //
  //   // Show confirmation dialog before regenerating
  //   await showRegenerateConfirmation(async () => {
  //     await handleGenerateSnippet(variable, {
  //       userNote: snippet.userNotes || undefined
  //     });
  //   });
  // };

  // Filter and search variables
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'generated' | 'pending'>('generated');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // View density state (compact/comfortable/spacious) - Load from localStorage
  const [viewDensity, _setViewDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.viewDensity);
      if (saved && ['compact', 'comfortable', 'spacious'].includes(saved)) {
        return saved as 'compact' | 'comfortable' | 'spacious';
      }
    } catch (error) {
      console.error('Failed to load view density preference:', error);
    }
    return 'comfortable'; // Default
  });

  // Card size preset state (small/standard/large) - Load from localStorage
  const [cardSizePreset, _setCardSizePreset] = useState<'small' | 'standard' | 'large'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.cardSizePreset);
      if (saved && ['small', 'standard', 'large'].includes(saved)) {
        return saved as 'small' | 'standard' | 'large';
      }
    } catch (error) {
      console.error('Failed to load card size preference:', error);
    }
    return 'standard'; // Default
  });

  // Field visibility state - Load from localStorage
  const [visibleFields, setVisibleFields] = useState<Set<FieldId>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.visibleFields);
      if (saved) {
        const parsed = JSON.parse(saved);
        return new Set(parsed);
      }
    } catch (error) {
      console.error('Failed to load field visibility preferences:', error);
    }
    // Default: all fields visible
    return new Set(FIELD_DEFINITIONS.map(field => field.id));
  });

  const [fieldDropdownOpen, setFieldDropdownOpen] = useState(false);
  const hasAnySnippets = Object.keys(pairProgramming.snippets).length > 0;

  // Save preferences to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.viewDensity, viewDensity);
      console.log('[PairProgrammingArea] Saved view density to localStorage:', viewDensity);
    } catch (error) {
      console.error('Failed to save view density preference:', error);
    }
  }, [viewDensity]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.cardSizePreset, cardSizePreset);
      console.log('[PairProgrammingArea] Saved card size preset to localStorage:', cardSizePreset);
    } catch (error) {
      console.error('Failed to save card size preference:', error);
    }
  }, [cardSizePreset]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.visibleFields, JSON.stringify(Array.from(visibleFields)));
      console.log('[PairProgrammingArea] Saved field visibility to localStorage:', Array.from(visibleFields));
    } catch (error) {
      console.error('Failed to save field visibility preferences:', error);
    }
  }, [visibleFields]);

  // Toggle field visibility
  const toggleField = (fieldId: FieldId) => {
    const field = FIELD_DEFINITIONS.find(f => f.id === fieldId);
    if (field?.alwaysVisible) {
      console.log(`[PairProgrammingArea] Cannot toggle always-visible field: ${fieldId}`);
      return;
    }

    setVisibleFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
        console.log(`[PairProgrammingArea] Field hidden: ${fieldId}. Visible fields:`, Array.from(newSet));
      } else {
        newSet.add(fieldId);
        console.log(`[PairProgrammingArea] Field shown: ${fieldId}. Visible fields:`, Array.from(newSet));
      }
      return newSet;
    });
  };

  // Check if a field should be rendered
  const isFieldVisible = (fieldId: FieldId): boolean => {
    const field = FIELD_DEFINITIONS.find(f => f.id === fieldId);
    if (!field) return false;
    
    // Always show if it's marked as always visible
    if (field.alwaysVisible) return true;
    
    // For snippet-dependent fields, check if snippets are generated AND if user wants to see them
    if (field.requiresSnippet) {
      return hasAnySnippets && visibleFields.has(fieldId);
    }
    
    // For basic fields, just check if user wants to see them
    return visibleFields.has(fieldId);
  };

  const filteredVariables = useMemo(() => {
    // Always use variables from the selected sidebar category
    // Filter buttons filter within the selected category
    return variables.filter(variable => {
      const matchesSearch = 
        variable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (variable.label && variable.label.toLowerCase().includes(searchQuery.toLowerCase()));

      const snippet = pairProgramming.snippets[variable.name];
      if (filterStatus === 'generated') {
        return matchesSearch && snippet?.codeSnippet;
      }
      if (filterStatus === 'pending') {
        return matchesSearch && !snippet?.codeSnippet;
      }
      return matchesSearch;
    });
  }, [variables, pairProgramming.snippets, searchQuery, filterStatus]);

  const toggleCardExpansion = (variableName: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variableName)) {
        newSet.delete(variableName);
      } else {
        newSet.add(variableName);
      }
      return newSet;
    });
  };

  const getStatusBadgeClass = (status?: string) => {
    if (!status) return '';
    return `status-${status}`;
  };

  // Commented out - not currently used but may be useful in future
  // const getStatusBadgeLabel = (status?: string) => {
  //   switch (status) {
  //     case 'accept':
  //       return '✓ Approved';
  //     case 'reject':
  //       return '✗ Rejected';
  //     case 'modify':
  //       return 'Modify';
  //     default:
  //       return '';
  //   }
  // };

  // Content area ref - header is always visible, no hiding logic needed
  const contentAreaRef = useRef<HTMLDivElement>(null);

  return (
    <div className="pair-programming-area">
      {/* Pair Programming Header - Always Visible */}
      <div className="pair-programming-header">
        <div className="header-info">
          <Code2 size={20} />
          <span className="header-title">Pair Programming Area</span>
          <span className="header-subtitle">
            {categoryName}: {filteredVariables.length} {filterStatus === 'generated' ? 'generated' : 'pending'} variables
          </span>
          
          {/* Filter Buttons - Moved to header-info */}
          <div className="filter-buttons header-filters">
            <button 
              className={`filter-btn ${filterStatus === 'generated' ? 'active' : ''}`}
              onClick={() => setFilterStatus('generated')}
            >
              Generated ({allVariables.filter(v => pairProgramming.snippets[v.name]?.codeSnippet).length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              Pending ({allVariables.filter(v => !pairProgramming.snippets[v.name]?.codeSnippet).length})
            </button>
          </div>

          {/* Field Visibility Button - Moved to header-info */}
          <div className="header-field-visibility">
            <Dropdown
              open={fieldDropdownOpen}
              onOpenChange={(open) => setFieldDropdownOpen(open)}
              menu={{
                items: FIELD_DEFINITIONS.map(field => ({
                  key: field.id,
                  label: (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!field.alwaysVisible && !(field.requiresSnippet && !hasAnySnippets)) {
                          toggleField(field.id);
                        }
                      }}
                      style={{ width: '100%', cursor: 'pointer' }}
                    >
                      <Checkbox
                        checked={visibleFields.has(field.id)}
                        disabled={field.alwaysVisible || (field.requiresSnippet && !hasAnySnippets)}
                        style={{ pointerEvents: 'none' }}
                      >
                        {field.label}
                        {field.alwaysVisible && ' (Always visible)'}
                        {field.requiresSnippet && !hasAnySnippets && ' (Generate snippets first)'}
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
              <button className="field-selector-btn">
                <Eye size={16} />
                Field Visibility ({visibleFields.size}/{FIELD_DEFINITIONS.length})
              </button>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Search Toolbar - Only search box remains */}
      <div className="pair-programming-toolbar">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search variables by name or label..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div 
        ref={contentAreaRef} 
        className={`pair-programming-area-content density-${viewDensity} size-${cardSizePreset}`}
      >
        {/* Variables Grid */}
        {filteredVariables.length > 0 ? (
          <div className={`pair-programming-variables-grid density-${viewDensity} size-${cardSizePreset}`}>
            {filteredVariables.map((variable) => {
              const snippet = pairProgramming.snippets[variable.name];
              const isGenerating = pairProgramming.isGenerating[variable.name];
              const isExpanded = expandedCards.has(variable.name);
              const trimmedNotes = snippet?.userNotes?.trim() ?? '';
              const needsNotes = snippet?.accepted === 'modify' && !trimmedNotes;

              return (
                <div 
                  key={variable.name}
                  className={`variable-card ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => toggleCardExpansion(variable.name)}
                >
                  {/* Card Header */}
                  <div className="variable-card-header">
                    <div className="variable-card-title">
                      <div className="variable-card-name">
                        {variable.name}
                      </div>
                      <div className="variable-card-label">
                        {variable.label || 'No label'}
                      </div>
                    </div>
                    
                    <div className="variable-card-badges">
                      {variable.is_required && (
                        <span className="variable-badge required">Required</span>
                      )}
                      {isGenerating && (
                        <span className="variable-badge status-pending">
                          ⏳ Generating
                        </span>
                      )}
                      {/* Show status badge - auto-approved when code exists, unless marked as 'modify' */}
                      {!isGenerating && snippet?.codeSnippet && !snippet?.error && (
                        <span className={`variable-badge ${getStatusBadgeClass(snippet.accepted === 'modify' ? 'modify' : 'accept')}`}>
                          {snippet.accepted === 'modify' ? '⚠ Modify' : '✓ Approved'}
                        </span>
                      )}
                      {/* Modify button - allows user to mark approved variables for modification */}
                      {!isGenerating && snippet?.codeSnippet && snippet?.accepted !== 'modify' && (
                        <button
                          className="acceptance-btn-header modify-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptanceChange(variable.name, 'modify');
                          }}
                          title="Mark for modification"
                        >
                          ✎ Modify
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="variable-card-content">
                    {isFieldVisible('type') && (
                      <div className="variable-info-row">
                        <div className="variable-info-label">Type:</div>
                        <div className="variable-info-value">
                          {variable.type || '—'}
                        </div>
                      </div>
                    )}

                    {isFieldVisible('length') && variable.length && (
                      <div className="variable-info-row">
                        <div className="variable-info-label">Length:</div>
                        <div className="variable-info-value">{variable.length}</div>
                      </div>
                    )}

                    {isFieldVisible('format') && variable.format && (
                      <div className="variable-info-row">
                        <div className="variable-info-label">Format:</div>
                        <div className="variable-info-value">{variable.format}</div>
                      </div>
                    )}

                    {isFieldVisible('origin') && (
                      <div className="variable-info-row">
                        <div className="variable-info-label">Origin:</div>
                        <div className="variable-info-value">
                          {variable.origin || variable.extra?.Origin || variable.extra?.origin || '—'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="variable-card-details">
                      {/* Derivation */}
                      {isFieldVisible('derivation') && variable.derivation && (
                        <div className="detail-block">
                          <div className="detail-block-title">Derivation Logic</div>
                          <div className="detail-block-content">
                            {getDerivationText(variable)}
                          </div>
                        </div>
                      )}

                      {/* Rationale */}
                      {isFieldVisible('rationale') && snippet?.rationale && (
                        <div className="detail-block">
                          <div className="detail-block-title">Coding Rationale</div>
                          <div className="detail-block-content">
                            {snippet.rationale}
                          </div>
                        </div>
                      )}

                      {/* Pseudo-Code */}
                      {isFieldVisible('pseudo') && snippet?.pseudoCode && (
                        <div className="detail-block">
                          <div className="detail-block-title">
                            🔍 Pseudo-Code
                            {snippet.pseudoSummary && (
                              <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#9ca3af', marginLeft: '8px' }}>
                                — {snippet.pseudoSummary}
                              </span>
                            )}
                          </div>
                          <pre className="detail-code-block" style={{ background: '#f5f5f5', borderLeft: '4px solid #007acc' }}>
                            {snippet.pseudoCode}
                          </pre>
                        </div>
                      )}

                      {/* Code Snippet */}
                      {isFieldVisible('code') && (
                        <>
                          {isGenerating ? (
                            <div className="detail-block">
                              <div className="detail-block-title">Code Snippet ({programmingLanguage})</div>
                              <div className="code-loading-expanded">
                                <Loader2 size={20} className="spinning" />
                                <span>Generating code...</span>
                              </div>
                            </div>
                          ) : snippet?.error ? (
                            <div className="detail-block">
                              <div className="detail-block-title">Code Snippet ({programmingLanguage})</div>
                              <div className="code-error-expanded">
                                <AlertCircle size={16} />
                                <span>{snippet.error}</span>
                              </div>
                            </div>
                          ) : snippet?.codeSnippet ? (
                            <div className="detail-block">
                              <div className="detail-block-title">Code Snippet ({programmingLanguage})</div>
                              <pre className="detail-code-block">
                                <code dangerouslySetInnerHTML={{ __html: highlightCode(snippet.codeSnippet, programmingLanguage) }} />
                              </pre>
                              {snippet?.metadata?.user_note_applied && (
                                <div className="code-badge-expanded note-applied">
                                  ✓ Generated using user notes
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="detail-block">
                              <div className="detail-block-title">Code Snippet ({programmingLanguage})</div>
                              <div className="detail-block-content" style={{ color: '#9ca3af' }}>
                                Not generated yet. Use "Get AI Inputs" button to generate code for all variables.
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* User Notes - Show when marked as modify or when approved (for future modifications) */}
                      {snippet?.accepted === 'modify' && (
                        <div className="detail-block">
                          <div className="detail-block-title">User Notes</div>
                          <textarea
                            className={`detail-textarea ${needsNotes ? 'required' : ''}`}
                            placeholder="Describe the change you expect in this snippet..."
                            value={snippet?.userNotes || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleNotesChange(variable.name, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            rows={3}
                          />
                          {needsNotes && (
                            <div className="notes-hint warning" style={{ marginTop: '6px', fontSize: '11px', color: '#f59e0b' }}>
                              ⚠ User notes are required to regenerate code with modifications
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  )}

                  {/* Card Footer - Show More/Less Only */}
                  <div className="variable-card-footer" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="secondary"
                      onClick={() => toggleCardExpansion(variable.name)}
                      title={isExpanded ? 'Show less' : 'Show more details'}
                      style={{ width: '100%' }}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={14} />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          Show More
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pair-programming-empty">
            <div className="pair-programming-empty-title">
              {searchQuery ? 'No Variables Match Your Search' : 'No Variables Found'}
            </div>
            <div className="pair-programming-empty-subtitle">
              {searchQuery 
                ? 'Try adjusting your search filters' 
                : 'Load a dataset to see variables here'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
