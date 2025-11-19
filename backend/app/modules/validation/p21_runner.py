"""
Pinnacle 21 Community Edition (P21 CE) Docker runner
Executes P21 CE validation via Docker container
"""

import asyncio
import json
import subprocess
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import hashlib

from .models import ValidationIssue, ValidationSummary, P21ValidationResponse, ArtifactRef


class P21Runner:
    """
    Runs Pinnacle 21 CE validation via Docker
    Parses outputs and normalizes to standard format
    """
    
    def __init__(
        self,
        docker_image: str = "pinnacle21/p21ce:latest",
        timeout_sec: int = 600,
        max_memory: str = "4g"
    ):
        """
        Initialize P21 runner
        
        Args:
            docker_image: Docker image name
            timeout_sec: Maximum execution time
            max_memory: Maximum memory allocation
        """
        self.docker_image = docker_image
        self.timeout_sec = timeout_sec
        self.max_memory = max_memory
    
    def _prepare_volumes(
        self,
        study_id: str,
        adam_paths: List[str]
    ) -> tuple[Path, Path, Path]:
        """
        Prepare input/output directories for Docker volumes
        
        Returns:
            Tuple of (input_dir, output_dir, work_dir)
        """
        base_dir = Path(__file__).parents[4] / "Content" / "Submissions" / study_id
        
        input_dir = base_dir / "validation" / "p21" / "input"
        output_dir = base_dir / "validation" / "p21" / "output"
        work_dir = base_dir / "validation" / "p21" / "work"
        
        # Create directories
        input_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)
        work_dir.mkdir(parents=True, exist_ok=True)
        
        return input_dir, output_dir, work_dir
    
    def _parse_p21_output(
        self,
        output_dir: Path,
        dataset_name: str
    ) -> List[ValidationIssue]:
        """
        Parse P21 output files and convert to ValidationIssue format
        
        P21 outputs can be in various formats (CSV, XML, JSON, HTML)
        This is a simplified parser - full implementation would handle all formats
        
        Args:
            output_dir: Directory containing P21 outputs
            dataset_name: Name of dataset validated
        
        Returns:
            List of ValidationIssue objects
        """
        issues = []
        
        # Look for common P21 output files
        csv_files = list(output_dir.glob("*.csv"))
        
        for csv_file in csv_files:
            try:
                import pandas as pd
                df = pd.read_csv(csv_file)
                
                # Common P21 CSV columns: Rule, Severity, Dataset, Variable, Message
                for _, row in df.iterrows():
                    issue = ValidationIssue(
                        severity=str(row.get("Severity", "INFO")).upper(),
                        dataset=str(row.get("Dataset", dataset_name)),
                        variable=str(row.get("Variable", "")) if pd.notna(row.get("Variable")) else None,
                        rule_id=str(row.get("Rule", "")) if pd.notna(row.get("Rule")) else None,
                        message=str(row.get("Message", "")),
                        location=str(row.get("Location", "")) if pd.notna(row.get("Location")) else None,
                        category="P21 Validation"
                    )
                    issues.append(issue)
            
            except Exception as e:
                # Log parsing error
                print(f"Error parsing P21 output {csv_file}: {e}")
        
        return issues
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA-256 checksum of file"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    async def run_validation(
        self,
        study_id: str,
        adam_paths: List[str],
        ruleset: str = "ADaM"
    ) -> P21ValidationResponse:
        """
        Run P21 CE validation via Docker
        
        Args:
            study_id: Study identifier
            adam_paths: List of paths to ADAM dataset files
            ruleset: Ruleset to apply (default: ADaM)
        
        Returns:
            P21ValidationResponse with issues and artifacts
        """
        # Prepare directories
        input_dir, output_dir, work_dir = self._prepare_volumes(study_id, adam_paths)
        
        # Copy input files to input directory
        # (In production, adam_paths would be copied to input_dir)
        
        # Construct Docker command
        # Note: This is a placeholder - actual P21 CE Docker command depends on image
        docker_cmd = [
            "docker", "run",
            "--rm",
            f"--memory={self.max_memory}",
            "--cpus=2",
            "-v", f"{input_dir}:/data/input:ro",
            "-v", f"{output_dir}:/data/output",
            "-v", f"{work_dir}:/data/work",
            self.docker_image,
            "--ruleset", ruleset,
            "--input", "/data/input",
            "--output", "/data/output"
        ]
        
        try:
            # Run Docker container
            process = await asyncio.create_subprocess_exec(
                *docker_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Wait with timeout
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=self.timeout_sec
            )
            
            # Parse outputs
            issues = []
            for adam_path in adam_paths:
                dataset_name = Path(adam_path).stem
                dataset_issues = self._parse_p21_output(output_dir, dataset_name)
                issues.extend(dataset_issues)
            
            # Collect artifacts
            artifacts = []
            for output_file in output_dir.glob("*"):
                if output_file.is_file():
                    artifacts.append(ArtifactRef(
                        name=output_file.name,
                        path=str(output_file),
                        created_at=datetime.utcnow().isoformat(),
                        checksum=self._calculate_checksum(output_file),
                        size_bytes=output_file.stat().st_size
                    ))
            
            # Create summary
            by_severity = {"ERROR": 0, "WARNING": 0, "INFO": 0}
            for issue in issues:
                by_severity[issue.severity] += 1
            
            summary = ValidationSummary(
                total_issues=len(issues),
                by_severity=by_severity,
                datasets_checked=[Path(p).stem for p in adam_paths]
            )
            
            return P21ValidationResponse(
                issues=issues,
                artifacts=artifacts,
                summary=summary,
                raw_output={
                    "stdout": stdout.decode() if stdout else "",
                    "stderr": stderr.decode() if stderr else "",
                    "exit_code": process.returncode
                }
            )
        
        except asyncio.TimeoutError:
            # Timeout handling
            return P21ValidationResponse(
                issues=[ValidationIssue(
                    severity="ERROR",
                    message=f"P21 validation timed out after {self.timeout_sec} seconds",
                    category="Execution"
                )],
                artifacts=[],
                summary=ValidationSummary(
                    total_issues=1,
                    by_severity={"ERROR": 1, "WARNING": 0, "INFO": 0},
                    datasets_checked=[]
                )
            )
        
        except Exception as e:
            # Error handling
            return P21ValidationResponse(
                issues=[ValidationIssue(
                    severity="ERROR",
                    message=f"P21 validation failed: {str(e)}",
                    category="Execution"
                )],
                artifacts=[],
                summary=ValidationSummary(
                    total_issues=1,
                    by_severity={"ERROR": 1, "WARNING": 0, "INFO": 0},
                    datasets_checked=[]
                )
            )
