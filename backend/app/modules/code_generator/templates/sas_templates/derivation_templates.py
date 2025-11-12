"""
SAS Code Templates for ADAM Dataset Generation

Template library for common SAS programming patterns in ADAM datasets.
"""

from typing import Dict

# Direct derivation templates
SAS_DIRECT_DERIVATION = """
/* Direct derivation: {variable} */
{variable} = {source_dataset}.{source_variable};
"""

# Conditional flag templates
SAS_CONDITIONAL_FLAG = """
/* Conditional flag: {variable} */
if {condition} then {variable} = "Y";
else {variable} = "N";
"""

SAS_MULTIPLE_CONDITIONS = """
/* Multiple conditions: {variable} */
if {first_condition} then {variable} = {first_value};
{additional_conditions}
else {variable} = "";
"""

# Date conversion templates
SAS_DATE_CONVERSION = """
/* Date conversion: {variable} */
{variable} = input({source_variable}, {date_informat}.);
format {variable} DATE9.;
"""

SAS_DATETIME_CONVERSION = """
/* Datetime conversion: {variable} */
{variable} = input({source_variable}, {datetime_informat}.);
format {variable} DATETIME19.;
"""

# Merge operation templates
SAS_MERGE_DATASETS = """
/* Merge datasets for {variable} */
proc sort data={dataset1}; by {key_variables}; run;
proc sort data={dataset2}; by {key_variables}; run;

data {output_dataset};
  merge {dataset1}(in=a) {dataset2}(in=b);
  by {key_variables};
  if a;
run;
"""

# Numeric calculation templates
SAS_NUMERIC_CALCULATION = """
/* Numeric calculation: {variable} */
{variable} = {expression};
"""

SAS_AGGREGATE_FUNCTION = """
/* Aggregate function: {variable} */
proc sql;
  create table {output_dataset} as
  select {grouping_vars}, 
         {aggregate_function}({source_variable}) as {variable}
  from {dataset}
  group by {grouping_vars};
quit;
"""

# String manipulation templates  
SAS_STRING_CONCATENATION = """
/* String concatenation: {variable} */
{variable} = catx(' ', {variables});
"""

SAS_STRING_EXTRACTION = """
/* String extraction: {variable} */
{variable} = prxchange('{pattern}', 1, {source_variable});
"""

# Grouping and sorting templates
SAS_GROUPING_OPERATION = """
/* Grouping operation: {variable} */
data {dataset};
  set {dataset};
  by {grouping_vars};
  {operation}
run;
"""

SAS_SORTING = """
/* Sorting dataset */
proc sort data={dataset};
  by {sort_variables};
run;
"""

# Filtering templates
SAS_FILTER_ROWS = """
/* Filter rows for {variable} */
data {dataset};
  set {dataset};
  where {conditions};
run;
"""

# Subset operations
SAS_SELECT_COLUMNS = """
/* Select columns */
data {dataset};
  set {dataset}(keep={columns});
run;
"""

# Flag derivation templates
SAS_BASELINE_FLAG = """
/* Baseline flag: {variable} */
if {baseline_condition} then {variable} = "Y";
else {variable} = "";
"""

SAS_WORST_CASE_FLAG = """
/* Worst case flag: {variable} */
proc sql;
  create table _temp as
  select {subject_var}, min({value_var}) as min_value
  from {dataset}
  group by {subject_var};
quit;

data {dataset};
  merge {dataset} _temp;
  by {subject_var};
  if {value_var} = min_value then {variable} = "Y";
  else {variable} = "";
  drop min_value;
run;
"""

# Data step template
SAS_DATA_STEP = """
/* Data step for {variable} */
data {output_dataset};
  set {input_dataset};
  {statements}
run;
"""

# Template mapping
SAS_TEMPLATES: Dict[str, str] = {
    "direct_derivation": SAS_DIRECT_DERIVATION,
    "conditional_flag": SAS_CONDITIONAL_FLAG,
    "multiple_conditions": SAS_MULTIPLE_CONDITIONS,
    "date_conversion": SAS_DATE_CONVERSION,
    "datetime_conversion": SAS_DATETIME_CONVERSION,
    "merge_datasets": SAS_MERGE_DATASETS,
    "numeric_calculation": SAS_NUMERIC_CALCULATION,
    "aggregate_function": SAS_AGGREGATE_FUNCTION,
    "string_concatenation": SAS_STRING_CONCATENATION,
    "string_extraction": SAS_STRING_EXTRACTION,
    "grouping_operation": SAS_GROUPING_OPERATION,
    "sorting": SAS_SORTING,
    "filter_rows": SAS_FILTER_ROWS,
    "select_columns": SAS_SELECT_COLUMNS,
    "baseline_flag": SAS_BASELINE_FLAG,
    "worst_case_flag": SAS_WORST_CASE_FLAG,
    "data_step": SAS_DATA_STEP,
}


def get_sas_template(template_name: str) -> str:
    """Get SAS template by name"""
    return SAS_TEMPLATES.get(template_name, "")


def list_sas_templates() -> list:
    """List all available SAS templates"""
    return list(SAS_TEMPLATES.keys())
