"""
Excel file parser for VariablesMapping.xlsx
"""

import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import pandas as pd
from loguru import logger


class VariablesMappingParser:
    """Parser for VariablesMapping.xlsx file"""

    def __init__(self, mapping_file_path: Optional[str] = None):
        """
        Initialize parser with path to VariablesMapping.xlsx

        Args:
            mapping_file_path: Path to VariablesMapping.xlsx.
                             If None, uses default path: Context/ADAMRules/VariablesMapping.xlsx
        """
        if mapping_file_path is None:
            # Default path relative to backend root
            backend_root = Path(__file__).parent.parent.parent.parent.parent
            mapping_file_path = (
                backend_root / "Context" / "ADAMRules" / "VariablesMapping.xlsx"
            )

        self.mapping_file_path = Path(mapping_file_path)
        self._mapping_data: Optional[pd.DataFrame] = None
        self._category_map: Optional[Dict[str, str]] = None

    def load_mapping(self) -> None:
        """Load and parse the VariablesMapping.xlsx file"""
        try:
            if not self.mapping_file_path.exists():
                raise FileNotFoundError(
                    f"VariablesMapping.xlsx not found at {self.mapping_file_path}"
                )

            logger.info(f"Loading VariablesMapping from {self.mapping_file_path}")

            # Read Excel file - assuming first sheet contains the mapping
            self._mapping_data = pd.read_excel(
                self.mapping_file_path, sheet_name=0, engine="openpyxl"
            )

            logger.info(
                f"Loaded {len(self._mapping_data)} rows from VariablesMapping.xlsx"
            )
            logger.debug(f"Columns found: {list(self._mapping_data.columns)}")

            # Build category map: variable_name -> category
            self._build_category_map()

        except Exception as e:
            logger.error(f"Error loading VariablesMapping.xlsx: {str(e)}")
            raise

    def _build_category_map(self) -> None:
        """Build internal mapping of variable names to categories"""
        if self._mapping_data is None:
            raise ValueError("Mapping data not loaded. Call load_mapping() first.")

        # Expected columns (case-insensitive matching)
        variable_col = self._find_column(["Variable", "variable", "VARIABLE", "Variable Name"])
        category_col = self._find_column(["Category", "category", "CATEGORY", "Variable Category"])

        if variable_col is None or category_col is None:
            available_cols = ", ".join(self._mapping_data.columns)
            raise ValueError(
                f"Required columns not found. Expected 'Variable' and 'Category'. "
                f"Available columns: {available_cols}"
            )

        # Build map
        self._category_map = {}
        for _, row in self._mapping_data.iterrows():
            var_name = row[variable_col]
            category = row[category_col]

            # Handle missing/NaN values
            if pd.notna(var_name) and pd.notna(category):
                var_name = str(var_name).strip().upper()
                category = str(category).strip()
                self._category_map[var_name] = category

        logger.info(f"Built category map with {len(self._category_map)} variables")

    def _find_column(self, possible_names: List[str]) -> Optional[str]:
        """Find column by trying multiple possible names"""
        if self._mapping_data is None:
            return None

        for col in self._mapping_data.columns:
            if col in possible_names:
                return col
        return None

    def get_category_for_variable(self, variable_name: str) -> Optional[str]:
        """
        Get category for a given variable name

        Args:
            variable_name: Variable name to look up

        Returns:
            Category name if found, None otherwise
        """
        if self._category_map is None:
            raise ValueError("Mapping not loaded. Call load_mapping() first.")

        var_upper = variable_name.strip().upper()
        return self._category_map.get(var_upper)

    def get_all_categories(self) -> List[str]:
        """Get list of all unique categories"""
        if self._category_map is None:
            raise ValueError("Mapping not loaded. Call load_mapping() first.")

        return sorted(set(self._category_map.values()))

    def get_variable_details(self, variable_name: str) -> Optional[Dict[str, str]]:
        """
        Get detailed information about a variable from the mapping

        Args:
            variable_name: Variable name to look up

        Returns:
            Dictionary with variable details (type, length, format, description) or None
        """
        if self._mapping_data is None:
            raise ValueError("Mapping not loaded. Call load_mapping() first.")

        var_upper = variable_name.strip().upper()

        # Find variable column
        variable_col = self._find_column(["Variable", "variable", "VARIABLE", "Variable Name"])
        if variable_col is None:
            return None

        # Find row for this variable
        matching_rows = self._mapping_data[
            self._mapping_data[variable_col].astype(str).str.upper().str.strip()
            == var_upper
        ]

        if matching_rows.empty:
            return None

        row = matching_rows.iloc[0]

        # Extract details from available columns
        details = {}

        # Map common column names
        column_mappings = {
            "type": ["Type", "type", "TYPE", "Data Type", "Variable Type"],
            "length": ["Length", "length", "LENGTH", "Variable Length"],
            "format": ["Format", "format", "FORMAT", "Variable Format"],
            "description": [
                "Description",
                "description",
                "DESCRIPTION",
                "Variable Description",
                "Label",
            ],
            "category": ["Category", "category", "CATEGORY", "Variable Category"],
        }

        for detail_key, possible_cols in column_mappings.items():
            col = self._find_column(possible_cols)
            if col is not None and pd.notna(row[col]):
                details[detail_key] = str(row[col]).strip()

        return details if details else None


