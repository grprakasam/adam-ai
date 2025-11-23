"""
Interactive R Docker Runner

Executes R code in Docker containers with minimal wrapping.
Captures stdout, stderr, plots, and data frames.
"""

import asyncio
import subprocess
import time
import logging
from pathlib import Path
from typing import Optional, Callable

from .schemas import ExecutionMode

logger = logging.getLogger(__name__)


class InteractiveRRunner:
    """Execute R code in Docker with output capture"""

    # Docker images for R versions
    R_IMAGES = {
        "4.1.3": "rocker/tidyverse:4.1.3",
        "4.2.3": "rocker/tidyverse:4.2.3",
        "4.3.2": "rocker/tidyverse:4.3.2",
        "4.4.0": "rocker/tidyverse:4.4.0",
    }
    DEFAULT_VERSION = "4.3.2"

    def __init__(self):
        self.docker_available = self._check_docker()

    def _check_docker(self) -> bool:
        """Check if Docker is available"""
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
        r_code: str,
        r_version: str,
        mode: ExecutionMode,
        timeout: int,
        memory_limit: int,
        capture_plots: bool = True,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> tuple[int, float]:
        """
        Execute R code in Docker container

        Args:
            run_id: Unique run identifier
            work_dir: Working directory for execution
            r_code: R code to execute
            r_version: R version to use
            mode: Execution mode (interactive or adam)
            timeout: Timeout in seconds
            memory_limit: Memory limit in MB
            capture_plots: Whether to capture plots
            progress_callback: Optional callback for progress updates

        Returns:
            (exit_code, duration)
        """
        if not self.docker_available:
            raise RuntimeError("Docker daemon not accessible")

        # Prepare working directory
        input_dir = work_dir / "input"
        output_dir = work_dir / "output"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        # Wrap R code based on mode
        if mode == ExecutionMode.INTERACTIVE:
            wrapped_code = self._wrap_interactive_code(r_code, capture_plots)
        else:
            # ADAM mode - use existing wrapping (future enhancement)
            wrapped_code = self._wrap_interactive_code(r_code, capture_plots)

        # Write wrapped code
        code_file = input_dir / "program.R"
        code_file.write_text(wrapped_code, encoding='utf-8')

        # Get Docker image
        image = self.R_IMAGES.get(r_version, self.R_IMAGES[self.DEFAULT_VERSION])

        # Build Docker command
        docker_cmd = self._build_docker_command(
            image=image,
            work_dir=work_dir,
            memory_limit=memory_limit,
            timeout=timeout
        )

        # Execute
        logger.info(f"[{run_id}] Starting Docker execution with {image}")
        if progress_callback:
            progress_callback(10, "Starting Docker container")

        start_time = time.time()
        exit_code = 0

        try:
            # Run Docker command
            process = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            # Monitor execution
            stdout_task = self._stream_output(
                process.stdout, work_dir / "logs" / "docker_stdout.log"
            )
            stderr_task = self._stream_output(
                process.stderr, work_dir / "logs" / "docker_stderr.log"
            )

            # Wait for completion with timeout
            if progress_callback:
                progress_callback(30, "Executing R code")

            try:
                await asyncio.wait_for(
                    asyncio.gather(stdout_task, stderr_task),
                    timeout=timeout
                )

                # Get exit code
                exit_code = await process.wait()

            except asyncio.TimeoutError:
                logger.error(f"[{run_id}] Execution timeout after {timeout}s")
                process.kill()
                await process.wait()
                exit_code = 124  # Timeout exit code

                # Write timeout indicator
                (output_dir / "exit_code.txt").write_text("124")
                (output_dir / "stderr.txt").write_text(
                    f"Execution timeout after {timeout} seconds\n"
                )

            duration = time.time() - start_time

            # Write exit code
            (output_dir / "exit_code.txt").write_text(str(exit_code))

            if progress_callback:
                if exit_code == 0:
                    progress_callback(90, "Execution completed successfully")
                else:
                    progress_callback(90, f"Execution failed with exit code {exit_code}")

            logger.info(f"[{run_id}] Execution completed in {duration:.2f}s with exit code {exit_code}")
            return exit_code, duration

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"[{run_id}] Execution error: {e}", exc_info=True)

            # Write error
            (output_dir / "exit_code.txt").write_text("1")
            (output_dir / "stderr.txt").write_text(f"Docker execution error: {str(e)}\n")

            return 1, duration

    def _wrap_interactive_code(self, user_code: str, capture_plots: bool) -> str:
        """
        Wrap user code with minimal output capture

        This wrapper:
        - Redirects stdout/stderr to files
        - Captures plots if requested
        - Saves data frames metadata
        - Minimal dependencies
        """
        plot_setup = """
# Enable plot capture
png(filename="/work/output/plot_%03d.png", width=800, height=600, res=100)
par(bg="white")
""" if capture_plots else ""

        plot_cleanup = """
# Close plot device
if (length(dev.list()) > 0) {
    dev.off()
}
""" if capture_plots else ""

        wrapped = f"""#!/usr/bin/env Rscript
# Interactive R Execution Wrapper
# Auto-generated by ADAM AI

# Redirect output
stdout_file <- "/work/output/stdout.txt"
stderr_file <- "/work/output/stderr.txt"

sink(file=stdout_file, type="output")
sink(file=stderr_file, type="message")

# Print session start
cat("=== R Session Started ===\\n")
cat("R version:", as.character(getRversion()), "\\n")
cat("Platform:", R.version$platform, "\\n")
cat("Working directory:", getwd(), "\\n\\n")

{plot_setup}

# Error handling
tryCatch({{

    # User code starts here
{self._indent_code(user_code, 4)}
    # User code ends here

    cat("\\n=== Execution Completed Successfully ===\\n")

}}, error = function(e) {{
    cat("\\n=== ERROR OCCURRED ===\\n", file=stderr())
    cat("Error message:", e$message, "\\n", file=stderr())
    cat("Error class:", class(e)[1], "\\n", file=stderr())
    if (!is.null(e$call)) {{
        cat("Error in call:\\n", file=stderr())
        print(e$call, file=stderr())
    }}

    # Print traceback
    cat("\\nTraceback:\\n", file=stderr())
    traceback_lines <- capture.output(traceback())
    cat(paste(traceback_lines, collapse="\\n"), "\\n", file=stderr())

    quit(status=1)
}}, warning = function(w) {{
    cat("Warning:", w$message, "\\n", file=stderr())
    invokeRestart("muffleWarning")
}})

{plot_cleanup}

# Try to save data frame metadata
tryCatch({{
    # Find all data frames in global environment
    all_objects <- ls(envir=.GlobalEnv)
    data_frames <- list()

    for (obj_name in all_objects) {{
        obj <- get(obj_name, envir=.GlobalEnv)
        if (is.data.frame(obj)) {{
            df_info <- list(
                name = obj_name,
                rows = nrow(obj),
                columns = ncol(obj),
                column_names = names(obj),
                preview_rows = if (nrow(obj) > 0) {{
                    head(obj, min(10, nrow(obj)))
                }} else {{
                    list()
                }}
            )
            data_frames[[length(data_frames) + 1]] <- df_info

            # Also save as CSV
            csv_file <- file.path("/work/output", paste0(obj_name, ".csv"))
            write.csv(obj, csv_file, row.names=FALSE)
            cat("Saved data frame:", obj_name, "to", csv_file, "\\n")
        }}
    }}

    # Save metadata as JSON
    if (length(data_frames) > 0) {{
        library(jsonlite)
        json_file <- "/work/output/data_frames.json"
        write_json(data_frames, json_file, auto_unbox=TRUE, pretty=TRUE)
        cat("Saved data frame metadata to", json_file, "\\n")
    }}

}}, error = function(e) {{
    cat("Note: Could not save data frame metadata:", e$message, "\\n", file=stderr())
}})

# Print session info
cat("\\n=== Session Info ===\\n")
print(sessionInfo())

# Close sinks
sink(type="message")
sink(type="output")

# Exit successfully
quit(status=0)
"""
        return wrapped

    def _indent_code(self, code: str, spaces: int) -> str:
        """Indent code by specified number of spaces"""
        indent = " " * spaces
        lines = code.split("\n")
        indented = [indent + line if line.strip() else "" for line in lines]
        return "\n".join(indented)

    def _build_docker_command(
        self,
        image: str,
        work_dir: Path,
        memory_limit: int,
        timeout: int
    ) -> list[str]:
        """Build Docker run command with security constraints"""
        return [
            "docker", "run",
            "--rm",  # Auto-remove container
            "--network", "none",  # No network access
            "--memory", f"{memory_limit}m",  # Memory limit
            "--cpus", "2",  # CPU limit
            "--read-only",  # Read-only root filesystem
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=1g",  # Temp storage
            "-v", f"{work_dir / 'input'}:/work/input:ro",  # Input (read-only)
            "-v", f"{work_dir / 'output'}:/work/output:rw",  # Output (read-write)
            "-v", f"{work_dir / 'logs'}:/work/logs:rw",  # Logs (read-write)
            "-w", "/work",  # Working directory
            image,
            "Rscript", "/work/input/program.R"
        ]

    async def _stream_output(self, stream: asyncio.StreamReader, log_file: Path):
        """Stream output from Docker to log file"""
        log_file.parent.mkdir(parents=True, exist_ok=True)

        with open(log_file, 'w', encoding='utf-8') as f:
            while True:
                line = await stream.readline()
                if not line:
                    break
                decoded = line.decode('utf-8', errors='replace')
                f.write(decoded)
                f.flush()
