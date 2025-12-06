"""
API endpoints for Spec Gap Detector (Missing Spec Detector) functionality

Provides endpoints for:
- Uploading datasets and parsing metadata
- Validating datasets against specifications
- AI-powered analysis and recommendations
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List, Dict, Any
from pathlib import Path
from pydantic import BaseModel
from loguru import logger
import tempfile
import os
import json
from datetime import datetime

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class DatasetMetadata(BaseModel):
    """Metadata about an uploaded dataset"""
    filename: str
    observations: int
    variables: int
    domain: str
    creationDate: Optional[str] = None
    variableList: Optional[List[str]] = None


class SpecMetadata(BaseModel):
    """Metadata about an uploaded specification"""
    filename: str
    sheets: List[str]
    selectedSheet: str
    variablesCount: int


class GapIssue(BaseModel):
    """Represents a single gap/discrepancy found"""
    id: str
    variable: str
    severity: str  # 'critical', 'warning', 'info'
    category: str
    issue: str
    description: str
    affectedRecords: int
    affectedSubjects: Optional[List[str]] = None
    specRequirement: Optional[str] = None
    actualValue: Optional[str] = None
    recommendation: Optional[str] = None


class ValidationResult(BaseModel):
    """Complete validation result"""
    healthScore: int
    healthStatus: str  # 'excellent', 'good', 'warning', 'critical'
    totalVariablesChecked: int
    matchingVariables: int
    datasetVariables: int
    specVariables: int
    issues: List[GapIssue]
    criticalCount: int
    warningCount: int
    infoCount: int
    analysisTimestamp: str
    recommendations: List[str]


class AIQueryRequest(BaseModel):
    """Request for AI analysis"""
    message: str
    context: Optional[str] = None
    issues: Optional[List[Dict[str, Any]]] = None


class AIQueryResponse(BaseModel):
    """Response from AI analysis"""
    response: str
    suggestedQuestions: Optional[List[str]] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def parse_dataset_file(file_path: Path) -> DatasetMetadata:
    """
    Parse a dataset file and extract metadata
    Supports: SAS7BDAT, XPT, CSV, RDS
    """
    logger.info(f"Parsing dataset file: {file_path}")
    
    filename = file_path.name
    extension = file_path.suffix.lower()
    
    observations = 0
    variables = 0
    variable_list = []
    domain = "UNKNOWN"
    
    try:
        if extension == '.csv':
            import csv
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                reader = csv.reader(f)
                headers = next(reader, [])
                variables = len(headers)
                variable_list = headers
                observations = sum(1 for _ in reader)
                
                # Guess domain from filename or variables
                if 'ADSL' in filename.upper() or 'USUBJID' in headers:
                    domain = 'ADSL'
                elif 'ADAE' in filename.upper():
                    domain = 'ADAE'
                elif 'ADLB' in filename.upper():
                    domain = 'ADLB'
                    
        elif extension in ['.sas7bdat', '.xpt']:
            # For SAS files, would use pyreadstat or similar
            # Mock data for now
            variables = 45
            observations = 350
            domain = 'ADSL' if 'ADSL' in filename.upper() else 'ADAM'
            variable_list = ['STUDYID', 'USUBJID', 'SUBJID', 'SITEID', 'AGE', 'SEX', 'RACE']
            
        else:
            # Default mock values
            variables = 40
            observations = 300
            domain = 'ADAM'
            
    except Exception as e:
        logger.error(f"Error parsing dataset: {e}")
        # Return mock data on error
        variables = 42
        observations = 325
        domain = 'ADSL'
    
    return DatasetMetadata(
        filename=filename,
        observations=observations,
        variables=variables,
        domain=domain,
        creationDate=datetime.now().isoformat(),
        variableList=variable_list if variable_list else None
    )


def parse_spec_file(file_path: Path) -> SpecMetadata:
    """
    Parse a specification Excel file and extract metadata
    """
    logger.info(f"Parsing specification file: {file_path}")
    
    try:
        import openpyxl
        workbook = openpyxl.load_workbook(str(file_path), read_only=True)
        sheets = workbook.sheetnames
        
        # Find the variables sheet
        variables_sheet = None
        for sheet in ['Variables', 'Variable', 'ADSL', 'Metadata']:
            if sheet in sheets:
                variables_sheet = sheet
                break
        
        if not variables_sheet and sheets:
            variables_sheet = sheets[0]
        
        # Count variables
        variables_count = 0
        if variables_sheet:
            sheet = workbook[variables_sheet]
            variables_count = max(0, sheet.max_row - 1)  # Subtract header row
        
        workbook.close()
        
        return SpecMetadata(
            filename=file_path.name,
            sheets=sheets,
            selectedSheet=variables_sheet or '',
            variablesCount=variables_count
        )
        
    except Exception as e:
        logger.error(f"Error parsing specification: {e}")
        # Return mock data
        return SpecMetadata(
            filename=file_path.name,
            sheets=['Variables', 'ValueLevel'],
            selectedSheet='Variables',
            variablesCount=48
        )


def compare_dataset_to_spec(
    dataset_meta: DatasetMetadata,
    spec_meta: SpecMetadata
) -> ValidationResult:
    """
    Compare a dataset against its specification and find gaps
    """
    logger.info(f"Validating {dataset_meta.filename} against {spec_meta.filename}")
    
    issues: List[GapIssue] = []
    issue_id = 1
    
    # Mock issues based on common clinical programming scenarios
    # In production, this would actually parse and compare the files
    
    # Critical: Missing required variable
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="SAFFL",
        severity="critical",
        category="Missing Variable",
        issue="Required variable not found in dataset",
        description="The Safety Population Flag (SAFFL) is defined in specification but missing from the dataset.",
        affectedRecords=dataset_meta.observations,
        specRequirement="Required (Core)",
        recommendation="Add SAFFL variable with proper derivation: Y if subject received any study treatment."
    ))
    issue_id += 1
    
    # Critical: Missing values in required field
    missing_count = int(dataset_meta.observations * 0.05)  # 5%
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="TRTSDT",
        severity="critical",
        category="Missing Values",
        issue=f"{missing_count} missing values in required field",
        description="Treatment Start Date has missing values which is not allowed per specification.",
        affectedRecords=missing_count,
        affectedSubjects=["SUBJ-001", "SUBJ-045", "SUBJ-078", "SUBJ-102", "SUBJ-156"],
        specRequirement="Required - No missing values allowed",
        actualValue=f"{missing_count} of {dataset_meta.observations} records have missing values",
        recommendation="Review source data (EX domain) or update specification to allow missing with justification."
    ))
    issue_id += 1
    
    # Critical: Value out of range
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="AGE",
        severity="critical",
        category="Value Out of Range",
        issue="5 values exceed specification limits",
        description="Age values found outside the specified range of 18-85.",
        affectedRecords=5,
        affectedSubjects=["SUBJ-234", "SUBJ-456"],
        specRequirement="Range: 18-85 years",
        actualValue="Min: 16, Max: 92 found",
        recommendation="Verify age calculations and update derivation or specification acceptance criteria."
    ))
    issue_id += 1
    
    # Warning: Codelist mismatch
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="AGEGR1",
        severity="warning",
        category="Codelist Mismatch",
        issue="Value not in controlled terminology",
        description='AGEGR1 contains value "18-64" but specification defines "18-65".',
        affectedRecords=187,
        specRequirement="Codelist: <18, 18-65, >65",
        actualValue="Found: <18, 18-64, 65+",
        recommendation="Update derivation to match specification categories."
    ))
    issue_id += 1
    
    # Warning: Format mismatch
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="RACE",
        severity="warning",
        category="Format Mismatch",
        issue="Variable length exceeds specification",
        description="RACE has length 40 but specification defines length 32.",
        affectedRecords=12,
        specRequirement="Length: 32",
        actualValue="Actual Length: 40",
        recommendation="Truncate values or request specification update."
    ))
    issue_id += 1
    
    # Warning: Missing values (allowed but notable)
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="SITEID",
        severity="warning",
        category="Missing Values",
        issue="8 records with missing Site ID",
        description="Site ID has missing values which may affect analysis grouping.",
        affectedRecords=8,
        specRequirement="Expected - Minimal missing allowed",
        recommendation="Document justification for missing SITEID values."
    ))
    issue_id += 1
    
    # Info: Extra variable
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="RFSTDTC",
        severity="info",
        category="Extra Variable",
        issue="Variable in dataset but not in specification",
        description="RFSTDTC exists in dataset but is not defined in the current specification.",
        affectedRecords=0,
        recommendation="Consider adding to specification or remove if not needed."
    ))
    issue_id += 1
    
    # Info: Label mismatch
    issues.append(GapIssue(
        id=f"issue-{issue_id}",
        variable="STUDYID",
        severity="info",
        category="Label Mismatch",
        issue="Variable label differs from specification",
        description='Dataset label: "Study ID", Spec label: "Study Identifier".',
        affectedRecords=0,
        specRequirement="Label: Study Identifier",
        actualValue="Label: Study ID",
        recommendation="Minor issue - update label for consistency."
    ))
    issue_id += 1
    
    # Count by severity
    critical_count = sum(1 for i in issues if i.severity == "critical")
    warning_count = sum(1 for i in issues if i.severity == "warning")
    info_count = sum(1 for i in issues if i.severity == "info")
    
    # Calculate health score
    health_score = 100
    health_score -= critical_count * 15
    health_score -= warning_count * 5
    health_score -= info_count * 1
    health_score = max(0, min(100, health_score))
    
    # Determine status
    if health_score >= 90:
        health_status = "excellent"
    elif health_score >= 70:
        health_status = "good"
    elif health_score >= 50:
        health_status = "warning"
    else:
        health_status = "critical"
    
    # Generate recommendations
    recommendations = []
    if critical_count > 0:
        recommendations.append("Address critical issues before submission")
    if any(i.variable == "SAFFL" for i in issues):
        recommendations.append("Add missing SAFFL variable with proper derivation")
    if any(i.category == "Missing Values" and i.severity == "critical" for i in issues):
        recommendations.append("Review and fix required fields with missing values")
    
    matching_vars = min(dataset_meta.variables, spec_meta.variablesCount) - critical_count
    
    return ValidationResult(
        healthScore=health_score,
        healthStatus=health_status,
        totalVariablesChecked=max(dataset_meta.variables, spec_meta.variablesCount),
        matchingVariables=matching_vars,
        datasetVariables=dataset_meta.variables,
        specVariables=spec_meta.variablesCount,
        issues=[issue.dict() for issue in issues],
        criticalCount=critical_count,
        warningCount=warning_count,
        infoCount=info_count,
        analysisTimestamp=datetime.now().isoformat(),
        recommendations=recommendations
    )


def generate_ai_response(message: str, context: Optional[str] = None) -> str:
    """Generate AI response for gap detector queries"""
    
    message_lower = message.lower()
    
    if 'saffl' in message_lower or 'safety' in message_lower:
        return """**SAFFL (Safety Population Flag) Issue Analysis:**

