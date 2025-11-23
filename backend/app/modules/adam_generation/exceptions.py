"""
ADAM Generation Exceptions

Domain-specific exceptions for ADAM dataset generation workflow.
Provides clear error messages and recovery guidance for ADAM programmers.

Design Philosophy:
- User-friendly messages for domain experts, not just developers
- Actionable recovery steps that an ADAM programmer can follow
- Detailed error context for debugging and audit trails
"""

from typing import Optional, Dict, Any, List


class AdamGenerationError(Exception):
    """
    Base exception for ADAM generation errors

    Provides structured error information with user-friendly messages
    and actionable recovery steps tailored for ADAM programmers.
    """

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        user_message: Optional[str] = None,
        recovery_actions: Optional[List[str]] = None
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code or "ADAM_GEN_ERROR"
        self.details = details or {}
        self.user_message = user_message or message
        self.recovery_actions = recovery_actions or []

    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to API-friendly dictionary for frontend display"""
        return {
            "error_code": self.error_code,
            "message": self.message,
            "user_message": self.user_message,
            "details": self.details,
            "recovery_actions": self.recovery_actions
        }


class DockerUnavailableError(AdamGenerationError):
    """Docker runtime is not available or not responding"""

    def __init__(self, message: str = "Docker runtime unavailable"):
        super().__init__(
            message=message,
            error_code="DOCKER_UNAVAILABLE",
            user_message="R runtime environment is currently unavailable. The system cannot execute R programs at this time.",
            recovery_actions=[
                "Contact your system administrator to verify Docker service status",
                "Try again in a few minutes - the service may be restarting",
                "If urgent, ask your admin about temporary local R execution option"
            ]
        )


class ValidationError(AdamGenerationError):
    """Input validation failed before execution"""

    def __init__(self, message: str, validation_errors: Optional[List[str]] = None):
        errors = validation_errors or []
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            user_message=f"Cannot proceed with ADAM generation: {message}",
            details={"validation_errors": errors},
            recovery_actions=[
                "Review the validation errors listed below",
                "Ensure all required inputs are provided",
                "Verify study context and dataset selection are correct"
            ]
        )
        self.errors = errors


class InputDataNotFoundError(AdamGenerationError):
    """Required SDTM datasets not found for ADAM generation"""

    def __init__(self, missing_domains: List[str], study_id: str, adam_dataset: str):
        domains_str = ', '.join(missing_domains)
        message = f"Missing required SDTM datasets for {adam_dataset} generation: {domains_str}"
        super().__init__(
            message=message,
            error_code="INPUT_DATA_NOT_FOUND",
            user_message=f"Cannot generate {adam_dataset} - required SDTM datasets are missing: {domains_str}",
            details={
                "missing_domains": missing_domains,
                "study_id": study_id,
                "adam_dataset": adam_dataset
            },
            recovery_actions=[
                f"Navigate to the Testing tab and generate the missing SDTM datasets: {domains_str}",
                f"Verify that study '{study_id}' is selected in the Testing tab",
                "Ensure SDTM generation completed successfully before trying ADAM generation",
                "Check that the study ID matches between specification upload and testing"
            ]
        )


class ExecutionTimeoutError(AdamGenerationError):
    """R execution exceeded configured timeout limit"""

    def __init__(self, timeout_seconds: int, elapsed_seconds: Optional[float] = None):
        super().__init__(
            message=f"R execution exceeded {timeout_seconds}s timeout" +
                   (f" (ran for {elapsed_seconds:.1f}s)" if elapsed_seconds else ""),
            error_code="EXECUTION_TIMEOUT",
            user_message=f"Your R program took longer than {timeout_seconds} seconds and was stopped automatically.",
            details={
                "timeout_seconds": timeout_seconds,
                "elapsed_seconds": elapsed_seconds
            },
            recovery_actions=[
                "Review your R code for inefficient operations (nested loops, large merges)",
                "Consider processing a smaller subset of subjects for testing first",
                "Optimize data transformations using vectorized operations (dplyr, data.table)",
                "If this dataset genuinely requires more time, contact your admin to request a timeout extension"
            ]
        )


class RRuntimeError(AdamGenerationError):
    """R code execution failed with runtime error"""

    def __init__(
        self,
        message: str,
        error_line: Optional[int] = None,
        stderr: Optional[str] = None,
        failed_statement: Optional[str] = None
    ):
        details = {}
        if error_line:
            details["error_line"] = error_line
        if stderr:
            details["stderr"] = stderr[:1000]  # Limit to first 1000 chars
        if failed_statement:
            details["failed_statement"] = failed_statement

        user_msg = f"R execution error: {message}"
        if error_line:
            user_msg += f" (near line {error_line})"

        super().__init__(
            message=message,
            error_code="R_RUNTIME_ERROR",
            user_message=user_msg,
            details=details,
            recovery_actions=[
                "Review the R code editor for syntax errors or typos",
                "Verify that variable names match your SDTM datasets (DM, AE, etc.)",
                "Check that all required R packages are loaded (library calls)",
                "Use the 'View Detailed Logs' button to see the complete error message",
                "Test your code logic with a small subset of data first"
            ]
        )


class OutputNotGeneratedError(AdamGenerationError):
    """Expected ADAM dataset was not created by R execution"""

    def __init__(self, adam_dataset: str, output_dir: Optional[str] = None):
        super().__init__(
            message=f"Output dataset {adam_dataset} was not generated by R program",
            error_code="OUTPUT_NOT_GENERATED",
            user_message=f"The ADAM dataset '{adam_dataset}' was not created. Your R code may not be writing the output correctly.",
            details={
                "adam_dataset": adam_dataset,
                "output_dir": output_dir
            },
            recovery_actions=[
                f"Verify your R code creates a dataset named exactly '{adam_dataset}' (case-sensitive)",
                f"Ensure the code saves the dataset using write.csv() or write_csv() to the output directory",
                "Check that the last line of your code doesn't have errors that prevent output creation",
                "Review the execution logs to see if any warnings or errors occurred during processing"
            ]
        )


class CodeNotFoundError(AdamGenerationError):
    """Consolidated ADAM program code not found"""

    def __init__(self, code_id: Optional[str] = None, adam_dataset: Optional[str] = None):
        message = f"Consolidated code for {adam_dataset} not found" if adam_dataset else "Consolidated code not found"
        if code_id:
            message += f" (ID: {code_id})"

        super().__init__(
            message=message,
            error_code="CODE_NOT_FOUND",
            user_message=f"No R program found for {adam_dataset or 'this dataset'}. You need to generate the consolidated code first.",
            details={"code_id": code_id, "adam_dataset": adam_dataset},
            recovery_actions=[
                "Navigate to the 'Consolidated Code' tab",
                "Generate the consolidated ADAM program for your selected dataset",
                "Ensure code generation completed successfully before proceeding",
                "Alternatively, paste your R code directly into the editor in the ADAM Generator tab"
            ]
        )


class InsufficientResourcesError(AdamGenerationError):
    """Execution failed due to resource limits (memory, CPU)"""

    def __init__(self, resource_type: str, limit: Any, actual: Optional[Any] = None):
        message = f"{resource_type} limit exceeded: {limit}"
        if actual:
            message += f" (used: {actual})"

        super().__init__(
            message=message,
            error_code="INSUFFICIENT_RESOURCES",
            user_message=f"R execution failed because it exceeded the {resource_type} limit ({limit}).",
            details={
                "resource_type": resource_type,
                "limit": limit,
                "actual": actual
            },
            recovery_actions=[
                "Reduce the number of subjects in your SDTM test data",
                "Simplify complex derivations or split them into multiple steps",
                "Remove unnecessary intermediate datasets from memory in your R code",
                "Use more memory-efficient R packages (data.table instead of base R)",
                "Contact your administrator to request higher resource limits for production use"
            ]
        )


class StudyContextError(AdamGenerationError):
    """Study context is missing or invalid"""

    def __init__(self, study_id: Optional[str] = None):
        message = f"Invalid study context" + (f": {study_id}" if study_id else "")
        super().__init__(
            message=message,
            error_code="STUDY_CONTEXT_ERROR",
            user_message="Study context is not properly set. Please select a study before generating ADAM datasets.",
            details={"study_id": study_id},
            recovery_actions=[
                "Go to the Setup or Landing page and select your study",
                "Verify you're working in the correct study context",
                "Refresh the page if the study context appears to be lost"
            ]
        )


# Alias for backward compatibility
TimeoutError = ExecutionTimeoutError
CodeExecutionError = RRuntimeError
OutputNotFoundError = OutputNotGeneratedError

