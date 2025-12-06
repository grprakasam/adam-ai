"""
API endpoints for specification comparison functionality

Provides endpoints for:
- Uploading and parsing specification Excel files
- Comparing two specifications to find differences
- AI-powered analysis of specification changes
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from typing import Optional, List, Dict, Any
from pathlib import Path
from pydantic import BaseModel
from loguru import logger
import tempfile
import os
import json
import openpyxl
from datetime import datetime
import re

router = APIRouter()


# ============================================================================
# MODELS
# ============================================================================

class SpecVariable(BaseModel):
    """Represents a variable from a specification"""
    name: str
    label: Optional[str] = None
    type: Optional[str] = None
    length: Optional[int] = None
    format: Optional[str] = None
    derivation: Optional[str] = None
    source: Optional[str] = None
    codeList: Optional[str] = None
    core: Optional[str] = None
    comments: Optional[str] = None


class SpecMetadata(BaseModel):
    """Metadata about a parsed specification file"""
    filename: str
    sheets: List[str]
    selectedSheet: str
    variables: List[SpecVariable]
    totalVariables: int
    uploadedAt: str


class VariableChange(BaseModel):
    """Represents a change to a specific field"""
    field: str
    oldValue: Any
    newValue: Any
    impact: str  # 'high', 'medium', 'low'


class VariableDifference(BaseModel):
    """Represents a difference for a variable between specs"""
    variableName: str
    changeType: str  # 'added', 'removed', 'modified'
    specA: Optional[SpecVariable] = None
    specB: Optional[SpecVariable] = None
    changes: Optional[List[VariableChange]] = None
    impactScore: int
    category: Optional[str] = None


class Recommendation(BaseModel):
    """Decision recommendation based on comparison"""
    id: str
    priority: str  # 'high', 'medium', 'low'
    type: str  # 'action', 'warning', 'info'
    title: str
    description: str
    affectedVariables: Optional[List[str]] = None


class ComparisonResult(BaseModel):
    """Complete comparison result"""
    totalVariablesA: int
    totalVariablesB: int
    commonVariables: int
    addedVariables: List[VariableDifference]
    removedVariables: List[VariableDifference]
    modifiedVariables: List[VariableDifference]
    matchPercentage: float
    criticalChanges: int
    analysisTimestamp: str
    recommendations: List[Recommendation]


class CompareRequest(BaseModel):
    """Request to compare two specifications"""
    specA_path: str
    specB_path: str
    sheetA: Optional[str] = None
    sheetB: Optional[str] = None


class AIQueryRequest(BaseModel):
    """Request for AI analysis of comparison"""
    message: str
    context: Optional[str] = None


class AIQueryResponse(BaseModel):
    """Response from AI analysis"""
    response: str
    suggestedQuestions: Optional[List[str]] = None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_backend_dir() -> Path:
    """Get the backend directory path"""
    current_file = Path(__file__).resolve()
    # spec_comparison.py -> endpoints -> v1 -> api -> app -> backend
    return current_file.parent.parent.parent.parent.parent


def parse_spec_excel(file_path: Path) -> SpecMetadata:
    """
    Parse an ADAM specification Excel file and extract variable information
    """
    logger.info(f"Parsing specification file: {file_path}")
    
    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    try:
        workbook = openpyxl.load_workbook(str(file_path), read_only=True, data_only=True)
        sheets = workbook.sheetnames
        
        # Try to find the variables sheet (common names)
        variable_sheet_names = ['Variables', 'Variable', 'ADSL', 'ADAE', 'Metadata', 'Vars']
        selected_sheet = None
        
        for sheet_name in variable_sheet_names:
            if sheet_name in sheets:
                selected_sheet = sheet_name
                break
        
        if not selected_sheet:
            selected_sheet = sheets[0] if sheets else None
        
        variables = []
        
        if selected_sheet:
            sheet = workbook[selected_sheet]
            
            # Get header row to map columns
            headers = {}
            header_row = list(sheet.iter_rows(min_row=1, max_row=1, values_only=True))[0]
            
            for idx, header in enumerate(header_row):
                if header:
                    header_lower = str(header).lower().strip()
                    headers[header_lower] = idx
            
            # Map common column names
            column_mapping = {
                'name': ['variable', 'variable name', 'varname', 'name', 'var'],
                'label': ['label', 'variable label', 'description'],
                'type': ['type', 'data type', 'dtype', 'variable type'],
                'length': ['length', 'len', 'size'],
                'format': ['format', 'display format'],
                'derivation': ['derivation', 'derivation rule', 'algorithm', 'origin'],
                'source': ['source', 'source variable', 'src'],
                'codelist': ['codelist', 'code list', 'controlled terminology'],
                'core': ['core', 'cdisc core'],
                'comments': ['comments', 'notes', 'comment'],
            }
            
            def find_column(field_name: str) -> Optional[int]:
                for possible_name in column_mapping.get(field_name, []):
                    if possible_name in headers:
                        return headers[possible_name]
                return None
            
            # Parse data rows
            for row in sheet.iter_rows(min_row=2, max_row=500, values_only=True):
                # Skip empty rows
                if not any(cell for cell in row):
                    continue
                
                name_col = find_column('name')
                if name_col is None or not row[name_col]:
                    continue
                
                var = SpecVariable(
                    name=str(row[name_col]).strip(),
                    label=str(row[find_column('label')]).strip() if find_column('label') is not None and row[find_column('label')] else None,
                    type=str(row[find_column('type')]).strip() if find_column('type') is not None and row[find_column('type')] else None,
                    length=int(row[find_column('length')]) if find_column('length') is not None and row[find_column('length')] else None,
                    format=str(row[find_column('format')]).strip() if find_column('format') is not None and row[find_column('format')] else None,
                    derivation=str(row[find_column('derivation')]).strip() if find_column('derivation') is not None and row[find_column('derivation')] else None,
                    source=str(row[find_column('source')]).strip() if find_column('source') is not None and row[find_column('source')] else None,
                    codeList=str(row[find_column('codelist')]).strip() if find_column('codelist') is not None and row[find_column('codelist')] else None,
                    core=str(row[find_column('core')]).strip() if find_column('core') is not None and row[find_column('core')] else None,
                    comments=str(row[find_column('comments')]).strip() if find_column('comments') is not None and row[find_column('comments')] else None,
                )
                variables.append(var)
        
        workbook.close()
        
        return SpecMetadata(
            filename=file_path.name,
            sheets=sheets,
            selectedSheet=selected_sheet or '',
            variables=variables,
            totalVariables=len(variables),
            uploadedAt=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error parsing specification: {e}", exc_info=True)
        raise ValueError(f"Failed to parse specification: {str(e)}")


def compare_specifications(spec_a: SpecMetadata, spec_b: SpecMetadata) -> ComparisonResult:
    """
    Compare two specifications and identify differences
    """
    logger.info(f"Comparing specifications: {spec_a.filename} vs {spec_b.filename}")
    
    vars_a = {v.name: v for v in spec_a.variables}
    vars_b = {v.name: v for v in spec_b.variables}
    
    names_a = set(vars_a.keys())
    names_b = set(vars_b.keys())
    
    added_names = names_b - names_a
    removed_names = names_a - names_b
    common_names = names_a & names_b
    
    added_variables = []
    removed_variables = []
    modified_variables = []
    
    # Process added variables
    for name in added_names:
        var_b = vars_b[name]
        category = categorize_variable(name)
        impact = calculate_impact_score(None, var_b)
        
        added_variables.append(VariableDifference(
            variableName=name,
            changeType='added',
            specB=var_b,
            impactScore=impact,
            category=category
        ))
    
    # Process removed variables
    for name in removed_names:
        var_a = vars_a[name]
        category = categorize_variable(name)
        impact = calculate_impact_score(var_a, None)
        
        removed_variables.append(VariableDifference(
            variableName=name,
            changeType='removed',
            specA=var_a,
            impactScore=impact,
            category=category
        ))
    
    # Process common variables for modifications
    for name in common_names:
        var_a = vars_a[name]
        var_b = vars_b[name]
        changes = []
        
        # Compare all fields
        fields_to_compare = ['label', 'type', 'length', 'format', 'derivation', 'source', 'codeList', 'core']
        
        for field in fields_to_compare:
            val_a = getattr(var_a, field, None)
            val_b = getattr(var_b, field, None)
            
            # Normalize None and empty string
            if val_a == 'None' or val_a == '':
                val_a = None
            if val_b == 'None' or val_b == '':
                val_b = None
            
            if val_a != val_b:
                impact = determine_change_impact(field, val_a, val_b)
                changes.append(VariableChange(
                    field=field,
                    oldValue=val_a,
                    newValue=val_b,
                    impact=impact
                ))
        
        if changes:
            category = categorize_variable(name)
            impact_score = max([8 if c.impact == 'high' else 5 if c.impact == 'medium' else 2 for c in changes])
            
            modified_variables.append(VariableDifference(
                variableName=name,
                changeType='modified',
                specA=var_a,
                specB=var_b,
                changes=changes,
                impactScore=impact_score,
                category=category
            ))
    
    # Calculate statistics
    total_changes = len(added_variables) + len(removed_variables) + len(modified_variables)
    total_vars = max(len(vars_a), len(vars_b))
    match_pct = ((total_vars - total_changes) / total_vars * 100) if total_vars > 0 else 100
    
    critical_changes = sum(1 for v in modified_variables if v.impactScore >= 8)
    
    # Generate recommendations
    recommendations = generate_recommendations(added_variables, removed_variables, modified_variables)
    
    return ComparisonResult(
        totalVariablesA=len(vars_a),
        totalVariablesB=len(vars_b),
        commonVariables=len(common_names),
        addedVariables=added_variables,
        removedVariables=removed_variables,
        modifiedVariables=modified_variables,
        matchPercentage=round(match_pct, 1),
        criticalChanges=critical_changes,
        analysisTimestamp=datetime.now().isoformat(),
        recommendations=recommendations
    )


def categorize_variable(name: str) -> str:
    """Categorize a variable based on naming conventions"""
    name_upper = name.upper()
    
    if any(x in name_upper for x in ['TRT', 'ARM', 'ACTARM', 'DOSE']):
        return 'Treatment'
    elif any(x in name_upper for x in ['AGE', 'SEX', 'RACE', 'ETHNIC', 'COUNTRY']):
        return 'Demographics'
    elif any(x in name_upper for x in ['FL', 'FLAG', 'SAFFL', 'ITTFL', 'FASFL']):
        return 'Population'
    elif any(x in name_upper for x in ['AE', 'TRTEM', 'SOC', 'BODSYS', 'PT']):
        return 'Safety'
    elif any(x in name_upper for x in ['AVAL', 'CHG', 'BASE', 'AVALC']):
        return 'Analysis'
    elif any(x in name_upper for x in ['PARAM', 'PARAMCD', 'PARAMN']):
        return 'Parameter'
    elif any(x in name_upper for x in ['DT', 'DTM', 'DY']):
        return 'Timing'
    else:
        return 'General'


def calculate_impact_score(var_a: Optional[SpecVariable], var_b: Optional[SpecVariable]) -> int:
    """Calculate impact score for a variable change"""
    if var_a is None:  # New variable
        name = var_b.name if var_b else ''
        if any(x in name.upper() for x in ['SAFFL', 'ITTFL', 'FASFL', 'TRTEMFL']):
            return 9
        elif any(x in name.upper() for x in ['FL', 'TRT', 'ARM']):
            return 7
        return 5
    elif var_b is None:  # Removed variable
        name = var_a.name if var_a else ''
        if any(x in name.upper() for x in ['SAFFL', 'ITTFL', 'FASFL']):
            return 10
        return 6
    return 5


def determine_change_impact(field: str, old_val: Any, new_val: Any) -> str:
    """Determine the impact level of a specific field change"""
    high_impact_fields = ['derivation', 'type', 'codeList']
    medium_impact_fields = ['length', 'format', 'source']
    
    if field in high_impact_fields:
        return 'high'
    elif field in medium_impact_fields:
        return 'medium'
    return 'low'


def generate_recommendations(
    added: List[VariableDifference],
    removed: List[VariableDifference],
    modified: List[VariableDifference]
) -> List[Recommendation]:
    """Generate decision recommendations based on comparison results"""
    recommendations = []
    rec_id = 1
    
    # Check for critical modifications
    critical_mods = [v for v in modified if v.impactScore >= 8]
    for var in critical_mods:
        high_impact_changes = [c for c in (var.changes or []) if c.impact == 'high']
        if high_impact_changes:
            recommendations.append(Recommendation(
                id=str(rec_id),
                priority='high',
                type='warning',
                title=f'Critical: {var.variableName} Definition Changed',
                description=f'The {var.variableName} variable has significant changes in: {", ".join([c.field for c in high_impact_changes])}. Review all affected analyses.',
                affectedVariables=[var.variableName]
            ))
            rec_id += 1
    
    # Check for population flag changes
    pop_flags = [v for v in modified if any(x in v.variableName.upper() for x in ['SAFFL', 'ITTFL', 'FASFL'])]
    for var in pop_flags:
        recommendations.append(Recommendation(
            id=str(rec_id),
            priority='high',
            type='warning',
            title=f'Population Flag Changed: {var.variableName}',
            description=f'The {var.variableName} population flag has changed derivation. This may affect subject counts in analyses. Review SAP immediately.',
            affectedVariables=[var.variableName]
        ))
        rec_id += 1
    
    # Check for new safety-related variables
    safety_added = [v for v in added if v.category == 'Safety']
    if safety_added:
        recommendations.append(Recommendation(
            id=str(rec_id),
            priority='medium',
            type='action',
            title='New Safety Variables Added',
            description=f'New safety-related variables have been added: {", ".join([v.variableName for v in safety_added])}. Update safety analysis programs.',
            affectedVariables=[v.variableName for v in safety_added]
        ))
        rec_id += 1
    
    # Check for removed variables
    if removed:
        recommendations.append(Recommendation(
            id=str(rec_id),
            priority='medium',
            type='warning',
            title='Variables Removed from Specification',
            description=f'{len(removed)} variable(s) were removed. Ensure affected programs are updated: {", ".join([v.variableName for v in removed[:5]])}',
            affectedVariables=[v.variableName for v in removed]
        ))
        rec_id += 1
    
    # If no critical issues found
    if not recommendations:
        recommendations.append(Recommendation(
            id=str(rec_id),
            priority='low',
            type='info',
            title='Review Summary',
            description=f'Found {len(added)} additions, {len(removed)} removals, and {len(modified)} modifications. Review changes and update programs as needed.',
            affectedVariables=None
        ))
    
    return recommendations


# ============================================================================
# API ENDPOINTS
# ============================================================================

@router.post("/upload")
async def upload_specification(
    file: UploadFile = File(..., description="ADAM specification Excel file"),
):
    """
    Upload and parse an ADAM specification file.
    Returns metadata including sheet names and variable count.
    """
    logger.info(f"Uploading specification file: {file.filename}")
    
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Validate file extension
    if not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="File must be an Excel file (.xlsx or .xls)")
    
    temp_file_path = None
    try:
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix) as temp_file:
            content = await file.read()
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        # Parse the specification
        spec_meta = parse_spec_excel(Path(temp_file_path))
        
        return {
            "status": "success",
            "metadata": spec_meta.dict(),
        }
        
    except Exception as e:
        logger.error(f"Error uploading specification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup temp file
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


@router.post("/compare", response_model=ComparisonResult)
async def compare_specifications_endpoint(
    file_a: UploadFile = File(..., description="First specification file (Version A)"),
    file_b: UploadFile = File(..., description="Second specification file (Version B)"),
    sheet_a: Optional[str] = Form(None, description="Sheet name for file A"),
    sheet_b: Optional[str] = Form(None, description="Sheet name for file B"),
):
    """
    Compare two specification files and return detailed differences.
    """
    logger.info(f"Comparing specifications: {file_a.filename} vs {file_b.filename}")
    
    temp_file_a = None
    temp_file_b = None
    
    try:
        # Save files to temp
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file_a.filename).suffix) as tf:
            content_a = await file_a.read()
            tf.write(content_a)
            temp_file_a = tf.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=Path(file_b.filename).suffix) as tf:
            content_b = await file_b.read()
            tf.write(content_b)
            temp_file_b = tf.name
        
        # Parse both specifications
        spec_a = parse_spec_excel(Path(temp_file_a))
        spec_b = parse_spec_excel(Path(temp_file_b))
        
        # Compare
        result = compare_specifications(spec_a, spec_b)
        
        return result
        
    except Exception as e:
        logger.error(f"Error comparing specifications: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        # Cleanup
        for temp_file in [temp_file_a, temp_file_b]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception:
                    pass


@router.post("/ai-query", response_model=AIQueryResponse)
async def ai_query(request: AIQueryRequest):
    """
    Get AI-powered analysis and answers about specification comparison.
    Uses LLM to provide insights about changes, impacts, and recommendations.
    """
    logger.info(f"Processing AI query: {request.message[:100]}...")
    
    try:
        # Try to use OpenRouter or other configured LLM
        from app.modules.llm_service import get_llm_service
        
        llm_service = get_llm_service()
        
        system_prompt = """You are an expert clinical programming AI assistant specializing in ADAM/CDISC standards.
