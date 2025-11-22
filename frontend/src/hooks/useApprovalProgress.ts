import { useMemo } from 'react';
import { useProjectStore } from '../store/projectStore';

export interface ApprovalProgress {
  totalVariables: number;
  approvedVariables: number;
  percentage: number;
  isReadyForGeneration: boolean;
}

/**
 * Hook to calculate approval progress across all categorized variables
 * 
 * Calculates:
 * - Total count of all variables across all categories
 * - Count of approved variables (auto-approved when code exists, unless marked as 'modify')
 * - Percentage of approval
 * - Whether ready for generation (at least one approved variable required)
 * 
 * Auto-approval logic:
 * - Variables with generated code are automatically approved
 * - Variables marked as 'modify' are NOT counted as approved
 * - Updates in real-time when code is generated or approval status changes
 */
export const useApprovalProgress = (): ApprovalProgress => {
  const categorizedVariables = useProjectStore((state) => state.categorizedVariables);
  // Use a selector that will trigger re-render when snippets change
  // Zustand uses shallow equality, so we need to ensure we get a new reference when snippets change
  const snippets = useProjectStore((state) => state.pairProgramming?.snippets || {});

  const progress = useMemo(() => {
    let totalVariables = 0;
    let approvedVariables = 0;

    // Iterate through all categories
    if (categorizedVariables?.categories && Array.isArray(categorizedVariables.categories)) {
      categorizedVariables.categories.forEach((category) => {
        if (category?.variables && Array.isArray(category.variables)) {
          category.variables.forEach((variable) => {
            if (variable?.name) {
              totalVariables++;
              const varName = variable.name;
              const snippet = snippets[varName];
              // Count as approved if:
              // 1. Snippet exists with code AND not explicitly marked as 'modify'
              // 2. OR explicitly marked as 'accept'
              // This means all generated variables are auto-approved unless user marks them as 'modify'
              if (snippet && snippet.codeSnippet && !snippet.error) {
                if (snippet.accepted !== 'modify') {
                  approvedVariables++;
                }
              } else if (snippet && snippet.accepted === 'accept') {
                // Also count explicitly approved (for backward compatibility)
                approvedVariables++;
              }
            }
          });
        }
      });
    }

    const percentage = totalVariables > 0
      ? Math.round((approvedVariables / totalVariables) * 100)
      : 0;

    return {
      totalVariables,
      approvedVariables,
      percentage,
      // Enable generation if there's at least one approved variable
      isReadyForGeneration: approvedVariables > 0,
    };
  }, [categorizedVariables, snippets]);

  return progress;
};
