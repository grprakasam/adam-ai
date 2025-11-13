"""
Code Validation Service
Validates R and SAS code for syntax errors, style issues, and best practices.
"""

import re
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from enum import Enum


class ValidationSeverity(str, Enum):
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    STYLE = "style"


class ValidationIssue:
    """Represents a single validation issue"""
    
    def __init__(
        self,
        line: int,
        column: Optional[int],
        severity: ValidationSeverity,
        message: str,
        rule: Optional[str] = None,
        suggestion: Optional[str] = None
    ):
        self.line = line
        self.column = column
        self.severity = severity
        self.message = message
        self.rule = rule
        self.suggestion = suggestion
    
    def to_dict(self) -> Dict:
        return {
            "line": self.line,
            "column": self.column,
            "severity": self.severity.value,
            "message": self.message,
            "rule": self.rule,
            "suggestion": self.suggestion
        }


class ValidationResult:
    """Contains validation results for a code snippet"""
    
    def __init__(
        self,
        is_valid: bool,
        language: str,
        issues: List[ValidationIssue],
        execution_time: float = 0.0
    ):
        self.is_valid = is_valid
        self.language = language
        self.issues = issues
        self.execution_time = execution_time
    
    def to_dict(self) -> Dict:
        return {
            "isValid": self.is_valid,
            "language": self.language,
            "issues": [issue.to_dict() for issue in self.issues],
            "errorCount": sum(1 for i in self.issues if i.severity == ValidationSeverity.ERROR),
            "warningCount": sum(1 for i in self.issues if i.severity == ValidationSeverity.WARNING),
            "executionTime": self.execution_time
        }


