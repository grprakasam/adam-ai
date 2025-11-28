"""
Code Comparer Module

Provides code comparison functionality for ADaM programs with AI-powered analysis.
"""

from .schemas import (
    CodeComparisonRequest,
    CodeComparisonResult,
    Difference,
    SyntaxIssue,
    ComplianceIssue,
    ComparisonOptions,
    ComparisonContext,
)
from .service import CodeComparerService

__all__ = [
    'CodeComparisonRequest',
    'CodeComparisonResult',
    'Difference',
    'SyntaxIssue',
    'ComplianceIssue',
    'ComparisonOptions',
    'ComparisonContext',
    'CodeComparerService',
]








