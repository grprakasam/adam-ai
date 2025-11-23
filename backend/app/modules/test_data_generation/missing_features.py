"""
Missing SDTM Domain Generators for ADAM Data Generation

This module implements the top 3 critical missing features:
1. EX (Exposure) Domain - Treatment exposure tracking
2. DS (Disposition) Domain - Study completion status
3. Enhanced DM with Analysis Flags - ITTFL, SAFFL, EFFFL
"""

from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random


class ExposureDomainGenerator:
    """
    Generate EX (Exposure) Domain - CRITICAL for ADAM Analysis
    
    Required for ADAM:
    - Treatment duration calculations (TRTDURD in ADSL)
    - Cumulative dose calculations (ADEX)
    - Treatment start/end dates (TRTSDT, TRTEDT)
    - Exposure flags (SAFFL, EFFFL derivation)
    """
    
    def generate_ex(self, dm_df: pd.DataFrame, request) -> pd.DataFrame:
        """
        Generate Exposure (EX) domain - CDISC SDTM 3.4 Compliant
        
        Required: STUDYID, DOMAIN, USUBJID, EXSEQ, EXTRT, EXDOSE, EXDOSU, EXSTDTC, EXENDTC
        Expected: EXROUTE, EXFRQ, EXDOSFRM, VISITNUM, VISIT
        """
        data = []
        exseq = 1
        
        # Treatment arm mappings from DM - use request treatment_arms if available
        default_treatment_map = {
            'Placebo': {'dose': 0, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'QD'},
            'Active': {'dose': 20, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'QD'},
            'Drug 10mg': {'dose': 10, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'QD'},
            'Drug 20mg': {'dose': 20, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'BID'},
            'Drug 40mg': {'dose': 40, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'BID'},
        }
        
        # Build treatment map from request or use defaults
        treatment_map = {}
        if hasattr(request, 'treatment_arms') and request.treatment_arms:
            for arm in request.treatment_arms:
                if arm in default_treatment_map:
                    treatment_map[arm] = default_treatment_map[arm]
                else:
                    # Default for unknown treatment arms
                    treatment_map[arm] = {'dose': 20, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'QD'}
        else:
            treatment_map = default_treatment_map
        
        for _, subject in dm_df.iterrows():
            usubjid = subject['USUBJID']
            arm = subject.get('ARM', 'Placebo')
            rfstdtc = datetime.strptime(subject['RFSTDTC'], '%Y-%m-%d')
            rfendtc = datetime.strptime(subject['RFENDTC'], '%Y-%m-%d') if subject.get('RFENDTC') else rfstdtc + timedelta(days=180)
            
            # Treatment information - use treatment_map from request or defaults
            treatment_info = treatment_map.get(arm, treatment_map.get('Placebo', {'dose': 0, 'form': 'TABLET', 'route': 'ORAL', 'freq': 'QD'}))
            extrt = arm
            exdose = treatment_info['dose']
            
            # Treatment start date (typically same as RFSTDTC or shortly after)
            treatment_start_offset = random.randint(0, 3)  # 0-3 days after randomization
            exstdtc = rfstdtc + timedelta(days=treatment_start_offset)
            
            # Treatment end date (may be before study end for discontinuations)
            # 85% complete treatment, 15% discontinue early
            if random.random() < 0.15:  # Early discontinuation
                days_on_treatment = random.randint(30, int((rfendtc - exstdtc).days * 0.7))
                exendtc = exstdtc + timedelta(days=days_on_treatment)
            else:  # Complete treatment
                exendtc = rfendtc
            
            # Primary exposure record
            record = {
                'STUDYID': 'STUDY001',
                'DOMAIN': 'EX',
                'USUBJID': usubjid,
                'EXSEQ': exseq,
                'EXTRT': extrt,
                'EXDOSE': exdose,
                'EXDOSU': 'MG',
                'EXDOSFRM': treatment_info['form'],
                'EXDOSFRQ': treatment_info['freq'],
                'EXROUTE': treatment_info['route'],
                'EXSTDTC': exstdtc.strftime('%Y-%m-%d'),
                'EXENDTC': exendtc.strftime('%Y-%m-%d'),
                'EXSTDY': (exstdtc - rfstdtc).days + 1,
                'EXENDY': (exendtc - rfstdtc).days + 1,
                'VISIT': 'BASELINE',
                'VISITNUM': 2,
            }
            data.append(record)
            exseq += 1
            
            # Dose modifications (20% of subjects have dose changes)
            if random.random() < 0.2 and exdose > 0:
                # Dose reduction or increase
                modification_date = exstdtc + timedelta(days=random.randint(30, 90))
                if random.random() < 0.7:  # 70% dose reduction
                    new_dose = max(0, exdose - random.randint(5, exdose))
                    exmod = 'DOSE REDUCED'
                else:  # 30% dose increase
                    new_dose = exdose + random.randint(5, 20)
                    exmod = 'DOSE INCREASED'
                
                if new_dose != exdose and modification_date < exendtc:
                    record = {
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'EX',
                        'USUBJID': usubjid,
                        'EXSEQ': exseq,
                        'EXTRT': extrt,
                        'EXDOSE': new_dose,
                        'EXDOSU': 'MG',
                        'EXDOSFRM': treatment_info['form'],
                        'EXDOSFRQ': treatment_info['freq'],
                        'EXROUTE': treatment_info['route'],
                        'EXSTDTC': modification_date.strftime('%Y-%m-%d'),
                        'EXENDTC': exendtc.strftime('%Y-%m-%d'),
                        'EXSTDY': (modification_date - rfstdtc).days + 1,
                        'EXENDY': (exendtc - rfstdtc).days + 1,
                        'EXMOD': exmod,
                        'VISIT': f'WEEK {(modification_date - rfstdtc).days // 7}',
                        'VISITNUM': 3,
                    }
                    data.append(record)
                    exseq += 1
        
        return pd.DataFrame(data)


