"""
Code Analyzer for Extracting Required SDTM Datasets

Intelligently analyzes R and SAS code to detect which SDTM datasets are being
referenced, providing dynamic dataset requirement detection instead of hardcoded mappings.
"""

import re
import logging
from typing import List, Set, Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class CodeAnalysisResult:
    """Result of code analysis"""
    required_datasets: List[str]
    dataset_operations: Dict[str, List[str]]  # dataset -> list of operations
    confidence_level: str  # 'high', 'medium', 'low'
    warnings: List[str]


class CodeAnalyzer:
    """
    Analyzes R and SAS code to extract required SDTM datasets.

    Detects datasets from:
    - read_sas() calls
    - read.csv() calls
    - read_csv() calls
    - haven::read_sas()
    - data loading operations
    - dataset references in merge/join operations
    """

    # Common SDTM domain codes
    SDTM_DOMAINS = {
        'DM', 'AE', 'LB', 'VS', 'EX', 'DS', 'CM', 'MH', 'SV', 'EG',
        'PE', 'QS', 'SC', 'DA', 'DD', 'DV', 'SE', 'SU', 'TA', 'TD',
        'TE', 'TI', 'TS', 'TV', 'CO', 'DI', 'FA', 'IE', 'IS', 'MI',
        'MO', 'MS', 'PC', 'PP', 'RE', 'RP', 'RS', 'SS', 'TU'
    }

    def __init__(self):
        """Initialize code analyzer"""
        self.patterns_r = self._compile_r_patterns()
        self.patterns_sas = self._compile_sas_patterns()

    def _compile_r_patterns(self) -> List[tuple]:
        """Compile regex patterns for R code"""
        return [
            # read_sas("path/to/dm.sas7bdat")
            (re.compile(r'read_sas\s*\(\s*["\'].*?/(\w+)\.sas7bdat["\']', re.IGNORECASE), 'read_sas'),

            # haven::read_sas("dm.sas7bdat")
            (re.compile(r'haven::read_sas\s*\(\s*["\'].*?/(\w+)\.sas7bdat["\']', re.IGNORECASE), 'haven::read_sas'),

            # read.csv("dm.csv") or read_csv("dm.csv")
            (re.compile(r'read[._]csv\s*\(\s*["\'].*?/(\w+)\.csv["\']', re.IGNORECASE), 'read_csv'),

            # dm <- read_sas(...) - assignment pattern
            (re.compile(r'(\w+)\s*<-\s*read_sas\s*\(', re.IGNORECASE), 'assignment'),

            # left_join(dm, ex, ...)
            (re.compile(r'(?:left_join|right_join|inner_join|full_join|merge)\s*\(\s*(\w+)\s*,\s*(\w+)', re.IGNORECASE), 'join'),

            # %in% dm or dataset references
            (re.compile(r'\b(\w+)(?:\$|%>%|\[)', re.IGNORECASE), 'reference'),
        ]

    def _compile_sas_patterns(self) -> List[tuple]:
        """Compile regex patterns for SAS code"""
        return [
            # SET dm;
            (re.compile(r'\bSET\s+(\w+)\s*;', re.IGNORECASE), 'SET'),

            # MERGE dm ex;
            (re.compile(r'\bMERGE\s+([\w\s]+);', re.IGNORECASE), 'MERGE'),

            # DATA dm; SET ...
            (re.compile(r'\bDATA\s+(\w+)\s*;', re.IGNORECASE), 'DATA'),

            # PROC SQL; FROM dm
            (re.compile(r'\bFROM\s+(\w+)', re.IGNORECASE), 'FROM'),

            # LEFT JOIN ex
            (re.compile(r'(?:LEFT|RIGHT|INNER|FULL)\s+JOIN\s+(\w+)', re.IGNORECASE), 'JOIN'),
        ]

    def analyze_code(self, code: str, language: str = 'R') -> CodeAnalysisResult:
        """
        Analyze code to extract required datasets.

        Args:
            code: R or SAS code to analyze
            language: Programming language ('R' or 'SAS')

        Returns:
            CodeAnalysisResult with detected datasets and metadata
        """
        if not code or not code.strip():
            return CodeAnalysisResult(
                required_datasets=[],
                dataset_operations={},
                confidence_level='low',
                warnings=['No code provided for analysis']
            )

        # Select appropriate patterns
        patterns = self.patterns_r if language.upper() == 'R' else self.patterns_sas

        datasets_found = set()
        operations = {}
        warnings = []

        # Remove comments to avoid false positives
        code_clean = self._remove_comments(code, language)

        # Extract datasets from patterns
        for pattern, operation_type in patterns:
            matches = pattern.finditer(code_clean)
            for match in matches:
                # Extract dataset name(s)
                if operation_type == 'MERGE':
                    # Multiple datasets in MERGE statement
                    datasets = match.group(1).strip().split()
                    for ds in datasets:
                        ds_clean = ds.strip().upper()
                        if self._is_likely_sdtm_domain(ds_clean):
                            datasets_found.add(ds_clean)
                            operations.setdefault(ds_clean, []).append(operation_type)
                else:
                    # Single dataset
                    for i in range(1, len(match.groups()) + 1):
                        ds = match.group(i)
                        if ds:
                            ds_clean = ds.strip().upper()
                            if self._is_likely_sdtm_domain(ds_clean):
                                datasets_found.add(ds_clean)
                                operations.setdefault(ds_clean, []).append(operation_type)

        # Filter out non-SDTM patterns
        sdtm_datasets = [ds for ds in datasets_found if self._is_likely_sdtm_domain(ds)]

        # Determine confidence level
        confidence = self._calculate_confidence(sdtm_datasets, operations, code_clean)

        # Generate warnings
        if len(sdtm_datasets) == 0:
            warnings.append('No SDTM datasets detected in code')
        elif len(sdtm_datasets) > 20:
            warnings.append(f'Unusually high number of datasets detected ({len(sdtm_datasets)})')

        logger.info(f"Code analysis complete: {len(sdtm_datasets)} datasets detected with {confidence} confidence")

        return CodeAnalysisResult(
            required_datasets=sorted(sdtm_datasets),
            dataset_operations=operations,
            confidence_level=confidence,
            warnings=warnings
        )

    def _remove_comments(self, code: str, language: str) -> str:
        """Remove comments from code"""
        if language.upper() == 'R':
            # Remove R comments (# to end of line)
            code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)
        else:
            # Remove SAS comments (* ... *) and /* ... */
            code = re.sub(r'\*[^;]*;', '', code)
            code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)

        return code

    def _is_likely_sdtm_domain(self, dataset_name: str) -> bool:
        """Check if a name is likely an SDTM domain"""
        ds = dataset_name.upper().strip()

        # Must be 2-4 characters
        if not (2 <= len(ds) <= 4):
            return False

        # Check against known SDTM domains
        if ds in self.SDTM_DOMAINS:
            return True

        # Common non-SDTM names to filter out
        excluded = {
            'DATA', 'TEMP', 'TMP', 'OUT', 'OUTPUT', 'ADAM', 'TEST',
            'DF', 'DAT', 'NA', 'NULL', 'TRUE', 'FALSE', 'IF', 'THEN',
            'ELSE', 'DO', 'END', 'FOR', 'IN', 'BY', 'ID'
        }

        if ds in excluded:
            return False

        # If it's uppercase 2-letter or matches SDxx pattern, likely SDTM
        if len(ds) == 2 and ds.isalpha():
            return True

        return False

    def _calculate_confidence(
        self,
        datasets: List[str],
        operations: Dict[str, List[str]],
        code: str
    ) -> str:
        """Calculate confidence level for detected datasets"""
        if not datasets:
            return 'low'

        # High confidence: Multiple read operations detected
        read_ops = sum(1 for ops in operations.values()
                      if any(op in ['read_sas', 'read_csv', 'SET', 'FROM'] for op in ops))

        if read_ops >= len(datasets) * 0.7:  # 70% have explicit read operations
            return 'high'
        elif read_ops >= len(datasets) * 0.4:  # 40% have explicit read operations
            return 'medium'
        else:
            return 'low'

    def extract_from_consolidated_code(self, consolidated_code: str) -> List[str]:
        """
        Convenience method to extract dataset list from consolidated code.
        Automatically detects language from code.

        Args:
            consolidated_code: The consolidated R or SAS code

        Returns:
            List of required SDTM dataset names (uppercase)
        """
        # Auto-detect language
        language = 'SAS' if any(keyword in consolidated_code.upper()
                                for keyword in ['PROC ', 'DATA ', 'SET ']) else 'R'

        result = self.analyze_code(consolidated_code, language)
        return result.required_datasets
