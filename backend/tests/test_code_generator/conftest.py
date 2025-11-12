"""
Pytest configuration and fixtures for code_generator tests
"""
import pytest
import sys
from pathlib import Path

# Add backend directory to path for imports
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))


@pytest.fixture
def sample_variable():
    """Fixture providing a sample variable for testing"""
    return {
        "variable": "AGEGR1",
        "label": "Age Group 1",
        "type": "text",
        "length": 10,
        "derivation": "Categorize AGE into groups: <65, 65-80, >80"
    }


@pytest.fixture
def sample_context():
    """Fixture providing sample context for testing"""
    return {
        "dataset": "ADSL",
        "language": "R",
        "study_id": "TEST001",
        "standards": {
            "sdtm_version": "3.4",
            "adam_ig_version": "1.3",
            "meddra_version": "26.0"
        },
        "available_sdtm_domains": ["DM", "VS", "LB", "AE"],
        "required_variables": ["USUBJID", "STUDYID", "SITEID"]
    }


@pytest.fixture
def sample_categorization_result():
    """Fixture providing sample categorization result"""
    return {
        "demographic_variables": [
            {
                "variable": "AGE",
                "label": "Age",
                "derivation": "Derived from DM.AGE",
                "type": "numeric"
            },
            {
                "variable": "AGEGR1",
                "label": "Age Group 1",
                "derivation": "Categorize AGE: <65, 65-80, >80",
                "type": "text"
            }
        ],
        "efficacy_variables": [
            {
                "variable": "AVAL",
                "label": "Analysis Value",
                "derivation": "Standardized result value",
                "type": "numeric"
            },
            {
                "variable": "CHG",
                "label": "Change from Baseline",
                "derivation": "AVAL - BASE",
                "type": "numeric"
            }
        ],
        "safety_variables": [
            {
                "variable": "SAFFL",
                "label": "Safety Population Flag",
                "derivation": "If received treatment then 'Y' else 'N'",
                "type": "text"
            }
        ]
    }


@pytest.fixture
def r_code_sample():
    """Fixture providing sample R code"""
    return """
# Categorize age into groups
adsl <- adsl %>%
  mutate(
    AGEGR1 = case_when(
      AGE < 65 ~ '<65',
      AGE >= 65 & AGE <= 80 ~ '65-80',
      AGE > 80 ~ '>80',
      TRUE ~ NA_character_
    )
  )
"""


@pytest.fixture
def sas_code_sample():
    """Fixture providing sample SAS code"""
    return """
/* Categorize age into groups */
data adsl;
  set adsl;
  
  if AGE < 65 then AGEGR1 = '<65';
  else if AGE >= 65 and AGE <= 80 then AGEGR1 = '65-80';
  else if AGE > 80 then AGEGR1 = '>80';
  else AGEGR1 = '';
run;
"""


@pytest.fixture
def mock_gemini_response():
    """Fixture providing mock Gemini API response"""
    return {
        "code_snippet": "adsl$AGEGR1 <- ifelse(adsl$AGE < 65, '<65', '>=65')",
        "coding_rationale": "Categorize age into two groups based on 65-year threshold",
        "success": True,
        "metadata": {
            "model": "gemini-2.0-flash-exp",
            "tokens_used": 150
        }
    }
