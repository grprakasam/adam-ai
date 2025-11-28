"""
Test Data Generation API Endpoints

Provides endpoints for generating mock SDTM datasets for testing.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Literal, Optional, List, Dict, Any
import pandas as pd
import io
from datetime import datetime
from pathlib import Path
import zipfile
import json

from app.modules.test_data_generation import SDTMDataGenerator, SDTMGenerationRequest
from app.middleware.resource_monitor import ResourceMonitor, get_system_metrics
from app.schemas.sdtm_security import (
    validate_study_id,
    sanitize_filename,
    SecureDomainCode,
    SecureDateRange,
    SecureParameterValidator
)
from app.utils.file_lock import file_lock, FileLockError
from loguru import logger
import hashlib
import time

router = APIRouter()


def generate_request_seed(study_id: str, domain: str, num_subjects: int) -> int:
    """
    Generate a unique seed for each request to prevent duplicate data in concurrent generation.

    Args:
        study_id: Study identifier
        domain: SDTM domain code
        num_subjects: Number of subjects

    Returns:
        Unique integer seed based on request parameters and timestamp
    """
    # Combine request parameters with timestamp to ensure uniqueness
    seed_str = f"{study_id}_{domain}_{num_subjects}_{time.time()}"
    hash_obj = hashlib.sha256(seed_str.encode())
    # Convert first 8 bytes of hash to integer
    seed = int.from_bytes(hash_obj.digest()[:8], byteorder='big') % (2**31)
    return seed


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

        # Security validation: Validate study_id if provided
        if study_id:
            study_id = validate_study_id(study_id)

        # Security validation: Validate domain code
        domain_validator = SecureDomainCode(domain=request.domain)
        validated_domain = domain_validator.domain

        # Security validation: Validate date range
        date_validator = SecureDateRange(
            start_date=request.study_start_date,
            end_date=request.study_end_date
        )

        # Resource validation: Check memory and request size limits
        validation_result = ResourceMonitor.validate_generation_request(
            domain=validated_domain,
            num_subjects=request.num_subjects,
            records_per_subject=getattr(request, 'records_per_subject', None),
            num_visits=getattr(request, 'num_visits', 6)
        )
        logger.info(f"Resource validation passed: {validation_result}")

        # Generate request-scoped seed to prevent duplicates in concurrent generation
        request_seed = generate_request_seed(
            study_id or "TEMP",
            validated_domain,
            request.num_subjects
        )
        logger.info(f"Using request-scoped seed: {request_seed}")

        # Generate data with unique seed
        generator = SDTMDataGenerator(seed=request_seed)
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

            # Save CSV with sanitized filename
            safe_filename = sanitize_filename(f"{validated_domain}.csv")
            csv_file = sdtm_dir / safe_filename
            df.to_csv(csv_file, index=False)
            logger.info(f"Saved SDTM dataset to {csv_file}")
            
            # Save metadata with file locking to prevent race conditions
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

            # Use file locking to prevent concurrent write corruption
            try:
                with file_lock(metadata_file, timeout=30):
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
                    logger.info(f"Metadata saved with file lock: {metadata_file}")
            except FileLockError as e:
                logger.error(f"Failed to acquire file lock for metadata: {e}")
                # Continue without metadata update (non-critical failure)
        
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
    format: Literal['csv', 'sas7bdat', 'rds', 'xlsx', 'xpt'] = 'csv'
):
    """
    Download generated SDTM dataset in specified format.
    
    Formats:
    - csv: Comma-separated values
    - xlsx: Excel workbook (requires openpyxl)
    - sas7bdat: SAS dataset (requires pyreadstat)
    - xpt: SAS transport format (requires pyreadstat)
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
        
        elif format == 'xlsx':
            try:
                from openpyxl import Workbook
                from openpyxl.utils.dataframe import dataframe_to_rows
                import tempfile
                import os
                
                # Create workbook
                wb = Workbook()
                ws = wb.active
                ws.title = domain
                
                # Write data
                for r in dataframe_to_rows(df, index=False, header=True):
                    ws.append(r)
                
                # Auto-adjust column widths
                for column in ws.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)
                    ws.column_dimensions[column_letter].width = adjusted_width
                
                # Save to temporary file
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
                wb.save(temp_file.name)
                temp_file.close()
                
                # Read file and return
                with open(temp_file.name, 'rb') as f:
                    excel_data = f.read()
                
                # Clean up
                os.unlink(temp_file.name)
                
                return StreamingResponse(
                    io.BytesIO(excel_data),
                    media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    headers={
                        'Content-Disposition': f'attachment; filename="{filename}.xlsx"'
                    }
                )
            except ImportError:
                raise HTTPException(
                    status_code=501,
                    detail="Excel format export requires openpyxl library. Please install it or use CSV format."
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
        
        elif format == 'xpt':
            try:
                import pyreadstat
                import tempfile
                import os
                
                # XPT files need to be written to disk first
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xpt')
                temp_file.close()
                
                # Write XPT file
                pyreadstat.write_xport(df, temp_file.name)
                
                # Read file and return
                with open(temp_file.name, 'rb') as f:
                    xpt_data = f.read()
                
                # Clean up
                os.unlink(temp_file.name)
                
                return StreamingResponse(
                    io.BytesIO(xpt_data),
                    media_type='application/octet-stream',
                    headers={
                        'Content-Disposition': f'attachment; filename="{filename}.xpt"'
                    }
                )
            except ImportError:
                raise HTTPException(
                    status_code=501,
                    detail="XPT format export requires pyreadstat library. Please install it or use CSV format."
                )
        
        elif format == 'rds':
            try:
                import pyreadr
                import tempfile
                import os
                
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.rds')
                temp_file.close()
                
                pyreadr.write_rds(temp_file.name, df)
                
                with open(temp_file.name, 'rb') as f:
                    rds_data = f.read()
                
                os.unlink(temp_file.name)
                
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


@router.get("/list-sdtm-datasets")
async def list_sdtm_datasets(
    study_id: Optional[str] = Query(None, description="Study ID to list datasets for")
):
    """
    List all available SDTM datasets for a study.
    
    Returns list of available domains and their metadata.
    """
    try:
        if not study_id:
            return {
                "study_id": None,
                "datasets": [],
                "message": "No study_id provided. Datasets are only saved when study_id is provided during generation."
            }
        
        backend_dir = Path(__file__).resolve().parents[4]
        sdtm_dir = (backend_dir / "Content" / "Generated" / "SDTM" / study_id).resolve()
        
        if not sdtm_dir.exists():
            return {
                "study_id": study_id,
                "datasets": [],
                "message": f"No datasets found for study {study_id}"
            }
        
        datasets = []
        metadata_file = sdtm_dir / "metadata.json"
        
        # Read metadata if available
        metadata = {}
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
        
        # Find all CSV files (primary format)
        for csv_file in sdtm_dir.glob("*.csv"):
            domain = csv_file.stem.upper()
            file_size = csv_file.stat().st_size
            
            domain_metadata = metadata.get(domain, {})
            
            datasets.append({
                "domain": domain,
                "filename": csv_file.name,
                "file_path": str(csv_file),
                "file_size": file_size,
                "generated_at": domain_metadata.get("generated_at"),
                "num_rows": domain_metadata.get("num_rows"),
                "num_columns": domain_metadata.get("num_columns"),
                "num_subjects": domain_metadata.get("num_subjects"),
            })
        
        return {
            "study_id": study_id,
            "datasets": datasets,
            "total": len(datasets),
            "message": f"Found {len(datasets)} dataset(s) for study {study_id}"
        }
    
    except Exception as e:
        logger.error(f"Error listing SDTM datasets: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to list SDTM datasets: {str(e)}")


@router.get("/download-all-sdtm")
async def download_all_sdtm_datasets(
    study_id: str = Query(..., description="Study ID to download datasets for"),
    format: Literal['zip', 'csv', 'xlsx', 'xpt', 'sas7bdat'] = Query('zip', description="Format for download. 'zip' downloads all formats in a ZIP file")
):
    """
    Download all SDTM datasets for a study as a ZIP file.
    
    The ZIP file contains all available datasets in CSV format by default.
    If format is specified, all datasets are converted to that format.
    """
    try:
        backend_dir = Path(__file__).resolve().parents[4]
        sdtm_dir = (backend_dir / "Content" / "Generated" / "SDTM" / study_id).resolve()
        
        if not sdtm_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"No datasets found for study {study_id}"
            )
        
        # Create ZIP file in memory
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Find all CSV files
            csv_files = list(sdtm_dir.glob("*.csv"))
            
            if not csv_files:
                raise HTTPException(
                    status_code=404,
                    detail=f"No CSV datasets found for study {study_id}"
                )
            
            generator = SDTMDataGenerator(seed=42)
            
            for csv_file in csv_files:
                domain = csv_file.stem.upper()
                
                # Read the CSV file
                df = pd.read_csv(csv_file)
                
                if format == 'zip' or format == 'csv':
                    # Add CSV to ZIP
                    csv_data = df.to_csv(index=False)
                    zip_file.writestr(f"{domain}.csv", csv_data)
                
                if format == 'zip' or format == 'xlsx':
                    # Add Excel file
                    try:
                        from openpyxl import Workbook
                        from openpyxl.utils.dataframe import dataframe_to_rows
                        import tempfile
                        import os
                        
                        wb = Workbook()
                        ws = wb.active
                        ws.title = domain
                        
                        for r in dataframe_to_rows(df, index=False, header=True):
                            ws.append(r)
                        
                        # Auto-adjust column widths
                        for column in ws.columns:
                            max_length = 0
                            column_letter = column[0].column_letter
                            for cell in column:
                                try:
                                    if len(str(cell.value)) > max_length:
                                        max_length = len(str(cell.value))
                                except:
                                    pass
                            adjusted_width = min(max_length + 2, 50)
                            ws.column_dimensions[column_letter].width = adjusted_width
                        
                        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
                        wb.save(temp_file.name)
                        temp_file.close()
                        
                        with open(temp_file.name, 'rb') as f:
                            excel_data = f.read()
                        
                        os.unlink(temp_file.name)
                        zip_file.writestr(f"{domain}.xlsx", excel_data)
                    except ImportError:
                        logger.warning("openpyxl not available, skipping Excel format")
                
                if format == 'zip' or format == 'xpt':
                    # Add XPT file
                    try:
                        import pyreadstat
                        import tempfile
                        import os
                        
                        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.xpt')
                        temp_file.close()
                        
                        pyreadstat.write_xport(df, temp_file.name)
                        
                        with open(temp_file.name, 'rb') as f:
                            xpt_data = f.read()
                        
                        os.unlink(temp_file.name)
                        zip_file.writestr(f"{domain}.xpt", xpt_data)
                    except ImportError:
                        logger.warning("pyreadstat not available, skipping XPT format")
                
                if format == 'zip' or format == 'sas7bdat':
                    # Add SAS7BDAT file
                    try:
                        import pyreadstat
                        import tempfile
                        import os
                        
                        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.sas7bdat')
                        temp_file.close()
                        
                        pyreadstat.write_sas7bdat(df, temp_file.name)
                        
                        with open(temp_file.name, 'rb') as f:
                            sas_data = f.read()
                        
                        os.unlink(temp_file.name)
                        zip_file.writestr(f"{domain}.sas7bdat", sas_data)
                    except ImportError:
                        logger.warning("pyreadstat not available, skipping SAS format")
            
            # Add metadata file if it exists
            metadata_file = sdtm_dir / "metadata.json"
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata_content = f.read()
                zip_file.writestr("metadata.json", metadata_content)
        
        zip_buffer.seek(0)
        filename = f"SDTM_Datasets_{study_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
        
        return StreamingResponse(
            io.BytesIO(zip_buffer.read()),
            media_type='application/zip',
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading all SDTM datasets: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to download all SDTM datasets: {str(e)}")


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

        # Security validation: Validate study_id if provided
        if request.study_id:
            request.study_id = validate_study_id(request.study_id)

        # Security validation: Validate all domain codes
        validated_domains = []
        for domain in request.domains:
            domain_validator = SecureDomainCode(domain=domain)
            validated_domains.append(domain_validator.domain)

        # Security validation: Validate date range
        date_validator = SecureDateRange(
            start_date=request.study_start_date,
            end_date=request.study_end_date
        )

        # Security validation: Validate treatment arms
        validated_arms = SecureParameterValidator.validate_treatment_arms(request.treatment_arms)
        request.treatment_arms = validated_arms

        # Security validation: Validate visit schedule
        validated_visits = SecureParameterValidator.validate_visit_schedule(request.visit_schedule_days)
        request.visit_schedule_days = validated_visits

        # Resource validation: Check batch memory and request size limits
        batch_validation = ResourceMonitor.validate_batch_request(
            domains=validated_domains,
            num_subjects=request.num_subjects,
            records_per_subject=request.records_per_subject,
            num_visits=request.num_visits
        )
        logger.info(f"Batch resource validation passed: {batch_validation}")

        # Generate base seed for batch request
        batch_seed = generate_request_seed(
            request.study_id or "TEMP_BATCH",
            "_".join(validated_domains),
            request.num_subjects
        )
        logger.info(f"Using batch base seed: {batch_seed}")

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
        
        # Generate each domain with unique seeds
        for idx, domain in enumerate(request.domains):
            try:
                logger.info(f"Generating domain: {domain}")

                # Create unique seed for this domain (batch_seed + domain index)
                domain_seed = batch_seed + idx
                generator = SDTMDataGenerator(seed=domain_seed)
                logger.info(f"Using domain-specific seed for {domain}: {domain_seed}")

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
                    safe_filename = sanitize_filename(f"{domain.upper()}.csv")
                    csv_file = sdtm_dir / safe_filename
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
