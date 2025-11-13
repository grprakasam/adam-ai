"""
Test script for code validation
Tests R and SAS validation functionality
"""

import asyncio
from app.core.validation import get_validator

# Test R code samples
R_VALID_CODE = """
library(dplyr)

# Load data
data <- read.csv("input.csv")

# Process data
result <- data %>%
  filter(!is.na(USUBJID)) %>%
  mutate(AGE_GROUP = case_when(
    AGE < 18 ~ "Pediatric",
    AGE >= 18 & AGE < 65 ~ "Adult",
    AGE >= 65 ~ "Elderly"
  ))

# Save result
write.csv(result, "output.csv", row.names = FALSE)
"""

R_SYNTAX_ERROR = """
library(dplyr)

# Missing closing parenthesis
data <- read.csv("input.csv"

result <- data %>% filter(AGE > 18)
"""

R_STYLE_ISSUES = """
library(dplyr)
x<-1+2
y=3+4  # Should use <- not =
verylongvariablenamethatexceedsreasonablelength <- 123
"""

# Test SAS code samples
SAS_VALID_CODE = """
data adsl;
    set sdtm.dm;
    by usubjid;
    
    /* Calculate age groups */
    if age < 18 then agegr1 = 'Pediatric';
    else if age >= 18 and age < 65 then agegr1 = 'Adult';
    else if age >= 65 then agegr1 = 'Elderly';
    
    label agegr1 = 'Age Group';
run;

proc sort data=adsl;
    by usubjid;
run;
"""

SAS_MISSING_RUN = """
data adsl;
    set sdtm.dm;
    age_years = age;

data adae;
    set sdtm.ae;
"""

SAS_STYLE_ISSUES = """
data test; set input; x=1; y=2; z=3; run;
"""


def print_validation_result(result, code_name):
    """Pretty print validation results"""
    print(f"\n{'='*60}")
    print(f"Test: {code_name}")
    print(f"{'='*60}")
    print(f"Language: {result.language}")
    print(f"Valid: {'✅ Yes' if result.is_valid else '❌ No'}")
    print(f"Errors: {sum(1 for i in result.issues if i.severity.value == 'error')}")
    print(f"Warnings: {sum(1 for i in result.issues if i.severity.value == 'warning')}")
    print(f"Execution Time: {result.execution_time:.2f}s")
    
    if result.issues:
        print(f"\nIssues Found:")
        for issue in result.issues:
            severity_icon = {
                'error': '❌',
                'warning': '⚠️',
                'info': 'ℹ️',
                'style': '✨'
            }.get(issue.severity.value, '•')
            
            location = f"Line {issue.line}" + (f", Col {issue.column}" if issue.column else "")
            print(f"  {severity_icon} [{issue.severity.value.upper()}] {location}: {issue.message}")
            if issue.suggestion:
                print(f"     💡 Suggestion: {issue.suggestion}")
    else:
        print("\n✅ No issues found!")


def main():
    """Run all validation tests"""
    print("\n" + "="*60)
    print("CODE VALIDATION TEST SUITE")
    print("="*60)
    
    validator = get_validator()
    
    # Check validator status
    print("\n📊 Validator Status:")
    status = validator.get_validator_status()
    print(f"  R Available: {'✅' if status['R']['available'] else '❌'}")
    print(f"  R lintr Available: {'✅' if status['R'].get('lintr_available') else '❌'}")
    print(f"  SAS Available: ✅ (Basic validation)")
    
    # Test R validation
    print("\n" + "="*60)
    print("R VALIDATION TESTS")
    print("="*60)
    
    print("\n1️⃣ Testing valid R code...")
    result = validator.validate(R_VALID_CODE, "R")
    print_validation_result(result, "Valid R Code")
    
    print("\n2️⃣ Testing R syntax error...")
    result = validator.validate(R_SYNTAX_ERROR, "R")
    print_validation_result(result, "R Syntax Error")
    
    print("\n3️⃣ Testing R style issues...")
    result = validator.validate(R_STYLE_ISSUES, "R")
    print_validation_result(result, "R Style Issues")
    
    # Test SAS validation
    print("\n" + "="*60)
    print("SAS VALIDATION TESTS")
    print("="*60)
    
    print("\n4️⃣ Testing valid SAS code...")
    result = validator.validate(SAS_VALID_CODE, "SAS")
    print_validation_result(result, "Valid SAS Code")
    
    print("\n5️⃣ Testing SAS missing RUN...")
    result = validator.validate(SAS_MISSING_RUN, "SAS")
    print_validation_result(result, "SAS Missing RUN")
    
    print("\n6️⃣ Testing SAS style issues...")
    result = validator.validate(SAS_STYLE_ISSUES, "SAS")
    print_validation_result(result, "SAS Style Issues")
    
    print("\n" + "="*60)
    print("✅ ALL TESTS COMPLETE")
    print("="*60)
    print("\n💡 Tips:")
    print("  • If R validation shows 'R not available', install R from https://www.r-project.org/")
    print("  • If lintr unavailable, run: install.packages('lintr') in R")
    print("  • SAS validation uses pattern matching (no SAS executable required)")
    print()


if __name__ == "__main__":
    main()
