"""
Docker Runner for ADAM Generation

Execute R code in Docker containers with health checks and monitoring.
Enhanced with security constraints and progress tracking.
"""

import asyncio
import subprocess
import time
import logging
from pathlib import Path
from typing import Optional, Callable, List, Dict, Any
from dataclasses import dataclass

from .exceptions import DockerUnavailableError, TimeoutError, CodeExecutionError

logger = logging.getLogger(__name__)


@dataclass
class ExecutionResult:
    """Result of Docker execution"""
    success: bool
    exit_code: int
    duration: float
    logs: List[str]
    log_file: str
    output_files: List[str] = None


class DockerRunner:
    """Execute R code in Docker containers with health checks and monitoring"""

    def __init__(self):
        self.docker_available = self._check_docker_availability()
        self.image_manager = DockerImageManager()

    def _check_docker_availability(self) -> bool:
        """Verify Docker daemon is accessible"""
        try:
            result = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            logger.error("Docker not available")
            return False

    async def execute(
        self,
        run_id: str,
        work_dir: Path,
        r_version: str,
        timeout: int,
        memory_limit: Optional[int] = None,
        progress_callback: Optional[Callable[[int], None]] = None
    ) -> ExecutionResult:
        """Execute R program in Docker container"""

        if not self.docker_available:
            raise DockerUnavailableError("Docker daemon not accessible")

        # Get Docker image
        image = await self.image_manager.get_image(r_version)

        # Build Docker command
        docker_cmd = self._build_docker_command(
            image=image,
            work_dir=work_dir,
            memory_limit=memory_limit or 2048
        )

        # Execute with streaming logs
        start_time = time.time()
        logs = []

        process = await asyncio.create_subprocess_exec(
            *docker_cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # Monitor execution with timeout
        try:
            # Track progress based on log output
            progress_tracker = ProgressTracker(progress_callback) if progress_callback else None
            
            # Create tasks for stdout/stderr streaming
            stdout_task = self._stream_logs(
                process.stdout, logs, "stdout", progress_tracker
            )
            stderr_task = self._stream_logs(
                process.stderr, logs, "stderr", progress_tracker
            )

            # Wait for streams to complete
            await asyncio.wait_for(
                asyncio.gather(stdout_task, stderr_task),
                timeout=timeout
            )

            # Wait for process to complete
            exit_code = await process.wait()
            duration = time.time() - start_time
            
            # Final progress update
            if progress_callback:
                progress_callback(100)

            # Save logs
            log_file = work_dir / "logs" / "run.log"
            log_file.parent.mkdir(parents=True, exist_ok=True)
            log_file.write_text("\n".join(logs))

            # Check for output files
            output_dir = work_dir / "output"
            output_files = []
            if output_dir.exists():
                output_files = [str(f) for f in output_dir.glob("*") if f.is_file()]

            return ExecutionResult(
                success=(exit_code == 0),
                exit_code=exit_code,
                duration=duration,
                logs=logs,
                log_file=str(log_file),
                output_files=output_files
            )

        except asyncio.TimeoutError:
            # Kill container gracefully
            await self._kill_container(process)
            raise TimeoutError(f"Execution exceeded {timeout}s timeout")

    def _build_docker_command(
        self,
        image: str,
        work_dir: Path,
        memory_limit: int
    ) -> List[str]:
        """Build Docker run command with security and resource constraints"""
        return [
            "docker", "run",
            "--rm",                                      # Auto-remove
            "--network", "none",                         # No network
            "--memory", f"{memory_limit}m",              # Memory limit
            "--cpus", "2",                               # CPU limit
            "--read-only",                               # Read-only root FS
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=1g",  # Temp storage
            "-v", f"{work_dir / 'input'}:/work/input:ro",  # Input (read-only)
            "-v", f"{work_dir / 'output'}:/work/output:rw", # Output (read-write)
            "-w", "/work",                               # Working directory
            image,
            "Rscript", "/work/input/program.R"
        ]

    async def _stream_logs(
        self,
        stream: asyncio.StreamReader,
        logs: List[str],
        stream_type: str,
        progress_tracker: Optional['ProgressTracker'] = None
    ):
        """Stream logs from stdout/stderr"""
        while True:
            line = await stream.readline()
            if not line:
                break
            decoded = line.decode('utf-8', errors='ignore').strip()
            if decoded:
                logs.append(f"[{stream_type}] {decoded}")
                logger.debug(f"Docker {stream_type}: {decoded}")
                
                # Update progress based on log content (only from stdout to avoid double updates)
                if progress_tracker and stream_type == "stdout":
                    progress_tracker.update(decoded)

    async def _kill_container(self, process):
        """Gracefully terminate Docker container"""
        try:
            process.kill()
            await asyncio.sleep(2)
            # Force kill if still running
            try:
                process.kill()
            except ProcessLookupError:
                pass
        except Exception as e:
            logger.error(f"Error killing container: {e}")


class ProgressTracker:
    """Track execution progress from log output"""
    
    def __init__(self, callback: Optional[Callable[[int], None]]):
        self.callback = callback
        self.last_update = 0
        self.stage = 0  # 0=loading, 1=executing, 2=saving
        
    def update(self, log_line: str):
        """Update progress based on log content"""
        if not self.callback:
            return
            
        log_lower = log_line.lower()
        
        # Detect stage changes
        if "loading sdtm" in log_lower or "found" in log_lower and "sdtm" in log_lower:
            self.stage = 0
            self.callback(10)
        elif "executing user" in log_lower or "user code" in log_lower:
            self.stage = 1
            self.callback(30)
        elif "saving output" in log_lower or "saved" in log_lower:
            self.stage = 2
            self.callback(80)
        elif "completed successfully" in log_lower:
            self.callback(95)
        else:
            # Incremental progress within stage
            current_time = time.time()
            if current_time - self.last_update > 2.0:  # Update every 2 seconds
                if self.stage == 0:
                    self.callback(15)
                elif self.stage == 1:
                    # Estimate progress during execution (30-80%)
                    self.callback(min(50 + int((current_time % 10) * 3), 80))
                self.last_update = current_time


class DockerImageManager:
    """Manage Docker images for different R versions"""

    DEFAULT_R_VERSION = "4.3.2"
    R_VERSION_IMAGES = {
        "4.1.3": "rocker/tidyverse:4.1.3",
        "4.2.3": "rocker/tidyverse:4.2.3",
        "4.3.2": "rocker/tidyverse:4.3.2",  # Default
    }

    async def get_image(self, r_version: str) -> str:
        """Get Docker image for R version"""
        if r_version in self.R_VERSION_IMAGES:
            return self.R_VERSION_IMAGES[r_version]
        
        # Fallback to default
        logger.warning(f"R version {r_version} not found, using default {self.DEFAULT_R_VERSION}")
        return self.R_VERSION_IMAGES[self.DEFAULT_R_VERSION]

