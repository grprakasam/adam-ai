"""
Specification Parser - Parses ADAM specification Excel files
"""

import pandas as pd
import re
from pathlib import Path
from typing import List, Dict
from loguru import logger


class SpecificationParser:
    """Parse ADAM specification Excel files"""

    # Column name mappings (handles variations)
    COLUMN_MAPPINGS = {
        'variable': ['Variable', 'Variable Name', 'VARIABLE', 'VAR'],
        'label': ['Label', 'Variable Label', 'LABEL', 'Description'],
        'type': ['Type', 'Data Type', 'TYPE', 'Format'],
        'length': ['Length', 'LENGTH', 'Max Length'],
        'source': ['Source', 'Source Variable', 'SDTM Source', 'Derivation'],
        'algorithm': ['Algorithm', 'Derivation', 'Logic', 'Derivation Logic'],
        'category': ['Category', 'Section', 'Group'],
    }

    async def parse(self, spec_path: str, dataset: str) -> List[Dict]:
        """
        Parse specification Excel file

        Returns list of variable dictionaries with:
        - variable_name, label, type, length, format
        - sources: [{domain, variable}, ...]
        - algorithm: derivation text
        - category: CDISC category
        """
        # Resolve specification path (support repo-relative paths)
        path_obj = Path(spec_path)
        
        if not path_obj.is_absolute():
            # Path resolution: backend/app/modules/traceability/spec_parser.py
            # parents[0] = traceability/, parents[1] = modules/, parents[2] = app/
            # parents[3] = backend/, parents[4] = ADAM_AI/ (project root)
            project_root = Path(__file__).resolve().parents[4]
            path_obj = (project_root / spec_path).resolve()
            
            # Fallback: try relative to current working directory
            if not path_obj.exists():
                cwd_relative = (Path.cwd() / spec_path).resolve()
                if cwd_relative.exists():
                    path_obj = cwd_relative
                    logger.info(f"Resolved path relative to CWD: {path_obj}")

        logger.info(f"Parsing specification: {path_obj}")

        if not path_obj.exists():
            raise FileNotFoundError(
                f"Specification file not found at '{path_obj}'. "
                f"Check that backend is running and the specification file exists at "
                f"'{spec_path}' relative to project root."
            )

        # Read Excel (try multiple sheet names)
        df = None
        for sheet_name in [dataset, 'Variables', 'Spec', 'Sheet1']:
            try:
                df = pd.read_excel(str(path_obj), sheet_name=sheet_name)
                logger.debug(f"Found sheet: {sheet_name}")
                break
            except ValueError:
                continue
            except Exception as e:
                logger.warning(f"Could not read sheet {sheet_name}: {e}")

        if df is None:
            raise ValueError(f"Could not find {dataset} specification in {path_obj}")

        # Normalize column names
        column_map = self._detect_columns(df.columns)
        logger.debug(f"Detected columns: {column_map}")

        # Parse variables
        variables = []
        for idx, row in df.iterrows():
            var_name = row.get(column_map.get('variable'))
            
            # Skip rows with missing variable names
            if pd.isna(var_name) or not var_name or str(var_name).strip() == '':
                logger.debug(f"Skipping row {idx}: missing variable name")
                continue
            
            # Clean variable name
            var_name = str(var_name).strip()

            # Extract source variables from derivation text
            algorithm_col = column_map.get('algorithm', column_map.get('source', ''))
            derivation = str(row.get(algorithm_col, '')) if algorithm_col else ''
            
            # Handle NaN/None in derivation
            if pd.isna(derivation) or derivation == 'nan':
                derivation = ''
            
            sources = self._extract_sources(derivation, dataset)

            # Categorize variable
            category = self._categorize_variable(var_name, derivation)
            
            # Get label and handle NaN
            label = row.get(column_map.get('label', ''), '')
            if pd.isna(label) or label == 'nan':
                label = ''
            else:
                label = str(label).strip()
            
            # Get type and handle NaN
            var_type = row.get(column_map.get('type', ''), 'Text')
            if pd.isna(var_type) or var_type == 'nan':
                var_type = 'Text'
            else:
                var_type = str(var_type).strip()
            
            # Get length and handle NaN
            length = row.get(column_map.get('length'))
            if pd.isna(length):
                length = None
            elif isinstance(length, (int, float)):
                length = int(length)
            else:
                try:
                    length = int(float(str(length)))
                except (ValueError, TypeError):
                    length = None

            variables.append({
                'variable_name': var_name,
                'label': label,
                'type': var_type,
                'length': length,
                'algorithm': derivation,
                'sources': sources,
                'category': category,
            })

        logger.info(f"Parsed {len(variables)} variables from specification")
        return variables

    def _detect_columns(self, columns: pd.Index) -> Dict[str, str]:
        """Detect column names using fuzzy matching"""
        detected = {}
        for key, variations in self.COLUMN_MAPPINGS.items():
            for col in columns:
                if any(v.lower() in str(col).lower() for v in variations):
                    detected[key] = col
                    break
        return detected

    def _extract_sources(self, derivation_text: str, dataset: str) -> List[Dict]:
        """
        Extract SDTM sources from derivation text

        Patterns:
        - "DM.AGE" → {domain: DM, variable: AGE}
        - "from DM" → {domain: DM, variable: null}
        - "AESTDTC" → infer domain from dataset (AE for ADAE)
        """
        sources = []

        # Pattern 1: DOMAIN.VARIABLE
        domain_var_pattern = r'\b([A-Z]{2})\.([A-Z0-9]+)\b'
        matches = re.findall(domain_var_pattern, derivation_text)
        for domain, var in matches:
            sources.append({'domain': domain, 'variable': var})

        # Pattern 2: "from DOMAIN" or "in DOMAIN"
        domain_pattern = r'\b(?:from|in)\s+([A-Z]{2})\b'
        matches = re.findall(domain_pattern, derivation_text, re.IGNORECASE)
        for domain in matches:
            sources.append({'domain': domain.upper(), 'variable': None})

        # Pattern 3: Infer from dataset (e.g., ADAE uses AE domain)
        if not sources:
            inferred_domain = self._infer_domain(dataset)
            if inferred_domain:
                sources.append({'domain': inferred_domain, 'variable': None})

        return sources

    def _infer_domain(self, dataset: str) -> str:
        """Infer primary SDTM domain from ADAM dataset"""
        domain_map = {
            'ADSL': 'DM',
            'ADAE': 'AE',
            'ADLB': 'LB',
            'ADVS': 'VS',
            'ADCM': 'CM',
        }
        return domain_map.get(dataset.upper(), 'DM')

    def _categorize_variable(self, var_name: str, derivation: str) -> str:
        """Categorize variable based on name and derivation"""
        # Simple heuristic for now
        if var_name in ['STUDYID', 'USUBJID', 'SUBJID']:
            return 'Subject & Study Identifiers'
        elif 'TRT' in var_name:
            return 'Treatment'
        elif var_name.endswith('DT') or var_name.endswith('DTM'):
            return 'Dates and Times'
        elif var_name.endswith('FL'):
            return 'Flags'
        elif 'AGE' in var_name or 'SEX' in var_name or 'RACE' in var_name:
            return 'Demographics'
        else:
            return 'Other Variables'
