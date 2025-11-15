"""
AI Analyzer - Generates AI-powered insights for traceability variables
"""

from typing import Dict, List
from loguru import logger
from .models import TraceabilityVariable, AIInsight


class AIAnalyzer:
    """AI-powered analysis of traceability variables"""

    async def analyze_variable(
        self,
        variable: TraceabilityVariable
    ) -> AIInsight:
        """
        Generate AI insights for variable

        Checks:
        1. Anomaly detection (unusual patterns)
        2. CDISC compliance suggestions
        3. Similar patterns from public ADAM programs
        """

        anomalies = []
        suggestions = []
        similar_patterns = []
        confidence_factors = {}

        # Check 1: Variable naming convention
        naming_check = self._check_naming_convention(variable)
        if naming_check:
            anomalies.append(naming_check)
            confidence_factors['naming'] = 0.7
        else:
            confidence_factors['naming'] = 1.0

        # Check 2: Unusual source domains
        source_check = self._check_unusual_sources(variable)
        if source_check:
            anomalies.append(source_check)
            confidence_factors['sources'] = 0.8
        else:
            confidence_factors['sources'] = 1.0

        # Check 3: Missing rule references
        if not variable.rule_refs and variable.category != 'Other Variables':
            suggestions.append({
                'title': 'Missing ADAM IG Rule Reference',
                'rationale': f'Variable {variable.variable_name} in category "{variable.category}" should reference ADAM IG rules.'
            })

        # Check 4: Low confidence
        if variable.confidence < 0.6:
            suggestions.append({
                'title': 'Low Confidence Score',
                'rationale': 'Consider adding code snippet or clarifying derivation logic to improve traceability confidence.'
            })

        # Check 5: Similar patterns
        similar_patterns = self._find_similar_patterns(variable)

        return AIInsight(
            anomalies=anomalies,
            suggestions=suggestions,
            similar_patterns=similar_patterns,
            confidence_factors=confidence_factors
        )

    def _check_naming_convention(self, variable: TraceabilityVariable) -> Dict | None:
        """Check ADAM naming conventions"""
        var_name = variable.variable_name

        # DT suffix should be numeric date
        if var_name.endswith('DT'):
            if variable.data_type not in ['Numeric', 'Num', 'NUM']:
                return {
                    'title': 'Naming Convention Violation',
                    'description': f'{var_name} ends with DT but is not Numeric type.'
                }

        # DTM suffix should be numeric datetime
        if var_name.endswith('DTM'):
            if variable.data_type not in ['Numeric', 'Num', 'NUM']:
                return {
                    'title': 'Naming Convention Violation',
                    'description': f'{var_name} ends with DTM but is not Numeric type.'
                }

        # FL suffix should be character flag
        if var_name.endswith('FL'):
            if variable.data_type not in ['Character', 'Char', 'CHAR', 'Text']:
                return {
                    'title': 'Naming Convention Violation',
                    'description': f'{var_name} ends with FL but is not Character type.'
                }

        return None

    def _check_unusual_sources(self, variable: TraceabilityVariable) -> Dict | None:
        """Detect unusual SDTM source patterns"""
        # Expected source domains by category
        expected_sources = {
            'Demographics': ['DM'],
            'Treatment': ['EX', 'EC'],
            'Disposition': ['DS'],
            'Subject & Study Identifiers': ['DM'],
        }

        expected = expected_sources.get(variable.category, [])
        actual = [s.domain for s in variable.sources]

        if expected and not any(d in actual for d in expected):
            return {
                'title': 'Unusual Source Domain',
                'description': f'{variable.category} variables typically use {", ".join(expected)} domains, but {variable.variable_name} uses {", ".join(actual)}.'
            }

        return None

    def _find_similar_patterns(self, variable: TraceabilityVariable) -> List[str]:
        """Find similar derivation patterns"""
        patterns = []

        if variable.variable_name.startswith('TRT'):
            patterns.append('Similar pattern in CDISC Pilot Study: TRT01P derived from first dose in EX')
            patterns.append('PhUSE Standard Scripts: Treatment variables use EXSTDTC for start date')

        if variable.variable_name == 'USUBJID':
            patterns.append('CDISC Standard: USUBJID formed by concatenating STUDYID and SUBJID')

        if variable.variable_name.endswith('FL'):
            patterns.append('ADaM IG: Flag variables should have values "Y" or null')

        return patterns
