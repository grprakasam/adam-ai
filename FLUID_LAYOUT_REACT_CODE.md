# React Component Implementation - Fluid Layout

## Complete Card Component Template

```jsx
// Variable Card Component
const VariableCard = ({ 
  variable, 
  snippet, 
  isExpanded, 
  onToggle, 
  onGenerate, 
  isGenerating 
}) => {
  const getStatusBadgeClass = (status) => {
    if (!status) return '';
    return `status-${status}`;
  };

  return (
    <div 
      className={`variable-card ${isExpanded ? 'expanded' : ''}`}
      onClick={onToggle}
    >
      {/* Card Header */}
      <div className="variable-card-header">
        <div className="variable-card-title">
          <div className="variable-card-name">
            {variable.name}
          </div>
          <div className="variable-card-label">
            {variable.label}
          </div>
        </div>
        
        <div className="variable-card-badges">
          {variable.is_required && (
            <span className="variable-badge required">
              Required
            </span>
          )}
          {snippet?.accepted && (
            <span className={`variable-badge ${getStatusBadgeClass(snippet.accepted)}`}>
              {snippet.accepted === 'modify' ? 'Modify' : 
               snippet.accepted === 'accepted' ? '✓ Accepted' :
               snippet.accepted === 'rejected' ? '✗ Rejected' : 'Pending'}
            </span>
          )}
          {isGenerating && (
            <span className="variable-badge status-pending">
              ⏳ Generating
            </span>
          )}
        </div>
      </div>

      {/* Card Content - Quick Info */}
      <div className="variable-card-content">
        <div className="variable-info-row">
          <div className="variable-info-label">Type:</div>
          <div className="variable-info-value">{variable.type || 'Unknown'}</div>
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
          <div className="variable-info-value">{variable.origin || 'Unknown'}</div>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="variable-card-details">
          {variable.derivation && (
            <div className="detail-block">
              <div className="detail-block-title">Derivation Logic</div>
              <div className="detail-block-content">
                {variable.derivation}
              </div>
            </div>
          )}

          {snippet?.rationale && (
            <div className="detail-block">
              <div className="detail-block-title">Coding Rationale</div>
              <div className="detail-block-content">
                {snippet.rationale}
              </div>
            </div>
          )}

          {snippet?.codeSnippet && (
            <div className="detail-block">
              <div className="detail-block-title">Code Snippet</div>
              <div className="detail-block-content" style={{ fontFamily: 'monospace' }}>
                {snippet.codeSnippet}
              </div>
            </div>
          )}

          {snippet?.userNotes && (
            <div className="detail-block">
              <div className="detail-block-title">User Notes</div>
              <div className="detail-block-content">
                {snippet.userNotes}
              </div>
            </div>
          )}

          {snippet?.error && (
            <div className="detail-block" style={{ 
              backgroundColor: '#fef2f2',
              borderLeft: '3px solid #ef4444'
            }}>
              <div className="detail-block-title">Error</div>
              <div className="detail-block-content" style={{ color: '#991b1b' }}>
                {snippet.error}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Card Footer - Actions */}
      <div className="variable-card-footer">
        <button 
          className="secondary"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          {isExpanded ? '⬆ Show Less' : '⬇ Show More'}
        </button>
        <button 
          className="primary"
          onClick={(e) => {
            e.stopPropagation();
            onGenerate();
          }}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>
    </div>
  );
};

export default VariableCard;
```

## Main Component Update

