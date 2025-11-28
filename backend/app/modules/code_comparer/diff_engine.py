"""
Diff Engine

Computes textual differences between two code snippets using Python's difflib.
"""

import difflib
from dataclasses import dataclass
from typing import List, Tuple
from loguru import logger


@dataclass
class DiffHunk:
    """Represents a single diff hunk"""
    type: str  # 'add', 'remove', 'change', 'equal'
    code1_start: int
    code1_end: int
    code2_start: int
    code2_end: int
    code1_lines: List[str]
    code2_lines: List[str]


@dataclass
class DiffResult:
    """Result of diff computation"""
    similarity_ratio: float  # 0.0 to 1.0
    diff_hunks: List[DiffHunk]
    total_lines_1: int
    total_lines_2: int
    added_lines: int
    removed_lines: int
    modified_lines: int
    unified_diff: str  # Unified diff format for display


class DiffEngine:
    """Computes detailed diff using Python's difflib"""
    
    def compute(self, code1: str, code2: str) -> DiffResult:
        """
        Compute detailed diff between two code snippets.
        
        Args:
            code1: First code snippet
            code2: Second code snippet
            
        Returns:
            DiffResult with similarity ratio and diff hunks
        """
        lines1 = code1.splitlines(keepends=True)
        lines2 = code2.splitlines(keepends=True)
        
        # Compute similarity ratio
        matcher = difflib.SequenceMatcher(None, code1, code2)
        similarity = matcher.ratio()
        
        # Generate unified diff
        unified_diff_lines = list(difflib.unified_diff(
            lines1,
            lines2,
            fromfile='code1',
            tofile='code2',
            lineterm='',
            n=3  # Context lines
        ))
        unified_diff = ''.join(unified_diff_lines)
        
        # Parse diff into hunks
        hunks = self._parse_unified_diff(unified_diff_lines, lines1, lines2)
        
        # Count changes
        added_lines = sum(1 for h in hunks if h.type == 'add')
        removed_lines = sum(1 for h in hunks if h.type == 'remove')
        modified_lines = sum(1 for h in hunks if h.type == 'change')
        
        return DiffResult(
            similarity_ratio=similarity,
            diff_hunks=hunks,
            total_lines_1=len(lines1),
            total_lines_2=len(lines2),
            added_lines=added_lines,
            removed_lines=removed_lines,
            modified_lines=modified_lines,
            unified_diff=unified_diff
        )
    
    def _parse_unified_diff(self, diff_lines: List[str], lines1: List[str], lines2: List[str]) -> List[DiffHunk]:
        """Parse unified diff format into DiffHunk objects"""
        hunks = []
        i = 0
        code1_idx = 0
        code2_idx = 0
        
        while i < len(diff_lines):
            line = diff_lines[i]
            
            # Skip header lines
            if line.startswith('---') or line.startswith('+++') or line.startswith('@@'):
                if line.startswith('@@'):
                    # Extract line numbers from hunk header: @@ -start1,count1 +start2,count2 @@
                    import re
                    match = re.match(r'@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', line)
                    if match:
                        code1_idx = int(match.group(1)) - 1  # Convert to 0-indexed
                        code2_idx = int(match.group(3)) - 1
                i += 1
                continue
            
            # Process diff lines
            if line.startswith('+') and not line.startswith('+++'):
                # Added line
                hunks.append(DiffHunk(
                    type='add',
                    code1_start=code1_idx,
                    code1_end=code1_idx,
                    code2_start=code2_idx,
                    code2_end=code2_idx + 1,
                    code1_lines=[],
                    code2_lines=[line[1:]]  # Remove '+' prefix
                ))
                code2_idx += 1
            elif line.startswith('-') and not line.startswith('---'):
                # Removed line
                hunks.append(DiffHunk(
                    type='remove',
                    code1_start=code1_idx,
                    code1_end=code1_idx + 1,
                    code2_start=code2_idx,
                    code2_end=code2_idx,
                    code1_lines=[line[1:]],  # Remove '-' prefix
                    code2_lines=[]
                ))
                code1_idx += 1
            elif line.startswith(' '):
                # Context line (unchanged)
                code1_idx += 1
                code2_idx += 1
            else:
                # Modified line (treated as remove + add)
                if code1_idx < len(lines1) and code2_idx < len(lines2):
                    hunks.append(DiffHunk(
                        type='change',
                        code1_start=code1_idx,
                        code1_end=code1_idx + 1,
                        code2_start=code2_idx,
                        code2_end=code2_idx + 1,
                        code1_lines=[lines1[code1_idx]],
                        code2_lines=[lines2[code2_idx]]
                    ))
                code1_idx += 1
                code2_idx += 1
            
            i += 1
        
        return hunks








