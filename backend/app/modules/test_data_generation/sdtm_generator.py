"""
SDTM Test Data Generator Module

Generates mock SDTM datasets for testing ADAM programs.
Supports DM, AE, LB, VS, EX, DS domains with realistic data patterns.
Includes automatic ADAM analysis flags when EX/DS domains are available.
"""

from typing import List, Optional, Dict, Any, Literal
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from faker import Faker
import random
from pydantic import BaseModel, Field

fake = Faker()

# Import missing domain generators
try:
    from .missing_features import (
        ExposureDomainGenerator,
        DispositionDomainGenerator,
        EnhancedDMDomainGenerator
    )
    MISSING_FEATURES_AVAILABLE = True
except ImportError:
    MISSING_FEATURES_AVAILABLE = False


class SDTMGenerationRequest(BaseModel):
    """Request model for SDTM test data generation - CDISC Compliant"""
    domain: str = Field(..., description="SDTM domain code (DM, AE, LB, VS, etc.)")
    num_subjects: int = Field(50, ge=1, le=1000, description="Number of subjects")
    records_per_subject: Optional[int] = Field(None, ge=1, le=1000, description="Records per subject for non-DM domains")
    missingness_pct: float = Field(10.0, ge=0.0, le=50.0, description="Percentage of missing data")
    distribution_type: Literal['uniform', 'normal', 'realistic'] = Field('realistic', description="Data distribution type")
    study_start_date: str = Field('2024-01-01', description="Study start date (YYYY-MM-DD)")
    study_end_date: str = Field('2024-12-31', description="Study end date (YYYY-MM-DD)")
    custom_variables: Optional[List[Dict[str, Any]]] = Field(None, description="Custom variable definitions")
    template_source: Literal['pharmaverse', 'cdisc', 'custom'] = Field('pharmaverse', description="Template source")
    
    # Safety-specific configuration (CDISC SDTM 3.4 compliant)
    serious_ae_pct: float = Field(5.0, ge=0.0, le=50.0, description="Percentage of serious adverse events (AESER='Y')")
    severe_ae_pct: float = Field(10.0, ge=0.0, le=50.0, description="Percentage of severe adverse events (AESEV='SEVERE')")
    related_ae_pct: float = Field(30.0, ge=0.0, le=100.0, description="Percentage of treatment-related AEs (AEREL includes RELATED)")
    lab_abnormality_pct: float = Field(15.0, ge=0.0, le=50.0, description="Percentage of abnormal lab values (LBNRIND='HIGH' or 'LOW')")
    include_meddra: bool = Field(True, description="Include MedDRA coding (AEDECOD, AEBODSYS, AESOC)")
    include_ct: bool = Field(True, description="Include controlled terminology validation")
    num_treatment_arms: int = Field(2, ge=1, le=10, description="Number of treatment arms")
    treatment_arms: List[str] = Field(default=['Placebo', 'Active'], description="Treatment arm names")
    randomization_ratio: str = Field('1:1', description="Randomization ratio (e.g., '1:1', '2:1:1')")
    num_visits: int = Field(5, ge=1, le=20, description="Number of study visits")
    visit_schedule_days: List[int] = Field(default=[1, 15, 30, 60, 90], description="Visit schedule in days from baseline")
    visit_window_days: int = Field(3, ge=0, le=30, description="Visit window tolerance in days")
    sex_distribution: Literal['balanced', 'male_biased', 'female_biased', 'custom'] = Field('balanced', description="Sex distribution")
    age_min: int = Field(18, ge=0, le=100, description="Minimum age in years")
    age_max: int = Field(75, ge=0, le=100, description="Maximum age in years")
    age_distribution: Literal['normal', 'uniform', 'realistic'] = Field('realistic', description="Age distribution type")
    study_phase: str = Field('Phase III', description="Study phase")
    therapeutic_area: str = Field('Oncology', description="Therapeutic area")
    sdtm_version: str = Field('3.4', description="SDTM version")
    adam_ig_version: str = Field('1.3', description="ADaM IG version")
    protocol_deviations_pct: float = Field(5.0, ge=0.0, le=30.0, description="Percentage of protocol deviations")
    outlier_pct: float = Field(2.0, ge=0.0, le=10.0, description="Percentage of outlier values")


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
        Generate Adverse Events (AE) domain - CDISC SDTM 3.4 Compliant
        
        Required: STUDYID, DOMAIN, USUBJID, AESEQ, AETERM, AEDECOD, AESTDTC
        Expected: AESEV, AEREL, AESER, AEBODSYS, AESOC (MedDRA)
        """
        # First generate DM to get subjects
        dm_df = self.generate_dm(request)
        num_records = request.records_per_subject or random.randint(3, 10)
        
        # Enhanced AE terms with MedDRA coding (CDISC controlled terminology)
        ae_terms = [
            # (AETERM, AEDECOD, AEBODSYS, AESOC)
            ('Headache', 'HEADACHE', 'NERVOUS SYSTEM DISORDERS', 'Nervous system disorders'),
            ('Nausea', 'NAUSEA', 'GASTROINTESTINAL DISORDERS', 'Gastrointestinal disorders'),
            ('Fatigue', 'FATIGUE', 'GENERAL DISORDERS AND ADMINISTRATION SITE CONDITIONS', 'General disorders and administration site conditions'),
            ('Dizziness', 'DIZZINESS', 'NERVOUS SYSTEM DISORDERS', 'Nervous system disorders'),
            ('Diarrhea', 'DIARRHOEA', 'GASTROINTESTINAL DISORDERS', 'Gastrointestinal disorders'),
            ('Vomiting', 'VOMITING', 'GASTROINTESTINAL DISORDERS', 'Gastrointestinal disorders'),
            ('Rash', 'RASH', 'SKIN AND SUBCUTANEOUS TISSUE DISORDERS', 'Skin and subcutaneous tissue disorders'),
            ('Cough', 'COUGH', 'RESPIRATORY, THORACIC AND MEDIASTINAL DISORDERS', 'Respiratory, thoracic and mediastinal disorders'),
            ('Fever', 'PYREXIA', 'GENERAL DISORDERS AND ADMINISTRATION SITE CONDITIONS', 'General disorders and administration site conditions'),
            ('Pain', 'PAIN', 'GENERAL DISORDERS AND ADMINISTRATION SITE CONDITIONS', 'General disorders and administration site conditions'),
            ('Hypertension', 'HYPERTENSION', 'VASCULAR DISORDERS', 'Vascular disorders'),
            ('Tachycardia', 'TACHYCARDIA', 'CARDIAC DISORDERS', 'Cardiac disorders'),
            ('Dyspnea', 'DYSPNOEA', 'RESPIRATORY, THORACIC AND MEDIASTINAL DISORDERS', 'Respiratory, thoracic and mediastinal disorders'),
        ]
        
        # Severity distribution based on configuration
        severity_weights = {
            'MILD': 0.6,
            'MODERATE': 0.3,
            'SEVERE': request.severe_ae_pct / 100.0
        }
        # Normalize weights
        total = sum(severity_weights.values())
        severity_weights = {k: v/total for k, v in severity_weights.items()}
        
        # Relationship distribution
        related_terms = ['POSSIBLY RELATED', 'PROBABLY RELATED', 'DEFINITELY RELATED']
        unrelated_terms = ['NOT RELATED', 'UNLIKELY RELATED']
        
        data = []
        for _, subject in dm_df.iterrows():
            usubjid = subject['USUBJID']
            rfstdtc = datetime.strptime(subject['RFSTDTC'], '%Y-%m-%d')
            rfendtc = datetime.strptime(subject['RFENDTC'], '%Y-%m-%d') if subject['RFENDTC'] else rfstdtc + timedelta(days=180)
            
            # Some subjects may have no AEs (20% chance)
            if random.random() < 0.2:
                continue
            
            ae_count = random.randint(1, num_records)
            for seq in range(1, ae_count + 1):
                aeterm, aedecod, aebodsys, aesoc = random.choice(ae_terms)
                
                # AE start date during study
                study_days = (rfendtc - rfstdtc).days
                if study_days > 0:
                    aestdtc = rfstdtc + timedelta(days=random.randint(1, study_days))
                    aeendtc = aestdtc + timedelta(days=random.randint(1, min(30, study_days)))
                else:
                    aestdtc = rfstdtc
                    aeendtc = rfstdtc + timedelta(days=random.randint(1, 30))
                
                # Determine severity based on configuration
                rand_sev = random.random()
                if rand_sev < severity_weights['MILD']:
                    aesev = 'MILD'
                elif rand_sev < severity_weights['MILD'] + severity_weights['MODERATE']:
                    aesev = 'MODERATE'
                else:
                    aesev = 'SEVERE'
                
                # Determine if serious (AESER) based on configuration
                aeser = 'Y' if random.random() < (request.serious_ae_pct / 100.0) else 'N'
                
                # Determine relationship based on configuration
                if random.random() < (request.related_ae_pct / 100.0):
                    aerel = random.choice(related_terms)
                else:
                    aerel = random.choice(unrelated_terms)
                
                # AE outcome - more likely fatal if serious
                if aeser == 'Y' and random.random() < 0.1:  # 10% of serious AEs are fatal
                    aeout = 'FATAL'
                else:
                    aeout = random.choice([
                        'RECOVERED/RESOLVED',
                        'RECOVERING/RESOLVING',
                        'NOT RECOVERED/NOT RESOLVED',
                        'RECOVERED/RESOLVED WITH SEQUELAE'
                    ])
                
                record = {
                    'STUDYID': 'STUDY001',
                    'DOMAIN': 'AE',
                    'USUBJID': usubjid,
                    'AESEQ': seq,
                    'AETERM': aeterm,
                    'AEDECOD': aedecod if request.include_meddra else '',
                    'AEBODSYS': aebodsys if request.include_meddra else '',
                    'AESOC': aesoc if request.include_meddra else '',
                    'AESTDTC': aestdtc.strftime('%Y-%m-%d'),
                    'AEENDTC': aeendtc.strftime('%Y-%m-%d') if random.random() > request.missingness_pct/100 else '',
                    'AESEV': aesev,
                    'AESER': aeser,
                    'AEREL': aerel,
                    'AEACN': random.choice(['DOSE NOT CHANGED', 'DOSE REDUCED', 'DRUG WITHDRAWN', 'UNKNOWN']) if aeser == 'Y' or aerel in related_terms else 'DOSE NOT CHANGED',
                    'AEOUT': aeout,
                    'AESCONG': 'Y' if random.random() < 0.05 else 'N',  # Congenital anomaly flag
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
                    
                    # Determine if abnormal based on configuration
                    is_abnormal = random.random() < (request.lab_abnormality_pct / 100.0)
                    if is_abnormal:
                        # Generate abnormal value (outside normal range)
                        if random.random() < 0.5:  # Low
                            lborres = random.uniform(lower * 0.5, lower * 0.9)
                            lbnrind = 'LOW'
                        else:  # High
                            lborres = random.uniform(upper * 1.1, upper * 2.0)
                            lbnrind = 'HIGH'
                    else:
                        lbnrind = 'NORMAL'
                    
                    # Add some missing values
                    if random.random() < request.missingness_pct / 100:
                        lborres_str = ''
                        lbnrind = ''
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
                        'LBNRIND': lbnrind,  # CDISC: Normal/Abnormal indicator
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
        """
        Generate SDTM data based on domain
        
        For DM domain: Automatically enhances with analysis flags if EX/DS are available
        """
        domain = request.domain.upper()
        
        generators = {
            'DM': self.generate_dm,
            'AE': self.generate_ae,
            'LB': self.generate_lb,
            'VS': self.generate_vs,
        }
        
        # Add EX and DS domains if available
        if MISSING_FEATURES_AVAILABLE:
            ex_generator = ExposureDomainGenerator()
            ds_generator = DispositionDomainGenerator()
            
            generators['EX'] = lambda req: ex_generator.generate_ex(self.generate_dm(req), req)
            generators['DS'] = lambda req: ds_generator.generate_ds(self.generate_dm(req), None, req)
        
        if domain not in generators:
            supported = ', '.join(generators.keys())
            raise ValueError(f"Unsupported domain: {domain}. Supported: {supported}")
        
        result = generators[domain](request)
        
        # Auto-enhance DM with analysis flags if EX/DS are available
        if domain == 'DM' and MISSING_FEATURES_AVAILABLE:
            try:
                # Generate EX and DS to enhance DM
                ex_df = ex_generator.generate_ex(result, request)
                ds_df = ds_generator.generate_ds(result, ex_df, request)
                
                # Enhance DM with analysis flags
                dm_enhancer = EnhancedDMDomainGenerator()
                result = dm_enhancer.enhance_dm_with_analysis_flags(result, ex_df, ds_df)
            except Exception as e:
                # If enhancement fails, return base DM (non-blocking)
                import logging
                logging.warning(f"Could not enhance DM with analysis flags: {e}")
        
        return result
    
    def validate_data(self, df: pd.DataFrame, domain: str) -> Dict[str, Any]:
        """Validate generated SDTM data - CDISC SDTM 3.4 Compliant"""
        errors = []
        warnings = []
        
        # Check required variables based on domain (CDISC SDTM 3.4)
        required_vars = {
            'DM': ['STUDYID', 'DOMAIN', 'USUBJID', 'SUBJID', 'RFSTDTC', 'AGE', 'SEX', 'RACE'],
            'AE': ['STUDYID', 'DOMAIN', 'USUBJID', 'AESEQ', 'AETERM', 'AEDECOD', 'AESTDTC'],
            'LB': ['STUDYID', 'DOMAIN', 'USUBJID', 'LBSEQ', 'LBTESTCD', 'LBTEST', 'LBDTC'],
            'VS': ['STUDYID', 'DOMAIN', 'USUBJID', 'VSSEQ', 'VSTESTCD', 'VSTEST', 'VSDTC'],
            'EX': ['STUDYID', 'DOMAIN', 'USUBJID', 'EXSEQ', 'EXTRT', 'EXDOSE', 'EXDOSU', 'EXSTDTC', 'EXENDTC'],
            'DS': ['STUDYID', 'DOMAIN', 'USUBJID', 'DSSEQ', 'DSTERM', 'DSDECOD', 'DSTDTC'],
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
        
        # Check sequence variables are sequential (per subject)
        seq_vars = [col for col in df.columns if col.endswith('SEQ')]
        for seq_var in seq_vars:
            if seq_var in df.columns and 'USUBJID' in df.columns:
                # Check per subject
                for usubjid in df['USUBJID'].unique():
                    subject_data = df[df['USUBJID'] == usubjid].sort_values(seq_var)
                    if len(subject_data) > 1:
                        seq_values = subject_data[seq_var].values
                        if not all(seq_values[i] <= seq_values[i+1] for i in range(len(seq_values)-1)):
                            warnings.append(f"{seq_var} is not sequential for subject {usubjid}")
        
        # ADAM analysis flags check for DM domain
        if domain == 'DM':
            adam_flags = ['ITTFL', 'SAFFL', 'EFFFL', 'RANDFL', 'TRTSDT', 'TRTEDT', 'TRTDURD']
            present_flags = [flag for flag in adam_flags if flag in df.columns]
            if present_flags:
                warnings.append(f"✓ ADAM-ready: Analysis flags present ({', '.join(present_flags)})")
            else:
                warnings.append("ℹ Generate EX and DS domains to enable ADAM analysis flags in DM")
        
        return {
            'is_valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings,
            'row_count': len(df),
            'column_count': len(df.columns),
        }