class DispositionDomainGenerator:
    """
    Generate DS (Disposition) Domain - CRITICAL for Analysis Population Flags
    
    Required for ADAM:
    - ITTFL (Intent-to-Treat Flag) - All randomized subjects
    - SAFFL (Safety Population Flag) - Subjects who received treatment
    - EFFFL (Efficacy Population Flag) - Subjects who completed per protocol
    - Dropout reasons and dates
    """
    
    def generate_ds(self, dm_df: pd.DataFrame, ex_df: Optional[pd.DataFrame], request) -> pd.DataFrame:
        """
        Generate Disposition (DS) domain - CDISC SDTM 3.4 Compliant
        
        Required: STUDYID, DOMAIN, USUBJID, DSSEQ, DSTERM, DSDECOD, DSSTDTC
        Expected: VISITNUM, VISIT, DSDECOD (controlled terminology)
        """
        data = []
        dsseq = 1
        
        # Disposition events
        disposition_events = [
            # (DSDECOD, DSTERM, DSDTYP) - controlled terminology
            ('RANDOMIZED', 'Randomized', 'INFORMEDCONSENT'),
            ('INFORMEDCONSENT', 'Informed Consent Obtained', 'INFORMEDCONSENT'),
            ('COMPLETED', 'Completed Study', 'PROTOCOL'),
            ('WITHDRAWAL', 'Withdrawn by Subject', 'PROTOCOL'),
            ('WITHDRAWAL', 'Subject Decision', 'PROTOCOL'),
            ('WITHDRAWAL', 'Adverse Event', 'PROTOCOL'),
            ('WITHDRAWAL', 'Lack of Efficacy', 'PROTOCOL'),
            ('WITHDRAWAL', 'Protocol Violation', 'PROTOCOL'),
            ('WITHDRAWAL', 'Lost to Follow-up', 'PROTOCOL'),
            ('SCREENFAILURE', 'Screen Failure', 'PROTOCOL'),
            ('NOT COMPLETED', 'Study Termination by Sponsor', 'PROTOCOL'),
        ]
        
        for _, subject in dm_df.iterrows():
            usubjid = subject['USUBJID']
            rfstdtc = datetime.strptime(subject['RFSTDTC'], '%Y-%m-%d')
            rfendtc = datetime.strptime(subject['RFENDTC'], '%Y-%m-%d') if subject.get('RFENDTC') else None
            
            # Informed consent (before randomization)
            consent_date = rfstdtc - timedelta(days=random.randint(1, 7))
            record = {
                'STUDYID': 'STUDY001',
                'DOMAIN': 'DS',
                'USUBJID': usubjid,
                'DSSEQ': dsseq,
                'DSTERM': 'Informed Consent Obtained',
                'DSDECOD': 'INFORMEDCONSENT',
                'DSTDTC': consent_date.strftime('%Y-%m-%d'),
                'DSSTDY': (consent_date - rfstdtc).days,
                'VISIT': 'SCREENING',
                'VISITNUM': 1,
            }
            data.append(record)
            dsseq += 1
            
            # Randomized
            record = {
                'STUDYID': 'STUDY001',
                'DOMAIN': 'DS',
                'USUBJID': usubjid,
                'DSSEQ': dsseq,
                'DSTERM': 'Randomized',
                'DSDECOD': 'RANDOMIZED',
                'DSTDTC': rfstdtc.strftime('%Y-%m-%d'),
                'DSSTDY': 1,
                'VISIT': 'BASELINE',
                'VISITNUM': 2,
            }
            data.append(record)
            dsseq += 1
            
            # Final disposition (completed vs. discontinued)
            if rfendtc:
                study_days = (rfendtc - rfstdtc).days
                
                # 75% complete, 25% discontinue
                if random.random() < 0.75:  # Completed
                    record = {
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'DS',
                        'USUBJID': usubjid,
                        'DSSEQ': dsseq,
                        'DSTERM': 'Completed Study',
                        'DSDECOD': 'COMPLETED',
                        'DSTDTC': rfendtc.strftime('%Y-%m-%d'),
                        'DSSTDY': study_days,
                        'VISIT': 'END OF TREATMENT',
                        'VISITNUM': 6,
                    }
                else:  # Discontinued
                    # Discontinuation reason
                    discontinuation_type = random.choice([
                        ('Withdrawn by Subject', 'WITHDRAWAL'),
                        ('Adverse Event', 'WITHDRAWAL'),
                        ('Lack of Efficacy', 'WITHDRAWAL'),
                        ('Protocol Violation', 'WITHDRAWAL'),
                        ('Lost to Follow-up', 'WITHDRAWAL'),
                    ])
                    
                    # Early discontinuation date
                    discontinuation_day = random.randint(int(study_days * 0.3), int(study_days * 0.8))
                    discontinuation_date = rfstdtc + timedelta(days=discontinuation_day)
                    
                    record = {
                        'STUDYID': 'STUDY001',
                        'DOMAIN': 'DS',
                        'USUBJID': usubjid,
                        'DSSEQ': dsseq,
                        'DSTERM': discontinuation_type[0],
                        'DSDECOD': discontinuation_type[1],
                        'DSTDTC': discontinuation_date.strftime('%Y-%m-%d'),
                        'DSSTDY': discontinuation_day,
                        'VISIT': f'WEEK {discontinuation_day // 7}',
                        'VISITNUM': 3,
                    }
                data.append(record)
                dsseq += 1
        
        return pd.DataFrame(data)


