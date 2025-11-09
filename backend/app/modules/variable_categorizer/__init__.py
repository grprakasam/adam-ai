"""
Variable Categorizer Module

This module provides functionality to categorize ADAM specification variables
using the VariablesMapping.xlsx reference file.
"""

from .service import VariableCategorizerService
from .models import VariableInfo, VariableCategory, CategorizationResult

__all__ = [
    "VariableCategorizerService",
    "VariableInfo",
    "VariableCategory",
    "CategorizationResult",
]