class SpecificationParser:
    """Parser for ADAM specification Excel files"""

    def __init__(self, spec_file_path: str):
        """
        Initialize parser with specification file path

        Args:
            spec_file_path: Path to specification Excel file
        """
        self.spec_file_path = Path(spec_file_path)
        self._spec_data: Optional[pd.DataFrame] = None

    def load_specification(self, sheet_name: Optional[str] = None) -> None:
        """
        Load specification Excel file

        Args:
            sheet_name: Name of sheet to load. If None, loads first sheet.
        """
        try:
            if not self.spec_file_path.exists():
                raise FileNotFoundError(
                    f"Specification file not found at {self.spec_file_path}"
                )

            logger.info(f"Loading specification from {self.spec_file_path}")

            # Try to read the first sheet or specified sheet
            if sheet_name:
                self._spec_data = pd.read_excel(
                    self.spec_file_path, sheet_name=sheet_name, engine="openpyxl"
                )
            else:
                # Load first sheet by default
                self._spec_data = pd.read_excel(
                    self.spec_file_path, sheet_name=0, engine="openpyxl"
                )

            logger.info(f"Loaded {len(self._spec_data)} rows from specification")
            logger.debug(f"Columns found: {list(self._spec_data.columns)}")

        except Exception as e:
            logger.error(f"Error loading specification file: {str(e)}")
            raise

    def get_variables(self) -> List[Dict[str, str]]:
        """
        Extract variables from specification

        Returns:
            List of dictionaries with variable information
        """
        if self._spec_data is None:
            raise ValueError("Specification not loaded. Call load_specification() first.")

        variables = []

        # Find variable name column
        variable_col = self._find_column(
            ["Variable", "variable", "VARIABLE", "Variable Name", "variable_name"]
        )

        if variable_col is None:
            logger.warning(
                "No variable column found in specification. "
                f"Available columns: {', '.join(self._spec_data.columns)}"
            )
            return []

        # Extract variable information
        for _, row in self._spec_data.iterrows():
            var_name = row[variable_col]

            if pd.notna(var_name):
                var_info = {"name": str(var_name).strip()}

                # Try to extract additional fields
                label_col = self._find_column(
                    ["Label", "label", "LABEL", "Variable Label", "Description"]
                )
                type_col = self._find_column(
                    ["Type", "type", "TYPE", "Data Type", "Variable Type"]
                )
                length_col = self._find_column(
                    ["Length", "length", "LENGTH", "Variable Length"]
                )
                format_col = self._find_column(
                    ["Format", "format", "FORMAT", "Variable Format"]
                )
                derivation_col = self._find_column(
                    ["Derivation", "derivation", "DERIVATION", "Source", "Algorithm"]
                )

                if label_col and pd.notna(row[label_col]):
                    var_info["label"] = str(row[label_col]).strip()
                if type_col and pd.notna(row[type_col]):
                    var_info["type"] = str(row[type_col]).strip()
                if length_col and pd.notna(row[length_col]):
                    var_info["length"] = str(row[length_col]).strip()
                if format_col and pd.notna(row[format_col]):
                    var_info["format"] = str(row[format_col]).strip()
                if derivation_col and pd.notna(row[derivation_col]):
                    var_info["derivation"] = str(row[derivation_col]).strip()

                variables.append(var_info)

        logger.info(f"Extracted {len(variables)} variables from specification")
        return variables

    def _find_column(self, possible_names: List[str]) -> Optional[str]:
        """Find column by trying multiple possible names"""
        if self._spec_data is None:
            return None

        for col in self._spec_data.columns:
            if col in possible_names:
                return col
        return None
