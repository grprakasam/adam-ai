"""
Dataset Comparer Module

Provides comprehensive dataset comparison functionality for ADAM QC workflows.
"""

from .service import DatasetComparerService
from .schemas import (
    DatasetComparisonRequest,
    DatasetComparisonResult,
    DatasetMetadata,
    ComparisonSettings,
)

__all__ = [
    'DatasetComparerService',
    'DatasetComparisonRequest',
    'DatasetComparisonResult',
    'DatasetMetadata',
    'ComparisonSettings',
]
