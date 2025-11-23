"""
R Execution Service

Main orchestrator for interactive R code execution.
"""

import logging
import hashlib
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime

from .schemas import (
    RExecutionRequest,
    RExecutionResponse,
    RExecutionStatus,
    RExecutionResult,
    RExecutionOutput,
    RunStatus,
    ExecutionMode,
)
from .docker_runner import InteractiveRRunner
from .local_runner import LocalRRunner
from .execution_detector import ExecutionDetector, ExecutionMethod, ExecutionCapabilities
from .output_parser import OutputParser
from .repository import RExecutionRepository

logger = logging.getLogger(__name__)


class RExecutionService:
    """Service layer for R execution with automatic Docker/Local R fallback"""

    def __init__(self, base_path: Optional[Path] = None):
        # Detect available execution methods
        self.capabilities = ExecutionDetector.detect()

        # Initialize runners
        self.docker_runner = InteractiveRRunner()
        self.local_runner = LocalRRunner()
        self.parser = OutputParser()
        self.repository = RExecutionRepository(base_path=base_path)

        # Log available methods
        if self.capabilities.docker_available:
            logger.info("✓ Docker execution available")
        else:
            logger.warning(f"✗ Docker not available: {self.capabilities.docker_error}")

        if self.capabilities.local_r_available:
            logger.info(f"✓ Local R execution available (version {self.capabilities.local_r_version})")
        else:
            logger.warning(f"✗ Local R not available: {self.capabilities.local_r_error}")

        if not self.capabilities.any_available:
            logger.error("⚠️  No R execution method available! Please install Docker or R.")

    def get_capabilities(self) -> ExecutionCapabilities:
        """Get current execution capabilities"""
        return self.capabilities

    @staticmethod
    def generate_run_id() -> str:
        """Generate unique run ID"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"rexec_{timestamp}_{unique_id}"

    def _create_work_directory(self, run_id: str) -> Path:
        """Create working directory for execution"""
        work_dir = Path("Content/Generated/R_Execution/runs") / run_id
        work_dir.mkdir(parents=True, exist_ok=True)

        # Create subdirectories
        (work_dir / "input").mkdir(exist_ok=True)
        (work_dir / "output").mkdir(exist_ok=True)
        (work_dir / "logs").mkdir(exist_ok=True)

        return work_dir

    async def start_execution(
        self,
        request: RExecutionRequest
    ) -> RExecutionResponse:
        """
        Start R code execution

        Returns response with run_id and stream URL
        """
        # Generate run ID
        run_id = self.generate_run_id()

        # Create run record
        await self.repository.create_run(
            run_id=run_id,
            request_params=request.dict()
        )

        logger.info(f"Started R execution run: {run_id}")

        # Return response
        return RExecutionResponse(
            run_id=run_id,
            status=RunStatus.QUEUED,
            message="Execution queued",
            stream_url=f"/api/v1/r-execution/run/{run_id}/stream"
        )

    async def execute(
        self,
        request: RExecutionRequest,
        run_id: Optional[str] = None,
        progress_callback: Optional[callable] = None
    ) -> RExecutionResult:
        """
        Execute R code (main orchestration method)

        This method:
        1. Creates working directory
        2. Executes R code in Docker
        3. Parses outputs
        4. Returns result

        Args:
            request: Execution request
            run_id: Optional run ID (generated if not provided)
            progress_callback: Optional callback(percent, message)

        Returns:
            RExecutionResult with complete outputs
        """
        # Generate run ID if not provided
        if run_id is None:
            run_id = self.generate_run_id()
            await self.repository.create_run(
                run_id=run_id,
                request_params=request.dict()
            )

        try:
            # Update status to running
            await self.repository.update_run(
                run_id=run_id,
                status=RunStatus.RUNNING,
                progress_percent=5,
                current_step="Initializing"
            )

            if progress_callback:
                progress_callback(5, "Initializing execution")

            # Create working directory
            logger.info(f"[{run_id}] Creating workspace")
            work_dir = self._create_work_directory(run_id)

            if progress_callback:
                progress_callback(10, "Workspace created")

            # Check if any execution method is available
            if not self.capabilities.any_available:
                raise RuntimeError(
                    "No R execution method available. Please install either:\n"
                    "1. Docker Desktop (recommended): https://www.docker.com/products/docker-desktop\n"
                    "2. R (https://cran.r-project.org/)"
                )

            # Choose execution method
            use_docker = self.capabilities.docker_available
            runner = self.docker_runner if use_docker else self.local_runner
            execution_method = "Docker" if use_docker else f"Local R {self.capabilities.local_r_version}"

            # Execute R code
            logger.info(f"[{run_id}] Executing R code using {execution_method} (mode={request.mode})")
            await self.repository.update_run(
                run_id=run_id,
                progress_percent=20,
                current_step=f"Executing R code ({execution_method})",
                execution_method=execution_method
            )

            # Progress callback wrapper
            def execution_progress_callback(percent: int, message: str):
                # Map execution progress (0-100) to overall progress (20-80)
                overall_percent = 20 + int(percent * 0.6)
                self.repository.update_run(
                    run_id=run_id,
                    progress_percent=overall_percent,
                    current_step=message
                )
                if progress_callback:
                    progress_callback(overall_percent, message)

            exit_code, duration = await runner.execute(
                run_id=run_id,
                work_dir=work_dir,
                r_code=request.code,
                r_version=request.r_version,
                mode=request.mode,
                timeout=request.timeout_seconds,
                memory_limit=request.memory_limit_mb,
                capture_plots=request.capture_plots,
                progress_callback=execution_progress_callback
            )

            # Parse outputs
            logger.info(f"[{run_id}] Parsing outputs")
            await self.repository.update_run(
                run_id=run_id,
                progress_percent=85,
                current_step="Parsing outputs"
            )

            if progress_callback:
                progress_callback(85, "Parsing outputs")

            output: RExecutionOutput = self.parser.parse_output_directory(
                work_dir / "output"
            )

            # Determine final status
            if exit_code == 0:
                final_status = RunStatus.SUCCEEDED
            elif exit_code == 124:  # Timeout
                final_status = RunStatus.TIMEOUT
            else:
                final_status = RunStatus.FAILED

            # Update run record
            logger.info(f"[{run_id}] Execution {final_status.value}")
            await self.repository.update_run(
                run_id=run_id,
                status=final_status,
                progress_percent=100,
                current_step="Complete",
                error_message=output.error_message if final_status == RunStatus.FAILED else None,
                execution_duration=duration
            )

            if progress_callback:
                progress_callback(100, "Complete")

            # Build result
            code_hash = hashlib.sha256(request.code.encode()).hexdigest()[:16]

            result = RExecutionResult(
                run_id=run_id,
                status=final_status,
                mode=request.mode,
                r_version=request.r_version,
                code_hash=code_hash,
                execution_duration=duration,
                output=output,
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow()
            )

            return result

        except Exception as e:
            logger.error(f"[{run_id}] Execution failed with exception: {e}", exc_info=True)

            # Update run as failed
            await self.repository.update_run(
                run_id=run_id,
                status=RunStatus.FAILED,
                error_message=str(e),
                progress_percent=100,
                current_step="Failed"
            )

            # Create error output
            error_output = RExecutionOutput(
                stdout=[],
                stderr=[f"Execution error: {str(e)}"],
                exit_code=1,
                error_message=str(e)
            )

            code_hash = hashlib.sha256(request.code.encode()).hexdigest()[:16]

            return RExecutionResult(
                run_id=run_id,
                status=RunStatus.FAILED,
                mode=request.mode,
                r_version=request.r_version,
                code_hash=code_hash,
                execution_duration=0.0,
                output=error_output,
                started_at=datetime.utcnow(),
                finished_at=datetime.utcnow()
            )

    async def get_status(self, run_id: str) -> Optional[RExecutionStatus]:
        """Get execution status"""
        metadata = await self.repository.get_run(run_id)

        if not metadata:
            return None

        # Parse timestamps
        started_at_str = metadata.get("started_at")
        finished_at_str = metadata.get("finished_at")

        started_at = None
        if started_at_str:
            started_at = datetime.fromisoformat(started_at_str.replace('Z', '+00:00'))

        finished_at = None
        if finished_at_str:
            finished_at = datetime.fromisoformat(finished_at_str.replace('Z', '+00:00'))

        # Get request params
        request_params = metadata.get("request_params", {})

        return RExecutionStatus(
            run_id=run_id,
            status=RunStatus(metadata["status"]),
            mode=ExecutionMode(request_params.get("mode", "interactive")),
            r_version=request_params.get("r_version", "4.3.2"),
            progress_percent=metadata.get("progress_percent", 0),
            current_step=metadata.get("current_step", "Unknown"),
            started_at=started_at or datetime.utcnow(),
            finished_at=finished_at,
            duration_seconds=metadata.get("duration_seconds"),
            error_message=metadata.get("error_message")
        )

    async def get_result(self, run_id: str) -> Optional[RExecutionResult]:
        """Get complete execution result (only for completed runs)"""
        status = await self.get_status(run_id)

        if not status:
            return None

        if status.status not in [RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.TIMEOUT]:
            return None

        # Parse outputs
        work_dir = Path("Content/Generated/R_Execution/runs") / run_id
        output_dir = work_dir / "output"

        if not output_dir.exists():
            return None

        output = self.parser.parse_output_directory(output_dir)

        # Get metadata
        metadata = await self.repository.get_run(run_id)
        request_params = metadata.get("request_params", {})

        code_hash = hashlib.sha256(request_params.get("code", "").encode()).hexdigest()[:16]

        return RExecutionResult(
            run_id=run_id,
            status=status.status,
            mode=status.mode,
            r_version=status.r_version,
            code_hash=code_hash,
            execution_duration=status.duration_seconds or 0.0,
            output=output,
            started_at=status.started_at,
            finished_at=status.finished_at or datetime.utcnow()
        )

    async def cancel_execution(self, run_id: str) -> bool:
        """Cancel a running execution"""
        status = await self.get_status(run_id)

        if not status or status.status not in [RunStatus.QUEUED, RunStatus.RUNNING]:
            return False

        # Update status to canceled
        await self.repository.update_run(
            run_id=run_id,
            status=RunStatus.CANCELED,
            error_message="Execution canceled by user"
        )

        logger.info(f"Canceled execution: {run_id}")
        return True
