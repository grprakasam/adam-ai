"""
R Execution Module

Interactive R code execution with automatic Docker/Local R fallback.
Supports both interactive REPL-style execution and ADAM-mode execution.

Execution Methods:
- Docker (preferred): Isolated, consistent, multi-version support
- Local R (fallback): Uses installed R when Docker unavailable
"""

from .schemas import (
    RExecutionRequest,
    RExecutionResponse,
    RExecutionStatus,
    RExecutionOutput,
    RExecutionResult,
    ExecutionMode,
    RunStatus,
)
from .service import RExecutionService
from .docker_runner import InteractiveRRunner
from .local_runner import LocalRRunner
from .execution_detector import ExecutionDetector, ExecutionMethod, ExecutionCapabilities
from .output_parser import OutputParser

__all__ = [
    "RExecutionRequest",
    "RExecutionResponse",
    "RExecutionStatus",
    "RExecutionOutput",
    "RExecutionResult",
    "ExecutionMode",
    "RunStatus",
    "RExecutionService",
    "InteractiveRRunner",
    "LocalRRunner",
    "ExecutionDetector",
    "ExecutionMethod",
    "ExecutionCapabilities",
    "OutputParser",
]
