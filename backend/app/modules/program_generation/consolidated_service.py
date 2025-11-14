"""
Consolidated Code Generation Service - Main Orchestrator
"""

from typing import Optional
from datetime import datetime
from loguru import logger

from .models import (
    ConsolidatedCodeRequest,
    ConsolidatedCodeResponse,
    ConsolidatedCodeData,
    ConsolidatedCodeSummary,
    ValidationResult,
    GenerationMetadata
)
from .validators import CodeValidator
from .assembler import CodeAssembler
from .optimizer import CodeOptimizer
from .comment_engine import CommentEngine
from .progress_tracker import ProgressTracker


class ConsolidatedCodeService:
    """Main service for generating consolidated ADAM code"""

    def __init__(self):
        self.validator = CodeValidator()
        self.assembler = CodeAssembler()
        self.optimizer = CodeOptimizer()
        self.comment_engine = CommentEngine()

    async def generate_consolidated_code(
        self,
        request: ConsolidatedCodeRequest,
        progress_callback: Optional[callable] = None
    ) -> ConsolidatedCodeResponse:
        """
        Generate consolidated code from approved variables

        Args:
            request: ConsolidatedCodeRequest with all parameters
            progress_callback: Optional callback for progress updates

        Returns:
            ConsolidatedCodeResponse with generated code and metadata
        """
        try:
            # Initialize progress tracker
            tracker = ProgressTracker(total_steps=7, callback=progress_callback)

            # Step 1: Validate inputs (10%)
            tracker.update("Validating inputs", 10)
            is_valid, errors = self.validator.validate_variables(request.approved_variables)
            if not is_valid:
                return ConsolidatedCodeResponse(
                    status="error",
                    message=f"Validation failed: {'; '.join(errors)}",
                    error_code="VALIDATION_ERROR"
                )

            # Check approval threshold
            total_vars = len(request.approved_variables)
            approved_vars = len([v for v in request.approved_variables if v.code_snippet])
            threshold_met, msg = self.validator.validate_approval_threshold(total_vars, approved_vars)

            if not threshold_met:
                return ConsolidatedCodeResponse(
                    status="error",
                    message=msg,
                    error_code="INSUFFICIENT_APPROVALS"
                )

            # Step 2: Sanitize code snippets (20%)
            tracker.update("Sanitizing code", 20)
            for var in request.approved_variables:
                var.code_snippet = self.validator.sanitize_code(var.code_snippet, request.language)

                # Safety check
                is_safe, safety_issues = self.validator.validate_code_safety(var.code_snippet, request.language)
                if not is_safe:
                    logger.warning(f"Safety issues in {var.name}: {safety_issues}")

            # Step 3: Assemble code by category (40%)
            tracker.update("Assembling code by category", 40)
            user_prefs_dict = request.user_preferences.dict() if request.user_preferences else {}

            assembled_code = self.assembler.assemble(
                variables=request.approved_variables,
                language=request.language,
                comment_verbosity=request.comment_verbosity,
                user_preferences=user_prefs_dict
            )

            # Step 4: Optimize code (60%)
            tracker.update("Optimizing code", 60)
            optimization_level = user_prefs_dict.get('optimization_level', 'standard')
            optimized_code, optimizations = self.optimizer.optimize(
                code=assembled_code,
                language=request.language,
                optimization_level=optimization_level
            )

            # Step 5: Add header and footer comments (70%)
            tracker.update("Adding documentation", 70)
            metadata = {
                'study_id': request.study_id,
                'adam_version': request.standards_version.get('adam', '1.3') if request.standards_version else '1.3',
                'sdtm_version': request.standards_version.get('sdtm', '1.7') if request.standards_version else '1.7',
                'specification_file': 'User uploaded specification'
            }

            header = self.comment_engine.generate_header(
                dataset=request.dataset,
                language=request.language,
                verbosity=request.comment_verbosity,
                metadata=metadata
            )

            footer = self.comment_engine.generate_footer(
                language=request.language,
                verbosity=request.comment_verbosity
            )

            final_code = header + optimized_code + footer

            # Step 6: Validate output (85%)
            tracker.update("Validating output", 85)
            validation_results = self._validate_output(final_code, request.language, request.dataset)

            # Step 7: Prepare response (95%)
            tracker.update("Preparing response", 95)

            # Calculate summary statistics
            lines_of_code = len(final_code.split('\n'))
            file_size_kb = len(final_code.encode('utf-8')) / 1024

            # Count unique categories
            categories = set(v.category for v in request.approved_variables)

            generation_time = tracker.complete()

            summary = ConsolidatedCodeSummary(
                total_variables=len(request.approved_variables),
                categories_included=len(categories),
                lines_of_code=lines_of_code,
                file_size_kb=round(file_size_kb, 2),
                optimizations_applied=optimizations,
                generation_time_seconds=round(generation_time, 2),
                confidence_score=self._calculate_confidence_score(validation_results)
            )

            generation_metadata = GenerationMetadata(
                generated_at=datetime.utcnow(),
                llm_provider="ollama" if request.execution_mode == "local" else "gemini",
                model_used="llama3.2" if request.execution_mode == "local" else "gemini-2.5-flash",
                execution_mode=request.execution_mode
            )

            data = ConsolidatedCodeData(
                consolidated_code=final_code,
                summary=summary,
                validation_results=validation_results,
                metadata=generation_metadata
            )

            logger.info(f"Consolidated code generation completed: {lines_of_code} lines, {file_size_kb:.2f} KB")

            return ConsolidatedCodeResponse(
                status="success",
                data=data
            )

        except Exception as e:
            logger.error(f"Consolidated code generation failed: {e}", exc_info=True)
            return ConsolidatedCodeResponse(
                status="error",
                message=str(e),
                error_code="GENERATION_ERROR"
            )

    def _validate_output(self, code: str, language: str, dataset: str) -> ValidationResult:
        """
        Validate generated code for syntax and CDISC compliance

        Args:
            code: Generated code
            language: Programming language
            dataset: ADAM dataset type

        Returns:
            ValidationResult with validation status
        """
        warnings = []
        errors = []

        # Basic syntax check (simplified)
        if language == "R":
            # Check for balanced brackets
            if code.count('{') != code.count('}'):
                errors.append("Unbalanced curly braces detected")
            if code.count('(') != code.count(')'):
                errors.append("Unbalanced parentheses detected")

            # Check for library calls
            if 'library(' not in code and 'require(' not in code:
                warnings.append("No library loading detected - ensure required packages are loaded")

        elif language == "SAS":
            # Check for RUN statements
            if 'DATA' in code.upper() and 'RUN;' not in code.upper():
                errors.append("DATA step without RUN statement")

            # Check for balanced quotes
            single_quotes = code.count("'") - code.count("\\'")
            if single_quotes % 2 != 0:
                errors.append("Unbalanced single quotes detected")

        # CDISC compliance checks
        required_vars = self._get_required_adam_variables(dataset)
        for req_var in required_vars:
            if req_var not in code:
                warnings.append(f"Required ADAM variable {req_var} not found in code")

        # Determine validation status
        syntax_valid = len(errors) == 0
        cdisc_compliant = len([w for w in warnings if 'Required ADAM variable' in w]) == 0

        return ValidationResult(
            syntax_valid=syntax_valid,
            cdisc_compliant=cdisc_compliant,
            warnings=warnings,
            errors=errors
        )

    def _get_required_adam_variables(self, dataset: str) -> list:
        """Get required variables for ADAM dataset"""
        required = {
            "ADSL": ["STUDYID", "USUBJID", "SUBJID", "SITEID", "AGE", "SEX", "RACE"],
            "ADAE": ["STUDYID", "USUBJID", "AESEQ", "AEDECOD", "AESTDTC"],
            "ADLB": ["STUDYID", "USUBJID", "PARAMCD", "PARAM", "AVAL"],
        }
        return required.get(dataset, [])

    def _calculate_confidence_score(self, validation: ValidationResult) -> float:
        """
        Calculate AI confidence score based on validation results

        Args:
            validation: ValidationResult

        Returns:
            Confidence score (0-100)
        """
        base_score = 100.0

        # Deduct points for errors and warnings
        base_score -= len(validation.errors) * 20  # Major deduction for errors
        base_score -= len(validation.warnings) * 5  # Minor deduction for warnings

        # Bonus for compliance
        if validation.syntax_valid:
            base_score += 0  # Already at 100 if no errors
        if validation.cdisc_compliant:
            base_score += 0  # Already factored in

        return max(min(base_score, 100.0), 0.0)  # Clamp between 0-100
