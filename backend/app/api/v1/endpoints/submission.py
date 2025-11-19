"""
Submission API endpoints for Define.xml, ADRG, SDRG, and eCTD packaging
"""

from fastapi import APIRouter, HTTPException, status

from app.modules.submission.models import (
    DefineXMLRequest, DefineXMLResponse,
    DocumentRequest, DocumentResponse,
    ECTDPackageRequest, ECTDPackageResponse
)
from app.modules.submission.define_xml_generator import DefineXMLGenerator
from app.modules.submission.adrg_generator import ADRGGenerator
from app.modules.submission.sdrg_generator import SDRGGenerator
from app.modules.submission.ectd_packager import ECTDPackager

router = APIRouter(prefix="/submission", tags=["Submission"])


@router.post("/definexml", response_model=DefineXMLResponse)
async def generate_define_xml(request: DefineXMLRequest):
    """
    Generate Define-XML 2.1 for ADAM datasets
    
    Creates CDISC-compliant Define.xml with sponsor placeholders
    """
    try:
        generator = DefineXMLGenerator()
        
        result = generator.generate(
            study_info=request.study_info,
            datasets=request.datasets,
            stylesheet_link=request.stylesheet_link
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Define.xml generation failed: {str(e)}"
        )


@router.post("/adrg", response_model=DocumentResponse)
async def generate_adrg(request: DocumentRequest):
    """
    Generate ADRG (Analysis Data Reviewer's Guide)
    
    Creates DOCX document with study metadata and dataset overview
    """
    try:
        generator = ADRGGenerator()
        
        result = generator.generate(
            study_info=request.study_info,
            datasets=request.datasets,
            notes=request.notes
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ADRG generation failed: {str(e)}"
        )


@router.post("/sdrg", response_model=DocumentResponse)
async def generate_sdrg(request: DocumentRequest):
    """
    Generate SDRG (Study Data Reviewer's Guide)
    
    Creates DOCX document with submission overview
    """
    try:
        generator = SDRGGenerator()
        
        result = generator.generate(
            study_info=request.study_info,
            datasets=request.datasets,
            notes=request.notes
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SDRG generation failed: {str(e)}"
        )


@router.post("/ectd/package", response_model=ECTDPackageResponse)
async def package_ectd(request: ECTDPackageRequest):
    """
    Create eCTD package with FDA M5 structure
    
    Packages Define.xml, ADRG, SDRG, and programs into eCTD format
    Optionally creates ZIP archive
    """
    try:
        packager = ECTDPackager()
        
        result = packager.package(
            study_id=request.study_id,
            include_define_xml=request.include_define_xml,
            include_adrg=request.include_adrg,
            include_sdrg=request.include_sdrg,
            include_programs=request.include_programs,
            create_zip=request.create_zip,
            target_dir=request.target_dir
        )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"eCTD packaging failed: {str(e)}"
        )
