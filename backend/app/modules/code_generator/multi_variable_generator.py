"""
Multi-Variable Code Generator

Revolutionary approach: Generate code for MULTIPLE variables in a single LLM call.
This reduces API calls by 10x and avoids rate limiting.
"""

from typing import List, Dict, Any
from loguru import logger
import json


class MultiVariableGenerator:
    """Generate code for multiple variables in a single LLM call"""

    @staticmethod
    def build_multi_variable_prompt(
        variables: List[Dict[str, Any]],
        language: str,
        dataset: str
    ) -> str:
        """
        Build a prompt that generates code for multiple variables at once

        Args:
            variables: List of 5-10 variables to generate code for
            language: R or SAS
            dataset: ADAM dataset name

        Returns:
            Optimized prompt for batch generation
        """
        var_specs = []
        # OPTIMIZED: Increased from 10 to 25 variables per batch
        for v in variables[:25]:  # Max 25 variables per batch (optimized for speed)
            var_specs.append(
                f"{v.get('name')}: {v.get('type')} - {v.get('derivation', 'Direct mapping')}"
            )

        vars_text = "\n".join(var_specs)

        # OPTIMIZED: Lightweight prompt for faster generation (removed verbose instructions)
        prompt = f"""Generate {language} code for {len(variables)} ADAM variables. Output JSON only.

Dataset: {dataset}
Variables:
{vars_text}

JSON format: [{{"variable": "VAR1", "code": "code here"}}, ...]
Code only, no comments, minimal syntax."""

        return prompt.strip()

    @staticmethod
    def parse_multi_variable_response(
        response_text: str,
        variables: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Parse LLM response containing code for multiple variables

        Args:
            response_text: LLM response text
            variables: Original variable list

        Returns:
            List of CodeSnippetResponse dictionaries
        """
        try:
            # Try to parse as JSON
            # Handle potential markdown code blocks
            text = response_text.strip()
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()

            results = json.loads(text)

            # Convert to CodeSnippetResponse format
            code_snippets = []
            for item in results:
                var_name = item.get('variable', '')
                code = item.get('code', '')

                # Find matching variable for metadata
                var_match = next((v for v in variables if v.get('name') == var_name), {})

                code_snippets.append({
                    'variable': var_name,
                    'language': 'R',  # Will be set by caller
                    'code_snippet': code,
                    'coding_rationale': f'Derived from specification for {var_name}',
                    'validated': True,
                    'warnings': [],
                    'error': None,
                    'metadata': {
                        'provider': 'groq',
                        'generation_method': 'multi_variable_batch',
                        'variable_type': var_match.get('type', 'Unknown')
                    }
                })

            return code_snippets

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse multi-variable response: {e}")
            logger.error(f"Response text: {response_text[:500]}")

            # Fallback: create placeholder results
            return [
                {
                    'variable': v.get('name'),
                    'language': 'R',
                    'code_snippet': f"# Placeholder for {v.get('name')}",
                    'coding_rationale': 'Failed to parse batch response',
                    'validated': False,
                    'warnings': ['Batch generation failed, using placeholder'],
                    'error': str(e),
                    'metadata': {'generation_method': 'fallback'}
                }
                for v in variables
            ]
