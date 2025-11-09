"""
Variable categorization service
"""

from typing import Dict, List, Optional
from pathlib import Path
from loguru import logger

from .parser import VariablesMappingParser, SpecificationParser
from .models import VariableInfo, VariableCategory, CategorizationResult


class VariableCategorizerService:
    """Service for categorizing ADAM specification variables"""

    # Category for variables not found in mapping
    OTHER_CATEGORY = "Other Category"
    OTHER_CATEGORY_DESC = "Variables not categorized in the standard mapping"

    def __init__(self, mapping_file_path: Optional[str] = None):
        """
        Initialize service

        Args:
            mapping_file_path: Path to VariablesMapping.xlsx.
                             If None, uses default path.
        """
        self.mapping_parser = VariablesMappingParser(mapping_file_path)
        self._is_loaded = False

    def initialize(self) -> None:
        """Load the variables mapping file"""
        if not self._is_loaded:
            self.mapping_parser.load_mapping()
            self._is_loaded = True
            logger.info("VariableCategorizerService initialized")

    def categorize_specification(
        self, spec_file_path: str, dataset_type: str = "ADSL"
    ) -> CategorizationResult:
        """
        Categorize variables from a specification file

        Args:
            spec_file_path: Path to ADAM specification Excel file
            dataset_type: Type of dataset (ADSL, ADAE, ADLB)

        Returns:
            CategorizationResult with categorized variables
        """
        # Ensure mapping is loaded
        if not self._is_loaded:
            self.initialize()

        # Parse specification
        spec_parser = SpecificationParser(spec_file_path)
        spec_parser.load_specification()
        spec_variables = spec_parser.get_variables()

        logger.info(
            f"Categorizing {len(spec_variables)} variables for {dataset_type}"
        )

        # Categorize variables
        categorized_vars = self._categorize_variables(spec_variables)

        # Build result
        result = self._build_categorization_result(categorized_vars, dataset_type)

        logger.info(
            f"Categorization complete: {result.categorized_count} categorized, "
            f"{result.uncategorized_count} in Other Category"
        )

        return result

    def _categorize_variables(
        self, spec_variables: List[Dict[str, str]]
    ) -> Dict[str, List[VariableInfo]]:
        """
        Categorize a list of variables

        Args:
            spec_variables: List of variable dictionaries from specification

        Returns:
            Dictionary mapping category names to lists of VariableInfo
        """
        categorized: Dict[str, List[VariableInfo]] = {}

        for var_dict in spec_variables:
            var_name = var_dict.get("name", "")

            if not var_name:
                continue

            # Get category from mapping
            category = self.mapping_parser.get_category_for_variable(var_name)

            # If not found in mapping, use Other Category
            if category is None:
                category = self.OTHER_CATEGORY
                logger.debug(f"Variable {var_name} not in mapping, using {self.OTHER_CATEGORY}")

            # Get additional details from mapping (if available)
            mapping_details = self.mapping_parser.get_variable_details(var_name)

            # Build VariableInfo - prefer spec details, fall back to mapping
            var_info = VariableInfo(
                name=var_name,
                label=var_dict.get("label") or (
                    mapping_details.get("description") if mapping_details else None
                ),
                type=var_dict.get("type") or (
                    mapping_details.get("type") if mapping_details else None
                ),
                length=var_dict.get("length") or (
                    mapping_details.get("length") if mapping_details else None
                ),
                format=var_dict.get("format") or (
                    mapping_details.get("format") if mapping_details else None
                ),
                category=category,
                derivation=var_dict.get("derivation"),
                is_required=self._is_required_variable(var_name),
            )

            # Add to categorized dict
            if category not in categorized:
                categorized[category] = []
            categorized[category].append(var_info)

        return categorized

    def _is_required_variable(self, var_name: str) -> bool:
        """
        Determine if a variable is required

        For now, this is a simple heuristic. Can be enhanced with a required variables list.

        Args:
            var_name: Variable name

        Returns:
            True if variable is likely required
        """
        # Common required ADSL variables
        required_vars = {
            "STUDYID",
            "USUBJID",
            "SUBJID",
            "SITEID",
            "AGE",
            "SEX",
            "RACE",
            "ARMCD",
            "ARM",
            "ACTARMCD",
            "ACTARM",
            "RFSTDTC",
            "RFENDTC",
        }

        return var_name.upper() in required_vars

    def _build_categorization_result(
        self, categorized_vars: Dict[str, List[VariableInfo]], dataset_type: str
    ) -> CategorizationResult:
        """
        Build CategorizationResult from categorized variables

        Args:
            categorized_vars: Dictionary mapping category names to variable lists
            dataset_type: Dataset type (ADSL, ADAE, ADLB)

        Returns:
            CategorizationResult
        """
        categories = []
        total_vars = 0
        uncategorized_count = 0

        # Get all categories from mapping first (to include empty categories if needed)
        all_mapping_categories = self.mapping_parser.get_all_categories()

        # Create category objects
        category_order = self._get_category_order()

        for category_name in category_order:
            if category_name in categorized_vars:
                variables = categorized_vars[category_name]
                
                # Add category description
                description = self._get_category_description(category_name)

                category = VariableCategory(
                    name=category_name,
                    description=description,
                    variables=variables,
                    count=len(variables),
                )
                categories.append(category)
                total_vars += len(variables)

                if category_name == self.OTHER_CATEGORY:
                    uncategorized_count = len(variables)

        # Add any remaining categories not in the predefined order
        for category_name, variables in categorized_vars.items():
            if category_name not in category_order:
                description = self._get_category_description(category_name)
                
                category = VariableCategory(
                    name=category_name,
                    description=description,
                    variables=variables,
                    count=len(variables),
                )
                categories.append(category)
                total_vars += len(variables)

        categorized_count = total_vars - uncategorized_count

        return CategorizationResult(
            categories=categories,
            total_variables=total_vars,
            categorized_count=categorized_count,
            uncategorized_count=uncategorized_count,
            dataset_type=dataset_type,
        )

    def _get_category_order(self) -> List[str]:
        """
        Get preferred order for displaying categories

        Returns:
            List of category names in display order
        """
        # Preferred order based on common ADSL categories
        return [
            "Identifier Variables",
            "Treatment Variables",
            "Population Flags",
            "Demographics",
            "Study Dates",
            "Treatment Dates",
            "Disposition",
            "Derived Variables",
            "Study-Specific Variables",
            self.OTHER_CATEGORY,
        ]

    def _get_category_description(self, category_name: str) -> str:
        """
        Get description for a category

        Args:
            category_name: Category name

        Returns:
            Category description
        """
        descriptions = {
            "Identifier Variables": "Subject and study identification variables",
            "Treatment Variables": "Treatment assignment and coding variables",
            "Population Flags": "Analysis population indicators",
            "Demographics": "Demographic characteristics",
            "Study Dates": "Key study milestone dates",
            "Treatment Dates": "Treatment start and end dates",
            "Disposition": "Subject disposition and completion status",
            "Derived Variables": "Variables derived from other datasets",
            "Study-Specific Variables": "Variables specific to this study",
            self.OTHER_CATEGORY: self.OTHER_CATEGORY_DESC,
        }

        return descriptions.get(category_name, "")

    def get_variable_category(self, variable_name: str) -> Optional[str]:
        """
        Get category for a single variable

        Args:
            variable_name: Variable name

        Returns:
            Category name or None if not found
        """
        if not self._is_loaded:
            self.initialize()

        category = self.mapping_parser.get_category_for_variable(variable_name)
        return category if category else self.OTHER_CATEGORY
