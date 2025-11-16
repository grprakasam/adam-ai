"""
Submission Readiness API Endpoints

Endpoints for FDA submission validation and package generation.
"""

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from loguru import logger

from app.modules.submission.service import SubmissionOrchestrationService
from app.modules.submission.models import (
    ValidationRequest,
    ValidationSummary,
    PackageRequest,
    PackageManifest,
    SubmissionReadinessScore,
)

router = APIRouter(prefix="/api/v1/submission", tags=["submission"])

# Initialize service
submission_service = SubmissionOrchestrationService()


@router.post("/validate", response_model=ValidationSummary)
async def run_validation(request: ValidationRequest):
    """
    Run validation checks (preflight, CT, P21).
    
    Example request:
    ```json
    {
        "study_id": "STUDY001",
        "dataset": "ADSL",
        "checks": ["preflight", "ct", "p21"],
        "options": {
            "ct_file_path": "Content/ControlledTerminology/CT.xlsx",
            "p21_timeout_seconds": 300,
            "stop_on_error": true
        }
    }
    ```
    """
    try:
        logger.info(f"Validation request: {request.study_id}/{request.dataset}")
        
        summary = await submission_service.run_all_validations(
            study_id=request.study_id,
            dataset=request.dataset,
            options=request.options
        )
        
        return summary
        
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/package", response_model=PackageManifest)
async def generate_package(request: PackageRequest):
    """
    Generate FDA submission package (Define.xml, ADRG, SDRG, eCTD).
    
    Example request:
    ```json
    {
        "study_id": "STUDY001",
        "datasets": ["ADSL", "ADAE"],
        "include": {
            "define_xml": true,
            "adrg": true,
            "sdrg": true,
            "programs": false
        },
        "options": {
            "create_zip": true,
            "include_checksums": true,
            "template": "fda_standard"
        }
    }
    ```
    """
    try:
        logger.info(f"Package generation request: {request.study_id}")
        
        manifest = await submission_service.generate_package(
            study_id=request.study_id,
            datasets=request.datasets,
            include_define=request.include.get("define_xml", True),
            include_adrg=request.include.get("adrg", True),
            include_sdrg=request.include.get("sdrg", True),
            create_zip=request.options.get("create_zip", True) if request.options else True
        )
        
        return manifest
        
    except Exception as e:
        logger.error(f"Package generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/readiness/{study_id}/{dataset}", response_model=SubmissionReadinessScore)
async def get_readiness_score(study_id: str, dataset: str):
    """
    Get submission readiness score for a study/dataset.
    
    Returns composite score (0-100) with component breakdown.
    """
    try:
        logger.info(f"Readiness score request: {study_id}/{dataset}")
        
        score = await submission_service.calculate_readiness_score(
            study_id=study_id,
            dataset=dataset
        )
        
        return score
        
    except Exception as e:
        logger.error(f"Readiness score error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/preflight/{study_id}/{dataset}")
async def run_preflight(study_id: str, dataset: str):
    """Run quick pre-flight structural checks"""
    try:
        result = await submission_service.run_preflight_check(
            study_id=study_id,
            dataset=dataset
        )
        return result
    except Exception as e:
        logger.error(f"Preflight error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ct-validation/{study_id}/{dataset}")
async def run_ct_validation(
    study_id: str,
    dataset: str,
    ct_file_path: Optional[str] = None
):
    """Run Controlled Terminology validation"""
    try:
        result = await submission_service.run_ct_validation(
            study_id=study_id,
            dataset=dataset,
            ct_file_path=ct_file_path
        )
        return result
    except Exception as e:
        logger.error(f"CT validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/p21-validation/{study_id}/{dataset}")
async def run_p21_validation(
    study_id: str,
    dataset: str,
    timeout_seconds: int = 300
):
    """Run Pinnacle 21 Community Edition validation"""
    try:
        result = await submission_service.run_p21_validation(
            study_id=study_id,
            dataset=dataset,
            timeout_seconds=timeout_seconds
        )
        return result
    except Exception as e:
        logger.error(f"P21 validation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/define-xml/{study_id}")
async def generate_define_xml(
    study_id: str,
    datasets: List[str],
    options: Optional[dict] = None
):
    """Generate Define.xml 2.1 file"""
    try:
        result = await submission_service.generate_define_xml(
            study_id=study_id,
            datasets=datasets,
            options=options
        )
        return {"status": "success", "file_path": result}
    except Exception as e:
        logger.error(f"Define.xml generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate/adrg/{study_id}")
async def generate_adrg(
    study_id: str,
    datasets: List[str],
    template: str = "fda_standard"
):
    """Generate ADRG (Analysis Data Reviewer's Guide)"""
    try:
        result = await submission_service.generate_adrg(
            study_id=study_id,
            datasets=datasets,
            template=template
        )
        return {"status": "success", "file_path": result}
    except Exception as e:
        logger.error(f"ADRG generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
