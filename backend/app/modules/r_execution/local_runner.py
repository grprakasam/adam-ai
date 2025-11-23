"""
Local R Runner

Executes R code using locally installed R (fallback when Docker unavailable).
"""

import asyncio
import subprocess
import time
import logging
import shutil
from pathlib import Path
from typing import Optional, Callable

from .schemas import ExecutionMode

logger = logging.getLogger(__name__)


class LocalRRunner:
    """Execute R code using local R installation"""

    def __init__(self):
        self.r_available = self._check_r_available()
        self.rscript_path = self._find_rscript()

    def _check_r_available(self) -> bool:
        """Check if R/Rscript is available"""
        return shutil.which('Rscript') is not None or shutil.which('R') is not None

    def _find_rscript(self) -> Optional[str]:
        """Find Rscript executable"""
        # Try common paths
        rscript = shutil.which('Rscript')
        if rscript:
            return rscript

        # Try R executable
        r_exe = shutil.which('R')
        if r_exe:
            return r_exe

        # Try Windows common locations
        common_paths = [
            r"C:\Program Files\R\R-4.3.2\bin\Rscript.exe",
            r"C:\Program Files\R\R-4.3.1\bin\Rscript.exe",
            r"C:\Program Files\R\R-4.2.3\bin\Rscript.exe",
            r"C:\Program Files\R\R-4.1.3\bin\Rscript.exe",
        ]

        for path in common_paths:
            if Path(path).exists():
                return path

        return None

    async def execute(
        self,
        run_id: str,
        work_dir: Path,
        r_code: str,
        r_version: str,  # Ignored for local execution
        mode: ExecutionMode,
        timeout: int,
        memory_limit: int,  # Ignored for local execution
        capture_plots: bool = True,
        progress_callback: Optional[Callable[[int, str], None]] = None
    ) -> tuple[int, float]:
        """
        Execute R code using local R installation

        Args:
            run_id: Unique run identifier
            work_dir: Working directory for execution
            r_code: R code to execute
            r_version: R version (ignored - uses installed version)
            mode: Execution mode
            timeout: Timeout in seconds
            memory_limit: Memory limit (ignored for local)
            capture_plots: Whether to capture plots
            progress_callback: Optional callback for progress

        Returns:
            (exit_code, duration)
        """
        if not self.r_available or not self.rscript_path:
            raise RuntimeError("R is not installed or not found in PATH")

        # Prepare working directory
        input_dir = work_dir / "input"
        output_dir = work_dir / "output"
        logs_dir = work_dir / "logs"
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        logs_dir.mkdir(parents=True, exist_ok=True)

        # Wrap R code
        if mode == ExecutionMode.INTERACTIVE:
            wrapped_code = self._wrap_interactive_code(r_code, capture_plots, output_dir)
        else:
            wrapped_code = self._wrap_interactive_code(r_code, capture_plots, output_dir)

        # Write code file
        code_file = input_dir / "program.R"
        code_file.write_text(wrapped_code, encoding='utf-8')

        # Execute
        logger.info(f"[{run_id}] Starting local R execution")
        if progress_callback:
            progress_callback(10, "Starting R execution")

        start_time = time.time()
        exit_code = 0

        try:
            # Build command
            cmd = [self.rscript_path, str(code_file)]

            # Execute
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(work_dir)
            )

            if progress_callback:
                progress_callback(30, "Executing R code")

            # Wait with timeout
            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    process.communicate(),
                    timeout=timeout
                )

                exit_code = process.returncode or 0

                # Write outputs
                (output_dir / "stdout.txt").write_bytes(stdout_data)
                (output_dir / "stderr.txt").write_bytes(stderr_data)

            except asyncio.TimeoutError:
                logger.error(f"[{run_id}] Execution timeout after {timeout}s")
                process.kill()
                await process.wait()
                exit_code = 124  # Timeout exit code

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

            logger.info(f"[{run_id}] Local execution completed in {duration:.2f}s with exit code {exit_code}")
            return exit_code, duration

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"[{run_id}] Local execution error: {e}", exc_info=True)

            # Write error
            (output_dir / "exit_code.txt").write_text("1")
            (output_dir / "stderr.txt").write_text(f"Local R execution error: {str(e)}\n")

            return 1, duration

    def _wrap_interactive_code(self, user_code: str, capture_plots: bool, output_dir: Path) -> str:
        """Wrap user code for local execution"""
        output_dir_str = str(output_dir).replace('\\', '/')

        plot_setup = f"""
# Enable plot capture
png(filename="{output_dir_str}/plot_%03d.png", width=800, height=600, res=100)
par(bg="white")
""" if capture_plots else ""

        plot_cleanup = """
# Close plot device
if (length(dev.list()) > 0) {
    dev.off()
}
""" if capture_plots else ""

        wrapped = f"""#!/usr/bin/env Rscript
# Local R Execution
# Auto-generated by ADAM AI

# Print R version
cat("R version:", as.character(getRversion()), "\\n")
cat("Platform:", R.version$platform, "\\n\\n")

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

            # Save as CSV
            csv_file <- file.path("{output_dir_str}", paste0(obj_name, ".csv"))
            write.csv(obj, csv_file, row.names=FALSE)
            cat("Saved data frame:", obj_name, "to", csv_file, "\\n")
        }}
    }}

    # Save metadata as JSON
    if (length(data_frames) > 0) {{
        if (requireNamespace("jsonlite", quietly = TRUE)) {{
            library(jsonlite)
            json_file <- "{output_dir_str}/data_frames.json"
            write_json(data_frames, json_file, auto_unbox=TRUE, pretty=TRUE)
            cat("Saved data frame metadata\\n")
        }}
    }}

}}, error = function(e) {{
    cat("Note: Could not save data frame metadata:", e$message, "\\n", file=stderr())
}})

# Print session info
cat("\\n=== Session Info ===\\n")
print(sessionInfo())

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
