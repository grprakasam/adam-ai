"""
SDTM Test Data Generator Module

Generates mock SDTM datasets for testing ADAM programs.
Supports DM, AE, LB, VS domains with realistic data patterns.
"""

from typing import List, Optional, Dict, Any, Literal
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from faker import Faker
import random
from pydantic import BaseModel, Field

fake = Faker()


class SDTMGenerationRequest(BaseModel):
    """Request model for SDTM test data generation"""
    domain: str = Field(..., description="SDTM domain code (DM, AE, LB, VS, etc.)")
    num_subjects: int = Field(50, ge=1, le=1000, description="Number of subjects")
    records_per_subject: Optional[int] = Field(None, ge=1, le=1000, description="Records per subject for non-DM domains")
    missingness_pct: float = Field(10.0, ge=0.0, le=50.0, description="Percentage of missing data")
    distribution_type: Literal['uniform', 'normal', 'realistic'] = Field('realistic', description="Data distribution type")
    study_start_date: str = Field('2024-01-01', description="Study start date (YYYY-MM-DD)")
    study_end_date: str = Field('2024-12-31', description="Study end date (YYYY-MM-DD)")
    custom_variables: Optional[List[Dict[str, Any]]] = Field(None, description="Custom variable definitions")
    template_source: Literal['pharmaverse', 'cdisc', 'custom'] = Field('pharmaverse', description="Template source")


