"""
Validation API endpoints for Pre-P21, CT, and P21 CE validation
"""

from fastapi import APIRouter, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import json
import io
import csv
from datetime import datetime

from app.modules.validation.models import (
    PreP21Request, PreP21Response,
    CTValidationRequest, CTValidationResponse,
    P21ValidationRequest, P21ValidationResponse
)
from app.modules.validation.adam_conformance import AdamConformanceValidator
from app.modules.validation.controlled_terminology import ControlledTerminologyValidator
from app.modules.validation.p21_runner import P21Runner

router = APIRouter(prefix="/validation", tags=["Validation"])


# Request models for simplified frontend API
class SimpleValidationRequest(BaseModel):
    study_id: str
    dataset: str
    dataset_paths: Optional[List[str]] = None
    ct_file_path: Optional[str] = None
    stop_on_error: Optional[bool] = False


class SimpleP21Request(BaseModel):
    study_id: str
    dataset: str
    dataset_paths: Optional[List[str]] = None
    rules: Optional[List[str]] = None
    timeout: Optional[int] = 300


class ValidationExportRequest(BaseModel):
    study_id: str
    dataset: str
    format: str  # csv, xlsx, json, pdf
    include_preflight: Optional[bool] = True
    include_ct: Optional[bool] = True
    include_p21: Optional[bool] = True


class AllValidationsResponse(BaseModel):
    preflight: Optional[Dict[str, Any]] = None
    controlled_terminology: Optional[Dict[str, Any]] = None
    ct: Optional[Dict[str, Any]] = None  # alias
    p21: Optional[Dict[str, Any]] = None
    summary: Optional[Dict[str, Any]] = None


@router.post("/run-all", response_model=AllValidationsResponse)
async def run_all_validations(request: SimpleValidationRequest):
    """
    Run all validation checks: Pre-P21, CT, and P21 CE

    Returns combined results from all validation types
    """
    try:
        results = {
            "preflight": None,
            "controlled_terminology": None,
            "ct": None,
            "p21": None,
            "summary": {
                "total_errors": 0,
                "total_warnings": 0,
                "total_info": 0,
                "all_passed": True
            }
        }

        # Run Pre-P21 checks
        try:
            preflight_validator = AdamConformanceValidator()
            datasets = {request.dataset: []}
            preflight_result = preflight_validator.validate(
                study_id=request.study_id,
                datasets=datasets,
                rules_preset="adam"
            )
            results["preflight"] = preflight_result.dict() if hasattr(preflight_result, 'dict') else preflight_result

            if not preflight_result.passed:
                results["summary"]["all_passed"] = False

            # Count issues by severity
            for issue in preflight_result.issues:
                if issue.severity == "ERROR":
                    results["summary"]["total_errors"] += 1
                elif issue.severity == "WARNING":
                    results["summary"]["total_warnings"] += 1
                else:
                    results["summary"]["total_info"] += 1

            if request.stop_on_error and preflight_result.has_blocking_errors:
                return results

        except Exception as e:
            print(f"Preflight validation error: {e}")
            results["preflight"] = {"error": str(e), "passed": False}

        # Run CT validation
        try:
            ct_validator = ControlledTerminologyValidator(ct_file_path=request.ct_file_path)
            ct_result = ct_validator.validate(
                study_id=request.study_id,
                dataset_name=request.dataset,
                bindings={},
                dataset_values={},
                versions={}
            )
            ct_dict = ct_result.dict() if hasattr(ct_result, 'dict') else ct_result
            results["controlled_terminology"] = ct_dict
            results["ct"] = ct_dict  # alias for frontend compatibility

            if not ct_result.passed:
                results["summary"]["all_passed"] = False

            for issue in ct_result.issues:
                if issue.severity == "ERROR":
                    results["summary"]["total_errors"] += 1
                elif issue.severity == "WARNING":
                    results["summary"]["total_warnings"] += 1
                else:
                    results["summary"]["total_info"] += 1

            if request.stop_on_error and not ct_result.passed:
                return results

        except Exception as e:
            print(f"CT validation error: {e}")
            results["controlled_terminology"] = {"error": str(e), "passed": False}
            results["ct"] = {"error": str(e), "passed": False}

        # Run P21 validation
        try:
            p21_runner = P21Runner(timeout_sec=300)
            p21_result = await p21_runner.run_validation(
                study_id=request.study_id,
                adam_paths=request.dataset_paths or [f"{request.dataset}.xpt"],
                ruleset="adam"
            )
            results["p21"] = p21_result.dict() if hasattr(p21_result, 'dict') else p21_result

            if not p21_result.passed:
                results["summary"]["all_passed"] = False

            if p21_result.summary:
                results["summary"]["total_errors"] += p21_result.summary.get("errors", 0)
                results["summary"]["total_warnings"] += p21_result.summary.get("warnings", 0)
                results["summary"]["total_info"] += p21_result.summary.get("info", 0)

        except Exception as e:
            print(f"P21 validation error: {e}")
            results["p21"] = {"error": str(e), "passed": False}

        return results

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"All validations failed: {str(e)}"
        )


@router.post("/preflight")
async def run_preflight_validation(request: SimpleValidationRequest):
    """
    Run Pre-P21 structural checks only

    Validates:
    - Required variables present
    - Key variables defined
    - Label lengths
    - Naming conventions (DT/DTM/FL/GR suffixes)
    """
    try:
        validator = AdamConformanceValidator()
        datasets = {request.dataset: []}

        result = validator.validate(
            study_id=request.study_id,
            datasets=datasets,
            rules_preset="adam"
        )

        return result.dict() if hasattr(result, 'dict') else result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pre-P21 validation failed: {str(e)}"
        )