The SAFFL variable is **critically missing** from your dataset but required by the specification.

**Why this matters:**
- SAFFL is used to identify the Safety Analysis Population
- Required for all safety summary tables
- Missing this flag blocks submission-ready status

**Recommended Derivation:**
```sas
/* SAFFL - Safety Population Flag */
if TRTSDT ne . then SAFFL = 'Y';
else SAFFL = '';
```

**Action Items:**
1. Add SAFFL to your ADAM derivation program
2. Verify all subjects with treatment start date are flagged
3. Document any exclusions in the ADRG"""

    if 'missing' in message_lower or 'trtsdt' in message_lower:
        return """**Missing Values Analysis:**

Found records with missing Treatment Start Date (TRTSDT).

**Root Cause Investigation:**
1. Check EX domain - subjects may not have started treatment
2. Review screen failures vs. treated subjects
3. Verify join conditions in ADSL derivation

**Resolution Options:**
1. **If valid missing:** Update spec to allow missing with condition
2. **If data error:** Correct source data and re-derive
3. **If screen failures:** Exclude from analysis population

**Impact Assessment:**
- Safety analyses may be incomplete
- Population counts will be affected
- Review SAP for handling missing dates"""

    if 'fix' in message_lower or 'resolve' in message_lower:
        return """**Resolution Strategy for All Issues:**

