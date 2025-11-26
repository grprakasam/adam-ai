"""
R Code Executor

Executes R code in Docker containers or locally for test execution.
Provides sandboxed execution environment with timeout and resource limits.
"""

import asyncio
import subprocess
import sys
import os
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional
import logging
import json

from ..models import TestExecutionResult, TestStatus

logger = logging.getLogger(__name__)


class RExecutor:
    """
    Executes R code in sandboxed environments
    """

    def __init__(self):
        self.docker_image = "rocker/tidyverse:latest"  # Pre-installed tidyverse
        self.output_dir = Path("backend/test_outputs")
        self.output_dir.mkdir(parents=True, exist_ok=True)

    async def execute_in_docker(
        self,
        code: str,
        test_data_id: str,
        test_id: str,
        timeout: int = 300,
        enable_logging: bool = True,
    ) -> TestExecutionResult:
        """
        Execute R code in Docker container

        Strategy:
        1. Create temporary directory for execution context
        2. Write R code to script file
        3. Mount test data and script into Docker container
        4. Run Docker container with resource limits
        5. Capture stdout/stderr logs
        6. Copy output datasets from container
        7. Clean up container and temp files
        """

        logger.info(f"Executing R code in Docker for test: {test_id}")

        # Create temporary execution directory
        # Use project-specific temp directory for Windows/Docker Desktop compatibility
        if sys.platform == 'win32':
            # On Windows, avoid Path.resolve()/absolute() which can raise NotImplementedError.
            # __file__ is at: backend/app/modules/testing/test_execution/r_executor.py
            # parents[5] should be the project root, parents[4] the backend directory.
            try:
                backend_dir = Path(__file__).parents[5] / "backend"
            except IndexError:
                # Fallback: assume current working directory contains backend/
                backend_dir = Path.cwd() / "backend"

            project_temp_dir = backend_dir / "temp_executions"
            project_temp_dir.mkdir(parents=True, exist_ok=True)

            temp_dir = tempfile.mkdtemp(dir=str(project_temp_dir))
            temp_path = Path(temp_dir)
        else:
            # On Unix systems, use system temp
            temp_dir = tempfile.mkdtemp()
            temp_path = Path(temp_dir)

        try:
            # Paths
            test_data_path = Path("backend/test_data") / test_data_id
            script_path = temp_path / "test_script.R"
            output_path = temp_path / "output"
            output_path.mkdir(exist_ok=True)

            # Prepare R script with data loading and execution
            full_script = self._prepare_r_script(
                code=code,
                test_data_path="/data",  # Path inside container
                output_path="/output",   # Path inside container
                test_data_id=test_data_id,
            )

            # Write script
            script_path.write_text(full_script)

            # Convert host paths to Docker-compatible mount paths
            def to_docker_path(path: Path) -> str:
                """Convert host path to Docker-compatible path without using resolve()/absolute()."""
                if sys.platform == 'win32':
                    import os

                    path_str = str(path)
                    try:
                        path_str = os.path.abspath(path_str)
                    except Exception:
                        # Fall back to the raw string if abspath fails
                        pass

                    # Docker Desktop on Windows needs forward slashes and drive letter conversion
                    # e.g., C:\Users\... becomes /c/Users/...
                    path_str = path_str.replace('\\', '/')
                    if len(path_str) > 1 and path_str[1] == ':':
                        # Convert C:/ to /c/
                        path_str = '/' + path_str[0].lower() + path_str[2:]
                    return path_str
                else:
                    # On Unix-like systems, normal absolute paths with forward slashes work fine.
                    try:
                        return str(path.resolve())
                    except Exception:
                        return str(path)

            # Build Docker command
            # On Windows, mount entire temp directory to avoid file access permission issues
            docker_cmd = [
                "docker", "run",
                "--rm",  # Remove container after execution
                "-v", f"{to_docker_path(temp_path)}:/workspace:rw",  # Mount entire temp directory (read-write)
            ]
            
            # Mount test data if it exists
            if test_data_path.exists():
                docker_cmd.extend([
                    "-v", f"{to_docker_path(test_data_path)}:/data:ro",  # Mount test data (read-only)
                ])
            
            docker_cmd.extend([
                "--memory", "2g",  # Limit memory to 2GB
                "--cpus", "2",     # Limit to 2 CPUs
                "--network", "none",  # No network access (security)
                self.docker_image,
                "Rscript", "/workspace/test_script.R"  # Use path inside mounted workspace
            ])

            logs = []
            errors = []
            warnings_list = []

            try:
                # Execute Docker container with timeout
                # On Windows, use shell to avoid NotImplementedError issues
                if sys.platform == 'win32':
                    # Convert paths to Windows format and escape properly for shell
                    cmd_str_parts = []
                    for arg in docker_cmd:
                        arg_str = str(arg)
                        # Escape paths with spaces
                        if ' ' in arg_str or '/' in arg_str or '\\' in arg_str:
                            cmd_str_parts.append(f'"{arg_str}"')
                        else:
                            cmd_str_parts.append(arg_str)
                    cmd_str = ' '.join(cmd_str_parts)
                    logger.debug(f"Docker command (Windows shell): {cmd_str}")
                    process = await asyncio.create_subprocess_shell(
                        cmd_str,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                else:
                    # On Unix-like systems, use exec
                    process = await asyncio.create_subprocess_exec(
                        *docker_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )

                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(),
                        timeout=timeout
                    )

                    # Parse logs
                    if stdout:
                        logs = stdout.decode('utf-8', errors='ignore').split('\n')

                    if stderr:
                        stderr_text = stderr.decode('utf-8', errors='ignore')
                        # Separate warnings from errors in R output
                        for line in stderr_text.split('\n'):
                            if 'warning' in line.lower():
                                warnings_list.append(line)
                            elif line.strip():
                                errors.append(line)

                    # Check exit code
                    if process.returncode == 0:
                        status = TestStatus.PASSED
                        logger.info(f"R execution successful: {test_id}")
                    else:
                        status = TestStatus.FAILED
                        logger.warning(f"R execution failed with code {process.returncode}: {test_id}")

                except asyncio.TimeoutError:
                    # Kill the process
                    process.kill()
                    await process.wait()
                    status = TestStatus.ERROR
                    errors.append(f"Execution timeout after {timeout} seconds")
                    logger.error(f"R execution timeout: {test_id}")

                # Copy output files to permanent location
                output_dataset_path = None
                if status == TestStatus.PASSED:
                    output_dataset_path = await self._capture_output(output_path, test_id)

                result = TestExecutionResult(
                    test_id=test_id,
                    status=status,
                    execution_duration_seconds=0,  # Will be set by service
                    output_dataset_path=output_dataset_path,
                    logs=logs if enable_logging else [],
                    errors=errors,
                    warnings=warnings_list,
                )

            except Exception as e:
                logger.error(f"Docker execution error: {test_id} - {str(e)}")
                result = TestExecutionResult(
                    test_id=test_id,
                    status=TestStatus.ERROR,
                    execution_duration_seconds=0,
                    logs=logs,
                    errors=[str(e)] + errors,
                    warnings=warnings_list,
                )
            
            return result
            
        finally:
            # Clean up temporary directory
            if temp_dir and Path(temp_dir).exists():
                try:
                    shutil.rmtree(temp_dir)
                    logger.debug(f"Cleaned up temp directory: {temp_dir}")
                except Exception as cleanup_error:
                    logger.warning(f"Failed to cleanup temp directory {temp_dir}: {cleanup_error}")

    async def execute_locally(
        self,
        code: str,
        test_data_id: str,
        test_id: str,
        timeout: int = 300,
        enable_logging: bool = True,
    ) -> TestExecutionResult:
        """
        Execute R code locally (without Docker)

        Note: Less secure than Docker execution, but faster for development
        """

        logger.info(f"Executing R code locally for test: {test_id}")

        # Create temporary execution directory
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Paths
            test_data_path = Path("backend/test_data") / test_data_id
            script_path = temp_path / "test_script.R"
            output_path = temp_path / "output"
            output_path.mkdir(exist_ok=True)

            # Prepare R script
            full_script = self._prepare_r_script(
                code=code,
                test_data_path=str(test_data_path.absolute()),
                output_path=str(output_path.absolute()),
                test_data_id=test_data_id,
            )

            # Write script
            script_path.write_text(full_script)

            logs = []
            errors = []
            warnings_list = []

            try:
                # Execute R script
                # On Windows, use shell to avoid NotImplementedError issues
                if sys.platform == 'win32':
                    # Escape path properly for shell
                    script_path_str = str(script_path)
                    if ' ' in script_path_str:
                        script_path_str = f'"{script_path_str}"'
                    cmd_str = f'Rscript {script_path_str}'
                    logger.debug(f"R command (Windows shell): {cmd_str}")
                    process = await asyncio.create_subprocess_shell(
                        cmd_str,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )
                else:
                    # On Unix-like systems, use exec
                    process = await asyncio.create_subprocess_exec(
                        "Rscript", str(script_path),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                    )

                try:
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(),
                        timeout=timeout
                    )

                    # Parse logs
                    if stdout:
                        logs = stdout.decode('utf-8', errors='ignore').split('\n')

                    if stderr:
                        stderr_text = stderr.decode('utf-8', errors='ignore')
                        for line in stderr_text.split('\n'):
                            if 'warning' in line.lower():
                                warnings_list.append(line)
                            elif line.strip():
                                errors.append(line)

                    # Check exit code
                    if process.returncode == 0:
                        status = TestStatus.PASSED
                    else:
                        status = TestStatus.FAILED

                except asyncio.TimeoutError:
                    process.kill()
                    await process.wait()
                    status = TestStatus.ERROR
                    errors.append(f"Execution timeout after {timeout} seconds")

                # Capture output
                output_dataset_path = None
                if status == TestStatus.PASSED:
                    output_dataset_path = await self._capture_output(output_path, test_id)

                return TestExecutionResult(
                    test_id=test_id,
                    status=status,
                    execution_duration_seconds=0,
                    output_dataset_path=output_dataset_path,
                    logs=logs if enable_logging else [],
                    errors=errors,
                    warnings=warnings_list,
                )

            except Exception as e:
                logger.error(f"Local R execution error: {test_id} - {str(e)}")
                return TestExecutionResult(
                    test_id=test_id,
                    status=TestStatus.ERROR,
                    execution_duration_seconds=0,
                    logs=logs,
                    errors=[str(e)] + errors,
                    warnings=warnings_list,
                )

    def _prepare_r_script(
        self,
        code: str,
        test_data_path: str,
        output_path: str,
        test_data_id: str,
    ) -> str:
        """
        Prepare complete R script with data loading and execution

        Structure:
        1. Load required libraries
        2. Load test data from CSV files
        3. Execute user's ADAM code
        4. Save output datasets
        5. Error handling
        """

        script = f"""
# ============================================
# ADAM AI Test Execution Script
# Test Data ID: {test_data_id}
# ============================================

# Load required libraries
library(tidyverse)
library(haven)  # For SAS dataset support

# Set options
options(warn = 1)  # Print warnings as they occur
options(stringsAsFactors = FALSE)

# Error handling
tryCatch({{

    # ========== LOAD TEST DATA ==========
    cat("Loading test data from:", "{test_data_path}", "\\n")

    # List available CSV files
    data_files <- list.files("{test_data_path}", pattern = "\\\\.csv$", full.names = TRUE)
    cat("Found", length(data_files), "test data files\\n")

    # Load each domain into a named list
    sdtm <- list()
    for (file in data_files) {{
        domain_name <- tools::file_path_sans_ext(basename(file))
        # Remove test_data_id prefix if present
        domain_name <- gsub("^{test_data_id}_", "", domain_name)

        cat("Loading domain:", domain_name, "\\n")
        sdtm[[domain_name]] <- read_csv(file, show_col_types = FALSE)

        # Print dataset info
        cat("  -", nrow(sdtm[[domain_name]]), "rows,", ncol(sdtm[[domain_name]]), "columns\\n")
    }}

    # Make individual domain datasets available in global environment
    # (Some ADAM code expects DM, AE, etc. as separate objects)
    for (domain_name in names(sdtm)) {{
        assign(domain_name, sdtm[[domain_name]], envir = .GlobalEnv)
    }}

    # ========== EXECUTE ADAM CODE ==========
    cat("\\nExecuting ADAM code...\\n")

    {code}

    cat("ADAM code execution completed successfully\\n")

    # ========== SAVE OUTPUT ==========
    cat("\\nSaving output datasets...\\n")

    # Detect ADAM datasets (typically named ADSL, ADAE, ADLB, etc.)
    adam_datasets <- ls(pattern = "^AD", envir = .GlobalEnv)

    if (length(adam_datasets) == 0) {{
        warning("No ADAM datasets found (expected names starting with 'AD')")
    }} else {{
        for (ds_name in adam_datasets) {{
            ds <- get(ds_name, envir = .GlobalEnv)

            # Save as CSV
            output_file <- file.path("{output_path}", paste0(ds_name, ".csv"))
            write_csv(ds, output_file)
            cat("Saved:", ds_name, "to", output_file, "\\n")

            # Also save as RDS for R-specific features
            rds_file <- file.path("{output_path}", paste0(ds_name, ".rds"))
            saveRDS(ds, rds_file)
        }}
    }}

    cat("\\nTest execution completed successfully\\n")

}}, error = function(e) {{
    cat("ERROR:", conditionMessage(e), "\\n")
    quit(status = 1)
}})
"""
        return script

    async def _capture_output(self, output_path: Path, test_id: str) -> Optional[str]:
        """
        Capture output datasets and move to permanent storage

        Returns path to primary output dataset (typically ADSL, ADAE, or ADLB)
        """

        # Create permanent output directory for this test
        perm_output_dir = self.output_dir / test_id
        perm_output_dir.mkdir(parents=True, exist_ok=True)

        # Copy all output files
        output_files = list(output_path.glob("*.csv"))

        if not output_files:
            logger.warning(f"No output files found for test: {test_id}")
            return None

        primary_dataset = None

        for file in output_files:
            dest = perm_output_dir / file.name
            shutil.copy(file, dest)
            logger.info(f"Captured output: {file.name}")

            # Identify primary dataset (ADSL, ADAE, ADLB, etc.)
            if file.stem in ['ADSL', 'ADAE', 'ADLB']:
                primary_dataset = str(dest)

        # Return primary dataset path or first output file
        return primary_dataset or str(perm_output_dir / output_files[0].name)