class RValidator:
    """Validates R code using syntax checking and lintr"""
    
    def __init__(self):
        self.r_available = self._check_r_availability()
        self.lintr_available = self._check_lintr_availability() if self.r_available else False
    
    def _check_r_availability(self) -> bool:
        """Check if R is installed and accessible"""
        try:
            result = subprocess.run(
                ["Rscript", "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False
    
    def _check_lintr_availability(self) -> bool:
        """Check if lintr package is installed"""
        try:
            check_code = 'if (require("lintr", quietly = TRUE)) { cat("YES") } else { cat("NO") }'
            result = subprocess.run(
                ["Rscript", "-e", check_code],
                capture_output=True,
                text=True,
                timeout=10
            )
            return "YES" in result.stdout
        except (subprocess.TimeoutExpired, Exception):
            return False
    
    def validate_syntax(self, code: str) -> List[ValidationIssue]:
        """Validate R code syntax using R's parser"""
        issues = []
        
        if not self.r_available:
            issues.append(ValidationIssue(
                line=1,
                column=None,
                severity=ValidationSeverity.WARNING,
                message="R is not available. Syntax validation skipped.",
                rule="r_unavailable"
            ))
            return issues
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.R', delete=False) as f:
                f.write(code)
                temp_file = f.name
            
            # Try to parse the R code
            parse_code = f'tryCatch(parse("{temp_file}"), error = function(e) cat("ERROR:", e$message, "\\n"))'
            result = subprocess.run(
                ["Rscript", "-e", parse_code],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            # Clean up temp file
            Path(temp_file).unlink(missing_ok=True)
            
            if "ERROR:" in result.stdout or "ERROR:" in result.stderr:
                error_text = result.stdout + result.stderr
                line_num = self._extract_line_number(error_text)
                issues.append(ValidationIssue(
                    line=line_num,
                    column=None,
                    severity=ValidationSeverity.ERROR,
                    message=self._clean_error_message(error_text),
                    rule="syntax_error"
                ))
        
        except subprocess.TimeoutExpired:
            issues.append(ValidationIssue(
                line=1,
                column=None,
                severity=ValidationSeverity.ERROR,
                message="R syntax validation timed out",
                rule="timeout"
            ))
        except Exception as e:
            issues.append(ValidationIssue(
                line=1,
                column=None,
                severity=ValidationSeverity.ERROR,
                message=f"Validation error: {str(e)}",
                rule="validation_error"
            ))
        
        return issues
    
    def validate_style(self, code: str) -> List[ValidationIssue]:
        """Validate R code style using lintr"""
        issues = []
        
        if not self.lintr_available:
            issues.append(ValidationIssue(
                line=1,
                column=None,
                severity=ValidationSeverity.INFO,
                message="lintr package not available. Style checking skipped.",
                rule="lintr_unavailable"
            ))
            return issues
        
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.R', delete=False) as f:
                f.write(code)
                temp_file = f.name
            
            # Run lintr
            lint_code = f'''
library(lintr)
lints <- lint("{temp_file}")
for (lint in lints) {{
  cat(sprintf("LINE:%d|COL:%d|TYPE:%s|MSG:%s\\n",
              lint$line_number,
              lint$column_number,
              lint$type,
              lint$message))
}}
'''
            result = subprocess.run(
                ["Rscript", "-e", lint_code],
                capture_output=True,
                text=True,
                timeout=15
            )
            
            # Clean up temp file
            Path(temp_file).unlink(missing_ok=True)
            
            # Parse lintr output
            for line in result.stdout.split('\n'):
                if line.startswith("LINE:"):
                    parts = line.split('|')
                    if len(parts) == 4:
                        line_num = int(parts[0].split(':')[1])
                        col_num = int(parts[1].split(':')[1])
                        lint_type = parts[2].split(':')[1]
                        message = parts[3].split(':', 1)[1]
                        
                        severity = ValidationSeverity.WARNING if lint_type == "warning" else ValidationSeverity.STYLE
                        
                        issues.append(ValidationIssue(
                            line=line_num,
                            column=col_num,
                            severity=severity,
                            message=message,
                            rule="lintr"
                        ))
        
        except subprocess.TimeoutExpired:
            issues.append(ValidationIssue(
                line=1,
                column=None,
                severity=ValidationSeverity.WARNING,
                message="Style validation timed out",
                rule="timeout"
            ))
        except Exception as e:
            # Style checking is not critical, just log warning
            issues.append(ValidationIssue(
                line=1,
                column=None,
                severity=ValidationSeverity.INFO,
                message=f"Style checking unavailable: {str(e)}",
                rule="style_check_error"
            ))
        
        return issues
    
    def validate(self, code: str) -> ValidationResult:
        """Run full validation on R code"""
        import time
        start_time = time.time()
        
        issues = []
        
        # First check syntax (critical)
        syntax_issues = self.validate_syntax(code)
        issues.extend(syntax_issues)
        
        # Only run style checks if syntax is valid
        has_syntax_errors = any(i.severity == ValidationSeverity.ERROR for i in syntax_issues)
        if not has_syntax_errors:
            style_issues = self.validate_style(code)
            issues.extend(style_issues)
        
        execution_time = time.time() - start_time
        is_valid = not any(i.severity == ValidationSeverity.ERROR for i in issues)
        
        return ValidationResult(
            is_valid=is_valid,
            language="R",
            issues=issues,
            execution_time=execution_time
        )
    
    @staticmethod
    def _extract_line_number(error_text: str) -> int:
        """Extract line number from R error message"""
        match = re.search(r'line (\d+)', error_text, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 1
    
    @staticmethod
    def _clean_error_message(error_text: str) -> str:
        """Clean up R error message for display"""
        # Remove "ERROR:" prefix
        msg = error_text.replace("ERROR:", "").strip()
        # Take first meaningful line
        lines = [l.strip() for l in msg.split('\n') if l.strip()]
        return lines[0] if lines else "Syntax error"


class SASValidator:
    """Validates SAS code using basic syntax checking"""
    
    def __init__(self):
        self.sas_keywords = {
            'data', 'set', 'merge', 'proc', 'run', 'quit', 'if', 'then', 'else',
            'do', 'end', 'by', 'where', 'output', 'keep', 'drop', 'rename',
            'length', 'format', 'informat', 'label', 'retain', 'array'
        }
    
    def validate_syntax(self, code: str) -> List[ValidationIssue]:
        """Basic SAS syntax validation"""
        issues = []
        lines = code.split('\n')
        
        # Track statement blocks
        in_data_step = False
        in_proc = False
        proc_name = None
        data_step_has_run = False
        proc_has_run = False
        
        for i, line in enumerate(lines, 1):
            stripped = line.strip().lower()
            
            # Skip comments and empty lines
            if not stripped or stripped.startswith('*') or stripped.startswith('/*'):
                continue
            
            # Check for DATA step
            if stripped.startswith('data '):
                if in_data_step and not data_step_has_run:
                    issues.append(ValidationIssue(
                        line=i,
                        column=None,
                        severity=ValidationSeverity.WARNING,
                        message="Previous DATA step not terminated with RUN",
                        rule="missing_run"
                    ))
                in_data_step = True
                data_step_has_run = False
                in_proc = False
            
            # Check for PROC
            elif stripped.startswith('proc '):
                if in_proc and not proc_has_run:
                    issues.append(ValidationIssue(
                        line=i,
                        column=None,
                        severity=ValidationSeverity.WARNING,
                        message=f"Previous PROC {proc_name or ''} not terminated with RUN/QUIT",
                        rule="missing_run_quit"
                    ))
                in_proc = True
                proc_has_run = False
                in_data_step = False
                # Extract proc name
                proc_match = re.search(r'proc\s+(\w+)', stripped)
                proc_name = proc_match.group(1) if proc_match else None
            
            # Check for RUN
            elif stripped == 'run;' or stripped == 'run ':
                if in_data_step:
                    data_step_has_run = True
                elif in_proc:
                    proc_has_run = True
            
            # Check for QUIT
            elif stripped == 'quit;' or stripped == 'quit ':
                if in_proc:
                    proc_has_run = True
            
            # Check for unmatched semicolons
            semicolon_count = line.count(';')
            if semicolon_count > 1:
                issues.append(ValidationIssue(
                    line=i,
                    column=None,
                    severity=ValidationSeverity.STYLE,
                    message=f"Multiple statements on one line ({semicolon_count} semicolons)",
                    rule="multiple_statements",
                    suggestion="Split into separate lines for readability"
                ))
            
            # Check for common typos
            if 'poroc' in stripped or 'rpoc' in stripped:
                issues.append(ValidationIssue(
                    line=i,
                    column=None,
                    severity=ValidationSeverity.ERROR,
                    message="Possible typo: 'proc' misspelled",
                    rule="typo"
                ))
        
        # Final checks
        if in_data_step and not data_step_has_run:
            issues.append(ValidationIssue(
                line=len(lines),
                column=None,
                severity=ValidationSeverity.WARNING,
                message="DATA step not terminated with RUN",
                rule="missing_run"
            ))
        
        if in_proc and not proc_has_run:
            issues.append(ValidationIssue(
                line=len(lines),
                column=None,
                severity=ValidationSeverity.WARNING,
                message=f"PROC {proc_name or ''} not terminated with RUN/QUIT",
                rule="missing_run_quit"
            ))
        
        return issues
    
    def validate_style(self, code: str) -> List[ValidationIssue]:
        """Check SAS code style"""
        issues = []
        lines = code.split('\n')
        
        for i, line in enumerate(lines, 1):
            # Check indentation consistency
            if line and line[0] in [' ', '\t']:
                leading_spaces = len(line) - len(line.lstrip(' '))
                leading_tabs = len(line) - len(line.lstrip('\t'))
                
                if leading_tabs > 0 and leading_spaces > 0:
                    issues.append(ValidationIssue(
                        line=i,
                        column=1,
                        severity=ValidationSeverity.STYLE,
                        message="Mixed tabs and spaces for indentation",
                        rule="indentation"
                    ))
            
            # Check line length
            if len(line) > 120:
                issues.append(ValidationIssue(
                    line=i,
                    column=120,
                    severity=ValidationSeverity.STYLE,
                    message=f"Line too long ({len(line)} characters, recommended max 120)",
                    rule="line_length"
                ))
        
        return issues
    
    def validate(self, code: str) -> ValidationResult:
        """Run full validation on SAS code"""
        import time
        start_time = time.time()
        
        issues = []
        issues.extend(self.validate_syntax(code))
        issues.extend(self.validate_style(code))
        
        execution_time = time.time() - start_time
        is_valid = not any(i.severity == ValidationSeverity.ERROR for i in issues)
        
        return ValidationResult(
            is_valid=is_valid,
            language="SAS",
            issues=issues,
            execution_time=execution_time
        )


class CodeValidator:
    """Main validation service that orchestrates language-specific validators"""
    
    def __init__(self):
        self.r_validator = RValidator()
        self.sas_validator = SASValidator()
    
    def validate(self, code: str, language: str) -> ValidationResult:
        """Validate code based on language"""
        language = language.upper()
        
        if language == "R":
            return self.r_validator.validate(code)
        elif language == "SAS":
            return self.sas_validator.validate(code)
        else:
            return ValidationResult(
                is_valid=False,
                language=language,
                issues=[
                    ValidationIssue(
                        line=1,
                        column=None,
                        severity=ValidationSeverity.ERROR,
                        message=f"Unsupported language: {language}",
                        rule="unsupported_language"
                    )
                ]
            )
    
    def get_validator_status(self) -> Dict[str, Dict]:
        """Get status of all validators"""
        return {
            "R": {
                "available": self.r_validator.r_available,
                "lintr_available": self.r_validator.lintr_available
            },
            "SAS": {
                "available": True,  # Basic validation always available
                "note": "Using basic syntax checking (SAS executable not required)"
            }
        }


# Singleton instance
_validator_instance = None

def get_validator() -> CodeValidator:
    """Get or create validator instance"""
    global _validator_instance
    if _validator_instance is None:
        _validator_instance = CodeValidator()
    return _validator_instance
