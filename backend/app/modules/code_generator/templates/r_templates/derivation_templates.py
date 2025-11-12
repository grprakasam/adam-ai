"""
R Code Templates for ADAM Dataset Generation

Template library for common R programming patterns in ADAM datasets.
"""

from typing import Dict

# Direct derivation templates
R_DIRECT_DERIVATION = """
# Direct derivation: {variable}
{variable} <- {source_dataset}${source_variable}
"""

# Conditional flag templates
R_CONDITIONAL_FLAG = """
# Conditional flag: {variable}
{variable} <- ifelse({condition}, "Y", "N")
"""

R_MULTIPLE_CONDITIONS = """
# Multiple conditions: {variable}
{variable} <- case_when(
  {conditions}
  TRUE ~ NA_character_
)
"""

# Date conversion templates
R_DATE_CONVERSION = """
# Date conversion: {variable}
{variable} <- as.numeric(as.Date({source_variable}, format="{date_format}"))
"""

R_DATETIME_CONVERSION = """
# Datetime conversion: {variable}
{variable} <- as.numeric(as.POSIXct({source_variable}, format="{datetime_format}"))
"""

# Merge operation templates
R_MERGE_DATASETS = """
# Merge datasets for {variable}
{output_dataset} <- {dataset1} %>%
  left_join({dataset2}, by = c({key_variables}))
"""

# Numeric calculation templates
R_NUMERIC_CALCULATION = """
# Numeric calculation: {variable}
{variable} <- {expression}
"""

R_AGGREGATE_FUNCTION = """
# Aggregate function: {variable}
{variable} <- {dataset} %>%
  group_by({grouping_vars}) %>%
  summarise({variable} = {aggregate_function}({source_variable}), .groups = 'drop')
"""

# String manipulation templates  
R_STRING_CONCATENATION = """
# String concatenation: {variable}
{variable} <- paste0({variables})
"""

R_STRING_EXTRACTION = """
# String extraction: {variable}
{variable} <- str_extract({source_variable}, "{pattern}")
"""

# Grouping and sorting templates
R_GROUPING_OPERATION = """
# Grouping operation: {variable}
{dataset} <- {dataset} %>%
  group_by({grouping_vars}) %>%
  mutate({variable} = {operation})
"""

R_SORTING = """
# Sorting dataset
{dataset} <- {dataset} %>%
  arrange({sort_variables})
"""

# Filtering templates
R_FILTER_ROWS = """
# Filter rows for {variable}
{dataset} <- {dataset} %>%
  filter({conditions})
"""

# Subset operations
R_SELECT_COLUMNS = """
# Select columns
{dataset} <- {dataset} %>%
  select({columns})
"""

# Flag derivation templates
R_BASELINE_FLAG = """
# Baseline flag: {variable}
{variable} <- ifelse({baseline_condition}, "Y", NA_character_)
"""

R_WORST_CASE_FLAG = """
# Worst case flag: {variable}
{variable} <- {dataset} %>%
  group_by({subject_var}) %>%
  mutate({variable} = ifelse({value_var} == min({value_var}, na.rm = TRUE), "Y", NA_character_)) %>%
  ungroup()
"""

# Template mapping
R_TEMPLATES: Dict[str, str] = {
    "direct_derivation": R_DIRECT_DERIVATION,
    "conditional_flag": R_CONDITIONAL_FLAG,
    "multiple_conditions": R_MULTIPLE_CONDITIONS,
    "date_conversion": R_DATE_CONVERSION,
    "datetime_conversion": R_DATETIME_CONVERSION,
    "merge_datasets": R_MERGE_DATASETS,
    "numeric_calculation": R_NUMERIC_CALCULATION,
    "aggregate_function": R_AGGREGATE_FUNCTION,
    "string_concatenation": R_STRING_CONCATENATION,
    "string_extraction": R_STRING_EXTRACTION,
    "grouping_operation": R_GROUPING_OPERATION,
    "sorting": R_SORTING,
    "filter_rows": R_FILTER_ROWS,
    "select_columns": R_SELECT_COLUMNS,
    "baseline_flag": R_BASELINE_FLAG,
    "worst_case_flag": R_WORST_CASE_FLAG,
}


def get_r_template(template_name: str) -> str:
    """Get R template by name"""
    return R_TEMPLATES.get(template_name, "")


def list_r_templates() -> list:
    """List all available R templates"""
    return list(R_TEMPLATES.keys())