You help users understand specification differences, their impacts, and provide actionable recommendations.
Format your responses with markdown for clarity. Be concise but thorough.
Focus on:
1. Impact on analyses and TLF outputs
2. Regulatory implications
3. Code changes needed
4. Best practices for implementation"""

        user_prompt = f"""Context about the specification comparison:
{request.context or 'No comparison data available.'}

User question: {request.message}

Please provide a helpful, detailed response focused on clinical programming best practices."""

        response = await llm_service.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=1000,
        )
        
        return AIQueryResponse(
            response=response,
            suggestedQuestions=[
                "What are the critical changes?",
                "Show me code for implementing changes",
                "Which TLFs need updates?",
            ]
        )
        
    except ImportError:
        # Fallback if LLM service not available
        logger.warning("LLM service not available, using mock response")
        
        return AIQueryResponse(
            response=_generate_mock_ai_response(request.message, request.context),
            suggestedQuestions=[
                "What are the critical changes?",
                "Show implementation code",
                "Impact on regulatory submission",
            ]
        )
    
    except Exception as e:
        logger.error(f"Error in AI query: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI query failed: {str(e)}")


def _generate_mock_ai_response(message: str, context: Optional[str]) -> str:
    """Generate a mock AI response for demo purposes"""
    message_lower = message.lower()
    
    if 'critical' in message_lower or 'impact' in message_lower:
        return """Based on the comparison analysis, here are the critical changes that require immediate attention:

