"""
Code Inspector - Analyzes R/SAS code snippets to extract SDTM sources
"""

import re
from typing import Dict, List
from loguru import logger


class CodeInspector:
    """Analyze R/SAS code snippets to extract SDTM sources and operations"""

    async def analyze(self, variable_name: str, snippet: Dict) -> Dict:
        """
        Analyze code snippet to extract:
        - Detected SDTM sources (domains and variables)
        - Operations performed (merge, filter, calculate, format)
        - Data flow (input → transformation → output)
        """
        language = snippet.get('language', 'R')
        code = snippet.get('code', '')

        if language == 'R':
            return await self._analyze_r_code(variable_name, code)
        elif language == 'SAS':
            return await self._analyze_sas_code(variable_name, code)
        else:
            logger.warning(f"Unknown language: {language}")
            return {}

    async def _analyze_r_code(self, var_name: str, code: str) -> Dict:
        """
        Analyze R code snippet

        Patterns to detect:
        - Data sources: dm$AGE, data$STUDYID
        - Merges: left_join(dm, ex, by="USUBJID")
        - Operations: mutate(), case_when(), if_else()
        """
        detected_sources = []
        operations = []

        # Pattern 1: data$VARIABLE or domain$VARIABLE
        var_pattern = r'\b([a-z_]+)\$([A-Z0-9]+)\b'
        matches = re.findall(var_pattern, code)
        for domain, var in matches:
            # Infer SDTM domain from dataframe name
            sdtm_domain = self._infer_sdtm_domain_from_df_name(domain)
            if sdtm_domain:
                detected_sources.append({
                    'domain': sdtm_domain,
                    'variable': var
                })

        # Pattern 2: Merge operations
        merge_pattern = r'\b(left_join|inner_join|full_join|merge)\s*\('
        if re.search(merge_pattern, code):
            operations.append('merge')

        # Pattern 3: dplyr operations
        if 'mutate(' in code:
            operations.append('calculate')
        if 'case_when(' in code or 'if_else(' in code:
            operations.append('conditional')
        if 'filter(' in code:
            operations.append('filter')

        return {
            'detected_sources': detected_sources,
            'operations': operations,
            'language': 'R'
        }

    async def _analyze_sas_code(self, var_name: str, code: str) -> Dict:
        """
        Analyze SAS code snippet

        Patterns to detect:
        - Data sources: SET DM, MERGE DM EX
        - Operations: IF-THEN, LENGTH, FORMAT
        """
        detected_sources = []
        operations = []

        # Pattern 1: SET domain
        set_pattern = r'\bSET\s+([A-Z]+)\b'
        matches = re.findall(set_pattern, code, re.IGNORECASE)
        for domain in matches:
            detected_sources.append({
                'domain': domain.upper(),
                'variable': None
            })

        # Pattern 2: MERGE domains
        merge_pattern = r'\bMERGE\s+((?:[A-Z]+\s*)+)'
        matches = re.findall(merge_pattern, code, re.IGNORECASE)
        for domains_str in matches:
            operations.append('merge')
            for domain in domains_str.split():
                if domain.isupper():
                    detected_sources.append({
                        'domain': domain,
                        'variable': None
                    })

        # Pattern 3: IF-THEN
        if re.search(r'\bIF\s+.+\s+THEN\b', code, re.IGNORECASE):
            operations.append('conditional')

        return {
            'detected_sources': detected_sources,
            'operations': operations,
            'language': 'SAS'
        }

    def _infer_sdtm_domain_from_df_name(self, df_name: str) -> str:
        """Infer SDTM domain from R dataframe name"""
        # Common patterns: dm, dm_data, sdtm_dm, etc.
        df_lower = df_name.lower()

        # Direct match
        if len(df_lower) == 2 and df_lower.isalpha():
            return df_lower.upper()

        # Look for 2-letter domain code
        domain_pattern = r'([a-z]{2})'
        match = re.search(domain_pattern, df_lower)
        if match:
            potential_domain = match.group(1).upper()
            # Common SDTM domains
            if potential_domain in ['DM', 'AE', 'LB', 'VS', 'EX', 'CM', 'DS', 'EC', 'EG', 'IE', 'MH', 'PE', 'SV']:
                return potential_domain

        return None
