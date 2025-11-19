"""
Test Data Generator Service

Generates synthetic SDTM test datasets with:
- Happy path cases (standard, valid data)
- Edge cases (boundaries, nulls, extremes)
- Negative cases (invalid data for error handling)
"""

import logging
import pandas as pd
import numpy as np
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import uuid
import json

from ..models import (
    TestDataGenerationRequest,
    TestDataGenerationResponse,
)

logger = logging.getLogger(__name__)


class TestDataGeneratorService:
    """
    Service for generating synthetic SDTM test datasets
    """

    def __init__(self):
        self.test_data_dir = Path("backend/test_data")
        self.test_data_dir.mkdir(parents=True, exist_ok=True)

    async def generate_test_data(
        self,
        request: TestDataGenerationRequest
    ) -> TestDataGenerationResponse:
        """
        Generate synthetic SDTM test dataset

        Args:
            request: Test data generation configuration

        Returns:
            TestDataGenerationResponse with file paths and metadata
        """
        test_data_id = f"test_{request.dataset_type.lower()}_{uuid.uuid4().hex[:8]}"
        logger.info(f"Generating test data: {test_data_id}")

        # Set random seed for reproducibility
        if request.seed:
            np.random.seed(request.seed)

        # Generate dataset based on type
        if request.dataset_type.upper() == 'DM':
            df = self._generate_dm_dataset(request)
        elif request.dataset_type.upper() == 'AE':
            df = self._generate_ae_dataset(request)
        elif request.dataset_type.upper() == 'LB':
            df = self._generate_lb_dataset(request)
        elif request.dataset_type.upper() == 'VS':
            df = self._generate_vs_dataset(request)
        else:
            # Generic dataset generation
            df = self._generate_generic_dataset(request)

        # Save dataset
        dataset_dir = self.test_data_dir / test_data_id
        dataset_dir.mkdir(parents=True, exist_ok=True)

        file_path = dataset_dir / f"{request.dataset_type.lower()}.csv"
        df.to_csv(file_path, index=False)

        # Save metadata
        metadata = {
            "test_data_id": test_data_id,
            "dataset_type": request.dataset_type,
            "num_subjects": request.num_subjects,
            "file_path": str(file_path),
            "generated_at": datetime.now().isoformat(),
            "num_rows": len(df),
            "num_columns": len(df.columns),
            "columns": list(df.columns),
            "include_edge_cases": request.include_edge_cases,
            "include_negative_cases": request.include_negative_cases,
            "seed": request.seed,
        }

        metadata_file = dataset_dir / f"{test_data_id}_metadata.json"
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        logger.info(f"Test data generated: {file_path} ({len(df)} rows)")

        return TestDataGenerationResponse(
            test_data_id=test_data_id,
            dataset_type=request.dataset_type,
            num_subjects=request.num_subjects,
            file_path=str(file_path),
            generated_at=datetime.now(),
            metadata=metadata,
        )

    def _generate_dm_dataset(self, request: TestDataGenerationRequest) -> pd.DataFrame:
        """Generate Demographics (DM) dataset"""
        num_subjects = request.num_subjects

        # Base dataset
        data = {
            'STUDYID': ['STUDY001'] * num_subjects,
            'DOMAIN': ['DM'] * num_subjects,
            'USUBJID': [f"STUDY001-{i:04d}" for i in range(1, num_subjects + 1)],
            'SUBJID': [f"{i:04d}" for i in range(1, num_subjects + 1)],
            'RFSTDTC': self._generate_dates(num_subjects),
            'RFENDTC': self._generate_dates(num_subjects, offset_days=180),
            'SITEID': np.random.choice(['101', '102', '103', '104'], num_subjects),
            'AGE': np.random.randint(18, 85, num_subjects),
            'AGEU': ['YEARS'] * num_subjects,
            'SEX': np.random.choice(['M', 'F'], num_subjects),
            'RACE': np.random.choice(['WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN'], num_subjects),
            'ETHNIC': np.random.choice(['HISPANIC OR LATINO', 'NOT HISPANIC OR LATINO'], num_subjects),
            'ARMCD': np.random.choice(['TRT', 'PBO'], num_subjects),
            'ARM': np.random.choice(['Treatment', 'Placebo'], num_subjects),
            'ACTARMCD': np.random.choice(['TRT', 'PBO'], num_subjects),
            'ACTARM': np.random.choice(['Treatment', 'Placebo'], num_subjects),
            'COUNTRY': np.random.choice(['USA', 'CAN', 'GBR'], num_subjects),
        }

        df = pd.DataFrame(data)

        # Add edge cases if requested
        if request.include_edge_cases and num_subjects > 5:
            df.loc[0, 'AGE'] = 18  # Minimum age
            df.loc[1, 'AGE'] = 85  # Maximum age
            df.loc[2, 'RACE'] = 'OTHER'  # Less common race

        # Add negative cases if requested
        if request.include_negative_cases and num_subjects > 8:
            df.loc[num_subjects - 1, 'AGE'] = None  # Missing age
            df.loc[num_subjects - 2, 'SEX'] = 'U'  # Unknown sex

        return df

    def _generate_ae_dataset(self, request: TestDataGenerationRequest) -> pd.DataFrame:
        """Generate Adverse Events (AE) dataset"""
        num_subjects = request.num_subjects
        ae_per_subject = np.random.poisson(2, num_subjects)  # Average 2 AEs per subject
        total_aes = ae_per_subject.sum()

        usubjids = []
        for i in range(1, num_subjects + 1):
            usubjid = f"STUDY001-{i:04d}"
            usubjids.extend([usubjid] * ae_per_subject[i - 1])

        ae_terms = [
            'HEADACHE', 'NAUSEA', 'FATIGUE', 'DIZZINESS', 'VOMITING',
            'DIARRHEA', 'RASH', 'INSOMNIA', 'ANXIETY', 'PAIN'
        ]

        data = {
            'STUDYID': ['STUDY001'] * total_aes,
            'DOMAIN': ['AE'] * total_aes,
            'USUBJID': usubjids,
            'AESEQ': list(range(1, total_aes + 1)),
            'AETERM': np.random.choice(ae_terms, total_aes),
            'AEDECOD': np.random.choice(ae_terms, total_aes),
            'AESEV': np.random.choice(['MILD', 'MODERATE', 'SEVERE'], total_aes, p=[0.6, 0.3, 0.1]),
            'AESER': np.random.choice(['Y', 'N'], total_aes, p=[0.1, 0.9]),
            'AEREL': np.random.choice(['RELATED', 'NOT RELATED', 'POSSIBLY RELATED'], total_aes),
            'AEACN': np.random.choice(['DOSE NOT CHANGED', 'DRUG WITHDRAWN', 'DOSE REDUCED'], total_aes),
            'AEOUT': np.random.choice(['RECOVERED/RESOLVED', 'RECOVERING/RESOLVING', 'NOT RECOVERED/NOT RESOLVED'], total_aes),
            'AESTDTC': self._generate_dates(total_aes),
            'AEENDTC': self._generate_dates(total_aes, offset_days=7),
        }

        df = pd.DataFrame(data)
        return df

    def _generate_lb_dataset(self, request: TestDataGenerationRequest) -> pd.DataFrame:
        """Generate Laboratory (LB) dataset"""
        num_subjects = request.num_subjects
        visits = ['SCREENING', 'BASELINE', 'WEEK 4', 'WEEK 8', 'WEEK 12']
        tests = [
            ('GLUC', 'Glucose', 'mg/dL', 70, 100),
            ('ALT', 'Alanine Aminotransferase', 'U/L', 7, 55),
            ('AST', 'Aspartate Aminotransferase', 'U/L', 8, 48),
            ('HGB', 'Hemoglobin', 'g/dL', 12, 16),
            ('WBC', 'White Blood Cell Count', 'GI/L', 4, 11),
        ]

        records = []
        seq = 1
        for subj_idx in range(1, num_subjects + 1):
            usubjid = f"STUDY001-{subj_idx:04d}"
            for visit in visits:
                for test_code, test_name, unit, low, high in tests:
                    value = np.random.uniform(low, high)
                    records.append({
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'LB',
                        'USUBJID': usubjid,
                        'LBSEQ': seq,
                        'LBTESTCD': test_code,
                        'LBTEST': test_name,
                        'LBORRES': f"{value:.2f}",
                        'LBORRESU': unit,
                        'LBSTRESC': f"{value:.2f}",
                        'LBSTRESN': value,
                        'LBSTRESU': unit,
                        'VISIT': visit,
                        'LBDTC': self._generate_single_date(),
                    })
                    seq += 1

        df = pd.DataFrame(records)
        return df

    def _generate_vs_dataset(self, request: TestDataGenerationRequest) -> pd.DataFrame:
        """Generate Vital Signs (VS) dataset"""
        num_subjects = request.num_subjects
        visits = ['SCREENING', 'BASELINE', 'WEEK 4', 'WEEK 8', 'WEEK 12']
        tests = [
            ('SYSBP', 'Systolic Blood Pressure', 'mmHg', 110, 140),
            ('DIABP', 'Diastolic Blood Pressure', 'mmHg', 70, 90),
            ('PULSE', 'Pulse Rate', 'beats/min', 60, 100),
            ('TEMP', 'Temperature', 'C', 36.5, 37.5),
        ]

        records = []
        seq = 1
        for subj_idx in range(1, num_subjects + 1):
            usubjid = f"STUDY001-{subj_idx:04d}"
            for visit in visits:
                for test_code, test_name, unit, low, high in tests:
                    value = np.random.uniform(low, high)
                    records.append({
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'VS',
                        'USUBJID': usubjid,
                        'VSSEQ': seq,
                        'VSTESTCD': test_code,
                        'VSTEST': test_name,
                        'VSORRES': f"{value:.1f}",
                        'VSORRESU': unit,
                        'VSSTRESC': f"{value:.1f}",
                        'VSSTRESN': value,
                        'VSSTRESU': unit,
                        'VISIT': visit,
                        'VSDTC': self._generate_single_date(),
                    })
                    seq += 1

        df = pd.DataFrame(records)
        return df

    def _generate_generic_dataset(self, request: TestDataGenerationRequest) -> pd.DataFrame:
        """Generate a generic dataset when specific type not implemented"""
        num_subjects = request.num_subjects

        data = {
            'STUDYID': ['STUDY001'] * num_subjects,
            'DOMAIN': [request.dataset_type] * num_subjects,
            'USUBJID': [f"STUDY001-{i:04d}" for i in range(1, num_subjects + 1)],
            'SEQ': list(range(1, num_subjects + 1)),
        }

        df = pd.DataFrame(data)
        logger.warning(f"Generated generic dataset for {request.dataset_type}")
        return df

    def _generate_dates(self, n: int, base_date: Optional[datetime] = None, offset_days: int = 0) -> List[str]:
        """Generate random dates in ISO format"""
        if base_date is None:
            base_date = datetime(2023, 1, 1)

        dates = []
        for _ in range(n):
            random_days = np.random.randint(0, 365) + offset_days
            date = base_date + timedelta(days=random_days)
            dates.append(date.strftime('%Y-%m-%d'))

        return dates

    def _generate_single_date(self, base_date: Optional[datetime] = None) -> str:
        """Generate a single random date in ISO format"""
        if base_date is None:
            base_date = datetime(2023, 1, 1)

        random_days = np.random.randint(0, 365)
        date = base_date + timedelta(days=random_days)
        return date.strftime('%Y-%m-%d')
