"""
Dataset Comparer Service

Core service for comparing datasets with multiple formats support.
Supports CSV, Excel, SAS, R, and XPT formats.
"""

import time
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from loguru import logger
from pathlib import Path

from .schemas import (
    DatasetComparisonRequest,
    DatasetComparisonResult,
    StructureComparison,
    ObservationComparison,
    ValueComparison,
    ValueDifference,
    StatisticalComparison,
    NumericSummary,
)


class DatasetComparerService:
    """
    Service for comparing datasets in various formats.

    Supported formats:
    - CSV (.csv)
    - Excel (.xlsx, .xls)
    - SAS (.sas7bdat)
    - R (.rds, .rdata)
    - XPT (.xpt)
    """

    def __init__(self):
        logger.info("DatasetComparerService initialized")

    async def compare(self, request: DatasetComparisonRequest) -> DatasetComparisonResult:
        """
        Compare two datasets based on the specified mode and settings.

        Args:
            request: Comparison request with dataset paths and settings

        Returns:
            DatasetComparisonResult with detailed comparison results
        """
        start_time = time.time()

        try:
            # Load datasets
            df1 = self._load_dataset(request.dataset1_path)
            df2 = self._load_dataset(request.dataset2_path)

            logger.info(f"Loaded datasets: {df1.shape} vs {df2.shape}")

            # Quick mode: Metadata + structure only
            if request.comparison_mode == "quick":
                result = await self._quick_compare(df1, df2, request)

            # Standard mode: Metadata + structure + key variables
            elif request.comparison_mode == "standard":
                result = await self._standard_compare(df1, df2, request)

            # Comprehensive mode: Full comparison with statistics
            else:  # comprehensive
                result = await self._comprehensive_compare(df1, df2, request)

            # Calculate execution time
            execution_time = int((time.time() - start_time) * 1000)
            result.execution_time = execution_time

            logger.info(f"Dataset comparison completed in {execution_time}ms: {result.overall_match:.1f}% match")

            return result

        except Exception as e:
            logger.error(f"Dataset comparison failed: {e}", exc_info=True)
            raise

    def _load_dataset(self, path: str) -> pd.DataFrame:
        """Load dataset from various formats"""
        path_obj = Path(path)
        ext = path_obj.suffix.lower()

        try:
            if ext == '.csv':
                return pd.read_csv(path)
            elif ext in ['.xlsx', '.xls']:
                return pd.read_excel(path)
            elif ext == '.sas7bdat':
                return pd.read_sas(path)
            elif ext == '.xpt':
                return pd.read_sas(path, format='xport')
            elif ext == '.rds':
                # Requires pyreadr
                import pyreadr
                result = pyreadr.read_r(path)
                return result[None]  # Get the first dataset
            else:
                raise ValueError(f"Unsupported file format: {ext}")
        except Exception as e:
            logger.error(f"Failed to load dataset {path}: {e}")
            raise

    async def _quick_compare(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        request: DatasetComparisonRequest
    ) -> DatasetComparisonResult:
        """Quick comparison: Metadata and structure only"""

        # Metadata comparison
        metadata_match = {
            "match": df1.shape == df2.shape,
            "differences": [] if df1.shape == df2.shape else [
                f"Shape mismatch: {df1.shape} vs {df2.shape}"
            ]
        }

        # Structure comparison
        structure = self._compare_structure(df1, df2)

        # Dummy observations for quick mode
        observations = ObservationComparison(
            total_dataset1=len(df1),
            total_dataset2=len(df2),
            common_count=min(len(df1), len(df2)),
            equal_count=0,  # Not computed in quick mode
            difference_count=0,
            unique_to_dataset1=max(0, len(df1) - len(df2)),
            unique_to_dataset2=max(0, len(df2) - len(df1)),
        )

        # Dummy values for quick mode
        values = ValueComparison(
            matching_variables=structure.common_variables,
            total_variables=structure.common_variables,
            differences=[],
        )

        # Calculate overall match
        overall_match = 100.0 if structure.match and metadata_match["match"] else 0.0

        return DatasetComparisonResult(
            overall_match=overall_match,
            metadata=metadata_match,
            structure=structure,
            observations=observations,
            values=values,
            execution_time=0  # Will be set later
        )

    async def _standard_compare(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        request: DatasetComparisonRequest
    ) -> DatasetComparisonResult:
        """Standard comparison: Metadata + structure + values"""

        # Get common variables
        common_vars = list(set(df1.columns) & set(df2.columns))

        # Filter by variable selection
        if request.settings.variable_selection == "selected":
            common_vars = [v for v in common_vars if v in request.settings.selected_variables]
        elif request.settings.variable_selection == "exclude-meta":
            # Exclude common metadata variables
            meta_vars = ['CREATED', 'MODIFIED', 'TIMESTAMP', 'DATETIME']
            common_vars = [v for v in common_vars if not any(m in v.upper() for m in meta_vars)]

        # Metadata comparison
        metadata_match = {
            "match": df1.shape == df2.shape,
            "differences": [] if df1.shape == df2.shape else [
                f"Shape mismatch: {df1.shape} vs {df2.shape}"
            ]
        }

        # Structure comparison
        structure = self._compare_structure(df1, df2)

        # Observations comparison
        observations = self._compare_observations(df1, df2, common_vars, request.settings)

        # Values comparison
        values = self._compare_values(df1, df2, common_vars, request.settings)

        # Calculate overall match
        overall_match = self._calculate_overall_match(structure, observations, values)

        return DatasetComparisonResult(
            overall_match=overall_match,
            metadata=metadata_match,
            structure=structure,
            observations=observations,
            values=values,
            execution_time=0
        )

    async def _comprehensive_compare(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        request: DatasetComparisonRequest
    ) -> DatasetComparisonResult:
        """Comprehensive comparison: Full validation with statistics"""

        # Run standard comparison first
        result = await self._standard_compare(df1, df2, request)

        # Add statistical analysis
        common_vars = list(set(df1.columns) & set(df2.columns))
        numeric_vars = [v for v in common_vars if pd.api.types.is_numeric_dtype(df1[v])]

        numeric_summary = []
        for var in numeric_vars:
            try:
                mean1 = df1[var].mean()
                mean2 = df2[var].mean()

                # Align datasets for difference calculation
                if request.settings.key_variable in common_vars:
                    merged = pd.merge(
                        df1[[request.settings.key_variable, var]],
                        df2[[request.settings.key_variable, var]],
                        on=request.settings.key_variable,
                        suffixes=('_1', '_2')
                    )
                    diffs = merged[f'{var}_1'] - merged[f'{var}_2']
                    max_diff = abs(diffs).max() if len(diffs) > 0 else 0
                    std_diff = diffs.std() if len(diffs) > 1 else 0
                else:
                    max_diff = abs(mean1 - mean2)
                    std_diff = 0

                numeric_summary.append(NumericSummary(
                    variable=var,
                    mean1=float(mean1) if not pd.isna(mean1) else 0,
                    mean2=float(mean2) if not pd.isna(mean2) else 0,
                    max_diff=float(max_diff) if not pd.isna(max_diff) else 0,
                    std_diff=float(std_diff) if not pd.isna(std_diff) else 0,
                ))
            except Exception as e:
                logger.warning(f"Failed to compute statistics for {var}: {e}")

        result.statistics = StatisticalComparison(numeric_summary=numeric_summary)

        return result

    def _compare_structure(self, df1: pd.DataFrame, df2: pd.DataFrame) -> StructureComparison:
        """Compare dataset structures"""
        set1 = set(df1.columns)
        set2 = set(df2.columns)

        common_vars = list(set1 & set2)
        unique_to_1 = list(set1 - set2)
        unique_to_2 = list(set2 - set1)

        # Check type mismatches
        type_mismatches = []
        for var in common_vars:
            type1 = str(df1[var].dtype)
            type2 = str(df2[var].dtype)
            if type1 != type2:
                type_mismatches.append({
                    "variable": var,
                    "type1": type1,
                    "type2": type2,
                })

        return StructureComparison(
            match=len(unique_to_1) == 0 and len(unique_to_2) == 0 and len(type_mismatches) == 0,
            common_variables=len(common_vars),
            unique_to_dataset1=unique_to_1,
            unique_to_dataset2=unique_to_2,
            type_mismatches=type_mismatches,
        )

    def _compare_observations(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        common_vars: List[str],
        settings
    ) -> ObservationComparison:
        """Compare observations"""

        key_var = settings.key_variable

        if key_var in common_vars:
            # Match by key variable
            keys1 = set(df1[key_var])
            keys2 = set(df2[key_var])
            common_keys = keys1 & keys2

            # For common keys, compare values
            merged = pd.merge(
                df1[list(common_vars)],
                df2[list(common_vars)],
                on=key_var,
                suffixes=('_1', '_2'),
                how='inner'
            )

            # Count equal observations
            equal_count = 0
            for _, row in merged.iterrows():
                all_equal = True
                for var in [v for v in common_vars if v != key_var]:
                    val1 = row.get(f'{var}_1')
                    val2 = row.get(f'{var}_2')
                    if not self._values_equal(val1, val2, settings):
                        all_equal = False
                        break
                if all_equal:
                    equal_count += 1

            return ObservationComparison(
                total_dataset1=len(df1),
                total_dataset2=len(df2),
                common_count=len(common_keys),
                equal_count=equal_count,
                difference_count=len(common_keys) - equal_count,
                unique_to_dataset1=len(keys1 - keys2),
                unique_to_dataset2=len(keys2 - keys1),
            )
        else:
            # No key variable, simple count comparison
            return ObservationComparison(
                total_dataset1=len(df1),
                total_dataset2=len(df2),
                common_count=min(len(df1), len(df2)),
                equal_count=0,
                difference_count=min(len(df1), len(df2)),
                unique_to_dataset1=max(0, len(df1) - len(df2)),
                unique_to_dataset2=max(0, len(df2) - len(df1)),
            )

    def _compare_values(
        self,
        df1: pd.DataFrame,
        df2: pd.DataFrame,
        common_vars: List[str],
        settings
    ) -> ValueComparison:
        """Compare values for common variables"""

        differences = []
        key_var = settings.key_variable

        if key_var not in common_vars:
            logger.warning(f"Key variable {key_var} not in common variables, skipping value comparison")
            return ValueComparison(
                matching_variables=len(common_vars),
                total_variables=len(common_vars),
                differences=[],
            )

        # Merge datasets on key variable
        merged = pd.merge(
            df1[common_vars],
            df2[common_vars],
            on=key_var,
            suffixes=('_1', '_2'),
            how='inner'
        )

        for var in [v for v in common_vars if v != key_var]:
            var1 = f'{var}_1'
            var2 = f'{var}_2'

            # Find differences
            diff_mask = merged.apply(
                lambda row: not self._values_equal(row[var1], row[var2], settings),
                axis=1
            )

            if diff_mask.any():
                diff_rows = merged[diff_mask]

                # Limit to first 100 differences for performance
                diff_rows = diff_rows.head(100)

                details = []
                for _, row in diff_rows.iterrows():
                    detail = {
                        "key": str(row[key_var]),
                        "value1": self._serialize_value(row[var1]),
                        "value2": self._serialize_value(row[var2]),
                    }

                    # Add difference for numeric variables
                    if pd.api.types.is_numeric_dtype(df1[var]):
                        try:
                            diff = float(row[var1] - row[var2])
                            detail["difference"] = diff
                        except:
                            pass

                    details.append(detail)

                var_type = "Numeric" if pd.api.types.is_numeric_dtype(df1[var]) else "Character"

                differences.append(ValueDifference(
                    variable=var,
                    type=var_type,
                    diff_count=int(diff_mask.sum()),
                    details=details,
                ))

        matching_variables = len([v for v in common_vars if v != key_var]) - len(differences)

        return ValueComparison(
            matching_variables=matching_variables,
            total_variables=len([v for v in common_vars if v != key_var]),
            differences=differences,
        )

    def _values_equal(self, val1, val2, settings) -> bool:
        """Check if two values are equal based on settings"""

        # Handle missing values
        is_na1 = pd.isna(val1)
        is_na2 = pd.isna(val2)

        if is_na1 or is_na2:
            if settings.missing_value_handling == "equal":
                return is_na1 == is_na2
            elif settings.missing_value_handling == "different":
                return False
            else:  # ignore
                return True

        # Numeric comparison
        if isinstance(val1, (int, float, np.number)) and isinstance(val2, (int, float, np.number)):
            if settings.numeric_comparison == "exact":
                return val1 == val2
            elif settings.numeric_comparison == "tolerance":
                return abs(val1 - val2) <= settings.numeric_tolerance
            else:  # relative
                if val1 == 0 and val2 == 0:
                    return True
                if val1 == 0 or val2 == 0:
                    return abs(val1 - val2) <= settings.numeric_tolerance
                rel_diff = abs((val1 - val2) / val1) * 100
                return rel_diff <= settings.relative_diff_threshold

        # Character comparison
        str1 = str(val1)
        str2 = str(val2)

        if settings.trim_whitespace:
            str1 = str1.strip()
            str2 = str2.strip()

        if not settings.case_sensitive:
            str1 = str1.lower()
            str2 = str2.lower()

        return str1 == str2

    def _serialize_value(self, value) -> Any:
        """Serialize value for JSON response"""
        if pd.isna(value):
            return None
        if isinstance(value, (np.integer, np.floating)):
            return float(value)
        return str(value)

    def _calculate_overall_match(
        self,
        structure: StructureComparison,
        observations: ObservationComparison,
        values: ValueComparison
    ) -> float:
        """Calculate overall match percentage"""

        # Structure score (30%)
        structure_score = 100.0 if structure.match else 50.0

        # Observations score (30%)
        if observations.common_count > 0:
            obs_score = (observations.equal_count / observations.common_count) * 100
        else:
            obs_score = 0.0

        # Values score (40%)
        if values.total_variables > 0:
            values_score = (values.matching_variables / values.total_variables) * 100
        else:
            values_score = 100.0

        overall = (structure_score * 0.3) + (obs_score * 0.3) + (values_score * 0.4)

        return round(overall, 1)
