import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { message, Dropdown, Checkbox } from 'antd';
import { Code2, Loader2, AlertCircle, Search, ChevronDown, ChevronUp, Eye, Pencil } from 'lucide-react';
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


// Highlight pseudo-code keywords for domain expert clarity
const highlightPseudoCode = (pseudoCode: string): string => {
  let highlighted = pseudoCode;

  // Escape HTML
  highlighted = highlighted
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Pseudo-code keywords (domain expert friendly)
  const keywords = /\b(IF|THEN|ELSE|FOR|WHILE|AND|OR|NOT|FOREACH|CALL|RETURN|SET|TO|IN|END)\b/g;
  highlighted = highlighted.replace(keywords, '<span class="pseudo-keyword">$&</span>');

  // Data domain references (SDTM domains)
  const domains = /\b(DM|AE|CM|LB|VS|EX|MH|SV|PE|DS|DA|DV|PC|PP|QS|SE|SS|TA|TF|TI|TV|EG|ET|FA|FB|FC|FD|FE|FF|FS|FX|IE|IG|IP|IS|IW|LF|LV|MB|MD|MG|MM|MS|MU|MW|MY|OB|OE|OM|OS|OT|PA|PD|PG|PK|RM|RS|RX|SA|SG|SI|SM|SN|SO|SP|SR|ST|SU|SW|SX|TM|TP|TR|TT|TX|UC|UE|VS|XP|ZG|ZU)\b/g;
  highlighted = highlighted.replace(domains, '<span class="sdtm-domain">$&</span>');

  // Numbers
  highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="pseudo-number">$&</span>');

  return highlighted;
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

// Derive a deterministic accent palette from the variable name for visual cues
const getVariableAccent = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    accent: `hsl(${hue}, 78%, 42%)`,
    accentSoft: `hsla(${hue}, 78%, 94%, 0.9)`,
    accentStrong: `hsl(${hue}, 78%, 30%)`,
  };
};