class SDTMDataGenerator:
    """Generator for SDTM test datasets"""
    
    def __init__(self, seed: Optional[int] = None):
        """Initialize generator with optional seed for reproducibility"""
        if seed:
            random.seed(seed)
            np.random.seed(seed)
            Faker.seed(seed)
        self.fake = Faker()
    
    def generate_dm(self, request: SDTMGenerationRequest) -> pd.DataFrame:
        """
        Generate Demographics (DM) domain
        
        Required variables: STUDYID, DOMAIN, USUBJID, SUBJID, RFSTDTC, RFENDTC,
                           AGE, SEX, RACE, ARMCD, ARM
        """
        num_subjects = request.num_subjects
        study_start = datetime.strptime(request.study_start_date, '%Y-%m-%d')
        study_end = datetime.strptime(request.study_end_date, '%Y-%m-%d')
        
        data = []
        for i in range(1, num_subjects + 1):
            # Generate subject IDs
            site_id = f"{random.randint(1, 10):03d}"
            subj_id = f"{i:04d}"
            usubjid = f"STUDY001-{site_id}-{subj_id}"
            
            # Generate dates
            rfstdtc = study_start + timedelta(days=random.randint(0, 90))
            rfendtc = rfstdtc + timedelta(days=random.randint(90, 365))
            
            # Generate demographics
            sex = random.choice(['M', 'F'])
            race = random.choice([
                'WHITE', 'BLACK OR AFRICAN AMERICAN', 'ASIAN',
                'AMERICAN INDIAN OR ALASKA NATIVE', 'NATIVE HAWAIIAN OR OTHER PACIFIC ISLANDER'
            ])
            
            # Treatment arms
            arm_choices = [
                ('001', 'Placebo'),
                ('002', 'Drug 10mg'),
                ('003', 'Drug 20mg'),
                ('004', 'Drug 40mg')
            ]
            armcd, arm = random.choice(arm_choices)
            
            record = {
                'STUDYID': 'STUDY001',
                'DOMAIN': 'DM',
                'USUBJID': usubjid,
                'SUBJID': subj_id,
                'RFSTDTC': rfstdtc.strftime('%Y-%m-%d'),
                'RFENDTC': rfendtc.strftime('%Y-%m-%d') if random.random() > request.missingness_pct/100 else '',
                'SITEID': site_id,
                'AGE': int(np.random.normal(55, 12)) if request.distribution_type == 'normal' else random.randint(18, 85),
                'AGEU': 'YEARS',
                'SEX': sex,
                'RACE': race,
                'ETHNIC': random.choice(['HISPANIC OR LATINO', 'NOT HISPANIC OR LATINO']),
                'ARMCD': armcd,
                'ARM': arm,
                'COUNTRY': random.choice(['USA', 'GBR', 'DEU', 'FRA', 'JPN']),
                'DTHFL': 'Y' if random.random() < 0.02 else '',  # 2% death rate
            }
            data.append(record)
        
        return pd.DataFrame(data)
    
    def generate_ae(self, request: SDTMGenerationRequest) -> pd.DataFrame:
        """
        Generate Adverse Events (AE) domain
        
        Required: STUDYID, DOMAIN, USUBJID, AESEQ, AETERM, AEDECOD,
                 AESTDTC, AEENDTC, AESEV, AEREL
        """
        # First generate DM to get subjects
        dm_df = self.generate_dm(request)
        num_records = request.records_per_subject or random.randint(3, 10)
        
        ae_terms = [
            ('Headache', 'HEADACHE'),
            ('Nausea', 'NAUSEA'),
            ('Fatigue', 'FATIGUE'),
            ('Dizziness', 'DIZZINESS'),
            ('Diarrhea', 'DIARRHOEA'),
            ('Vomiting', 'VOMITING'),
            ('Rash', 'RASH'),
            ('Cough', 'COUGH'),
            ('Fever', 'PYREXIA'),
            ('Pain', 'PAIN'),
        ]
        
        data = []
        for _, subject in dm_df.iterrows():
            usubjid = subject['USUBJID']
            rfstdtc = datetime.strptime(subject['RFSTDTC'], '%Y-%m-%d')
            rfendtc = datetime.strptime(subject['RFENDTC'], '%Y-%m-%d') if subject['RFENDTC'] else rfstdtc + timedelta(days=180)
            
            # Some subjects may have no AEs
            if random.random() < 0.2:  # 20% chance of no AEs
                continue
            
            ae_count = random.randint(1, num_records)
            for seq in range(1, ae_count + 1):
                aeterm, aedecod = random.choice(ae_terms)
                
                # AE start date during study
                aestdtc = rfstdtc + timedelta(days=random.randint(1, (rfendtc - rfstdtc).days))
                aeendtc = aestdtc + timedelta(days=random.randint(1, 30))
                
                record = {
                    'STUDYID': 'STUDY001',
                    'DOMAIN': 'AE',
                    'USUBJID': usubjid,
                    'AESEQ': seq,
                    'AETERM': aeterm,
                    'AEDECOD': aedecod,
                    'AEBODSYS': random.choice([
                        'GASTROINTESTINAL DISORDERS',
                        'NERVOUS SYSTEM DISORDERS',
                        'GENERAL DISORDERS',
                        'SKIN AND SUBCUTANEOUS TISSUE DISORDERS'
                    ]),
                    'AESTDTC': aestdtc.strftime('%Y-%m-%d'),
                    'AEENDTC': aeendtc.strftime('%Y-%m-%d') if random.random() > request.missingness_pct/100 else '',
                    'AESEV': random.choice(['MILD', 'MODERATE', 'SEVERE']),
                    'AESER': 'Y' if random.random() < 0.05 else 'N',  # 5% serious AEs
                    'AEREL': random.choice(['NOT RELATED', 'UNLIKELY RELATED', 'POSSIBLY RELATED', 'PROBABLY RELATED', 'DEFINITELY RELATED']),
                    'AEACN': random.choice(['DOSE NOT CHANGED', 'DOSE REDUCED', 'DRUG WITHDRAWN', 'UNKNOWN']),
                    'AEOUT': random.choice(['RECOVERED/RESOLVED', 'RECOVERING/RESOLVING', 'NOT RECOVERED/NOT RESOLVED', 'RECOVERED/RESOLVED WITH SEQUELAE', 'FATAL']),
                }
                data.append(record)
        
        return pd.DataFrame(data)
    
    def generate_lb(self, request: SDTMGenerationRequest) -> pd.DataFrame:
        """
        Generate Laboratory (LB) domain
        
        Required: STUDYID, DOMAIN, USUBJID, LBSEQ, LBTESTCD, LBTEST,
                 LBORRES, LBORRESU, LBDTC, VISIT, VISITNUM
        """
        dm_df = self.generate_dm(request)
        
        lab_tests = [
            ('HGB', 'Hemoglobin', (12, 18), 'g/dL'),
            ('WBC', 'White Blood Cell Count', (4, 11), '10^9/L'),
            ('PLT', 'Platelet Count', (150, 400), '10^9/L'),
            ('ALT', 'Alanine Aminotransferase', (7, 56), 'U/L'),
            ('AST', 'Aspartate Aminotransferase', (10, 40), 'U/L'),
            ('CREAT', 'Creatinine', (0.6, 1.2), 'mg/dL'),
            ('GLUC', 'Glucose', (70, 100), 'mg/dL'),
        ]
        
        visits = [
            ('SCREENING', -14, 1),
            ('BASELINE', 0, 2),
            ('WEEK 4', 28, 3),
            ('WEEK 8', 56, 4),
            ('WEEK 12', 84, 5),
            ('END OF TREATMENT', 168, 6),
        ]
        
        data = []
        lbseq = 1
        for _, subject in dm_df.iterrows():
            usubjid = subject['USUBJID']
            rfstdtc = datetime.strptime(subject['RFSTDTC'], '%Y-%m-%d')
            
            for visit_name, visit_day, visitnum in visits:
                visit_date = rfstdtc + timedelta(days=visit_day)
                
                for lbtestcd, lbtest, (lower, upper), lborresu in lab_tests:
                    # Generate realistic lab value
                    if request.distribution_type == 'normal':
                        mean = (lower + upper) / 2
                        std = (upper - lower) / 6
                        lborres = np.random.normal(mean, std)
                    else:
                        lborres = random.uniform(lower, upper)
                    
                    # Add some missing values
                    if random.random() < request.missingness_pct / 100:
                        lborres_str = ''
                    else:
                        lborres_str = f"{lborres:.2f}"
                    
                    record = {
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'LB',
                        'USUBJID': usubjid,
                        'LBSEQ': lbseq,
                        'LBTESTCD': lbtestcd,
                        'LBTEST': lbtest,
                        'LBCAT': 'CHEMISTRY' if lbtestcd in ['ALT', 'AST', 'CREAT', 'GLUC'] else 'HEMATOLOGY',
                        'LBORRES': lborres_str,
                        'LBORRESU': lborresu,
                        'LBSTRESN': lborres if lborres_str else None,
                        'LBSTRESU': lborresu,
                        'LBDTC': visit_date.strftime('%Y-%m-%d'),
                        'VISIT': visit_name,
                        'VISITNUM': visitnum,
                    }
                    data.append(record)
                    lbseq += 1
        
        return pd.DataFrame(data)
    
    def generate_vs(self, request: SDTMGenerationRequest) -> pd.DataFrame:
        """
        Generate Vital Signs (VS) domain
        
        Required: STUDYID, DOMAIN, USUBJID, VSSEQ, VSTESTCD, VSTEST,
                 VSORRES, VSORRESU, VSDTC, VISIT, VISITNUM
        """
        dm_df = self.generate_dm(request)
        
        vs_tests = [
            ('SYSBP', 'Systolic Blood Pressure', (90, 140), 'mmHg'),
            ('DIABP', 'Diastolic Blood Pressure', (60, 90), 'mmHg'),
            ('PULSE', 'Pulse Rate', (60, 100), 'beats/min'),
            ('TEMP', 'Temperature', (36.1, 37.2), 'C'),
            ('WEIGHT', 'Weight', (50, 100), 'kg'),
            ('HEIGHT', 'Height', (150, 190), 'cm'),
        ]
        
        visits = [
            ('SCREENING', -14, 1),
            ('BASELINE', 0, 2),
            ('WEEK 4', 28, 3),
            ('WEEK 8', 56, 4),
            ('WEEK 12', 84, 5),
        ]
        
        data = []
        vsseq = 1
        for _, subject in dm_df.iterrows():
            usubjid = subject['USUBJID']
            rfstdtc = datetime.strptime(subject['RFSTDTC'], '%Y-%m-%d')
            
            # Generate baseline values for each subject (stable over time with small variations)
            baseline_values = {}
            for vstestcd, _, (lower, upper), _ in vs_tests:
                baseline_values[vstestcd] = random.uniform(lower, upper)
            
            for visit_name, visit_day, visitnum in visits:
                visit_date = rfstdtc + timedelta(days=visit_day)
                
                for vstestcd, vstest, (lower, upper), vsorresu in vs_tests:
                    # Use baseline with small variation
                    baseline = baseline_values[vstestcd]
                    variation = (upper - lower) * 0.05  # 5% variation
                    vsorres = baseline + random.uniform(-variation, variation)
                    
                    # Add missing values
                    if random.random() < request.missingness_pct / 100:
                        vsorres_str = ''
                    else:
                        vsorres_str = f"{vsorres:.1f}"
                    
                    record = {
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'VS',
                        'USUBJID': usubjid,
                        'VSSEQ': vsseq,
                        'VSTESTCD': vstestcd,
                        'VSTEST': vstest,
                        'VSORRES': vsorres_str,
                        'VSORRESU': vsorresu,
                        'VSSTRESN': vsorres if vsorres_str else None,
                        'VSSTRESU': vsorresu,
                        'VSDTC': visit_date.strftime('%Y-%m-%d'),
                        'VISIT': visit_name,
                        'VISITNUM': visitnum,
                        'VSPOS': 'SITTING',
                        'VSLOC': 'ARM' if vstestcd in ['SYSBP', 'DIABP'] else None,
                    }
                    data.append(record)
                    vsseq += 1
        
        return pd.DataFrame(data)
    
    def generate(self, request: SDTMGenerationRequest) -> pd.DataFrame:
        """Generate SDTM data based on domain"""
        domain = request.domain.upper()
        
        generators = {
            'DM': self.generate_dm,
            'AE': self.generate_ae,
            'LB': self.generate_lb,
            'VS': self.generate_vs,
        }
        
        if domain not in generators:
            raise ValueError(f"Unsupported domain: {domain}. Supported: {', '.join(generators.keys())}")
        
        return generators[domain](request)
    
    def validate_data(self, df: pd.DataFrame, domain: str) -> Dict[str, Any]:
        """Validate generated SDTM data"""
        errors = []
        warnings = []
        
        # Check required variables based on domain
        required_vars = {
            'DM': ['STUDYID', 'DOMAIN', 'USUBJID', 'SUBJID', 'RFSTDTC', 'AGE', 'SEX', 'RACE'],
            'AE': ['STUDYID', 'DOMAIN', 'USUBJID', 'AESEQ', 'AETERM', 'AEDECOD', 'AESTDTC'],
            'LB': ['STUDYID', 'DOMAIN', 'USUBJID', 'LBSEQ', 'LBTESTCD', 'LBTEST', 'LBDTC'],
            'VS': ['STUDYID', 'DOMAIN', 'USUBJID', 'VSSEQ', 'VSTESTCD', 'VSTEST', 'VSDTC'],
        }
        
        if domain in required_vars:
            missing_vars = set(required_vars[domain]) - set(df.columns)
            if missing_vars:
                errors.append(f"Missing required variables: {', '.join(missing_vars)}")
        
        # Check USUBJID format
        if 'USUBJID' in df.columns:
            invalid_ids = df[~df['USUBJID'].str.match(r'^[A-Z0-9]+-[0-9]{3}-[0-9]{4}$', na=False)]
            if len(invalid_ids) > 0:
                warnings.append(f"Found {len(invalid_ids)} invalid USUBJID formats")
        
        # Check sequence variables are sequential
        seq_vars = [col for col in df.columns if col.endswith('SEQ')]
        for seq_var in seq_vars:
            if not df[seq_var].is_monotonic_increasing:
                warnings.append(f"{seq_var} is not sequential")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'row_count': len(df),
            'column_count': len(df.columns),
        }