class EnhancedDMDomainGenerator:
    """
    Enhance DM Domain with Analysis Flags - CRITICAL for ADAM ADSL
    
    Adds:
    - ITTFL (Intent-to-Treat Flag)
    - SAFFL (Safety Population Flag)
    - EFFFL (Efficacy Population Flag)
    - RANDFL (Randomization Flag)
    - TRTSDT/TRTEDT (Treatment dates from EX)
    - TRTDURD (Treatment duration in days)
    """
    
    def enhance_dm_with_analysis_flags(
        self, 
        dm_df: pd.DataFrame, 
        ex_df: pd.DataFrame, 
        ds_df: pd.DataFrame
    ) -> pd.DataFrame:
        """
        Enhance DM domain with ADAM analysis flags
        
        Derives:
        - ITTFL: Y if randomized (from DS where DSDECOD='RANDOMIZED')
        - SAFFL: Y if received treatment (from EX domain - any EX record)
        - EFFFL: Y if completed per protocol (from DS where DSDECOD='COMPLETED')
        - RANDFL: Y if randomized (same as ITTFL)
        - TRTSDT: First treatment start date (from EX EXSTDTC)
        - TRTEDT: Last treatment end date (from EX EXENDTC)
        - TRTDURD: Treatment duration in days (TRTEDT - TRTSDT + 1)
        """
        enhanced_dm = dm_df.copy()
        
        # Initialize flags
        enhanced_dm['ITTFL'] = 'N'
        enhanced_dm['SAFFL'] = 'N'
        enhanced_dm['EFFFL'] = 'N'
        enhanced_dm['RANDFL'] = 'N'
        enhanced_dm['TRTSDT'] = ''
        enhanced_dm['TRTEDT'] = ''
        enhanced_dm['TRTDURD'] = None
        
        for idx, row in enhanced_dm.iterrows():
            usubjid = row['USUBJID']
            
            # ITTFL / RANDFL: Set to Y if randomized
            randomized = ds_df[
                (ds_df['USUBJID'] == usubjid) & 
                (ds_df['DSDECOD'] == 'RANDOMIZED')
            ]
            if len(randomized) > 0:
                enhanced_dm.at[idx, 'ITTFL'] = 'Y'
                enhanced_dm.at[idx, 'RANDFL'] = 'Y'
            
            # SAFFL: Set to Y if received treatment (any EX record)
            received_treatment = ex_df[ex_df['USUBJID'] == usubjid]
            if len(received_treatment) > 0:
                enhanced_dm.at[idx, 'SAFFL'] = 'Y'
                
                # Treatment start date (first exposure)
                first_exposure = received_treatment.nsmallest(1, 'EXSTDY')
                if len(first_exposure) > 0:
                    trtsdt = first_exposure.iloc[0]['EXSTDTC']
                    enhanced_dm.at[idx, 'TRTSDT'] = trtsdt
                
                # Treatment end date (last exposure end)
                last_exposure = received_treatment.nlargest(1, 'EXENDY')
                if len(last_exposure) > 0:
                    trtedt = last_exposure.iloc[0]['EXENDTC']
                    enhanced_dm.at[idx, 'TRTEDT'] = trtedt
                    
                    # Treatment duration
                    if enhanced_dm.at[idx, 'TRTSDT'] and enhanced_dm.at[idx, 'TRTEDT']:
                        try:
                            trtsdt_dt = datetime.strptime(enhanced_dm.at[idx, 'TRTSDT'], '%Y-%m-%d')
                            trtedt_dt = datetime.strptime(enhanced_dm.at[idx, 'TRTEDT'], '%Y-%m-%d')
                            trtdurd = (trtedt_dt - trtsdt_dt).days + 1
                            enhanced_dm.at[idx, 'TRTDURD'] = max(0, trtdurd)
                        except:
                            pass
            
            # EFFFL: Set to Y if completed per protocol
            completed = ds_df[
                (ds_df['USUBJID'] == usubjid) & 
                (ds_df['DSDECOD'] == 'COMPLETED')
            ]
            if len(completed) > 0:
                enhanced_dm.at[idx, 'EFFFL'] = 'Y'
        
        return enhanced_dm


