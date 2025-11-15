"""
Traceability API Endpoints
"""

from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import Response
from typing import Dict
from loguru import logger
from pydantic import BaseModel

from app.modules.traceability.service import TraceabilityService
from app.modules.traceability.exporter import TraceabilityExporter
from app.modules.traceability.models import (
    TraceabilityGenerationRequest,
    TraceabilityMatrix
)

router = APIRouter()
traceability_service = TraceabilityService()
exporter = TraceabilityExporter()


class TraceabilityRequest(BaseModel):
    """Request model for traceability generation"""
    study_id: str
    dataset: str
    specification_path: str
    code_snippets: Dict[str, Dict] = {}
    include_ai_insights: bool = True
    force_refresh: bool = False


class ExportRequest(BaseModel):
    """Request model for export"""
    format: str = "excel"  # excel, pdf, word, json
    options: Dict = {}


@router.post("/generate", response_model=TraceabilityMatrix)
async def generate_traceability(request: TraceabilityRequest):
    """
    Generate traceability matrix for a dataset

    Returns complete traceability matrix with:
    - Variables with sources and derivation logic
    - Confidence scores
    - ADAM IG rule references
    - React Flow graph data
    - AI insights (optional)
    """
    try:
        logger.info(f"Generating traceability for {request.study_id} - {request.dataset}")

        matrix = await traceability_service.generate_traceability(
            study_id=request.study_id,
            dataset=request.dataset,
            spec_path=request.specification_path,
            code_snippets=request.code_snippets,
            include_ai_insights=request.include_ai_insights,
            force_refresh=request.force_refresh
        )

        return matrix

    except FileNotFoundError as e:
        logger.error(f"Specification file not found: {e}")
        raise HTTPException(status_code=404, detail=f"Specification file not found: {str(e)}")
    except ValueError as e:
        logger.error(f"Invalid specification format: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid specification: {str(e)}")
    except Exception as e:
        logger.error(f"Traceability generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Traceability generation failed: {str(e)}")


@router.post("/export/{study_id}/{dataset}")
async def export_traceability(
    study_id: str,
    dataset: str,
    export_request: ExportRequest
):
    """
    Export traceability matrix to various formats

    Supported formats:
    - excel: Multi-sheet workbook
    - pdf: Formatted PDF report
    - word: Word document
    - json: Machine-readable JSON
    """
    try:
        # Get cached matrix
        cache_key = f"traceability:{study_id}:{dataset}"
        cached = await traceability_service.cache.get(cache_key)

        if not cached:
            raise HTTPException(
                status_code=404,
                detail="Traceability matrix not found. Please generate it first."
            )

        matrix = TraceabilityMatrix(**cached)

        # Export based on format
        format_type = export_request.format.lower()

        if format_type == "excel":
            content = await exporter.export_to_excel(matrix, export_request.options)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{study_id}_{dataset}_traceability.xlsx"
        elif format_type == "pdf":
            content = await exporter.export_to_pdf(matrix, export_request.options)
            media_type = "application/pdf"
            filename = f"{study_id}_{dataset}_traceability.pdf"
        elif format_type == "word":
            content = await exporter.export_to_word(matrix)
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = f"{study_id}_{dataset}_traceability.docx"
        elif format_type == "json":
            content = await exporter.export_to_json(matrix)
            media_type = "application/json"
            filename = f"{study_id}_{dataset}_traceability.json"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format_type}")

        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/status/{study_id}/{dataset}")
async def get_traceability_status(study_id: str, dataset: str):
    """
    Check if traceability matrix exists for a study/dataset

    Returns:
    - exists: boolean
    - generated_at: timestamp (if exists)
    - summary: statistics (if exists)
    """
    try:
        cache_key = f"traceability:{study_id}:{dataset}"
        cached = await traceability_service.cache.get(cache_key)

        if cached:
            return {
                "exists": True,
                "generated_at": cached.get("generated_at"),
                "summary": {
                    "total_variables": cached.get("total_variables"),
                    "average_confidence": cached.get("average_confidence"),
                    "high_confidence_count": cached.get("high_confidence_count"),
                    "medium_confidence_count": cached.get("medium_confidence_count"),
                    "low_confidence_count": cached.get("low_confidence_count"),
                }
            }
        else:
            return {
                "exists": False
            }

    except Exception as e:
        logger.error(f"Status check failed: {e}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")


@router.delete("/{study_id}/{dataset}")
async def clear_traceability_cache(study_id: str, dataset: str):
    """Clear cached traceability matrix for a study/dataset"""
    try:
        cache_key = f"traceability:{study_id}:{dataset}"
        await traceability_service.cache.delete(cache_key)

        return {"message": f"Cache cleared for {study_id}/{dataset}"}

    except Exception as e:
        logger.error(f"Cache clear failed: {e}")
        raise HTTPException(status_code=500, detail=f"Cache clear failed: {str(e)}")
