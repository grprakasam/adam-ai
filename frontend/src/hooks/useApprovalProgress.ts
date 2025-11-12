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
 * - Count of approved variables (with accepted: true)
 * - Percentage of approval
 * - Whether ready for generation (≥80% threshold)
 * 
 * Updates in real-time when approval checkboxes change
 */
export const useApprovalProgress = (): ApprovalProgress => {
  const categorizedVariables = useProjectStore((state) => state.categorizedVariables);
  const snippets = useProjectStore((state) => state.pairProgramming.snippets);

  const progress = useMemo(() => {
    let totalVariables = 0;
    let approvedVariables = 0;

    // Iterate through all categories
    if (categorizedVariables && categorizedVariables.categories) {
      categorizedVariables.categories.forEach((category) => {
        if (category.variables && Array.isArray(category.variables)) {
          category.variables.forEach((variable) => {
            totalVariables++;
            const varName = variable.name;
            if (varName && snippets[varName]?.accepted) {
              approvedVariables++;
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
      isReadyForGeneration: percentage >= 80,
    };
  }, [categorizedVariables, snippets]);

  return progress;
};