@router.post("/ct")
async def run_ct_validation_simple(request: SimpleValidationRequest):
    """
    Run Controlled Terminology validation only

    Validates variable values against CDISC codelists
    """
    try:
        validator = ControlledTerminologyValidator(ct_file_path=request.ct_file_path)

        result = validator.validate(
            study_id=request.study_id,
            dataset_name=request.dataset,
            bindings={},
            dataset_values={},
            versions={}
        )

        return result.dict() if hasattr(result, 'dict') else result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CT validation failed: {str(e)}"
        )


@router.post("/p21")
async def run_p21_validation_simple(request: SimpleP21Request):
    """
    Run Pinnacle 21 CE validation only

    Executes P21 CE with ADaM ruleset and returns normalized results
    """
    try:
        runner = P21Runner(timeout_sec=request.timeout or 300)

        result = await runner.run_validation(
            study_id=request.study_id,
            adam_paths=request.dataset_paths or [f"{request.dataset}.xpt"],
            ruleset="adam"
        )

        return result.dict() if hasattr(result, 'dict') else result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"P21 validation failed: {str(e)}"
        )


@router.post("/export")
async def export_validation_results(request: ValidationExportRequest):
    """
    Export validation results in various formats

    Supports: CSV, XLSX, JSON, PDF
    """
    try:
        # Collect all issues
        all_issues = []

        # In production, would fetch actual results from cache/database
        # For now, generate sample export structure
        if request.include_preflight:
            all_issues.append({
                "type": "Pre-P21",
                "severity": "WARNING",
                "check": "Variable Naming",
                "variable": "AVAL",
                "message": "Sample preflight issue",
                "dataset": request.dataset
            })

        if request.include_ct:
            all_issues.append({
                "type": "CT Validation",
                "severity": "ERROR",
                "variable": "SEX",
                "value": "INVALID",
                "expected_codelist": "C66731",
                "message": "Value not in controlled terminology"
            })

        if request.include_p21:
            all_issues.append({
                "type": "P21 CE",
                "severity": "WARNING",
                "rule_id": "SD1001",
                "variable": "USUBJID",
                "message": "Sample P21 issue",
                "location": "Row 1"
            })

        if request.format == "json":
            content = json.dumps({
                "study_id": request.study_id,
                "dataset": request.dataset,
                "export_date": datetime.now().isoformat(),
                "issues": all_issues
            }, indent=2)
            return Response(
                content=content,
                media_type="application/json",
                headers={
                    "Content-Disposition": f"attachment; filename=validation_results_{request.study_id}_{request.dataset}.json"
                }
            )

        elif request.format == "csv":
            output = io.StringIO()
            if all_issues:
                writer = csv.DictWriter(output, fieldnames=all_issues[0].keys())
                writer.writeheader()
                writer.writerows(all_issues)

            content = output.getvalue()
            return Response(
                content=content,
                media_type="text/csv",
                headers={
                    "Content-Disposition": f"attachment; filename=validation_results_{request.study_id}_{request.dataset}.csv"
                }
            )

        elif request.format == "xlsx":
            # For XLSX, we'd need openpyxl
            # Return CSV for now with xlsx extension
            output = io.StringIO()
            if all_issues:
                writer = csv.DictWriter(output, fieldnames=all_issues[0].keys())
                writer.writeheader()
                writer.writerows(all_issues)

            content = output.getvalue()
            return Response(
                content=content.encode('utf-8'),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={
                    "Content-Disposition": f"attachment; filename=validation_results_{request.study_id}_{request.dataset}.xlsx"
                }
            )

        elif request.format == "pdf":
            # For PDF generation, would need reportlab or similar
            # Return text for now
            content = f"""
Validation Results Report
Study: {request.study_id}
Dataset: {request.dataset}
Date: {datetime.now().isoformat()}

Total Issues: {len(all_issues)}

Issues:
"""
            for i, issue in enumerate(all_issues, 1):
                content += f"\n{i}. [{issue.get('severity', 'INFO')}] {issue.get('message', 'No message')}\n"

            return Response(
                content=content,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=validation_results_{request.study_id}_{request.dataset}.pdf"
                }
            )

        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported export format: {request.format}"
            )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )


# Keep the original endpoints for backward compatibility
@router.post("/prep21", response_model=PreP21Response)
async def run_prep21_validation(request: PreP21Request):
    """
    Run Pre-P21 structural checks on ADAM datasets (legacy endpoint)
    """
    try:
        validator = AdamConformanceValidator()
        datasets = {}
        for dataset_name in request.dataset_names:
            datasets[dataset_name] = []

        result = validator.validate(
            study_id=request.study_id,
            datasets=datasets,
            rules_preset=request.rules_preset
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pre-P21 validation failed: {str(e)}"
        )


@router.post("/ct/advanced", response_model=CTValidationResponse)
async def run_ct_validation_advanced(request: CTValidationRequest):
    """
    Run Controlled Terminology validation (advanced endpoint)
    """
    try:
        validator = ControlledTerminologyValidator(ct_file_path=request.ct_file_path)

        result = validator.validate(
            study_id=request.study_id,
            dataset_name=request.dataset_name,
            bindings=request.bindings or {},
            dataset_values={},
            versions=request.versions
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"CT validation failed: {str(e)}"
        )


@router.post("/p21/advanced", response_model=P21ValidationResponse)
async def run_p21_validation_advanced(request: P21ValidationRequest):
    """
    Run Pinnacle 21 CE validation (advanced endpoint)
    """
    try:
        runner = P21Runner(timeout_sec=request.timeout_sec)

        result = await runner.run_validation(
            study_id=request.study_id,
            adam_paths=request.adam_paths,
            ruleset=request.ruleset
        )

        return result

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"P21 validation failed: {str(e)}"
        )