const PairProgrammingAreaComponent: React.FC<PairProgrammingAreaProps> = ({
  variables,
  categoryName,
}) => {
  const {
    pairProgramming,
    setPairProgrammingNotes,
    setPairProgrammingAcceptance,
    setPairProgrammingSnippet,
    programmingLanguage,
    categorizedVariables,
    projectConfig,
    specificationFile
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

  // Auto-detect derivation column from spec, with fallbacks for common column names
  const getDerivationText = (variable: VariableInfo): string => {
    const direct = variable.derivation?.trim();
    if (direct) return direct;

    const candidate = [
      'derivation',
      'Derivation',
      'DERIVATION',
      'Source/Derivation',
      'Source / Derivation',
      'Source_Derivation',
      'Derivation Logic',
      'derivation_logic',
      'DerivationLogic',
      'DERIVATION_LOGIC'
    ].map(key => variable.extra?.[key]?.trim()).find(val => val);

    return candidate || 'No derivation logic specified';
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
    // For modification, require user notes
    if (accepted === 'modify') {
      const snippet = pairProgramming.snippets[variable];
      const hasNotes = snippet?.userNotes?.trim();
      if (!hasNotes) {
        message.error('User notes are required to mark for modification. Please describe the changes needed.', 3);
        // Focus on notes field in AI panel if variable is selected
        setTimeout(() => {
          const textarea = document.querySelector('.ai-notes-editor') as HTMLTextAreaElement;
          if (textarea) {
            textarea.focus();
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add temporary highlight
            textarea.classList.add('notes-required-highlight');
            setTimeout(() => {
              textarea.classList.remove('notes-required-highlight');
            }, 2000);
          }
        }, 100);
        return; // Don't proceed with marking for modification
      }
    }

    setPairProgrammingAcceptance(variable, accepted);
    // Provide immediate feedback
    if (accepted === 'accept') {
      message.success(`${variable} approved`, 1.5);
    } else {
      message.success(`${variable} marked for logic modification`, 2);
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'to-be-modified'>('all');
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [selectedVariable, setSelectedVariable] = useState<string | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState<boolean>(false);
  const [aiPanelOffset, setAiPanelOffset] = useState<number>(120);

  const headerRef = useRef<HTMLDivElement>(null);

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
  const selectedIndex = useMemo(
    () => filteredVariables.findIndex((v) => v.name === selectedVariable),
    [filteredVariables, selectedVariable]
  );

  const goToVariable = useCallback(
    (direction: 1 | -1) => {
      if (!filteredVariables.length) return;
      if (selectedIndex === -1) {
        const fallback = filteredVariables[0];
        setSelectedVariable(fallback?.name || null);
        setIsAiPanelOpen(!!fallback);
        return;
      }
      const nextIndex = (selectedIndex + direction + filteredVariables.length) % filteredVariables.length;
      const nextVar = filteredVariables[nextIndex];
      if (nextVar) {
        setSelectedVariable(nextVar.name);
        setIsAiPanelOpen(true);
      }
    },
    [filteredVariables, selectedIndex]
  );

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

      // Filter by modification status
      if (filterStatus === 'to-be-modified') {
        const snippet = pairProgramming.snippets[variable.name];
        return matchesSearch && snippet?.accepted === 'modify';
      }

      // 'all' shows everything
      return matchesSearch;
    });
  }, [variables, pairProgramming.snippets, searchQuery, filterStatus]);

  // If filtering removes the selected variable, close the AI panel to keep DOM stable
  useEffect(() => {
    if (!filteredVariables.length) {
      setSelectedVariable(null);
      setIsAiPanelOpen(false);
      return;
    }
    if (selectedVariable && !filteredVariables.find((v) => v.name === selectedVariable)) {
      setSelectedVariable(null);
      setIsAiPanelOpen(false);
    }
  }, [filteredVariables, selectedVariable]);

  // Cleanup when component unmounts to prevent removeChild errors
  useEffect(() => {
    return () => {
      // Close modal when unmounting
      setIsAiPanelOpen(false);
      setSelectedVariable(null);
    };
  }, []);

  const updateAiPanelOffset = useCallback(() => {
    const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0;
    const buffer = 12; // keep a little breathing room below the sticky header
    const nextOffset = Math.max(headerHeight + buffer, 120);
    setAiPanelOffset(nextOffset);
  }, []);

  useEffect(() => {
    updateAiPanelOffset();
    window.addEventListener('resize', updateAiPanelOffset);
    return () => window.removeEventListener('resize', updateAiPanelOffset);
  }, [updateAiPanelOffset]);

  useEffect(() => {
    updateAiPanelOffset();
  }, [updateAiPanelOffset, categoryName, filteredVariables.length]);

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

  const handleCardSelect = (variableName: string) => {
    setSelectedVariable(prev => {
      const newSelection = prev === variableName ? null : variableName;
      setIsAiPanelOpen(newSelection !== null);
      return newSelection;
    });
  };

  const handleCloseAiPanel = () => {
    setSelectedVariable(null);
    setIsAiPanelOpen(false);
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
      {/* Pair Programming Header - Redesigned for Better UX */}
      <div className="pair-programming-header" ref={headerRef}>
        {/* Left Section: Title and Context */}
        <div className="header-left-section">
          <div className="header-brand">
            <Code2 size={22} className="header-icon" />
            <div className="header-title-group">
              <h2 className="header-title">Pair Programming Area</h2>
              <div className="header-subtitle">
                {(projectConfig.studyId || specificationFile?.name) && (
                  <>
                    {projectConfig.studyId && (
                      <span className="header-study-info">
                        Study: {projectConfig.studyId}
                      </span>
                    )}
                    {projectConfig.studyId && specificationFile?.name && (
                      <span className="header-divider">•</span>
                    )}
                    {specificationFile?.name && (
                      <span className="header-file-info">
                        File: {specificationFile.name}
                      </span>
                    )}
                    {(projectConfig.studyId || specificationFile?.name) && (
                      <span className="header-divider">•</span>
                    )}
                  </>
                )}
                <span className="header-category">{categoryName}</span>
                <span className="header-divider">•</span>
                <span className="header-count">
                  {filteredVariables.length} {filterStatus === 'to-be-modified' ? 'to be modified' : 'variables'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center Section: Filter Tabs */}
        <div className="header-center-section">
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filterStatus === 'all' ? 'active' : ''}`}
              onClick={() => setFilterStatus('all')}
            >
              <span className="filter-tab-label">All</span>
              <span className="filter-tab-count">
                {allVariables.length}
              </span>
            </button>
            <button
              className={`filter-tab ${filterStatus === 'to-be-modified' ? 'active' : ''}`}
              onClick={() => setFilterStatus('to-be-modified')}
            >
              <span className="filter-tab-label">To Be Modified</span>
              <span className="filter-tab-count">
                {allVariables.filter(v => pairProgramming.snippets[v.name]?.accepted === 'modify').length}
              </span>
            </button>
          </div>
        </div>

        {/* Right Section: Search and Utilities */}
        <div className="header-right-section">
          <div className="header-utilities">
            {/* Search Box */}
            <div className="header-search-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search variables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="header-search-input"
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Field Visibility Button */}
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
                    return false;
                  }
                }))
              }}
              trigger={['click']}
            >
              <button className="header-utility-btn" title="Configure visible fields">
                <Eye size={18} />
                <span className="utility-btn-text">Fields</span>
                <span className="utility-btn-badge">{visibleFields.size}/{FIELD_DEFINITIONS.length}</span>
              </button>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Two-Column Layout: Specification Cards (Left) + AI Results Panel (Right) */}
      <div
        className={`pair-programming-two-column-layout ${isAiPanelOpen ? 'ai-panel-open' : 'ai-panel-closed'}`}
        style={{ ['--ai-panel-sticky-offset' as any]: `${aiPanelOffset}px` }}
      >
        {/* Left Column: Variable Cards (Specification Data Only) */}
        <div
          ref={contentAreaRef}
          className={`pair-programming-cards-column density-${viewDensity} size-${cardSizePreset}`}
        >
          {/* Variables Grid */}
          {filteredVariables.length > 0 ? (
            <div className={`pair-programming-variables-grid density-${viewDensity} size-${cardSizePreset}`}>
              {filteredVariables.map((variable) => {
                const snippet = pairProgramming.snippets[variable.name];
                const isGenerating = pairProgramming.isGenerating[variable.name];
                const isExpanded = expandedCards.has(variable.name);
                const isSelected = selectedVariable === variable.name;
                const derivationText = getDerivationText(variable);
                const hasDerivation = derivationText && derivationText !== 'No derivation logic specified';

                return (
                  <div
                    key={variable.name}
                    className={`variable-card ${isExpanded ? 'expanded' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleCardSelect(variable.name)}
                  >
                    {/* Card Header - Redesigned for clarity */}
                    <div className="variable-card-header">
                      <div className="variable-card-main-info">
                        <div className="variable-card-name-section">
                          <div className="variable-card-name">
                            {variable.name}
                          </div>
                          {variable.is_required && (
                            <span className="variable-badge required required-inline">Required</span>
                          )}
                          {/* Modify button - subtle, top right */}
                          {!isGenerating && snippet?.codeSnippet && snippet?.accepted !== 'modify' && (
                            <button
                              className="modify-icon-btn-header"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAcceptanceChange(variable.name, 'modify');
                              }}
                              title="Mark for modification"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>
                        <div className="variable-card-label">
                          {variable.label || 'No label'}
                        </div>
                      </div>

                      {/* Status badges - only when needed */}
                      <div className="variable-card-status">
                        {isGenerating && (
                          <span className="variable-badge status-pending">
                            ⏳ Generating
                          </span>
                        )}
                        {!isGenerating && snippet?.accepted === 'modify' && (
                          <span className={`variable-badge ${getStatusBadgeClass('modify')}`}>
                            {snippet.userNotes?.trim()
                              ? '🔧 Modification Required'
                              : '⚠ Modification Required'}
                          </span>
                        )}
                        {!isGenerating && snippet?.accepted === 'modify' && snippet?.userNotes?.trim() && (
                          <span className="variable-badge notes-indicator" title={`Notes: ${snippet.userNotes.substring(0, 50)}...`}>
                            📝 Has User Notes
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Variable Specifications - Clean, scannable layout */}
                    <div className="variable-card-specs">
                      {(isFieldVisible('type') || (isFieldVisible('length') && variable.length) || isFieldVisible('origin') || (isFieldVisible('format') && variable.format)) && (
                        <div className="variable-specs-grid">
                          {isFieldVisible('type') && (
                            <div className="variable-spec-item">
                              <span className="variable-spec-label">Type</span>
                              <span className="variable-spec-value">{variable.type || '—'}</span>
                            </div>
                          )}
                          {isFieldVisible('length') && variable.length && (
                            <div className="variable-spec-item">
                              <span className="variable-spec-label">Length</span>
                              <span className="variable-spec-value">{variable.length}</span>
                            </div>
                          )}
                          {isFieldVisible('origin') && (
                            <div className="variable-spec-item">
                              <span className="variable-spec-label">Origin</span>
                              <span className="variable-spec-value">
                                {variable.origin || variable.extra?.Origin || variable.extra?.origin || '—'}
                              </span>
                            </div>
                          )}
                          {isFieldVisible('format') && variable.format && (
                            <div className="variable-spec-item">
                              <span className="variable-spec-label">Format</span>
                              <span className="variable-spec-value">{variable.format}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expandable Details - Only Specification Data (Derivation Logic) */}
                    {isExpanded && (
                      <div className="variable-card-details">
                        {/* Derivation Logic - Only specification data shown in cards */}
                        {isFieldVisible('derivation') && hasDerivation && (
                          <div className="detail-block">
                            <div className="detail-block-title">Derivation Logic</div>
                            <div className="detail-block-content">
                              {derivationText}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Footer - Show More/Less for Derivation Logic Only */}
                    {hasDerivation && (
                      <div className="variable-card-footer" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="secondary"
                          onClick={() => toggleCardExpansion(variable.name)}
                          title={isExpanded ? 'Show less' : 'Show derivation logic'}
                          style={{ width: '100%' }}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={14} />
                              Hide Derivation
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} />
                              Show Derivation
                            </>
                          )}
                        </button>
                      </div>
                    )}
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
                  : filterStatus === 'to-be-modified'
                    ? 'No variables marked for modification yet.'
                    : 'Load a dataset to see variables here'}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: AI Results Panel (disabled in floating modal mode) */}
        {false && isAiPanelOpen && (
          <div className="pair-programming-ai-panel">
            {selectedVariable ? (() => {
              const selectedVar = filteredVariables.find(v => v.name === selectedVariable);
              if (!selectedVar) return null;
              const snippet = pairProgramming.snippets[selectedVar.name];
              const isGenerating = pairProgramming.isGenerating[selectedVar.name];
              const trimmedNotes = snippet?.userNotes?.trim() ?? '';
              const needsNotes = snippet?.accepted === 'modify' && !trimmedNotes;
              const derivationText = getDerivationText(selectedVar);
              const hasDerivation = derivationText && derivationText !== 'No derivation logic specified';
              const pseudoContent = snippet?.pseudoCode || (hasDerivation ? derivationText : '') || snippet?.rationale;
              const accent = getVariableAccent(selectedVar.name);
              const variableInitial = selectedVar.name.slice(0, 1).toUpperCase();

              return (
                <div
                  className="ai-results-panel"
                  style={{
                    ['--ai-var-accent' as any]: accent.accent,
                    ['--ai-var-accent-soft' as any]: accent.accentSoft,
                    ['--ai-var-accent-strong' as any]: accent.accentStrong,
                  }}
                >
                  <div className="ai-panel-header">
                    <div className="ai-panel-title accented">
                      <span className="ai-panel-accent-dot" aria-hidden="true" />
                      <span className="ai-panel-accent-initial" aria-hidden="true">{variableInitial}</span>
                      <Code2 size={18} />
                      <span className="ai-panel-title-label">AI Results:</span>
                      <span className="ai-panel-variable-name">{selectedVar.name}</span>
                    </div>
                    <button
                      className="ai-panel-close"
                      onClick={handleCloseAiPanel}
                      title="Close panel"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="ai-panel-content">
                    {hasDerivation && (
                      <div className="ai-spec-derivation-section">
                        <div className="ai-section-header">
                          <div className="ai-section-title-group">
                            <span className="ai-spec-badge">Specification</span>
                            <span className="ai-section-title">Derivation Logic</span>
                          </div>
                        </div>
                        <div className="ai-spec-derivation-content">
                          {derivationText}
                        </div>
                      </div>
                    )}

                    {/* Coding Rationale - AI Generated (Read-only) */}
                    {isFieldVisible('rationale') && (
                      <div className="ai-result-section ai-generated-section">
                        <div className="ai-section-header">
                          <div className="ai-section-title-group">
                            <span className="ai-generated-badge">AI Generated</span>
                            <span className="ai-section-title">Coding Rationale</span>
                          </div>
                        </div>
                        {snippet?.rationale ? (
                          <div className="ai-readonly-content">
                            {snippet.rationale}
                          </div>
                        ) : (
                          <div className="ai-empty-state">
                            <span>No rationale generated yet. Generate AI inputs to see rationale.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pseudo-Code - AI Generated (Read-only) */}
                    {isFieldVisible('pseudo') && (
                      <div className="ai-result-section ai-generated-section">
                        <div className="ai-section-header">
                          <div className="ai-section-title-group">
                            <span className="ai-generated-badge">AI Generated</span>
                            <span className="ai-section-title">Pseudo-Code (Domain Expert View)</span>
                          </div>
                          {snippet?.pseudoSummary && (
                            <span className="ai-section-subtitle">{snippet.pseudoSummary}</span>
                          )}
                        </div>
                        {pseudoContent ? (
                          <div className="ai-readonly-content ai-code-content" key={`pseudo-${variable.name}`}>
                            <pre><code dangerouslySetInnerHTML={{ __html: highlightPseudoCode(pseudoContent) }} /></pre>
                          </div>
                        ) : (
                          <div className="ai-empty-state">
                            <span>No pseudo-code generated yet. Generate AI inputs to see pseudo-code.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Code Snippet - AI Generated (Read-only) */}
                    {isFieldVisible('code') && (
                      <div className="ai-result-section ai-generated-section">
                        <div className="ai-section-header">
                          <div className="ai-section-title-group">
                            <span className="ai-generated-badge">AI Generated</span>
                            <span className="ai-section-title">Code Snippet ({programmingLanguage})</span>
                          </div>
                        </div>
                        {isGenerating ? (
                          <div className="ai-loading-state">
                            <Loader2 size={20} className="spinning" />
                            <span>Generating code...</span>
                          </div>
                        ) : snippet?.error ? (
                          <div className="ai-error-state">
                            <AlertCircle size={16} />
                            <span>{snippet.error}</span>
                          </div>
                        ) : snippet?.codeSnippet ? (
                          <>
                            <div className="ai-readonly-content ai-code-content" key={`code-${variable.name}-${programmingLanguage}`}>
                              <pre><code dangerouslySetInnerHTML={{ __html: highlightCode(snippet.codeSnippet, programmingLanguage) }} /></pre>
                            </div>
                            {snippet?.metadata?.user_note_applied && (
                              <div className="ai-code-badge">
                                ✓ Generated using user notes
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="ai-empty-state">
                            <span>Not generated yet. Use "Get AI Inputs" button to generate code.</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* User Notes - Editable Section */}
                    <div className={`ai-result-section ai-user-notes-section ${snippet?.accepted === 'modify' && needsNotes ? 'notes-required' : ''}`}>
                      <div className="ai-section-header">
                        <div className="ai-section-title-group">
                          <span className="ai-user-badge">Your Input</span>
                          <span className="ai-section-title">User Notes</span>
                          {snippet?.accepted === 'modify' && (
                            <span className="ai-section-required-badge">Required</span>
                          )}
                        </div>
                      </div>
                      <div className="ai-notes-wrapper">
                        <textarea
                          className={`ai-notes-editor ai-editable-field ${snippet?.accepted === 'modify' && needsNotes ? 'notes-invalid' : ''} ${snippet?.accepted === 'modify' && !needsNotes ? 'notes-valid' : ''}`}
                          placeholder={snippet?.accepted === 'modify'
                            ? "Required: Describe the specific changes needed for this variable (e.g., 'Change the calculation to use median instead of mean', 'Add validation for missing values', etc.)"
                            : "Add notes for modifications or clarifications..."}
                          value={snippet?.userNotes || ''}
                          onChange={(e) => handleNotesChange(selectedVar.name, e.target.value)}
                          rows={5}
                          required={snippet?.accepted === 'modify'}
                        />
                        {snippet?.accepted === 'modify' && (
                          <div className="ai-notes-validation">
                            {needsNotes ? (
                              <div className="ai-notes-error">
                                <AlertCircle size={14} />
                                <span>Notes are required to proceed with modification</span>
                              </div>
                            ) : (
                              <div className="ai-notes-success">
                                <span>✓ Notes provided - Ready to update logic</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="ai-panel-actions">
                      {snippet?.codeSnippet && !snippet?.error && (
                        <>
                          {snippet.accepted !== 'modify' && (
                            <button
                              className={`ai-action-btn modify-btn ${!snippet?.userNotes?.trim() ? 'requires-notes' : ''}`}
                              onClick={() => {
                                const hasNotes = snippet?.userNotes?.trim();
                                if (hasNotes) {
                                  handleAcceptanceChange(selectedVar.name, 'modify');
                                } else {
                                  handleAcceptanceChange(selectedVar.name, 'modify'); // Will show error and focus notes
                                }
                              }}
                              title={snippet?.userNotes?.trim()
                                ? "Mark for logic modification"
                                : "Add user notes first - Notes are required to mark for modification"}
                            >
                              🔧 Mark for Logic Modification
                              {!snippet?.userNotes?.trim() && <span className="btn-required-indicator">*</span>}
                            </button>
                          )}
                          {snippet.accepted !== 'accept' && (
                            <button
                              className="ai-action-btn approve-btn"
                              onClick={() => handleAcceptanceChange(selectedVar.name, 'accept')}
                              disabled={snippet.accepted === 'modify' && !snippet?.userNotes?.trim()}
                              title={snippet.accepted === 'modify'
                                ? (snippet?.userNotes?.trim()
                                  ? "Update the logic with your modifications"
                                  : "Add notes before updating logic")
                                : "Approve this variable"}
                            >
                              {snippet.accepted === 'modify' ? '🔄 Update Logic' : '✓ Approve'}
                            </button>
                          )}
                        </>
                      )}
                      {/* Show info when marked for modification but no code exists */}
                      {!snippet?.codeSnippet && snippet?.accepted === 'modify' && (
                        <div className="ai-action-info">
                          <span className="ai-action-info-text">
                            🔧 This variable is marked for logic modification. Generate code to see the updated implementation.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="ai-panel-empty">
                <Code2 size={48} className="ai-panel-empty-icon" />
                <div className="ai-panel-empty-title">Select a Variable</div>
                <div className="ai-panel-empty-subtitle">
                  Click on a variable card to view and edit AI-generated results
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {isAiPanelOpen && selectedVariable && filteredVariables.find(v => v.name === selectedVariable) && (() => {
        const selectedVar = filteredVariables.find(v => v.name === selectedVariable)!;
        const snippet = pairProgramming.snippets[selectedVar.name];
        const isGenerating = pairProgramming.isGenerating[selectedVar.name];
        const trimmedNotes = snippet?.userNotes?.trim() ?? '';
        const needsNotes = snippet?.accepted === 'modify' && !trimmedNotes;
        const derivationText = getDerivationText(selectedVar);
        const hasDerivation = derivationText && derivationText !== 'No derivation logic specified';
        const pseudoContent = snippet?.pseudoCode || (hasDerivation ? derivationText : '') || snippet?.rationale;
        const accent = getVariableAccent(selectedVar.name);
        const variableInitial = selectedVar.name.slice(0, 1).toUpperCase();
        const canApprove = snippet && (snippet.accepted !== 'accept') && !(snippet.accepted === 'modify' && !snippet?.userNotes?.trim());
        const hasNavigation = filteredVariables.length > 1;

        return (
          <div key={`modal-${selectedVar.name}`} className="ai-floating-modal" role="dialog" aria-label={`AI Results for ${selectedVar.name}`}>
            <div key={`backdrop-${selectedVar.name}`} className="ai-floating-modal-backdrop" onClick={handleCloseAiPanel} aria-hidden="true" />
            <div key={`panel-${selectedVar.name}`} className="ai-floating-modal-panel">
              <div className="ai-modal-toolbar">
                {hasNavigation && (
                  <button className="secondary" onClick={() => goToVariable(-1)} title="Previous variable">
                    ← Previous
                  </button>
                )}
                <button className="secondary" onClick={handleCloseAiPanel} title="Close workspace">
                  ✕ Close
                </button>
                {snippet?.accepted !== 'modify' && (
                  <button
                    className="secondary"
                    onClick={() => handleAcceptanceChange(selectedVar.name, 'modify')}
                    title="Mark for modification"
                  >
                    ✎ Modify
                  </button>
                )}
                {canApprove && (
                  <button
                    className="primary"
                    onClick={() => handleAcceptanceChange(selectedVar.name, 'accept')}
                    disabled={snippet?.accepted === 'modify' && !snippet?.userNotes?.trim()}
                    title="Approve"
                  >
                    ✓ Approve
                  </button>
                )}
                {hasNavigation && (
                  <button className="secondary" onClick={() => goToVariable(1)} title="Next variable">
                    Next →
                  </button>
                )}
              </div>
              <div
                className="ai-results-panel"
                style={{
                  ['--ai-var-accent' as any]: accent.accent,
                  ['--ai-var-accent-soft' as any]: accent.accentSoft,
                  ['--ai-var-accent-strong' as any]: accent.accentStrong,
                }}
              >
                <div className="ai-panel-header">
                  <div className="ai-panel-title accented">
                    <span className="ai-panel-accent-dot" aria-hidden="true" />
                    <span className="ai-panel-accent-initial" aria-hidden="true">{variableInitial}</span>
                    <Code2 size={18} />
                    <span className="ai-panel-title-label">AI Results:</span>
                    <span className="ai-panel-variable-name">{selectedVar.name}</span>
                  </div>
                  <button
                    className="ai-panel-close"
                    onClick={handleCloseAiPanel}
                    title="Close panel"
                  >
                    �o
                  </button>
                </div>

                <div className="ai-panel-content">
                  {hasDerivation && (
                    <div className="ai-spec-derivation-section">
                      <div className="ai-section-header">
                        <div className="ai-section-title-group">
                          <span className="ai-spec-badge">Specification</span>
                          <span className="ai-section-title">Derivation Logic</span>
                        </div>
                      </div>
                      <div className="ai-spec-derivation-content">
                        {derivationText}
                      </div>
                    </div>
                  )}

                  {/* Coding Rationale - AI Generated (Read-only) */}
                  {isFieldVisible('rationale') && (
                    <div className="ai-result-section ai-generated-section">
                      <div className="ai-section-header">
                        <div className="ai-section-title-group">
                          <span className="ai-generated-badge">AI Generated</span>
                          <span className="ai-section-title">Coding Rationale</span>
                        </div>
                      </div>
                      {snippet?.rationale ? (
                        <div className="ai-readonly-content">
                          {snippet.rationale}
                        </div>
                      ) : (
                        <div className="ai-empty-state">
                          <span>No rationale generated yet. Generate AI inputs to see rationale.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pseudo-Code - AI Generated (Read-only) */}
                  {isFieldVisible('pseudo') && (
                    <div className="ai-result-section ai-generated-section">
                      <div className="ai-section-header">
                        <div className="ai-section-title-group">
                          <span className="ai-generated-badge">AI Generated</span>
                          <span className="ai-section-title">Pseudo-Code (Domain Expert View)</span>
                        </div>
                        {snippet?.pseudoSummary && (
                          <span className="ai-section-subtitle">{snippet.pseudoSummary}</span>
                        )}
                      </div>
                      {pseudoContent ? (
                        <div className="ai-readonly-content ai-code-content" key={`pseudo-${selectedVar.name}`}>
                          <pre><code dangerouslySetInnerHTML={{ __html: highlightPseudoCode(pseudoContent) }} /></pre>
                        </div>
                      ) : (
                        <div className="ai-empty-state">
                          <span>No pseudo-code generated yet. Generate AI inputs to see pseudo-code.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Code Snippet - AI Generated (Read-only) */}
                  {isFieldVisible('code') && (
                    <div className="ai-result-section ai-generated-section">
                      <div className="ai-section-header">
                        <div className="ai-section-title-group">
                          <span className="ai-generated-badge">AI Generated</span>
                          <span className="ai-section-title">Code Snippet ({programmingLanguage})</span>
                        </div>
                      </div>
                      {isGenerating ? (
                        <div className="ai-loading-state">
                          <Loader2 size={20} className="spinning" />
                          <span>Generating code...</span>
                        </div>
                      ) : snippet?.error ? (
                        <div className="ai-error-state">
                          <AlertCircle size={16} />
                          <span>{snippet.error}</span>
                        </div>
                      ) : snippet?.codeSnippet ? (
                        <>
                          <div className="ai-readonly-content ai-code-content" key={`code-${selectedVar.name}-${programmingLanguage}`}>
                            <pre><code dangerouslySetInnerHTML={{ __html: highlightCode(snippet.codeSnippet, programmingLanguage) }} /></pre>
                          </div>
                          {snippet?.metadata?.user_note_applied && (
                            <div className="ai-code-badge">
                              �o" Generated using user notes
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="ai-empty-state">
                          <span>Not generated yet. Use "Get AI Inputs" button to generate code.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* User Notes - Editable Section */}
                  <div className={`ai-result-section ai-user-notes-section ${snippet?.accepted === 'modify' && needsNotes ? 'notes-required' : ''}`}>
                    <div className="ai-section-header">
                      <div className="ai-section-title-group">
                        <span className="ai-user-badge">Your Input</span>
                        <span className="ai-section-title">User Notes</span>
                        {snippet?.accepted === 'modify' && (
                          <span className="ai-section-required-badge">Required</span>
                        )}
                      </div>
                    </div>
                    <div className="ai-notes-wrapper">
                      <textarea
                        className={`ai-notes-editor ai-editable-field ${snippet?.accepted === 'modify' && needsNotes ? 'notes-invalid' : ''} ${snippet?.accepted === 'modify' && !needsNotes ? 'notes-valid' : ''}`}
                        placeholder={snippet?.accepted === 'modify'
                          ? "Required: Describe the specific changes needed for this variable (e.g., 'Change the calculation to use median instead of mean', 'Add validation for missing values', etc.)"
                          : "Add notes for modifications or clarifications..."}
                        value={snippet?.userNotes || ''}
                        onChange={(e) => handleNotesChange(selectedVar.name, e.target.value)}
                        rows={5}
                        required={snippet?.accepted === 'modify'}
                      />
                      {snippet?.accepted === 'modify' && (
                        <div className="ai-notes-validation">
                          {needsNotes ? (
                            <div className="ai-notes-error">
                              <AlertCircle size={14} />
                              <span>Notes are required to proceed with modification</span>
                            </div>
                          ) : (
                            <div className="ai-notes-success">
                              <span>�o" Notes provided - Ready to update logic</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="ai-panel-actions">
                    {snippet?.codeSnippet && !snippet?.error && (
                      <>
                        {snippet.accepted !== 'modify' && (
                          <button
                            className={`ai-action-btn modify-btn ${!snippet?.userNotes?.trim() ? 'requires-notes' : ''}`}
                            onClick={() => {
                              const hasNotes = snippet?.userNotes?.trim();
                              if (hasNotes) {
                                handleAcceptanceChange(selectedVar.name, 'modify');
                              } else {
                                handleAcceptanceChange(selectedVar.name, 'modify'); // Will show error and focus notes
                              }
                            }}
                            title={snippet?.userNotes?.trim()
                              ? "Mark for logic modification"
                              : "Add user notes first - Notes are required to mark for modification"}
                          >
                            dY" Mark for Logic Modification
                            {!snippet?.userNotes?.trim() && <span className="btn-required-indicator">*</span>}
                          </button>
                        )}
                        {snippet.accepted !== 'accept' && (
                          <button
                            className="ai-action-btn approve-btn"
                            onClick={() => handleAcceptanceChange(selectedVar.name, 'accept')}
                            disabled={snippet.accepted === 'modify' && !snippet?.userNotes?.trim()}
                            title={snippet.accepted === 'modify'
                              ? (snippet?.userNotes?.trim()
                                ? "Update the logic with your modifications"
                                : "Add notes before updating logic")
                              : "Approve this variable"}
                          >
                            {snippet.accepted === 'modify' ? 'dY", Update Logic' : '�o" Approve'}
                          </button>
                        )}
                      </>
                    )}
                    {/* Show info when marked for modification but no code exists */}
                    {!snippet?.codeSnippet && snippet?.accepted === 'modify' && (
                      <div className="ai-action-info">
                        <span className="ai-action-info-text">
                          dY" This variable is marked for logic modification. Generate code to see the updated implementation.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// Memoize component to prevent unnecessary re-renders that can cause removeChild errors
const PairProgrammingArea = React.memo(PairProgrammingAreaComponent, (prevProps, nextProps) => {
  // Only re-render if variables or categoryName actually changed
  return (
    prevProps.variables.length === nextProps.variables.length &&
    prevProps.categoryName === nextProps.categoryName &&
    prevProps.variables.every((v, i) => v.name === nextProps.variables[i]?.name)
  );
});

export default PairProgrammingArea;
