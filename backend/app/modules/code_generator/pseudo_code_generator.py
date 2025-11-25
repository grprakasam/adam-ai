"""
Pseudo-Code Generator Module

Generates human-readable, step-by-step pseudo-code from ADAM variable derivation logic.
Designed to help domain experts understand derivation logic independent of programming language.
"""

from typing import Dict, Any, Optional, Tuple
from loguru import logger
from app.modules.llm_integration.service import get_llm_service, LLMIntegrationService, LLMProviderError
from app.config import settings


class PseudoCodeGenerator:
    """
    Generates language-neutral pseudo-code from variable derivation logic.

    Key design principles:
    - Plain English with logical operators (IF, THEN, ELSE, FOR, WHILE)
    - Clear indentation for nested logic
    - References SDTM domains and variables by name
    - Emphasizes clarity for domain experts
    - Graceful degradation on LLM failures
    """

    def __init__(self):
        """Initialize pseudo-code generator"""
        self.llm_service: LLMIntegrationService = get_llm_service()
        logger.info("✅ Initialized PseudoCodeGenerator")

    def _build_pseudo_code_prompt(
        self,
        variable_name: str,
        variable_label: str,
        derivation_logic: str,
        dataset_type: str,
        domain_context: Optional[str] = None
    ) -> str:
        """
        Build LLM prompt for pseudo-code generation.

        Args:
            variable_name: Name of the ADAM variable (e.g., SAFFL)
            variable_label: Human-readable label (e.g., Safety Population Flag)
            derivation_logic: Derivation logic from specification
            dataset_type: ADAM dataset type (e.g., ADSL, ADAE)
            domain_context: Optional additional context (e.g., therapeutic area)

        Returns:
            Formatted prompt string
        """
        prompt = f"""
You are an expert clinical data programmer specializing in CDISC standards and ADAM programming.

Task: Generate step-by-step pseudo-code that explains the derivation logic for an ADAM variable.

VARIABLE DETAILS:
- Variable Name: {variable_name}
- Variable Label: {variable_label}
- ADAM Dataset: {dataset_type}

DERIVATION LOGIC (from specification):
{derivation_logic}

{f"DOMAIN CONTEXT: {domain_context}" if domain_context else ""}

REQUIREMENTS:
1. Generate clear, step-by-step pseudo-code using plain English
2. Use logical keywords: IF, THEN, ELSE, FOR, WHILE, AND, OR, NOT
3. Indent nested logic (2 spaces per level) for clarity
4. Reference SDTM source domains and variables by name (e.g., "DM.SEX", "AE.AESOC")
5. Include variable transformations and conditional logic
6. Focus on clarity for domain experts (not SAS/R syntax)
7. Keep logic concise but complete
8. Add brief explanatory comments for complex steps

OUTPUT FORMAT:
Pseudo-Code:
[Step-by-step derivation logic here, max 20 lines]

Summary:
[1-2 sentence summary of what the variable does]

EXAMPLE FORMAT:
Pseudo-Code:
  1. START with empty dataset for {dataset_type}
  2. FOR each subject in DM (Demographics):
       a. Initialize SAFFL = 'N' (default: not in safety population)
       b. IF subject has at least one DOSE = 'Y':
            i. Set SAFFL = 'Y'
       c. IF subject's status = COMPLETED or ONGOING:
            i. Keep SAFFL value (already set or 'N')
  3. OUTPUT: Dataset with SAFFL populated per logic above

Summary: SAFFL indicates whether a subject was dosed and eligible for safety analysis.

Now generate pseudo-code for the variable {variable_name}:
"""
        return prompt

    async def generate_pseudo_code(
        self,
        variable_name: str,
        variable_label: str,
        derivation_logic: str,
        dataset_type: str,
        language: str = "R",
        provider: Optional[str] = None,
        domain_context: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str], bool, Optional[str]]:
        """
        Generate pseudo-code for a variable.

        Args:
            variable_name: ADAM variable name
            variable_label: Variable label
            derivation_logic: Derivation logic from spec
            dataset_type: ADAM dataset type (ADSL, ADAE, etc.)
            language: Programming language (R, SAS) - used only for context
            provider: LLM provider to use
            domain_context: Optional additional context

        Returns:
            Tuple of (pseudo_code, pseudo_summary, has_pseudo_code, error_message)
            - pseudo_code: Full pseudo-code string or None
            - pseudo_summary: 1-2 sentence summary or None
            - has_pseudo_code: Boolean indicating success
            - error_message: Error message if failed, None if successful
        """
        try:
            # Build prompt
            prompt = self._build_pseudo_code_prompt(
                variable_name=variable_name,
                variable_label=variable_label,
                derivation_logic=derivation_logic,
                dataset_type=dataset_type,
                domain_context=domain_context
            )

            # Call LLM
            logger.debug(f"Generating pseudo-code for {variable_name}")

            response = await self.llm_service.generate_completion(
                prompt=prompt,
                temperature=0.3,  # Lower temp for more deterministic output
                max_tokens=1000,  # Enough for step-by-step logic
                provider=provider,
                model=None  # Use default model
            )

            # Parse response
            pseudo_code, pseudo_summary = self._parse_pseudo_code_response(response, variable_name)

            if pseudo_code and pseudo_summary:
                logger.debug(f"✅ Generated pseudo-code for {variable_name}")
                return pseudo_code, pseudo_summary, True, None
            else:
                logger.warning(f"⚠️ Pseudo-code generation failed to parse for {variable_name}")
                return None, None, False, "Failed to parse pseudo-code response"

        except LLMProviderError as e:
            logger.warning(f"⚠️ LLM provider error for pseudo-code {variable_name}: {str(e)}")
            return None, None, False, f"LLM service error: {str(e)}"

        except Exception as e:
            logger.warning(f"⚠️ Unexpected error generating pseudo-code for {variable_name}: {str(e)}")
            return None, None, False, f"Unexpected error: {str(e)}"

    def _parse_pseudo_code_response(self, response: str, variable_name: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parse LLM response to extract pseudo-code and summary.

        Args:
            response: Raw LLM response
            variable_name: Variable name for logging

        Returns:
            Tuple of (pseudo_code, summary) or (None, None) if parsing fails
        """
        try:
            # Split by "Summary:" marker
            parts = response.split("Summary:")
            if len(parts) < 2:
                logger.warning(f"Could not find Summary marker in response for {variable_name}")
                return None, None

            # Extract pseudo-code (before Summary:)
            pseudo_code_raw = parts[0].strip()

            # Remove "Pseudo-Code:" prefix if present
            if pseudo_code_raw.startswith("Pseudo-Code:"):
                pseudo_code = pseudo_code_raw[len("Pseudo-Code:"):].strip()
            else:
                pseudo_code = pseudo_code_raw

            # Extract summary (after Summary:)
            summary = parts[1].strip()

            # Validate we have content
            if not pseudo_code or not summary:
                logger.warning(f"Empty pseudo-code or summary for {variable_name}")
                return None, None

            # Clean up summary (limit to first 2 sentences)
            summary = self._limit_summary(summary)

            # Validate pseudo-code length (should be reasonable, not too short or too long)
            if len(pseudo_code) < 50 or len(pseudo_code) > 2000:
                logger.warning(f"Pseudo-code length unusual for {variable_name}: {len(pseudo_code)} chars")
                return None, None

            return pseudo_code, summary

        except Exception as e:
            logger.warning(f"Error parsing pseudo-code response for {variable_name}: {str(e)}")
            return None, None

    def _limit_summary(self, summary: str, max_sentences: int = 2) -> str:
        """
        Limit summary to specified number of sentences.

        Args:
            summary: Raw summary text
            max_sentences: Maximum number of sentences to keep

        Returns:
            Limited summary
        """
        # Simple sentence splitting on periods (could be enhanced for complex cases)
        sentences = [s.strip() for s in summary.split('.') if s.strip()]

        # Take first N sentences and rejoin
        limited = '.'.join(sentences[:max_sentences])

        # Add period if not present
        if not limited.endswith('.'):
            limited += '.'

        return limited


# Singleton instance
_pseudo_code_generator: Optional[PseudoCodeGenerator] = None


def get_pseudo_code_generator() -> PseudoCodeGenerator:
    """Get or create pseudo-code generator instance (singleton)"""
    global _pseudo_code_generator
    if _pseudo_code_generator is None:
        _pseudo_code_generator = PseudoCodeGenerator()
    return _pseudo_code_generator
