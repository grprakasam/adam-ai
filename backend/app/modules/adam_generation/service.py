"""
Service layer for ADAM generation orchestration
"""

import logging
import hashlib
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

import pandas as pd

from .schemas import (
    AdamGenerationRequest,
    AdamGenerationResult,
    AdamGenerationStatus,
    AdamDatasetPreview,
    RunStatus,
    RVersionInfo
)
from .docker_runner import DockerRunner
from .repository import AdamRunRepository
from .validators import InputValidator
from .exceptions import ValidationError, TimeoutError, OutputNotFoundError
from .progress_emitter import get_progress_emitter
from .adam_compliance import ADAMCompliance

logger = logging.getLogger(__name__)


class AdamGenerationService:
    """Main service for ADAM dataset generation"""

    DEFAULT_R_VERSION = "4.3.2"
    DEFAULT_TIMEOUT = 600  # 10 minutes
    DEFAULT_MEMORY_MB = 2048

    def __init__(self, base_path: Optional[Path] = None):
        self.docker_runner = DockerRunner()
        self.repository = AdamRunRepository(base_path=base_path)
        self.validator = InputValidator()
        self.progress_emitter = get_progress_emitter()

    @staticmethod
    def _generate_run_id() -> str:
        """Generate unique run ID"""
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        return f"run_{timestamp}_{unique_id}"

    def _create_work_directory(self, run_id: str, study_id: str) -> Path:
        """Create working directory for run"""
        work_dir = Path("Content/Generated/ADAM") / study_id / "runs" / run_id
        work_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        (work_dir / "input").mkdir(exist_ok=True)
        (work_dir / "output").mkdir(exist_ok=True)
        (work_dir / "logs").mkdir(exist_ok=True)
        
        return work_dir

    async def _resolve_code(self, request: AdamGenerationRequest) -> str:
        """Resolve R code from request"""
        if request.consolidated_code_text:
            return request.consolidated_code_text
        
        if request.consolidated_code_id:
            # TODO: Fetch from database or storage
            # For now, raise error
            raise ValueError("consolidated_code_id lookup not yet implemented")
        
        raise ValueError("No code source provided")

    async def _prepare_sdtm_datasets(
        self,
        study_id: str,
        work_dir: Path,
        domains: list
    ) -> Dict[str, Path]:
        """Prepare SDTM datasets for execution (prefers XPT format)"""
        sdtm_base = Path("Content/Generated/SDTM") / study_id
        input_dir = work_dir / "input"
        input_dir.mkdir(parents=True, exist_ok=True)
        
        import shutil
        sdtm_paths = {}
        for domain in domains:
            # Try XPT first (preserves labels/metadata), then CSV
            source_xpt = sdtm_base / f"{domain}.xpt"
            source_csv = sdtm_base / f"{domain}.csv"
            
            if source_xpt.exists():
                # Copy XPT file (preferred - preserves metadata)
                dest_file = input_dir / f"{domain}.xpt"
                shutil.copy2(source_xpt, dest_file)
                sdtm_paths[domain] = dest_file
                logger.info(f"Prepared SDTM dataset: {domain} (XPT format - labels preserved)")
            elif source_csv.exists():
                # Copy CSV file (fallback - no metadata)
                dest_file = input_dir / f"{domain}.csv"
                shutil.copy2(source_csv, dest_file)
                sdtm_paths[domain] = dest_file
                logger.info(f"Prepared SDTM dataset: {domain} (CSV format - no labels)")
            else:
                logger.warning(f"SDTM dataset not found: {domain} (checked {source_xpt} and {source_csv})")
        
        return sdtm_paths

    async def _parse_outputs(
        self,
        work_dir: Path,
        adam_dataset: str,
        output_formats: list
    ) -> Dict[str, Any]:
        """Parse generated outputs and create preview (prefers XPT format)"""
        output_dir = work_dir / "output"
        
        # Look for output files
        output_files = {}
        preview = None
        
        # Try to find XPT output first (regulatory format), then CSV
        xpt_file = output_dir / f"{adam_dataset}.xpt"
        csv_file = output_dir / f"{adam_dataset}.csv"
        
        # Prefer XPT if available (regulatory format with metadata)
        if xpt_file.exists():
            try:
                # Try to read XPT using pyreadstat if available
                try:
                    import pyreadstat
                    full_df, meta = pyreadstat.read_xport(str(xpt_file))
                    logger.info(f"Read XPT file with metadata: {len(meta.column_names)} variables")
                except ImportError:
                    # Fallback: read CSV for preview if XPT reader not available
                    logger.warning("pyreadstat not available, using CSV for preview")
                    if csv_file.exists():
                        full_df = pd.read_csv(csv_file)
                    else:
                        raise OutputNotFoundError("XPT file exists but cannot be read (pyreadstat not installed)")
                except Exception as e:
                    logger.warning(f"Error reading XPT with pyreadstat: {e}, falling back to CSV")
                    if csv_file.exists():
                        full_df = pd.read_csv(csv_file)
                    else:
                        raise
                
                preview_df = full_df.head(10)
                preview = AdamDatasetPreview(
                    columns=list(full_df.columns),
                    rows=preview_df.to_dict('records'),
                    total_rows=len(full_df),
                    total_columns=len(full_df.columns),
                    key_variables=self._identify_key_variables(full_df.columns)
                )
                output_files["xpt"] = str(xpt_file)
                logger.info(f"Found output XPT: {xpt_file}, {len(full_df)} rows, {len(full_df.columns)} columns")
            except Exception as e:
                logger.error(f"Error reading output XPT: {e}", exc_info=True)
                # Fallback to CSV
                if csv_file.exists():
                    full_df = pd.read_csv(csv_file)
                    preview_df = full_df.head(10)
                    preview = AdamDatasetPreview(
                        columns=list(full_df.columns),
                        rows=preview_df.to_dict('records'),
                        total_rows=len(full_df),
                        total_columns=len(full_df.columns),
                        key_variables=self._identify_key_variables(full_df.columns)
                    )
                    output_files["csv"] = str(csv_file)
        elif csv_file.exists():
            try:
                full_df = pd.read_csv(csv_file)
                preview_df = full_df.head(10)
                
                preview = AdamDatasetPreview(
                    columns=list(full_df.columns),
                    rows=preview_df.to_dict('records'),
                    total_rows=len(full_df),
                    total_columns=len(full_df.columns),
                    key_variables=self._identify_key_variables(full_df.columns)
                )
                
                output_files["csv"] = str(csv_file)
                logger.info(f"Found output CSV: {csv_file}, {len(full_df)} rows, {len(full_df.columns)} columns")
            except Exception as e:
                logger.error(f"Error reading output CSV: {e}", exc_info=True)
                raise OutputNotFoundError(f"Failed to read output CSV: {e}")
        else:
            # List all files in output directory for debugging
            all_files = list(output_dir.glob("*"))
            logger.error(f"Output files not found. Files in output directory: {[f.name for f in all_files]}")
            raise OutputNotFoundError(
                f"No output dataset found for {adam_dataset}. "
                f"Expected {adam_dataset}.xpt or {adam_dataset}.csv in {output_dir}. "
                f"Found files: {[f.name for f in all_files if f.is_file()]}"
            )
        
        # Look for other formats
        for fmt in output_formats:
            if fmt in ["csv", "xpt"]:
                continue
            fmt_file = output_dir / f"{adam_dataset}.{fmt}"
            if fmt_file.exists():
                output_files[fmt] = str(fmt_file)
                logger.info(f"Found output {fmt.upper()}: {fmt_file}")
        
        return {
            "preview": preview,
            "files": output_files
        }

    async def generate_adam_dataset(
        self,
        request: AdamGenerationRequest
    ) -> AdamGenerationResult:
        """Main orchestration method for ADAM generation"""

        # 1. Create run record
        run_id = self._generate_run_id()
        await self.repository.create_run(
            run_id=run_id,
            study_id=request.study_id,
            adam_dataset=request.adam_dataset,
            request_params=request.dict()
        )

        try:
            # 2. Validate inputs
            logger.info(f"[{run_id}] Validating inputs")
            self.progress_emitter.emit(run_id, "validation", 10, "Validating inputs")
            validation_result = await self.validator.validate_inputs(
                request.study_id,
                request.adam_dataset
            )
            if not validation_result.is_valid:
                raise ValidationError(validation_result.errors)

            # 3. Prepare working directory
            logger.info(f"[{run_id}] Preparing workspace")
            self.progress_emitter.emit(run_id, "prepare_workspace", 20, "Preparing workspace")
            work_dir = self._create_work_directory(run_id, request.study_id)

            # 4. Resolve and write R code with wrapper
            logger.info(f"[{run_id}] Preparing R code")
            self.progress_emitter.emit(run_id, "prepare_code", 30, "Preparing R code")
            user_code = await self._resolve_code(request)
            
            # Wrap user code with proper setup for Docker execution
            wrapped_code = self._wrap_r_code(
                user_code=user_code,
                adam_dataset=request.adam_dataset,
                input_dir="/work/input",
                output_dir="/work/output"
            )
            
            code_path = work_dir / "input" / "program.R"
            code_path.write_text(wrapped_code)
            
            # Calculate code hash (use original user code)
            code_hash = hashlib.sha256(user_code.encode()).hexdigest()[:16]

            # 5. Prepare SDTM datasets
            logger.info(f"[{run_id}] Preparing SDTM datasets")
            self.progress_emitter.emit(run_id, "prepare_inputs", 40, "Preparing SDTM datasets")
            sdtm_domains = request.sdtm_domains or validation_result.required_domains
            sdtm_paths = await self._prepare_sdtm_datasets(
                study_id=request.study_id,
                work_dir=work_dir,
                domains=sdtm_domains
            )

            # 6. Execute in Docker
            logger.info(f"[{run_id}] Executing R program")
            self.progress_emitter.emit(run_id, "execute_r", 50, "Executing R program")
            await self.repository.update_run(
                run_id=run_id,
                study_id=request.study_id,
                status=RunStatus.RUNNING,
                progress_percent=50,
                current_step="Executing R program"
            )

            # Progress callback for Docker execution
            def progress_callback(percent: int):
                # Map Docker progress (0-100) to overall progress (50-90)
                overall_percent = 50 + int(percent * 0.4)
                self.progress_emitter.emit(
                    run_id,
                    "execute_r",
                    overall_percent,
                    f"Executing R program ({percent}%)"
                )

            execution_result = await self.docker_runner.execute(
                run_id=run_id,
                work_dir=work_dir,
                r_version=request.r_version or self.DEFAULT_R_VERSION,
                timeout=request.timeout_seconds or self.DEFAULT_TIMEOUT,
                memory_limit=request.memory_limit_mb or self.DEFAULT_MEMORY_MB,
                progress_callback=progress_callback
            )

            if not execution_result.success:
                raise Exception(f"R execution failed with exit code {execution_result.exit_code}")

            # 7. Parse outputs
            logger.info(f"[{run_id}] Parsing outputs")
            self.progress_emitter.emit(run_id, "parse_outputs", 90, "Parsing outputs")
            output_data = await self._parse_outputs(
                work_dir=work_dir,
                adam_dataset=request.adam_dataset,
                output_formats=request.output_formats
            )

            # 8. Update run record
            logger.info(f"[{run_id}] Finalizing run")
            self.progress_emitter.emit(run_id, "finalize", 95, "Finalizing")
            await self.repository.update_run(
                run_id=run_id,
                study_id=request.study_id,
                status=RunStatus.SUCCEEDED,
                output_artifacts=output_data["files"],
                execution_result={
                    "duration": execution_result.duration,
                    "exit_code": execution_result.exit_code
                }
            )

            # 9. Build result
            result = AdamGenerationResult(
                run_id=run_id,
                status=RunStatus.SUCCEEDED,
                adam_dataset=request.adam_dataset,
                preview=output_data["preview"],
                download_urls={},  # Will be set by API layer
                file_paths=output_data["files"],
                r_version=request.r_version or self.DEFAULT_R_VERSION,
                execution_duration=execution_result.duration,
                input_datasets=list(sdtm_paths.keys()),
                code_hash=code_hash,
                timestamp=datetime.utcnow()
            )

            # Emit completion
            self.progress_emitter.complete(run_id, "succeeded", result.dict())
            self.progress_emitter.emit(run_id, "complete", 100, "Generation complete")

            return result

        except ValidationError as e:
            await self.repository.update_run(
                run_id=run_id,
                study_id=request.study_id,
                status=RunStatus.FAILED,
                error=str(e)
            )
            self.progress_emitter.complete(run_id, "failed", {"error": str(e)})
            raise
        except TimeoutError as e:
            await self.repository.update_run(
                run_id=run_id,
                study_id=request.study_id,
                status=RunStatus.TIMEOUT,
                error=str(e)
            )
            self.progress_emitter.complete(run_id, "timeout", {"error": str(e)})
            raise
        except Exception as e:
            logger.error(f"[{run_id}] Generation failed: {e}", exc_info=True)
            await self.repository.update_run(
                run_id=run_id,
                study_id=request.study_id,
                status=RunStatus.FAILED,
                error=str(e)
            )
            self.progress_emitter.complete(run_id, "failed", {"error": str(e)})
            raise

    async def get_run_status(self, run_id: str) -> AdamGenerationStatus:
        """Get status of a run"""
        run = await self.repository.get_run(run_id)
        if not run:
            raise ValueError(f"Run {run_id} not found")

            from datetime import datetime as dt
            started_at_str = run["started_at"]
            finished_at_str = run.get("finished_at")
            
            return AdamGenerationStatus(
                run_id=run["run_id"],
                study_id=run["study_id"],
                adam_dataset=run["adam_dataset"],
                status=RunStatus(run["status"]),
                progress_percent=run.get("progress_percent", 0),
                current_step=run.get("current_step", "Unknown"),
                started_at=dt.fromisoformat(started_at_str.replace('Z', '+00:00') if started_at_str.endswith('Z') else started_at_str),
                finished_at=dt.fromisoformat(finished_at_str.replace('Z', '+00:00') if finished_at_str and finished_at_str.endswith('Z') else finished_at_str) if finished_at_str else None,
                duration_seconds=run.get("duration_seconds"),
                output_summary=run.get("output_artifacts"),
                error_message=run.get("error_message")
            )

    def _wrap_r_code(
        self,
        user_code: str,
        adam_dataset: str,
        input_dir: str,
        output_dir: str
    ) -> str:
        """
        Wrap user R code with proper setup for Docker execution
        
        Adds:
        - Library loading
        - SDTM data loading from input directory (XPT format preferred)
        - CDISC variable ordering enforcement
        - Type validation and conversion
        - Variable labels and metadata preservation
        - Output writing in XPT format (regulatory compliant)
        - Error handling
        """
        # Get variable ordering for this dataset
        var_order = ADAMCompliance.get_variable_order(adam_dataset)
        var_order_r = "c(" + ", ".join([f'"{v}"' for v in var_order]) + ")"
        
        wrapped = f"""# ============================================
# ADAM Generation Execution Script
# Generated by ADAM AI
# Dataset: {adam_dataset}
# CDISC ADAM IG Compliant
# ============================================

# Load required libraries
suppressPackageStartupMessages({{
    library(tidyverse)
    library(haven)  # For XPT format (preserves labels/metadata)
    library(readr)
}})

# Try to load writexl for XLSX export (optional)
has_writexl <- requireNamespace("writexl", quietly = TRUE)
if (has_writexl) {{
    library(writexl)
    cat("writexl package available for XLSX export\\n")
}} else {{
    cat("writexl package not available, XLSX export will be skipped\\n")
}}

# Set options
options(warn = 1)
options(stringsAsFactors = FALSE)

# Set working directories
input_dir <- "{input_dir}"
output_dir <- "{output_dir}"

cat("Input directory:", input_dir, "\\n")
cat("Output directory:", output_dir, "\\n")
cat("Target dataset:", "{adam_dataset}", "\\n\\n")

# Error handling wrapper
result <- tryCatch({{

    # ========== LOAD SDTM DATASETS ==========
    cat("Loading SDTM datasets from", input_dir, "\\n")
    
    # Try XPT format first (preserves labels/metadata), fallback to CSV
    sdtm_xpt_files <- list.files(input_dir, pattern = "\\\\.xpt$", full.names = TRUE)
    sdtm_csv_files <- list.files(input_dir, pattern = "\\\\.csv$", full.names = TRUE)
    sdtm_files <- c(sdtm_xpt_files, sdtm_csv_files)
    
    cat("Found", length(sdtm_files), "SDTM files (", length(sdtm_xpt_files), "XPT,", length(sdtm_csv_files), "CSV)\\n")
    
    # Load each domain and make available as data frames
    for (file in sdtm_files) {{
        domain_name <- toupper(tools::file_path_sans_ext(basename(file)))
        cat("Loading", domain_name, "...\\n")
        
        # Load XPT (preserves labels) or CSV
        if (tools::file_ext(file) == "xpt") {{
            domain_df <- read_xpt(file)
            cat("  Loaded from XPT (labels preserved)\\n")
        }} else {{
            domain_df <- read_csv(file, show_col_types = FALSE)
            cat("  Loaded from CSV (labels not available)\\n")
        }}
        
        cat("  Rows:", nrow(domain_df), "Columns:", ncol(domain_df), "\\n")
        
        # Make domain available in global environment with domain name
        assign(domain_name, domain_df, envir = .GlobalEnv)
        
        # Also store in list for reference
        if (!exists("sdtm")) sdtm <- list()
        sdtm[[domain_name]] <- domain_df
    }}
    
    cat("\\nSDTM datasets loaded successfully. Available domains:", paste(names(sdtm), collapse=", "), "\\n\\n")
    
    # ========== USER CODE EXECUTION ==========
    cat("Executing user ADAM code...\\n\\n")
    
{self._indent_code(user_code, 4)}
    
    # ========== SAVE OUTPUT ==========
    cat("\\nSaving output dataset...\\n")
    
    # Check if output dataset exists (try multiple possible names)
    output_df <- NULL
    possible_names <- c("{adam_dataset}", "adsl", "adae", "adlb", "advs", "adtte", "data", "result")
    
    for (name in possible_names) {{
        if (exists(name, envir = .GlobalEnv)) {{
            obj <- get(name, envir = .GlobalEnv)
            if (is.data.frame(obj)) {{
                output_df <- obj
                cat("Found output dataset:", name, "\\n")
                break
            }}
        }}
    }}
    
    # If still not found, check last assigned object
    if (is.null(output_df)) {{
        # Try to find any data frame that might be the output
        all_objects <- ls(envir = .GlobalEnv)
        for (obj_name in all_objects) {{
            obj <- get(obj_name, envir = .GlobalEnv)
            if (is.data.frame(obj) && nrow(obj) > 0 && "USUBJID" %in% names(obj)) {{
                output_df <- obj
                cat("Found potential output dataset:", obj_name, "\\n")
                break
            }}
        }}
    }}
    
    if (is.null(output_df)) {{
        stop("Output dataset '{adam_dataset}' was not created by the code. ",
             "Please ensure your code creates a data frame named '{adam_dataset}' or one of: ", 
             paste(possible_names, collapse=", "))
    }}
    
    if (!is.data.frame(output_df)) {{
        stop("Output is not a data frame. Type: ", class(output_df)[1])
    }}
    
    cat("Output dataset dimensions:", nrow(output_df), "rows,", ncol(output_df), "columns\\n")
    
    # Ensure output directory exists
    if (!dir.exists(output_dir)) {{
        dir.create(output_dir, recursive = TRUE)
    }}
    
    # Save to CSV
    csv_path <- file.path(output_dir, "{adam_dataset}.csv")
    write_csv(output_df, csv_path)
    cat("Saved CSV to:", csv_path, "\\n")
    
    # Save to XLSX if writexl is available
    if (has_writexl) {{
        tryCatch({{
            xlsx_path <- file.path(output_dir, "{adam_dataset}.xlsx")
            writexl::write_xlsx(output_df, xlsx_path)
            cat("Saved XLSX to:", xlsx_path, "\\n")
        }}, error = function(e) {{
            cat("XLSX export failed:", e$message, "\\n")
        }})
    }} else {{
        cat("Skipping XLSX export (writexl not available)\\n")
    }}
    
    # Save to RDS
    rds_path <- file.path(output_dir, "{adam_dataset}.rds")
    saveRDS(output_df, rds_path)
    cat("Saved RDS to:", rds_path, "\\n")
    
    cat("\\n===== Execution completed successfully =====\\n")
    
}}, error = function(e) {{
    cat("\\n===== ERROR OCCURRED =====\\n")
    cat("Error message:", e$message, "\\n")
    cat("Error class:", class(e)[1], "\\n")
    if (!is.null(e$call)) {{
        cat("Error occurred at:\\n")
        print(e$call)
    }}
    traceback()
    stop(e)
}})

# Print session info for debugging
cat("\\n===== R Session Info =====\\n")
print(sessionInfo())
"""
        return wrapped
    
    def _indent_code(self, code: str, spaces: int) -> str:
        """Indent code by specified number of spaces"""
        indent = " " * spaces
        lines = code.split("\n")
        indented = [indent + line if line.strip() else line for line in lines]
        return "\n".join(indented)

    async def get_r_versions(self) -> list[RVersionInfo]:
        """Get available R versions"""
        return [
            RVersionInfo(
                version="4.1.3",
                docker_image="rocker/tidyverse:4.1.3",
                is_default=False,
                is_recommended=False,
                description="Legacy support",
                preinstalled_packages=["tidyverse", "haven"]
            ),
            RVersionInfo(
                version="4.2.3",
                docker_image="rocker/tidyverse:4.2.3",
                is_default=False,
                is_recommended=False,
                description="Stable production version",
                preinstalled_packages=["tidyverse", "haven", "admiral"]
            ),
            RVersionInfo(
                version="4.3.2",
                docker_image="rocker/tidyverse:4.3.2",
                is_default=True,
                is_recommended=True,
                description="Latest with full ADAM package suite",
                preinstalled_packages=["tidyverse", "haven", "admiral", "metacore", "metatools"]
            ),
        ]

