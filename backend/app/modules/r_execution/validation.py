"""
Pre-execution validation utilities for ADAM Generation

Provides comprehensive validation before execution to catch issues early
and provide helpful error messages to users.
"""

import logging
import subprocess
from typing import Dict, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


class ValidationResult:
    """Result of a validation check"""
    
    def __init__(self, is_valid: bool, message: str, severity: str = "error", suggestion: Optional[str] = None):
        self.is_valid = is_valid
        self.message = message
        self.severity = severity  # "error", "warning", "info"
        self.suggestion = suggestion


class PreExecutionValidator:
    """Validates system state before ADAM generation execution"""
    
    def __init__(self):
        self.validation_results: List[ValidationResult] = []
    
    def validate_all(self) -> Dict:
        """Run all validation checks"""
        self.validation_results = []
        
        # Check Docker
        docker_result = self._check_docker()
        self.validation_results.append(docker_result)
        
        # Check R image
        if docker_result.is_valid:
            r_image_result = self._check_r_image()
            self.validation_results.append(r_image_result)
        
        # Check disk space
        disk_result = self._check_disk_space()
        self.validation_results.append(disk_result)
        
        # Check system resources
        resource_result = self._check_system_resources()
        self.validation_results.append(resource_result)
        
        # Determine overall validity
        has_errors = any(not r.is_valid and r.severity == "error" for r in self.validation_results)
        
        return {
            "is_valid": not has_errors,
            "checks": [
                {
                    "is_valid": r.is_valid,
                    "message": r.message,
                    "severity": r.severity,
                    "suggestion": r.suggestion
                }
                for r in self.validation_results
            ],
            "summary": self._generate_summary()
        }
    
    def _check_docker(self) -> ValidationResult:
        """Check if Docker is running"""
        try:
            result = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                timeout=5
            )
            
            if result.returncode == 0:
                return ValidationResult(
                    is_valid=True,
                    message="Docker is running and accessible",
                    severity="info"
                )
            else:
                return ValidationResult(
                    is_valid=False,
                    message="Docker is installed but not running",
                    severity="error",
                    suggestion="Start Docker Desktop from your Start menu or system tray. Wait 30-60 seconds for it to fully start."
                )
                
        except FileNotFoundError:
            return ValidationResult(
                is_valid=False,
                message="Docker is not installed",
                severity="error",
                suggestion="Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
            )
        except subprocess.TimeoutExpired:
            return ValidationResult(
                is_valid=False,
                message="Docker command timed out",
                severity="error",
                suggestion="Docker may be starting up. Wait a minute and try again."
            )
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                message=f"Error checking Docker: {str(e)}",
                severity="error",
                suggestion="Check Docker Desktop logs for more information"
            )
    
    def _check_r_image(self, image: str = "rocker/tidyverse:4.3.2") -> ValidationResult:
        """Check if R Docker image is available"""
        try:
            result = subprocess.run(
                ["docker", "image", "inspect", image],
                capture_output=True,
                timeout=10
            )
            
            if result.returncode == 0:
                return ValidationResult(
                    is_valid=True,
                    message=f"R Docker image '{image}' is available",
                    severity="info"
                )
            else:
                return ValidationResult(
                    is_valid=False,
                    message=f"R Docker image '{image}' is not available",
                    severity="error",
                    suggestion=f"Pull the image by running: docker pull {image}"
                )
                
        except subprocess.TimeoutExpired:
            return ValidationResult(
                is_valid=False,
                message="Timeout checking Docker image",
                severity="warning",
                suggestion="Docker may be slow. Try again in a moment."
            )
        except Exception as e:
            return ValidationResult(
                is_valid=False,
                message=f"Error checking R image: {str(e)}",
                severity="warning",
                suggestion="Ensure Docker is running properly"
            )
    
    def _check_disk_space(self, min_gb: float = 1.0) -> ValidationResult:
        """Check available disk space"""
        try:
            import shutil
            stat = shutil.disk_usage(".")
            available_gb = stat.free / (1024**3)
            
            if available_gb >= min_gb:
                return ValidationResult(
                    is_valid=True,
                    message=f"Sufficient disk space available ({available_gb:.2f} GB)",
                    severity="info"
                )
            else:
                return ValidationResult(
                    is_valid=False,
                    message=f"Low disk space: {available_gb:.2f} GB available",
                    severity="warning",
                    suggestion="Free up disk space before running large executions"
                )
                
        except Exception as e:
            return ValidationResult(
                is_valid=True,
                message=f"Could not check disk space: {str(e)}",
                severity="info"
            )
    
    def _check_system_resources(self) -> ValidationResult:
        """Check system CPU and memory"""
        try:
            import psutil
            
            # Check memory
            memory = psutil.virtual_memory()
            available_memory_gb = memory.available / (1024**3)
            
            # Check CPU
            cpu_percent = psutil.cpu_percent(interval=0.1)
            
            if available_memory_gb < 0.5:
                return ValidationResult(
                    is_valid=False,
                    message=f"Low memory: {available_memory_gb:.2f} GB available",
                    severity="warning",
                    suggestion="Close other applications to free up memory"
                )
            elif cpu_percent > 90:
                return ValidationResult(
                    is_valid=True,
                    message=f"High CPU usage: {cpu_percent}%",
                    severity="warning",
                    suggestion="System is busy. Execution may be slower."
                )
            else:
                return ValidationResult(
                    is_valid=True,
                    message=f"System resources OK (Memory: {available_memory_gb:.2f} GB, CPU: {cpu_percent}%)",
                    severity="info"
                )
                
        except ImportError:
            return ValidationResult(
                is_valid=True,
                message="psutil not available - skipping resource check",
                severity="info"
            )
        except Exception as e:
            return ValidationResult(
                is_valid=True,
                message=f"Could not check system resources: {str(e)}",
                severity="info"
            )
    
    def _generate_summary(self) -> str:
        """Generate a summary message"""
        errors = [r for r in self.validation_results if not r.is_valid and r.severity == "error"]
        warnings = [r for r in self.validation_results if not r.is_valid and r.severity == "warning"]
        
        if errors:
            return f"Found {len(errors)} critical issue(s) that must be resolved before execution"
        elif warnings:
            return f"System is ready with {len(warnings)} warning(s)"
        else:
            return "All checks passed - system is ready for execution"


def validate_system() -> Dict:
    """Convenience function to run all validation checks"""
    validator = PreExecutionValidator()
    return validator.validate_all()
