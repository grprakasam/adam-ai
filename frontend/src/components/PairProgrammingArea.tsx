import React, { useState, useMemo, useRef } from 'react';
import { message } from 'antd';
import { Code2, Loader2, AlertCircle, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { adamApi } from '../services/api';
import type { CodeSnippetRequest, VariableInfo } from '../types';
import './PairProgrammingArea.css';

interface PairProgrammingAreaProps {
  variables: VariableInfo[];
  categoryName: string;
}

interface GenerateSnippetOptions {
  userNote?: string;
  silent?: boolean;
}


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

  // Filter and search variables
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'generated' | 'pending'>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const filteredVariables = useMemo(() => {
    return variables.filter(variable => {
      const matchesSearch = 
        variable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (variable.label && variable.label.toLowerCase().includes(searchQuery.toLowerCase()));

      if (filterStatus === 'all') return matchesSearch;
      
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

  const getStatusBadgeLabel = (status?: string) => {
    switch (status) {
      case 'accept':
        return '✓ Accepted';
      case 'reject':
        return '✗ Rejected';
      case 'modify':
        return 'Modify';
      default:
        return '';
    }
  };

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
            {variables.length} variables • {Object.keys(pairProgramming.snippets).length} generated
          </span>
        </div>
      </div>

      {/* Search & Filter Toolbar - Immediately below header, always visible */}
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

          <div className="filter-buttons">
            <button 
              className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              All ({variables.length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'generated' ? 'active' : ''}`}
              onClick={() => setFilterStatus('generated')}
            >
              Generated ({Object.keys(pairProgramming.snippets).length})
            </button>
            <button 
              className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
              onClick={() => setFilterStatus('pending')}
            >
              Pending ({variables.length - Object.keys(pairProgramming.snippets).length})
            </button>
          </div>
        </div>

      {/* Scrollable Content Area */}
      <div ref={contentAreaRef} className="pair-programming-area-content">
        {/* Variables Grid */}
        {filteredVariables.length > 0 ? (
          <div className="pair-programming-variables-grid">
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
                      {!isGenerating && snippet?.accepted && (
                        <span className={`variable-badge ${getStatusBadgeClass(snippet.accepted)}`}>
                          {getStatusBadgeLabel(snippet.accepted)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className="variable-card-content">
                    <div className="variable-info-row">
                      <div className="variable-info-label">Type:</div>
                      <div className="variable-info-value">
                        {variable.type || '—'}
                      </div>
                    </div>

                    {variable.length && (
                      <div className="variable-info-row">
                        <div className="variable-info-label">Length:</div>
                        <div className="variable-info-value">{variable.length}</div>
                      </div>
                    )}

                    {variable.format && (
                      <div className="variable-info-row">
                        <div className="variable-info-label">Format:</div>
                        <div className="variable-info-value">{variable.format}</div>
                      </div>
                    )}

                    <div className="variable-info-row">
                      <div className="variable-info-label">Origin:</div>
                      <div className="variable-info-value">
                        {variable.origin || variable.extra?.Origin || variable.extra?.origin || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="variable-card-details">
                      {/* Derivation */}
                      {variable.derivation && (
                        <div className="detail-block">
                          <div className="detail-block-title">Derivation Logic</div>
                          <div className="detail-block-content">
                            {getDerivationText(variable)}
                          </div>
                        </div>
                      )}

                      {/* Rationale */}
                      {snippet?.rationale && (
                        <div className="detail-block">
                          <div className="detail-block-title">Coding Rationale</div>
                          <div className="detail-block-content">
                            {snippet.rationale}
                          </div>
                        </div>
                      )}

                      {/* Code Snippet */}
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
                            Not generated yet. Click "Generate" below.
                          </div>
                        </div>
                      )}

                      {/* User Notes */}
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
                        </div>
                      )}

                      {/* Acceptance Buttons */}
                      {snippet?.codeSnippet && (
                        <div className="detail-block">
                          <div className="detail-block-title">Acceptance</div>
                          <div className="acceptance-button-group">
                            <button
                              className={`acceptance-btn ${snippet?.accepted === 'accept' ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptanceChange(variable.name, 'accept');
                              }}
                            >
                              ✓ Accept
                            </button>
                            <button
                              className={`acceptance-btn ${snippet?.accepted === 'modify' ? 'active' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptanceChange(variable.name, 'modify');
                              }}
                            >
                              ✎ Modify
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card Footer - Actions */}
                  <div className="variable-card-footer" onClick={(e) => e.stopPropagation()}>
                    <button 
                      className="secondary"
                      onClick={() => toggleCardExpansion(variable.name)}
                      title={isExpanded ? 'Show less' : 'Show more details'}
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
                    <button 
                      className="primary"
                      onClick={() => handleGenerateSnippet(variable)}
                      disabled={isGenerating}
                      title={isGenerating ? 'Generating code...' : 'Generate AI code snippet'}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 size={14} className="spinning" />
                          Generating...
                        </>
                      ) : snippet?.accepted === 'modify' && trimmedNotes ? (
                        <>
                          <RefreshCw size={14} />
                          Regenerate
                        </>
                      ) : (
                        <>
                          <Code2 size={14} />
                          Generate
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