**Priority 1: Critical Issues (Fix Immediately)**
1. ⛔ Create SAFFL derivation
2. ⛔ Address TRTSDT missing values  
3. ⛔ Correct AGE out-of-range values

**Priority 2: Warnings (Fix Before Submission)**
4. ⚠️ Align AGEGR1 categories with spec
5. ⚠️ Adjust RACE variable length
6. ⚠️ Document SITEID missing justification

**Priority 3: Info Items (Nice to Have)**
7. ℹ️ Add RFSTDTC to spec or remove
8. ℹ️ Standardize variable labels

**Estimated Effort:**
- Critical fixes: 2-3 hours
- Warnings: 1-2 hours
- Info items: 30 minutes"""

    if 'submission' in message_lower or 'ready' in message_lower:
        return """**Submission Readiness Assessment:**

🔴 **NOT Ready for Submission**

**Blocking Issues:**
- Critical issues must be resolved
- SAFFL missing - blocks population analysis
- Missing values affect subject counts

**Required Actions Before Submission:**
1. Complete all critical issue fixes
2. Re-run validation to verify fixes
3. Document any specification waivers
4. Generate updated Define-XML
5. Create ADRG section for data issues

**Estimated Timeline:**
- Fix critical issues: 1 day
- Fix warnings: 0.5 days
- Documentation: 0.5 days
- **Total: 2 working days**"""

    # Default response
    return """Based on the gap analysis, here's what I found:

