"""
Test Data Generation API Endpoints

Provides endpoints for generating mock SDTM datasets for testing.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Literal, Optional, List, Dict, Any
import pandas as pd
import io
from datetime import datetime

from app.modules.test_data_generation import SDTMDataGenerator, SDTMGenerationRequest
from loguru import logger

router = APIRouter()


class GenerateSDTMResponse(BaseModel):
    """Response model for SDTM generation"""
    status: Literal['success', 'error']
    message: str
    data: Optional[Dict[str, Any]] = None
    preview_data: Optional[List[Dict]] = None
    validation_results: Optional[Dict[str, Any]] = None


@router.post("/generate-sdtm", response_model=GenerateSDTMResponse)
async def generate_sdtm_data(request: SDTMGenerationRequest):
    """
    Generate mock SDTM dataset for testing ADAM programs.
    
    Supports domains: DM, AE, LB, VS
    Returns preview (first 10 rows) and validation results.
    Full dataset can be downloaded separately.
    """
    try:
        logger.info(f"Generating SDTM data for domain: {request.domain}, subjects: {request.num_subjects}")
        
        # Generate data
        generator = SDTMDataGenerator(seed=42)  # Fixed seed for consistency
        df = generator.generate(request)
        
        if df is None or df.empty:
            raise ValueError(f"Failed to generate data for domain {request.domain}")
        
        # Validate data
        validation_results = generator.validate_data(df, request.domain.upper())
        
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
        }
        
        logger.info(f"Successfully generated {len(df)} rows for domain {request.domain}")
        
        return GenerateSDTMResponse(
            status='success',
            message=f"Successfully generated {len(df)} rows for domain {request.domain.upper()}",
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
        ]
    }