```jsx
// PairProgrammingArea.tsx - Fluid Layout Version
import React, { useState, useMemo } from 'react';
import { Code2, Search } from 'lucide-react';
import VariableCard from './VariableCard';
import './PairProgrammingArea.css';

export const PairProgrammingArea: React.FC<PairProgrammingAreaProps> = ({
  variables,
  pairProgramming,
  onGenerateSnippet,
  // ... other props
}) => {
  // State management
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'generated' | 'pending'>('all');

  // Filter and search variables
  const filteredVariables = useMemo(() => {
    return variables.filter(variable => {
      const matchesSearch = 
        variable.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        variable.label.toLowerCase().includes(searchQuery.toLowerCase());

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

  // Toggle card expansion
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

  // Handle generate
  const handleGenerateSnippet = async (variable: Variable) => {
    try {
      await onGenerateSnippet(variable);
      // Optionally auto-expand to show result
      setExpandedCards(prev => new Set(prev).add(variable.name));
    } catch (error) {
      console.error('Error generating snippet:', error);
    }
  };

  // Empty state
  if (!variables || variables.length === 0) {
    return (
      <div className="pair-programming-area">
        <div className="pair-programming-header">
          <div className="header-info">
            <Code2 size={20} />
            <span className="header-title">Pair Programming Area</span>
            <span className="header-subtitle">No variables loaded</span>
          </div>
        </div>
        <div className="pair-programming-empty">
          <div className="pair-programming-empty-title">
            No Variables Found
          </div>
          <div className="pair-programming-empty-subtitle">
            Load a dataset to see variables here
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pair-programming-area">
      {/* Sticky Header */}
      <div className="pair-programming-header">
        <div className="header-info">
          <Code2 size={20} />
          <span className="header-title">Pair Programming Area</span>
          <span className="header-subtitle">
            {variables.length} variables • {Object.keys(pairProgramming.snippets).length} generated
          </span>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="pair-programming-area-content">
        {/* Optional: Search and Filter Bar */}
        <div className="pair-programming-toolbar">
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search variables..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
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

        {/* Cards Grid */}
        {filteredVariables.length > 0 ? (
          <div className="pair-programming-variables-grid">
            {filteredVariables.map((variable) => {
              const snippet = pairProgramming.snippets[variable.name];
              const isGenerating = pairProgramming.isGenerating[variable.name];
              const isExpanded = expandedCards.has(variable.name);

              return (
                <VariableCard
                  key={variable.name}
                  variable={variable}
                  snippet={snippet}
                  isExpanded={isExpanded}
                  onToggle={() => toggleCardExpansion(variable.name)}
                  onGenerate={() => handleGenerateSnippet(variable)}
                  isGenerating={isGenerating}
                />
              );
            })}
          </div>
        ) : (
          <div className="pair-programming-empty">
            <div className="pair-programming-empty-title">
              No Variables Match Your Search
            </div>
            <div className="pair-programming-empty-subtitle">
              Try adjusting your search filters
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PairProgrammingArea;
```

## Toolbar Styling (Add to CSS)

```css
/* Pair Programming Toolbar - Search and Filters */
.pair-programming-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  flex-wrap: wrap;
  position: sticky;
  top: 70px;
  z-index: 40;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  flex: 1;
  min-width: 200px;
}

.search-box svg {
  color: #6b7280;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  width: 100%;
  color: #1f2937;
}

.search-input::placeholder {
  color: #9ca3af;
}

.filter-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 14px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.filter-btn:hover {
  background: #e5e7eb;
  border-color: #d1d5db;
}

.filter-btn.active {
  background: #10b981;
  border-color: #059669;
  color: white;
  font-weight: 600;
}

@media (max-width: 768px) {
  .pair-programming-toolbar {
    flex-direction: column;
    gap: 12px;
  }

  .search-box {
    min-width: unset;
  }

  .filter-buttons {
    width: 100%;
    justify-content: space-between;
  }

  .filter-btn {
    flex: 1;
    min-width: 60px;
  }
}
```

## Key Features Implemented

✅ **Progressive Disclosure**
- Compact card view by default
- Expand to show full details
- Smooth animations

✅ **Search & Filter**
- Real-time search by name/label
- Filter by generation status
- Count indicators

✅ **Status Visualization**
- Color-coded badges
- Status indicators
- Generation state feedback

✅ **Responsive**
- Mobile: Single column
- Tablet: 2 columns
- Desktop: 3-4 columns
- Large: 4 columns

✅ **Interactions**
- Click card to expand/collapse
- Hover effects
- Button states
- Loading feedback

## Migration Checklist

- [ ] Import `VariableCard` component
- [ ] Replace JSX structure with new layout
- [ ] Add state for `expandedCards`
- [ ] Add state for `searchQuery`
- [ ] Add state for `filterStatus`
- [ ] Add search and filter logic
- [ ] Add toolbar search box
- [ ] Add filter buttons
- [ ] Update CSS (already done!)
- [ ] Test on mobile
- [ ] Test on tablet
- [ ] Test on desktop
- [ ] Test keyboard navigation
- [ ] Test screen reader
- [ ] Remove old table-related code

## Type Definitions

```typescript
interface VariableCardProps {
  variable: Variable;
  snippet?: PairProgrammingSnippet;
  isExpanded: boolean;
  onToggle: () => void;
  onGenerate: () => Promise<void>;
  isGenerating: boolean;
}

interface PairProgrammingAreaProps {
  variables: Variable[];
  pairProgramming: PairProgrammingState;
  onGenerateSnippet: (variable: Variable) => Promise<void>;
  // ... other props
}
```

## Performance Optimization Tips

1. **Memoization:**
   ```jsx
   const VariableCard = React.memo(({ variable, ...props }) => {
     // Component
   });
   ```

2. **Virtual Scrolling (for 100+ variables):**
   ```jsx
   import { FixedSizeList } from 'react-window';
   // Wrap grid with virtual scroller
   ```

3. **Lazy Loading Details:**
   ```jsx
   // Load snippet details on expand, not on mount
   useEffect(() => {
     if (isExpanded && !snippet) {
       fetchSnippetDetails();
     }
   }, [isExpanded]);
   ```

