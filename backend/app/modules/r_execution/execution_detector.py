"""
Execution Mode Detector

Detects available R execution methods (Docker, Local R) and provides
appropriate fallback strategies.
"""

import subprocess
import shutil
import logging
from enum import Enum
from typing import Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class ExecutionMethod(str, Enum):
    """Available R execution methods"""
    DOCKER = "docker"
    LOCAL_R = "local_r"
    NONE = "none"


class ExecutionCapabilities:
    """Describes available execution capabilities"""

    def __init__(
        self,
        docker_available: bool,
        local_r_available: bool,
        docker_error: Optional[str] = None,
        local_r_error: Optional[str] = None,
        local_r_version: Optional[str] = None,
        local_r_path: Optional[str] = None
    ):
        self.docker_available = docker_available
        self.local_r_available = local_r_available
        self.docker_error = docker_error
        self.local_r_error = local_r_error
        self.local_r_version = local_r_version
        self.local_r_path = local_r_path

    @property
    def preferred_method(self) -> ExecutionMethod:
        """Get preferred execution method"""
        if self.docker_available:
            return ExecutionMethod.DOCKER
        elif self.local_r_available:
            return ExecutionMethod.LOCAL_R
        else:
            return ExecutionMethod.NONE

    @property
    def any_available(self) -> bool:
        """Check if any execution method is available"""
        return self.docker_available or self.local_r_available

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response"""
        return {
            "docker_available": self.docker_available,
            "local_r_available": self.local_r_available,
            "preferred_method": self.preferred_method.value,
            "docker_error": self.docker_error,
            "local_r_error": self.local_r_error,
            "local_r_version": self.local_r_version,
            "local_r_path": self.local_r_path,
            "recommendation": self._get_recommendation()
        }

    def _get_recommendation(self) -> str:
        """Get user-friendly recommendation"""
        if self.docker_available:
            return "Docker is available - recommended for best isolation and consistency"
        elif self.local_r_available:
            return f"Using local R installation (version {self.local_r_version}) - Docker not available"
        else:
            return "No R execution method available - please install Docker Desktop or R"


class ExecutionDetector:
    """Detects available R execution methods"""

    @staticmethod
    def detect() -> ExecutionCapabilities:
        """
        Detect all available R execution methods

        Returns:
            ExecutionCapabilities with detection results
        """
        # Check Docker
        docker_available, docker_error = ExecutionDetector._check_docker()

        # Check Local R
        local_r_available, local_r_error, r_version, r_path = ExecutionDetector._check_local_r()

        capabilities = ExecutionCapabilities(
            docker_available=docker_available,
            local_r_available=local_r_available,
            docker_error=docker_error,
            local_r_error=local_r_error,
            local_r_version=r_version,
            local_r_path=r_path
        )

        logger.info(f"Execution detection: Docker={docker_available}, Local R={local_r_available}")
        if capabilities.preferred_method != ExecutionMethod.NONE:
            logger.info(f"Preferred method: {capabilities.preferred_method.value}")
        else:
            logger.warning("No R execution method available!")

        return capabilities

    @staticmethod
    def _check_docker() -> tuple[bool, Optional[str]]:
        """Check if Docker is available"""
        try:
            result = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                timeout=5,
                text=True
            )

            if result.returncode == 0:
                return True, None
            else:
                error_msg = "Docker daemon not running"
                if "error during connect" in result.stderr.lower():
                    error_msg = "Docker Desktop is not started - please start Docker Desktop application"
                return False, error_msg

        except FileNotFoundError:
            return False, "Docker not installed - install Docker Desktop from https://www.docker.com/products/docker-desktop"
        except subprocess.TimeoutExpired:
            return False, "Docker daemon not responding - try restarting Docker Desktop"
        except Exception as e:
            return False, f"Docker check failed: {str(e)}"

    @staticmethod
    def _check_local_r() -> tuple[bool, Optional[str], Optional[str], Optional[str]]:
        """Check if local R is available"""
        # Try to find Rscript
        rscript_path = shutil.which('Rscript')

        # Try common Windows paths if not in PATH
        if not rscript_path:
            common_paths = [
                r"C:\Program Files\R\R-4.3.2\bin\Rscript.exe",
                r"C:\Program Files\R\R-4.3.1\bin\Rscript.exe",
                r"C:\Program Files\R\R-4.2.3\bin\Rscript.exe",
                r"C:\Program Files\R\R-4.1.3\bin\Rscript.exe",
                r"C:\Program Files\R\R-4.4.0\bin\Rscript.exe",
            ]

            for path in common_paths:
                if Path(path).exists():
                    rscript_path = path
                    break

        if not rscript_path:
            return False, "R not installed - install from https://cran.r-project.org/", None, None

        # Get R version
        try:
            result = subprocess.run(
                [rscript_path, "--version"],
                capture_output=True,
                timeout=5,
                text=True
            )

            # Extract version from output
            version = "unknown"
            for line in result.stderr.split('\n'):
                if 'R scripting front-end version' in line:
                    parts = line.split('version')
                    if len(parts) > 1:
                        version = parts[1].strip().split()[0]
                        break

            return True, None, version, rscript_path

        except Exception as e:
            return False, f"R found but version check failed: {str(e)}", None, rscript_path


def get_execution_capabilities() -> ExecutionCapabilities:
    """
    Convenience function to get current execution capabilities

    Returns:
        ExecutionCapabilities instance
    """
    return ExecutionDetector.detect()
