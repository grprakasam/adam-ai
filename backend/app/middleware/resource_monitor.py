"""
Resource Monitoring Middleware for SDTM Generation

Monitors memory usage and validates generation requests to prevent OOM errors.
"""

import psutil
from fastapi import HTTPException
from typing import Dict, Any
from loguru import logger

# Configuration
MAX_MEMORY_MB = 1024  # 1GB per request
MAX_GENERATION_SIZE = 1000  # Maximum subjects per request
MEMORY_WARNING_THRESHOLD = 85  # Percentage


class ResourceMonitor:
    """Monitor system resources and validate generation requests"""

    @staticmethod
    def estimate_memory_usage(
        domain: str,
        num_subjects: int,
        records_per_subject: int = None,
        num_visits: int = 6
    ) -> float:
        """
        Estimate memory usage for SDTM generation request.

        Returns estimated memory in MB.
        """
        # Base estimate: ~100 bytes per row
        BYTES_PER_ROW = 100

        estimated_rows = num_subjects

        # Domain-specific row calculations
        if domain.upper() == 'DM':
            estimated_rows = num_subjects  # 1 row per subject
        elif domain.upper() == 'AE':
            estimated_rows = num_subjects * (records_per_subject or 5)
        elif domain.upper() == 'LB':
            # Lab: num_subjects × num_tests × num_visits
            num_lab_tests = 7  # HGB, WBC, PLT, ALT, AST, CREAT, GLUC
            estimated_rows = num_subjects * num_lab_tests * num_visits
        elif domain.upper() == 'VS':
            # Vital signs: num_subjects × num_tests × num_visits
            num_vs_tests = 6  # SYSBP, DIABP, PULSE, TEMP, WEIGHT, HEIGHT
            estimated_rows = num_subjects * num_vs_tests * num_visits
        elif domain.upper() == 'EX':
            # Exposure: num_subjects × num_doses
            estimated_rows = num_subjects * (records_per_subject or 10)
        elif domain.upper() == 'DS':
            # Disposition: num_subjects × events
            estimated_rows = num_subjects * (records_per_subject or 3)

        # Convert to MB
        estimated_memory_mb = (estimated_rows * BYTES_PER_ROW) / (1024 * 1024)

        logger.debug(
            f"Memory estimate for {domain}: {estimated_rows} rows = "
            f"{estimated_memory_mb:.2f} MB"
        )

        return estimated_memory_mb

    @staticmethod
    def validate_generation_request(
        domain: str,
        num_subjects: int,
        records_per_subject: int = None,
        num_visits: int = 6
    ) -> Dict[str, Any]:
        """
        Validate that generation request won't exceed memory limits.

        Raises HTTPException if request is too large or system memory is low.

        Returns validation results dict.
        """
        # Estimate memory
        estimated_memory_mb = ResourceMonitor.estimate_memory_usage(
            domain=domain,
            num_subjects=num_subjects,
            records_per_subject=records_per_subject,
            num_visits=num_visits
        )

        # Check against limit
        if estimated_memory_mb > MAX_MEMORY_MB:
            raise HTTPException(
                status_code=413,  # Payload Too Large
                detail={
                    "error": "Request too large",
                    "estimated_memory_mb": round(estimated_memory_mb, 2),
                    "limit_mb": MAX_MEMORY_MB,
                    "suggestion": (
                        f"Reduce num_subjects (current: {num_subjects}) or "
                        "use batch generation with smaller chunks. "
                        f"Maximum recommended subjects for {domain}: "
                        f"{int(num_subjects * MAX_MEMORY_MB / estimated_memory_mb)}"
                    )
                }
            )

        # Check subject count limit
        if num_subjects > MAX_GENERATION_SIZE:
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Too many subjects requested",
                    "num_subjects": num_subjects,
                    "limit": MAX_GENERATION_SIZE,
                    "suggestion": f"Use batch generation with chunks of {MAX_GENERATION_SIZE} subjects"
                }
            )

        # Check current system memory
        memory = psutil.virtual_memory()
        if memory.percent > MEMORY_WARNING_THRESHOLD:
            logger.warning(
                f"High memory usage: {memory.percent}% "
                f"(used: {memory.used / (1024**3):.2f} GB / "
                f"total: {memory.total / (1024**3):.2f} GB)"
            )
            raise HTTPException(
                status_code=503,  # Service Unavailable
                detail={
                    "error": "Server memory usage high",
                    "memory_percent": memory.percent,
                    "suggestion": "Please retry in a few minutes when server load is lower"
                }
            )

        # Validation passed
        return {
            "valid": True,
            "estimated_memory_mb": round(estimated_memory_mb, 2),
            "current_memory_percent": memory.percent,
            "available_memory_gb": round(memory.available / (1024**3), 2)
        }

    @staticmethod
    def validate_batch_request(
        domains: list,
        num_subjects: int,
        records_per_subject: int = None,
        num_visits: int = 6
    ) -> Dict[str, Any]:
        """
        Validate batch generation request (multiple domains).

        Returns validation results with total estimated memory.
        """
        total_memory_mb = 0
        domain_estimates = {}

        for domain in domains:
            estimate = ResourceMonitor.estimate_memory_usage(
                domain=domain,
                num_subjects=num_subjects,
                records_per_subject=records_per_subject,
                num_visits=num_visits
            )
            domain_estimates[domain] = estimate
            total_memory_mb += estimate

        # Check total against limit
        # For batch, allow 2x limit since we process sequentially
        batch_limit = MAX_MEMORY_MB * 2

        if total_memory_mb > batch_limit:
            raise HTTPException(
                status_code=413,
                detail={
                    "error": "Batch request too large",
                    "total_estimated_memory_mb": round(total_memory_mb, 2),
                    "limit_mb": batch_limit,
                    "domain_estimates": {k: round(v, 2) for k, v in domain_estimates.items()},
                    "suggestion": (
                        f"Reduce num_subjects (current: {num_subjects}) or "
                        f"split into smaller batches. Largest domain: "
                        f"{max(domain_estimates, key=domain_estimates.get)} "
                        f"({round(max(domain_estimates.values()), 2)} MB)"
                    )
                }
            )

        # Check system memory
        memory = psutil.virtual_memory()
        if memory.percent > MEMORY_WARNING_THRESHOLD:
            raise HTTPException(
                status_code=503,
                detail={
                    "error": "Server memory usage high",
                    "memory_percent": memory.percent,
                    "suggestion": "Please retry in a few minutes"
                }
            )

        return {
            "valid": True,
            "total_estimated_memory_mb": round(total_memory_mb, 2),
            "domain_estimates": {k: round(v, 2) for k, v in domain_estimates.items()},
            "current_memory_percent": memory.percent
        }


def get_system_metrics() -> Dict[str, Any]:
    """Get current system resource metrics"""
    memory = psutil.virtual_memory()
    cpu = psutil.cpu_percent(interval=1)

    return {
        "memory": {
            "total_gb": round(memory.total / (1024**3), 2),
            "available_gb": round(memory.available / (1024**3), 2),
            "used_gb": round(memory.used / (1024**3), 2),
            "percent": memory.percent
        },
        "cpu": {
            "percent": cpu,
            "count": psutil.cpu_count()
        }
    }
