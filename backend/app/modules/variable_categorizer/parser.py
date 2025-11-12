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
        self._category_order: List[str] = []

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
        variable_col = self._find_column(["Variable", "variable", "VARIABLE", "Variable Name", "variable_name", "VariableName"])
        category_col = self._find_column(["Category", "category", "CATEGORY", "Variable Category", "variable_category"])

        if variable_col is None or category_col is None:
            available_cols = ", ".join(self._mapping_data.columns)
            raise ValueError(
                f"Required columns not found. Expected 'Variable' and 'Category'. "
                f"Available columns: {available_cols}"
            )

        # Build map
        self._category_map = {}
        self._category_order = []
        for _, row in self._mapping_data.iterrows():
            var_name = row[variable_col]
            category = row[category_col]

            # Handle missing/NaN values
            if pd.notna(var_name) and pd.notna(category):
                var_name = str(var_name).strip().upper()
                category = str(category).strip()
                self._category_map[var_name] = category
                if category not in self._category_order:
                    self._category_order.append(category)

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

        if self._category_order:
            return list(self._category_order)
        return sorted(set(self._category_map.values()))

    def get_category_order(self) -> List[str]:
        """Return categories in the order they appear in the mapping file"""
        if self._category_map is None:
            raise ValueError("Mapping not loaded. Call load_mapping() first.")
        if self._category_order:
            return list(self._category_order)
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
        variable_col = self._find_column(["Variable", "variable", "VARIABLE", "Variable Name", "variable_name", "VariableName"])
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
            ["Variable", "variable", "VARIABLE", "Variable Name", "variable_name", "VariableName", "VAR", "Var"]
        )

        if variable_col is None:
            logger.warning(
                "No variable column found in specification. "
                f"Available columns: {', '.join(self._spec_data.columns)}"
            )
            return []

        # Pre-detect commonly mapped columns by intent
        label_col = self._find_column(
            ["Label", "label", "LABEL", "Variable Label", "Description"]
        )
        type_col = self._find_column(
            ["Type", "type", "TYPE", "Data Type", "Variable Type", "SAS Type", "SAS_Type"]
        )
        length_col = self._find_column(
            ["Length", "length", "LENGTH", "Variable Length", "SAS Length", "SAS Length/Display Format", "SAS_Length"]
        )
        format_col = self._find_column(
            ["Format", "format", "FORMAT", "Variable Format", "Display Format", "SAS Format", "SAS Length/Display Format"]
        )
        derivation_col = self._find_column(
            ["Derivation", "derivation", "DERIVATION", "Source", "Algorithm", "Source/Derivation", "Source_Derivation"]
        )
        required_col = self._find_column(
            ["Required", "REQUIRED", "CDISC Core", "Core", "Mandatory"]
        )

        # Extract variable information
        for _, row in self._spec_data.iterrows():
            var_name = row[variable_col]

            if pd.notna(var_name):
                var_info = {"name": str(var_name).strip()}

                if label_col and pd.notna(row[label_col]):
                    var_info["label"] = str(row[label_col]).strip()
                if type_col and pd.notna(row[type_col]):
                    var_info["type"] = str(row[type_col]).strip()
                if length_col and pd.notna(row[length_col]):
                    var_info["length"] = str(row[length_col]).strip()
                if format_col and pd.notna(row[format_col]):
                    # If length_col and format_col point to same column (SAS Length/Display Format),
                    # only set if not already set by length
                    if format_col != length_col or "format" not in var_info:
                        var_info["format"] = str(row[format_col]).strip()
                if derivation_col and pd.notna(row[derivation_col]):
                    var_info["derivation"] = str(row[derivation_col]).strip()

                # Check if variable is required based on CDISC Core column
                if required_col and pd.notna(row[required_col]):
                    req_value = str(row[required_col]).strip().upper()
                    var_info["is_required"] = req_value in ["REQ", "REQUIRED", "YES", "Y", "MANDATORY"]
                else:
                    var_info["is_required"] = False

                # Capture all remaining columns verbatim into `extra`
                extras: Dict[str, str] = {}
                for col in self._spec_data.columns:
                    if col == variable_col:
                        continue
                    # Skip columns we already mapped above
                    if col in [label_col, type_col, length_col, format_col, derivation_col, required_col]:
                        continue
                    val = row[col]
                    if pd.notna(val):
                        extras[str(col)] = str(val).strip()

                if extras:
                    var_info["extra"] = extras

                variables.append(var_info)

        logger.info(f"Extracted {len(variables)} variables from specification")
        return variables

    def get_columns(self) -> List[str]:
        """Return all column names from the loaded specification in order"""
        if self._spec_data is None:
            raise ValueError("Specification not loaded. Call load_specification() first.")
        return list(map(str, list(self._spec_data.columns)))

    def _find_column(self, possible_names: List[str]) -> Optional[str]:
        """Find column by trying multiple possible names"""
        if self._spec_data is None:
            return None

        for col in self._spec_data.columns:
            if col in possible_names:
                return col
        return None
