export interface ConflictDetection {
  variable: string;
  issue: string;
  notes: string;
  conflictType: 'contradictory' | 'ambiguous' | 'multiple_methods';
}

interface ConflictKeyword {
  positive: string;
  negative: string;
  category: string;
}

const conflictKeywords: ConflictKeyword[] = [
  { positive: 'use', negative: "don't use", category: 'usage' },
  { positive: 'use', negative: 'do not use', category: 'usage' },
  { positive: 'include', negative: 'exclude', category: 'inclusion' },
  { positive: 'include', negative: "don't include", category: 'inclusion' },
  { positive: 'calculate', negative: "don't calculate", category: 'calculation' },
  { positive: 'calculate', negative: 'do not calculate', category: 'calculation' },
  { positive: 'derive', negative: "don't derive", category: 'derivation' },
  { positive: 'from', negative: 'not from', category: 'source' },
  { positive: 'apply', negative: "don't apply", category: 'application' },
  { positive: 'set', negative: "don't set", category: 'assignment' },
];

const derivationKeywords = [
  'calculate from',
  'derive from',
  'use',
  'copy from',
  'get from',
  'extract from',
  'take from',
  'map from',
];

/**
 * Detect conflicting or ambiguous instructions in user notes
 * 
 * Checks for:
 * 1. Contradictory keywords (e.g., "use X" vs "don't use X")
 * 2. Multiple derivation methods
 * 3. Ambiguous instructions
 * 
 * @param userNotes - Dictionary mapping variable names to their user notes
 * @returns Array of detected conflicts
 */
export const detectConflictingNotes = (
  userNotes: Record<string, string>
): ConflictDetection[] => {
  const conflicts: ConflictDetection[] = [];

  if (!userNotes || typeof userNotes !== 'object') {
    return conflicts;
  }

  Object.entries(userNotes).forEach(([variable, notes]) => {
    if (!notes || typeof notes !== 'string') {
      return;
    }

    const lowerNotes = notes.toLowerCase().trim();
    
    if (lowerNotes.length === 0) {
      return;
    }

    // Check for contradictory keywords
    conflictKeywords.forEach(({ positive, negative, category }) => {
      const hasPositive = lowerNotes.includes(positive.toLowerCase());
      const hasNegative = lowerNotes.includes(negative.toLowerCase());
      
      if (hasPositive && hasNegative) {
        conflicts.push({
          variable,
          issue: `Contradictory ${category} instructions detected: "${positive}" vs "${negative}"`,
          notes,
          conflictType: 'contradictory',
        });
      }
    });

    // Check for multiple derivation methods
    const foundMethods = derivationKeywords.filter((keyword) =>
      lowerNotes.includes(keyword.toLowerCase())
    );
    
    if (foundMethods.length > 2) {
      conflicts.push({
        variable,
        issue: `Multiple derivation methods specified (${foundMethods.length} found) - may be ambiguous`,
        notes,
        conflictType: 'multiple_methods',
      });
    }

    // Check for ambiguous or incomplete instructions
    const ambiguousPatterns = [
      { pattern: /\bor\b/gi, message: 'Contains "or" - instruction may be ambiguous' },
      { pattern: /\bmaybe\b/gi, message: 'Contains "maybe" - instruction is uncertain' },
      { pattern: /\bnot sure\b/gi, message: 'Contains "not sure" - instruction lacks confidence' },
      { pattern: /\bcheck\b.*\blater\b/gi, message: 'Contains "check later" - instruction is incomplete' },
    ];

    ambiguousPatterns.forEach(({ pattern, message }) => {
      if (pattern.test(notes)) {
        conflicts.push({
          variable,
          issue: message,
          notes,
          conflictType: 'ambiguous',
        });
      }
    });
  });

  // Remove duplicates based on variable + issue
  const uniqueConflicts = conflicts.filter(
    (conflict, index, self) =>
      index === self.findIndex(
        (c) => c.variable === conflict.variable && c.issue === conflict.issue
      )
  );

  return uniqueConflicts;
};

/**
 * Check if there are any blocking conflicts that prevent code generation
 * 
 * @param conflicts - Array of detected conflicts
 * @returns true if there are contradictory conflicts that should block generation
 */
export const hasBlockingConflicts = (conflicts: ConflictDetection[]): boolean => {
  return conflicts.some((c) => c.conflictType === 'contradictory');
};

/**
 * Get a summary of conflicts by type
 * 
 * @param conflicts - Array of detected conflicts
 * @returns Object with counts by conflict type
 */
export const getConflictSummary = (
  conflicts: ConflictDetection[]
): Record<string, number> => {
  const summary: Record<string, number> = {
    contradictory: 0,
    ambiguous: 0,
    multiple_methods: 0,
  };

  conflicts.forEach((conflict) => {
    summary[conflict.conflictType]++;
  });

  return summary;
};