# Integration function to add these to the main generator
def generate_all_domains_for_adam(request, generator) -> Dict[str, pd.DataFrame]:
    """
    Generate all SDTM domains needed for ADAM analysis
    
    Returns dictionary of domain DataFrames:
    - DM (with analysis flags)
    - AE, LB, VS (existing)
    - EX (new - exposure)
    - DS (new - disposition)
    """
    # Generate base DM
    dm_df = generator.generate_dm(request)
    
    # Generate EX domain
    ex_generator = ExposureDomainGenerator()
    ex_df = ex_generator.generate_ex(dm_df, request)
    
    # Generate DS domain
    ds_generator = DispositionDomainGenerator()
    ds_df = ds_generator.generate_ds(dm_df, ex_df, request)
    
    # Enhance DM with analysis flags
    dm_enhancer = EnhancedDMDomainGenerator()
    dm_df_enhanced = dm_enhancer.enhance_dm_with_analysis_flags(dm_df, ex_df, ds_df)
    
    # Generate other domains (existing)
    ae_df = generator.generate_ae(request) if request.domain.upper() == 'AE' else None
    lb_df = generator.generate_lb(request) if request.domain.upper() == 'LB' else None
    vs_df = generator.generate_vs(request) if request.domain.upper() == 'VS' else None
    
    return {
        'DM': dm_df_enhanced,
        'EX': ex_df,
        'DS': ds_df,
        'AE': ae_df,
        'LB': lb_df,
        'VS': vs_df,
    }

