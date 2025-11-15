"""
Test Execution Service

Orchestrates execution of ADAM code against test data in sandboxed environments.
Supports R (Docker/local) and SAS (Viya API/local) execution.
"""

import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional
import uuid
from datetime import datetime

from ..models import (
    TestExecutionRequest,
    TestExecutionResult,
    TestStatus,
    ExecutionEnvironment
)
from .r_executor import RExecutor
from .sas_executor import SASExecutor
from .output_capture import OutputCapture

logger = logging.getLogger(__name__)


class TestExecutionService:
    """
    Main service for executing ADAM code in test environments
    """

    def __init__(self):
        self.r_executor = RExecutor()
        self.sas_executor = SASExecutor()
        self.output_capture = OutputCapture()

        # Test execution history
        self.execution_history: Dict[str, TestExecutionResult] = {}

    async def execute_test(
        self,
        request: TestExecutionRequest
    ) -> TestExecutionResult:
        """
        Execute ADAM code against test data

        Workflow:
        1. Validate request and test data availability
        2. Prepare execution environment
        3. Execute code (R or SAS)
        4. Capture output datasets and logs
        5. Return execution result
        """
        test_id = str(uuid.uuid4())
        start_time = datetime.now()

        logger.info(f"Starting test execution: {test_id}")
        logger.info(f"Language: {request.language}, Environment: {request.execution_env}")

        try:
            # Validate test data exists
            test_data_dir = Path("backend/test_data") / request.test_data_id
            if not test_data_dir.exists():
                raise FileNotFoundError(f"Test data not found: {request.test_data_id}")

            # Execute based on language
            if request.language == 'R':
                result = await self._execute_r_code(request, test_id)
            elif request.language == 'SAS':
                result = await self._execute_sas_code(request, test_id)
            else:
                raise ValueError(f"Unsupported language: {request.language}")

            # Calculate duration
            duration = (datetime.now() - start_time).total_seconds()
            result.execution_duration_seconds = duration
            result.test_id = test_id

            # Store in history
            self.execution_history[test_id] = result

            logger.info(f"Test execution completed: {test_id} - Status: {result.status}")
            return result

        except Exception as e:
            logger.error(f"Test execution failed: {test_id} - {str(e)}")

            # Return error result
            error_result = TestExecutionResult(
                test_id=test_id,
                status=TestStatus.ERROR,
                execution_duration_seconds=(datetime.now() - start_time).total_seconds(),
                logs=[],
                errors=[str(e)],
                warnings=[],
            )

            self.execution_history[test_id] = error_result
            return error_result

    async def _execute_r_code(
        self,
        request: TestExecutionRequest,
        test_id: str
    ) -> TestExecutionResult:
        """Execute R code"""

        if request.execution_env == ExecutionEnvironment.DOCKER_R:
            result = await self.r_executor.execute_in_docker(
                code=request.adam_code,
                test_data_id=request.test_data_id,
                test_id=test_id,
                timeout=request.timeout_seconds,
                enable_logging=request.enable_logging,
            )
        elif request.execution_env == ExecutionEnvironment.LOCAL_R:
            result = await self.r_executor.execute_locally(
                code=request.adam_code,
                test_data_id=request.test_data_id,
                test_id=test_id,
                timeout=request.timeout_seconds,
                enable_logging=request.enable_logging,
            )
        else:
            raise ValueError(f"Unsupported R execution environment: {request.execution_env}")

        return result

    async def _execute_sas_code(
        self,
        request: TestExecutionRequest,
        test_id: str
    ) -> TestExecutionResult:
        """Execute SAS code"""

        if request.execution_env == ExecutionEnvironment.SAS_VIYA:
            result = await self.sas_executor.execute_via_viya(
                code=request.adam_code,
                test_data_id=request.test_data_id,
                test_id=test_id,
                timeout=request.timeout_seconds,
                enable_logging=request.enable_logging,
            )
        elif request.execution_env == ExecutionEnvironment.LOCAL_SAS:
            result = await self.sas_executor.execute_locally(
                code=request.adam_code,
                test_data_id=request.test_data_id,
                test_id=test_id,
                timeout=request.timeout_seconds,
                enable_logging=request.enable_logging,
            )
        else:
            raise ValueError(f"Unsupported SAS execution environment: {request.execution_env}")

        return result

    async def get_test_result(self, test_id: str) -> Optional[TestExecutionResult]:
        """Retrieve test execution result by ID"""
        return self.execution_history.get(test_id)

    async def list_test_results(
        self,
        limit: int = 50,
        status_filter: Optional[TestStatus] = None
    ) -> List[TestExecutionResult]:
        """List test execution results with optional filtering"""

        results = list(self.execution_history.values())

        if status_filter:
            results = [r for r in results if r.status == status_filter]

        # Sort by most recent first
        results.sort(key=lambda x: x.test_id, reverse=True)

        return results[:limit]
