"""
Input Validation and Sanitization for Consolidated Code Generation
"""

import re
from typing import List, Tuple
from loguru import logger

from .models import ApprovedVariable


class CodeValidator:
    """Validates and sanitizes user code snippets"""

    # Dangerous patterns that could indicate code injection
    DANGEROUS_PATTERNS = [
        r'system\s*\(',  # System calls
        r'exec\s*\(',    # Exec calls
        r'eval\s*\(',    # Eval calls
        r'__import__',   # Dynamic imports
        r'subprocess',   # Subprocess module
        r'os\.system',   # OS system calls
    ]

    # Placeholder comments to remove
    PLACEHOLDER_PATTERNS = [
        r'#\s*TODO:.*',
        r'#\s*FIXME:.*',
        r'#\s*PLACEHOLDER.*',
        r'/\*\s*TODO:.*?\*/',
        r'/\*\s*FIXME:.*?\*/',
    ]

    @staticmethod
    def validate_code_safety(code: str, language: str) -> Tuple[bool, List[str]]:
        """
        Check code for dangerous patterns

        Returns:
            (is_safe, list_of_issues)
        """
        issues = []

        for pattern in CodeValidator.DANGEROUS_PATTERNS:
            if re.search(pattern, code, re.IGNORECASE):
                issues.append(f"Potentially unsafe pattern detected: {pattern}")

        # Language-specific checks
        if language == "R":
            if re.search(r'Sys\.setenv', code):
                issues.append("Environment variable modification detected")
        elif language == "SAS":
            if re.search(r'%sysexec', code, re.IGNORECASE):
                issues.append("System execution command detected")

        is_safe = len(issues) == 0

        if not is_safe:
            logger.warning(f"Code safety validation failed: {issues}")

        return is_safe, issues

    @staticmethod
    def sanitize_code(code: str, language: str) -> str:
        """
        Remove placeholders and normalize formatting
        """
        # Remove placeholder comments
        for pattern in CodeValidator.PLACEHOLDER_PATTERNS:
            code = re.sub(pattern, '', code, flags=re.IGNORECASE)

        # Remove excessive blank lines (more than 2 consecutive)
        code = re.sub(r'\n{3,}', '\n\n', code)

        # Normalize indentation (convert tabs to spaces)
        code = code.replace('\t', '    ')

        # Trim trailing whitespace from each line
        lines = code.split('\n')
        lines = [line.rstrip() for line in lines]
        code = '\n'.join(lines)

        return code.strip()

    @staticmethod
    def validate_variables(variables: List[ApprovedVariable]) -> Tuple[bool, List[str]]:
        """
        Validate list of approved variables

        Returns:
            (is_valid, list_of_errors)
        """
        errors = []

        # Check for duplicate variable names
        var_names = [v.name for v in variables]
        duplicates = set([name for name in var_names if var_names.count(name) > 1])
        if duplicates:
            errors.append(f"Duplicate variable names found: {duplicates}")

        # Check variable name format (CDISC standard)
        valid_name_pattern = r'^[A-Z][A-Z0-9]{0,7}$'  # Max 8 chars, starts with letter
        for var in variables:
            if not re.match(valid_name_pattern, var.name):
                logger.warning(f"Variable {var.name} does not follow CDISC naming convention")

        # Check for required categories
        categories = [v.category for v in variables]
        if not categories:
            errors.append("No variable categories provided")

        is_valid = len(errors) == 0
        return is_valid, errors

    @staticmethod
    def validate_approval_threshold(total_variables: int, approved_count: int, threshold: float = 0.8) -> Tuple[bool, str]:
        """
        Check if approval threshold is met

        Args:
            total_variables: Total number of variables
            approved_count: Number of approved variables
            threshold: Minimum approval percentage (default 80%)

        Returns:
            (threshold_met, message)
        """
        if total_variables == 0:
            return False, "No variables to approve"

        approval_percentage = approved_count / total_variables

        if approval_percentage < threshold:
            required_more = int((threshold * total_variables) - approved_count)
            return False, f"Need {required_more} more approved variables to meet {threshold*100}% threshold"

        return True, f"Approval threshold met: {approval_percentage*100:.1f}%"
