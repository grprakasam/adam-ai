"""
Syntax Checker

Lightweight syntax validation for R and SAS code (no code execution).
"""

from typing import List, Tuple
from loguru import logger

from .schemas import SyntaxIssue


class SyntaxChecker:
    """Lightweight syntax validation (no code execution)"""
    
    async def check_r(self, code: str) -> List[SyntaxIssue]:
        """
        Check R code for basic syntax errors.
        
        Args:
            code: R code to check
            
        Returns:
            List of syntax issues
        """
        issues = []
        lines = code.splitlines()
        
        # Check balanced brackets
        if not self._is_balanced(code, ['(', ')'], ['[', ']'], ['{', '}']):
            line_num = self._find_unbalanced_line(code, lines)
            issues.append(SyntaxIssue(
                side="code1",  # Will be set by caller
                line=line_num,
                severity="error",
                message="Unbalanced brackets/parentheses",
                code_snippet=self._get_context(lines, line_num)
            ))
        
        # Check unclosed strings
        if self._has_unclosed_strings(code):
            line_num = self._find_unclosed_string_line(code, lines)
            issues.append(SyntaxIssue(
                side="code1",
                line=line_num,
                severity="error",
                message="Unclosed string literal",
                code_snippet=self._get_context(lines, line_num)
            ))
        
        return issues
    
    async def check_sas(self, code: str) -> List[SyntaxIssue]:
        """
        Check SAS code for basic syntax errors.
        
        Args:
            code: SAS code to check
            
        Returns:
            List of syntax issues
        """
        issues = []
        lines = code.splitlines()
        
        # Check for missing semicolons (heuristic)
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Skip comments and empty lines
            if not stripped or stripped.startswith('*') or stripped.startswith('/*'):
                continue
            
            # Check for statements that should end with semicolon
            if (stripped and 
                not stripped.endswith(';') and 
                not stripped.endswith('/*') and
                not stripped.startswith('/*') and
                not any(keyword in stripped.upper() for keyword in ['DATA', 'PROC', 'RUN', 'QUIT', 'END', 'MACRO', 'MEND'])):
                # Heuristic: likely missing semicolon
                issues.append(SyntaxIssue(
                    side="code1",
                    line=i,
                    severity="warning",
                    message="Possible missing semicolon",
                    code_snippet=self._get_context(lines, i)
                ))
        
        return issues
    
    def _is_balanced(self, text: str, *pairs: List[Tuple[str, str]]) -> bool:
        """Check if brackets/parentheses are balanced"""
        stack = []
        for char in text:
            for open_char, close_char in pairs:
                if char == open_char:
                    stack.append(close_char)
                elif char == close_char:
                    if not stack or stack.pop() != close_char:
                        return False
        return len(stack) == 0
    
    def _find_unbalanced_line(self, code: str, lines: List[str]) -> int:
        """Find the line number where brackets become unbalanced"""
        stack = []
        pairs = [('(', ')'), ('[', ']'), ('{', '}')]
        
        for i, line in enumerate(lines, 1):
            for char in line:
                for open_char, close_char in pairs:
                    if char == open_char:
                        stack.append((close_char, i))
                    elif char == close_char:
                        if not stack or stack[-1][0] != close_char:
                            return i
                        stack.pop()
        
        # If stack is not empty, return last line
        if stack:
            return stack[-1][1]
        return 1
    
    def _has_unclosed_strings(self, code: str) -> bool:
        """Check for unclosed string literals"""
        in_string = False
        escape_next = False
        quote_char = None
        
        for char in code:
            if escape_next:
                escape_next = False
                continue
            
            if char == '\\':
                escape_next = True
                continue
            
            if char in ['"', "'"]:
                if not in_string:
                    in_string = True
                    quote_char = char
                elif char == quote_char:
                    in_string = False
                    quote_char = None
        
        return in_string
    
    def _find_unclosed_string_line(self, code: str, lines: List[str]) -> int:
        """Find the line number where string becomes unclosed"""
        in_string = False
        escape_next = False
        quote_char = None
        
        for i, line in enumerate(lines, 1):
            for char in line:
                if escape_next:
                    escape_next = False
                    continue
                
                if char == '\\':
                    escape_next = True
                    continue
                
                if char in ['"', "'"]:
                    if not in_string:
                        in_string = True
                        quote_char = char
                    elif char == quote_char:
                        in_string = False
                        quote_char = None
            
            if in_string:
                return i
        
        return 1
    
    def _get_context(self, lines: List[str], line_num: int, context: int = 2) -> str:
        """Get code context around a line number"""
        start = max(0, line_num - context - 1)
        end = min(len(lines), line_num + context)
        context_lines = lines[start:end]
        return '\n'.join(context_lines)

