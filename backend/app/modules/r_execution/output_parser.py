"""
Output Parser for R Execution

Parses stdout, stderr, plots, and data frames from R execution output directory.
"""

import re
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Tuple
import pandas as pd

from .schemas import RExecutionOutput, PlotInfo, DataFrameInfo

logger = logging.getLogger(__name__)


class OutputParser:
    """Parse R execution outputs from work directory"""

    def __init__(self):
        self.plot_extensions = ['.png', '.jpg', '.jpeg', '.pdf', '.svg']
        self.data_extensions = ['.csv', '.rds', '.xlsx']

    def parse_output_directory(self, output_dir: Path) -> RExecutionOutput:
        """
        Parse all outputs from the execution directory

        Expected structure:
        output_dir/
          ├── stdout.txt         (captured console output)
          ├── stderr.txt         (captured errors/warnings)
          ├── exit_code.txt      (exit code)
          ├── plot_001.png       (plots)
          ├── plot_002.png
          ├── *.csv              (data files)
          └── *.rds              (R data files)
        """
        try:
            # Parse console output
            stdout_lines, stderr_lines = self._parse_console_output(output_dir)

            # Parse plots
            plots = self._parse_plots(output_dir)

            # Parse data frames (from metadata if available)
            data_frames = self._parse_data_frames(output_dir)

            # Find other files
            other_files = self._find_other_files(output_dir)

            # Get exit code
            exit_code = self._get_exit_code(output_dir)

            # Extract error message if failed
            error_message = None
            if exit_code != 0 and stderr_lines:
                error_message = self._extract_error_message(stderr_lines)

            return RExecutionOutput(
                stdout=stdout_lines,
                stderr=stderr_lines,
                plots=plots,
                data_frames=data_frames,
                files=other_files,
                exit_code=exit_code,
                error_message=error_message
            )

        except Exception as e:
            logger.error(f"Error parsing output directory: {e}", exc_info=True)
            return RExecutionOutput(
                stdout=[],
                stderr=[f"Error parsing outputs: {str(e)}"],
                exit_code=1,
                error_message=str(e)
            )

    def _parse_console_output(self, output_dir: Path) -> Tuple[List[str], List[str]]:
        """Parse stdout and stderr files"""
        stdout_file = output_dir / "stdout.txt"
        stderr_file = output_dir / "stderr.txt"

        stdout_lines = []
        stderr_lines = []

        if stdout_file.exists():
            try:
                content = stdout_file.read_text(encoding='utf-8', errors='replace')
                stdout_lines = [line.rstrip() for line in content.split('\n') if line.strip()]
                logger.info(f"Parsed {len(stdout_lines)} stdout lines")
            except Exception as e:
                logger.error(f"Error reading stdout: {e}")
                stdout_lines = [f"Error reading stdout: {str(e)}"]

        if stderr_file.exists():
            try:
                content = stderr_file.read_text(encoding='utf-8', errors='replace')
                stderr_lines = [line.rstrip() for line in content.split('\n') if line.strip()]
                logger.info(f"Parsed {len(stderr_lines)} stderr lines")
            except Exception as e:
                logger.error(f"Error reading stderr: {e}")
                stderr_lines = [f"Error reading stderr: {str(e)}"]

        return stdout_lines, stderr_lines

    def _parse_plots(self, output_dir: Path) -> List[PlotInfo]:
        """Find and catalog all plot images"""
        plots = []

        # Look for plot files (plot_001.png, plot_002.png, etc.)
        for ext in self.plot_extensions:
            plot_files = sorted(output_dir.glob(f"plot_*{ext}"))
            for idx, plot_file in enumerate(plot_files):
                try:
                    size_bytes = plot_file.stat().st_size
                    plots.append(PlotInfo(
                        index=idx + 1,
                        filename=plot_file.name,
                        path=str(plot_file),
                        size_bytes=size_bytes,
                        format=ext.lstrip('.')
                    ))
                except Exception as e:
                    logger.error(f"Error processing plot {plot_file}: {e}")

        logger.info(f"Found {len(plots)} plot(s)")
        return plots

    def _parse_data_frames(self, output_dir: Path) -> List[DataFrameInfo]:
        """
        Parse data frames from metadata file or by reading CSV/RDS files

        Looks for data_frames.json metadata file created by R wrapper
        """
        data_frames = []
        metadata_file = output_dir / "data_frames.json"

        if metadata_file.exists():
            # Read metadata created by R
            try:
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                    for df_meta in metadata:
                        data_frames.append(DataFrameInfo(**df_meta))
                logger.info(f"Loaded {len(data_frames)} data frame(s) from metadata")
                return data_frames
            except Exception as e:
                logger.error(f"Error reading data frame metadata: {e}")

        # Fallback: Try to read CSV files directly
        csv_files = list(output_dir.glob("*.csv"))
        for csv_file in csv_files:
            try:
                df = pd.read_csv(csv_file, nrows=10)  # Read only first 10 rows for preview
                full_df = pd.read_csv(csv_file)

                preview_rows = df.to_dict('records')

                data_frames.append(DataFrameInfo(
                    name=csv_file.stem,
                    rows=len(full_df),
                    columns=len(full_df.columns),
                    column_names=list(full_df.columns),
                    preview_rows=preview_rows
                ))
            except Exception as e:
                logger.error(f"Error reading CSV {csv_file}: {e}")

        logger.info(f"Found {len(data_frames)} data frame(s)")
        return data_frames

    def _find_other_files(self, output_dir: Path) -> List[str]:
        """Find other output files (CSV, RDS, etc.)"""
        files = []

        # Exclude system files
        exclude_patterns = ['stdout.txt', 'stderr.txt', 'exit_code.txt',
                           'data_frames.json', 'plot_*.png', 'plot_*.pdf']

        for file_path in output_dir.glob("*"):
            if file_path.is_file():
                # Check if matches exclude pattern
                if not any(file_path.match(pattern) for pattern in exclude_patterns):
                    files.append(file_path.name)

        logger.info(f"Found {len(files)} other file(s): {files}")
        return files

    def _get_exit_code(self, output_dir: Path) -> int:
        """Get exit code from file"""
        exit_code_file = output_dir / "exit_code.txt"

        if exit_code_file.exists():
            try:
                code = int(exit_code_file.read_text().strip())
                return code
            except Exception as e:
                logger.error(f"Error reading exit code: {e}")
                return 1

        return 0  # Assume success if no exit code file

    def _extract_error_message(self, stderr_lines: List[str]) -> str:
        """Extract the main error message from stderr"""
        if not stderr_lines:
            return "Unknown error"

        # Check for system/Docker errors first
        full_stderr = "\n".join(stderr_lines)
        if "Docker execution failed" in full_stderr or "Permission denied" in full_stderr:
            return full_stderr

        # Look for R error patterns
        error_patterns = [
            r'Error in (.+)',
            r'Error: (.+)',
            r'execution halted',
        ]

        for line in stderr_lines:
            for pattern in error_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    if match.groups():
                        return match.group(1)
                    return line

        # Return last non-empty stderr line
        for line in reversed(stderr_lines):
            if line.strip():
                return line

        return "Execution failed"

    def stream_output_lines(self, output_file: Path):
        """
        Generator to stream output lines as they're written (for real-time display)
        Useful for SSE streaming
        """
        last_position = 0

        while True:
            if output_file.exists():
                try:
                    with open(output_file, 'r', encoding='utf-8', errors='replace') as f:
                        f.seek(last_position)
                        new_lines = f.readlines()
                        last_position = f.tell()

                        for line in new_lines:
                            yield line.rstrip()
                except Exception as e:
                    logger.error(f"Error streaming output: {e}")
                    yield f"[Error reading output: {str(e)}]"
                    break

            # Check if process is complete
            exit_code_file = output_file.parent / "exit_code.txt"
            if exit_code_file.exists():
                # Read any remaining lines
                if output_file.exists():
                    try:
                        with open(output_file, 'r', encoding='utf-8', errors='replace') as f:
                            f.seek(last_position)
                            remaining_lines = f.readlines()
                            for line in remaining_lines:
                                yield line.rstrip()
                    except Exception as e:
                        logger.error(f"Error reading final output: {e}")
                break

            import time
            time.sleep(0.1)  # Poll every 100ms