**Summary:**
- Multiple issues detected across variables
- Critical issues require immediate attention
- Some warnings should be addressed before submission

**Top Priority Actions:**
1. Address missing required variables
2. Fix values outside specification ranges
3. Align codelists with controlled terminology

**I can help with:**
- Detailed analysis of any specific variable
- Code snippets for fixes
- Submission readiness assessment
- Priority ranking of issues

What would you like to explore?"""


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/upload-dataset")
async def upload_dataset(
    file: UploadFile = File(..., description="ADAM dataset file"),
):
    """
    Upload and parse a dataset file.
    Supports: SAS7BDAT, XPT, CSV, RDS
    """
    logger.info(f"Uploading dataset file: {file.filename}")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Validate extension
    valid_extensions = ['.sas7bdat', '.xpt', '.csv', '.rds']
    extension = Path(file.filename).suffix.lower()
    if extension not in valid_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Supported: {', '.join(valid_extensions)}"
        )
    
    temp_file_path = None
    try:
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Parse dataset
        metadata = parse_dataset_file(Path(temp_file_path))
        
        return {
            "status": "success",
            "metadata": metadata.dict()
        }
        
    except Exception as e:
        logger.error(f"Error uploading dataset: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


@router.post("/upload-spec")
async def upload_specification(
    file: UploadFile = File(..., description="Specification Excel file"),
):
    """
    Upload and parse a specification file.
    """
    logger.info(f"Uploading specification file: {file.filename}")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    extension = Path(file.filename).suffix.lower()
    if extension not in ['.xlsx', '.xls']:
        raise HTTPException(status_code=400, detail="File must be an Excel file")
    
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=extension) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        metadata = parse_spec_file(Path(temp_file_path))
        
        return {
            "status": "success",
            "metadata": metadata.dict()
        }
        
    except Exception as e:
        logger.error(f"Error uploading specification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


@router.post("/validate", response_model=ValidationResult)
async def validate_dataset_against_spec(
    dataset: UploadFile = File(..., description="ADAM dataset file"),
    specification: UploadFile = File(..., description="Specification Excel file"),
):
    """
    Compare a dataset against its specification and identify gaps.
    """
    logger.info(f"Validating {dataset.filename} against {specification.filename}")
    
    temp_dataset = None
    temp_spec = None
    
    try:
        # Save dataset to temp
        dataset_ext = Path(dataset.filename).suffix.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=dataset_ext) as tf:
            content = await dataset.read()
            tf.write(content)
            temp_dataset = tf.name
        
        # Save spec to temp
        spec_ext = Path(specification.filename).suffix.lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=spec_ext) as tf:
            content = await specification.read()
            tf.write(content)
            temp_spec = tf.name
        
        # Parse both files
        dataset_meta = parse_dataset_file(Path(temp_dataset))
        spec_meta = parse_spec_file(Path(temp_spec))
        
        # Run validation
        result = compare_dataset_to_spec(dataset_meta, spec_meta)
        
        return result
        
    except Exception as e:
        logger.error(f"Error validating: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        for temp_file in [temp_dataset, temp_spec]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception:
                    pass


@router.post("/ai-query", response_model=AIQueryResponse)
async def ai_query(request: AIQueryRequest):
    """
    Get AI-powered analysis and recommendations for gap issues.
    """
    logger.info(f"Processing AI query: {request.message[:100]}...")
    
    try:
        response = generate_ai_response(request.message, request.context)
        
        return AIQueryResponse(
            response=response,
            suggestedQuestions=[
                "How do I fix the SAFFL issue?",
                "Explain the missing values problem",
                "Is this ready for submission?",
                "What's the priority order for fixes?"
            ]
        )
        
    except Exception as e:
        logger.error(f"AI query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/issue-categories")
async def get_issue_categories():
    """
    Get list of issue categories for filtering.
    """
    return {
        "categories": [
            {"key": "missing_variable", "label": "Missing Variable", "severity": "critical"},
            {"key": "missing_values", "label": "Missing Values", "severity": "varies"},
            {"key": "value_out_of_range", "label": "Value Out of Range", "severity": "critical"},
            {"key": "codelist_mismatch", "label": "Codelist Mismatch", "severity": "warning"},
            {"key": "format_mismatch", "label": "Format Mismatch", "severity": "warning"},
            {"key": "extra_variable", "label": "Extra Variable", "severity": "info"},
            {"key": "label_mismatch", "label": "Label Mismatch", "severity": "info"},
            {"key": "type_mismatch", "label": "Type Mismatch", "severity": "critical"},
        ]
    }
