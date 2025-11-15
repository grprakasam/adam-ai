"""
Traceability Module

Generates SDTM-ADaM traceability matrix with lineage visualization.
Addresses FDA SDTCG §4.1.2.8 requirements.
"""

from .models import (
    TraceabilityMatrix,
    TraceabilityVariable,
    SourceVariable,
    DerivationStep,
    CodeReference,
    AIInsight,
    TraceabilityGenerationRequest
)
from .service import TraceabilityService

__all__ = [
    'TraceabilityMatrix',
    'TraceabilityVariable',
    'SourceVariable',
    'DerivationStep',
    'CodeReference',
    'AIInsight',
    'TraceabilityGenerationRequest',
    'TraceabilityService'
]
