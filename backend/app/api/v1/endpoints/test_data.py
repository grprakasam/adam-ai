"""
Test Data Generation API Endpoints

Provides endpoints for generating mock SDTM datasets for testing.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Any
import pandas as pd
import io
from datetime import datetime

from app.modules.test_data_generation import SDTMDataGenerator, SDTMGenerationRequest
from loguru import logger

router = APIRouter()


class BatchGenerateSDTMRequest(BaseModel):
    """Request model for batch SDTM generation"""
    domains: List[str] = Field(..., description="List of SDTM domain codes to generate")
    study_id: Optional[str] = Field(None, description="Study ID for saving datasets")
    num_subjects: int = Field(50, ge=1, le=1000, description="Number of subjects")
    # Use same parameters as single generation
    records_per_subject: Optional[int] = Field(None, ge=1, le=1000)
    missingness_pct: float = Field(10.0, ge=0.0, le=50.0)
    distribution_type: Literal['uniform', 'normal', 'realistic'] = Field('realistic')
    study_start_date: str = Field('2024-01-01')
    study_end_date: str = Field('2024-12-31')
    template_source: Literal['pharmaverse', 'cdisc', 'custom'] = Field('pharmaverse')
    serious_ae_pct: float = Field(5.0, ge=0.0, le=50.0)
    severe_ae_pct: float = Field(10.0, ge=0.0, le=50.0)
    related_ae_pct: float = Field(30.0, ge=0.0, le=100.0)
    lab_abnormality_pct: float = Field(15.0, ge=0.0, le=50.0)
    include_meddra: bool = Field(True)
    include_ct: bool = Field(True)
    num_treatment_arms: int = Field(2, ge=1, le=10)
    treatment_arms: List[str] = Field(default=['Placebo', 'Active'])
    randomization_ratio: str = Field('1:1')
    num_visits: int = Field(5, ge=1, le=20)
    visit_schedule_days: List[int] = Field(default=[1, 15, 30, 60, 90])
    visit_window_days: int = Field(3, ge=0, le=30)
    sex_distribution: Literal['balanced', 'male_biased', 'female_biased', 'custom'] = Field('balanced')
    age_min: int = Field(18, ge=0, le=100)
    age_max: int = Field(75, ge=0, le=100)
    age_distribution: Literal['normal', 'uniform', 'realistic'] = Field('realistic')
    study_phase: str = Field('Phase III')
    therapeutic_area: str = Field('Oncology')
    sdtm_version: str = Field('3.4')
    adam_ig_version: str = Field('1.3')
    protocol_deviations_pct: float = Field(5.0, ge=0.0, le=30.0)
    outlier_pct: float = Field(2.0, ge=0.0, le=10.0)


class BatchGenerateSDTMResponse(BaseModel):
    """Response model for batch SDTM generation"""
    status: Literal['success', 'partial', 'error']
    message: str
    generated: List[str] = Field(default_factory=list, description="Successfully generated domains")
    failed: List[Dict[str, Any]] = Field(default_factory=list, description="Failed domains with error messages")
    total_requested: int
    total_generated: int


class GenerateSDTMResponse(BaseModel):
    """Response model for SDTM generation"""
    status: Literal['success', 'error']
    message: str
    data: Optional[Dict[str, Any]] = None
    preview_data: Optional[List[Dict]] = None
    validation_results: Optional[Dict[str, Any]] = None


@router.post("/generate-sdtm", response_model=GenerateSDTMResponse)
async def generate_sdtm_data(
    request: SDTMGenerationRequest,
    study_id: Optional[str] = None
):
    """
    Generate mock SDTM dataset for testing ADAM programs.
    
    Supports domains: DM, AE, LB, VS, EX, DS
    Returns preview (first 10 rows) and validation results.
    If study_id is provided, saves to study-scoped directory.
    Full dataset can be downloaded separately.
    """
    try:
        logger.info(f"Generating SDTM data for domain: {request.domain}, subjects: {request.num_subjects}, study_id: {study_id}")
        
        # Generate data
        generator = SDTMDataGenerator(seed=42)  # Fixed seed for consistency
        df = generator.generate(request)
        
        if df is None or df.empty:
            raise ValueError(f"Failed to generate data for domain {request.domain}")
        
        # Validate data
        validation_results = generator.validate_data(df, request.domain.upper())
        
        # Save to study-scoped directory if study_id provided
        sdtm_dir = None
        if study_id:
            from pathlib import Path
            import json
            # Resolve path relative to backend directory for consistency
            backend_dir = Path(__file__).resolve().parents[4]  # Go up to backend/app/api/v1/endpoints -> backend
            sdtm_dir = (backend_dir / "Content" / "Generated" / "SDTM" / study_id).resolve()
            sdtm_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Saving SDTM data to: {sdtm_dir}")
            
            # Save CSV
            csv_file = sdtm_dir / f"{request.domain.upper()}.csv"
            df.to_csv(csv_file, index=False)
            logger.info(f"Saved SDTM dataset to {csv_file}")
            
            # Save metadata
            metadata = {
                "study_id": study_id,
                "domain": request.domain.upper(),
                "generated_at": datetime.now().isoformat(),
                "num_subjects": request.num_subjects,
                "num_rows": len(df),
                "num_columns": len(df.columns),
                "columns": list(df.columns),
                "generation_params": request.dict(),
            }
            metadata_file = sdtm_dir / "metadata.json"
            if metadata_file.exists():
                # Update existing metadata
                with open(metadata_file, 'r') as f:
                    existing = json.load(f)
                if not isinstance(existing, dict):
                    existing = {}
                existing[request.domain.upper()] = metadata
                with open(metadata_file, 'w') as f:
                    json.dump(existing, f, indent=2)
            else:
                # Create new metadata
                with open(metadata_file, 'w') as f:
                    json.dump({request.domain.upper(): metadata}, f, indent=2)
        
        # Get preview (first 10 rows)
        preview_df = df.head(10)
        preview_data = preview_df.to_dict('records')
        
        # Calculate statistics
        stats = {
            'total_rows': len(df),
            'total_columns': len(df.columns),
            'columns': list(df.columns),
            'domain': request.domain.upper(),
            'generated_at': datetime.now().isoformat(),
            'memory_size_kb': df.memory_usage(deep=True).sum() / 1024,
            'saved_to_study': study_id is not None,
            'file_path': str(sdtm_dir / f"{request.domain.upper()}.csv") if study_id else None,
        }
        
        logger.info(f"Successfully generated {len(df)} rows for domain {request.domain}")
        
        return GenerateSDTMResponse(
            status='success',
            message=f"Successfully generated {len(df)} rows for domain {request.domain.upper()}" + (f" (saved to study {study_id})" if study_id else ""),
            data=stats,
            preview_data=preview_data,
            validation_results=validation_results
        )
    
    except ValueError as e:
        logger.error(f"Validation error in SDTM generation: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error generating SDTM data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate SDTM data: {str(e)}")


@router.post("/download-sdtm")
async def download_sdtm_data(
    request: SDTMGenerationRequest,
    format: Literal['csv', 'sas7bdat', 'rds'] = 'csv'
):
    """
    Download generated SDTM dataset in specified format.
    
    Formats:
    - csv: Comma-separated values
    - sas7bdat: SAS dataset (requires pyreadstat)
    - rds: R data format (requires pyreadr)
    """
    try:
        logger.info(f"Downloading SDTM data: domain={request.domain}, format={format}")
        
        # Generate data
        generator = SDTMDataGenerator(seed=42)
        df = generator.generate(request)
        
        if df is None or df.empty:
            raise ValueError(f"Failed to generate data for domain {request.domain}")
        
        domain = request.domain.upper()
        filename = f"{domain}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Export based on format
        if format == 'csv':
            output = io.StringIO()
            df.to_csv(output, index=False)
            output.seek(0)
            
            return StreamingResponse(
                io.BytesIO(output.getvalue().encode()),
                media_type='text/csv',
                headers={
                    'Content-Disposition': f'attachment; filename="{filename}.csv"'
                }
            )
        
        elif format == 'sas7bdat':
            try:
                import pyreadstat
                output = io.BytesIO()
                pyreadstat.write_sas7bdat(df, output)
                output.seek(0)
                
                return StreamingResponse(
                    output,
                    media_type='application/octet-stream',
                    headers={
                        'Content-Disposition': f'attachment; filename="{filename}.sas7bdat"'
                    }
                )
            except ImportError:
                raise HTTPException(
                    status_code=501,
                    detail="SAS format export requires pyreadstat library. Please install it or use CSV format."
                )
        
        elif format == 'rds':
            try:
                import pyreadr
                output = io.BytesIO()
                pyreadr.write_rds(f"/tmp/{filename}.rds", df)
                
                with open(f"/tmp/{filename}.rds", 'rb') as f:
                    rds_data = f.read()
                
                return StreamingResponse(
                    io.BytesIO(rds_data),
                    media_type='application/octet-stream',
                    headers={
                        'Content-Disposition': f'attachment; filename="{filename}.rds"'
                    }
                )
            except ImportError:
                raise HTTPException(
                    status_code=501,
                    detail="RDS format export requires pyreadr library. Please install it or use CSV format."
                )
        
        else:
            raise ValueError(f"Unsupported format: {format}")
    
    except ValueError as e:
        logger.error(f"Validation error in SDTM download: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error downloading SDTM data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to download SDTM data: {str(e)}")


@router.post("/generate-sdtm-batch", response_model=BatchGenerateSDTMResponse)
async def generate_sdtm_batch(request: BatchGenerateSDTMRequest):
    """
    Generate multiple SDTM datasets in batch.
    
    This endpoint generates multiple SDTM domains at once, which is useful
    when generating all required datasets for ADAM generation.
    
    Args:
        request: Batch generation request with list of domains
        
    Returns:
        BatchGenerateSDTMResponse with success/failure status for each domain
    """
    try:
        logger.info(f"Batch generating SDTM data: domains={request.domains}, study_id={request.study_id}")
        
        generator = SDTMDataGenerator(seed=42)  # Fixed seed for consistency
        generated = []
        failed = []
        
        # Prepare base parameters (excluding domain-specific ones)
        base_params = {
            'num_subjects': request.num_subjects,
            'records_per_subject': request.records_per_subject,
            'missingness_pct': request.missingness_pct,
            'distribution_type': request.distribution_type,
            'study_start_date': request.study_start_date,
            'study_end_date': request.study_end_date,
            'template_source': request.template_source,
            'serious_ae_pct': request.serious_ae_pct,
            'severe_ae_pct': request.severe_ae_pct,
            'related_ae_pct': request.related_ae_pct,
            'lab_abnormality_pct': request.lab_abnormality_pct,
            'include_meddra': request.include_meddra,
            'include_ct': request.include_ct,
            'num_treatment_arms': request.num_treatment_arms,
            'treatment_arms': request.treatment_arms,
            'randomization_ratio': request.randomization_ratio,
            'num_visits': request.num_visits,
            'visit_schedule_days': request.visit_schedule_days,
            'visit_window_days': request.visit_window_days,
            'sex_distribution': request.sex_distribution,
            'age_min': request.age_min,
            'age_max': request.age_max,
            'age_distribution': request.age_distribution,
            'study_phase': request.study_phase,
            'therapeutic_area': request.therapeutic_area,
            'sdtm_version': request.sdtm_version,
            'adam_ig_version': request.adam_ig_version,
            'protocol_deviations_pct': request.protocol_deviations_pct,
            'outlier_pct': request.outlier_pct,
        }
        
        # Setup directory for saving if study_id provided
        sdtm_dir = None
        if request.study_id:
            from pathlib import Path
            backend_dir = Path(__file__).resolve().parents[4]
            sdtm_dir = (backend_dir / "Content" / "Generated" / "SDTM" / request.study_id).resolve()
            sdtm_dir.mkdir(parents=True, exist_ok=True)
            logger.info(f"Saving batch SDTM data to: {sdtm_dir}")
        
        # Generate each domain
        for domain in request.domains:
            try:
                logger.info(f"Generating domain: {domain}")
                
                # Create request for this domain
                domain_request = SDTMGenerationRequest(
                    domain=domain,
                    **base_params
                )
                
                # Generate data
                df = generator.generate(domain_request)
                
                if df is None or df.empty:
                    raise ValueError(f"Failed to generate data for domain {domain}")
                
                # Save to study-scoped directory if study_id provided
                if sdtm_dir:
                    csv_file = sdtm_dir / f"{domain.upper()}.csv"
                    df.to_csv(csv_file, index=False)
                    logger.info(f"Saved SDTM dataset: {csv_file}")
                
                generated.append(domain.upper())
                logger.info(f"Successfully generated {domain}")
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to generate {domain}: {error_msg}")
                failed.append({
                    'domain': domain.upper(),
                    'error': error_msg
                })
        
        # Determine overall status
        if len(failed) == 0:
            status = 'success'
            message = f"Successfully generated {len(generated)} dataset(s)"
        elif len(generated) > 0:
            status = 'partial'
            message = f"Generated {len(generated)} dataset(s), {len(failed)} failed"
        else:
            status = 'error'
            message = f"Failed to generate all {len(request.domains)} dataset(s)"
        
        return BatchGenerateSDTMResponse(
            status=status,
            message=message,
            generated=generated,
            failed=failed,
            total_requested=len(request.domains),
            total_generated=len(generated)
        )
        
    except Exception as e:
        logger.error(f"Batch SDTM generation error: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Batch SDTM generation failed: {str(e)}"
        )


@router.get("/domains")
async def get_supported_domains():
    """Get list of supported SDTM domains for test data generation"""
    return {
        'domains': [
            {
                'code': 'DM',
                'name': 'Demographics',
                'description': 'Subject-level demographic and study participation information',
                'variables_count': 15,
                'supports_multiple_records': False
            },
            {
                'code': 'AE',
                'name': 'Adverse Events',
                'description': 'Adverse events data with severity and relationship',
                'variables_count': 13,
                'supports_multiple_records': True
            },
            {
                'code': 'LB',
                'name': 'Laboratory',
                'description': 'Laboratory test results across visits',
                'variables_count': 12,
                'supports_multiple_records': True
            },
            {
                'code': 'VS',
                'name': 'Vital Signs',
                'description': 'Vital signs measurements across visits',
                'variables_count': 13,
                'supports_multiple_records': True
            },
            {
                'code': 'EX',
                'name': 'Exposure',
                'description': 'Treatment exposure data with dose and duration',
                'variables_count': 14,
                'supports_multiple_records': True,
                'is_critical_for_adam': True
            },
            {
                'code': 'DS',
                'name': 'Disposition',
                'description': 'Study completion status and dropout reasons',
                'variables_count': 10,
                'supports_multiple_records': True,
                'is_critical_for_adam': True
            },
        ]
    }