**High Priority Changes:**
1. Population flag modifications (SAFFL, ITTFL) - Review SAP
2. Derivation logic changes - Update all affected programs
3. New categorization requirements - Update TLF shells

**Recommended Actions:**
- Schedule review meeting with biostatistics
- Update validation programs
- Run impact analysis on existing outputs

Would you like specific details on any of these items?"""
    
    if 'code' in message_lower:
        return """Here are code snippets for implementing the key changes:

```sas
/* Example - Updated AGEGR1 derivation */
if AGE < 18 then AGEGR1 = '<18';
else if AGE >= 18 and AGE < 50 then AGEGR1 = '18-50';
else if AGE >= 50 and AGE < 65 then AGEGR1 = '50-65';
else AGEGR1 = '>65';
```

For complete implementation details, please review the updated specification document."""
    
    return """I can help you understand the specification changes. Based on the comparison:

- Review the modified variables for derivation changes
- Check all population flags for definition updates
- New variables may require additional programming

Let me know if you'd like more details on specific changes."""


@router.get("/sheets")
async def get_specification_sheets(path: str):
    """
    Get sheet names from a specification file by path
    """
    backend_dir = get_backend_dir()
    spec_path = Path(path)
    
    if not spec_path.is_absolute():
        spec_path = backend_dir / path
    
    if not spec_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    
    try:
        workbook = openpyxl.load_workbook(str(spec_path), read_only=True)
        sheets = workbook.sheetnames
        workbook.close()
        
        return {"sheets": sheets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
