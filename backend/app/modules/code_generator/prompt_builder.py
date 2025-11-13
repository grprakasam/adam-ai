"""
Prompt Builder for Code Generation

Constructs prompts for Gemini API to generate ADAM code and rationale.
"""

from typing import Dict, Any, Optional
from loguru import logger
from .templates.r_templates.derivation_templates import get_r_template, list_r_templates
from .templates.sas_templates.derivation_templates import get_sas_template, list_sas_templates
from app.modules.rule_loading.service import RuleLoadingService


class TemplateSelector:
    """Select appropriate template based on derivation logic"""
    
    def select_template(self, derivation: str, language: str) -> Optional[str]:
        """
        Select best matching template for the derivation logic
        
        Args:
            derivation: Derivation logic text
            language: Programming language (R or SAS)
            
        Returns:
            Template name if found, None otherwise
        """
        if not derivation:
            return None
        
        derivation_lower = derivation.lower()
        
        # Pattern matching for template selection
        if "flag" in derivation_lower or "y/n" in derivation_lower:
            if "baseline" in derivation_lower:
                return "baseline_flag"
            elif "worst" in derivation_lower:
                return "worst_case_flag"
            return "conditional_flag"
        
        elif "date" in derivation_lower:
            if "datetime" in derivation_lower or "time" in derivation_lower:
                return "datetime_conversion"
            return "date_conversion"
        
        elif "merge" in derivation_lower or "join" in derivation_lower:
            return "merge_datasets"
        
        elif any(word in derivation_lower for word in ["sum", "mean", "average", "count", "min", "max"]):
            return "aggregate_function"
        
        elif "concat" in derivation_lower or "combine" in derivation_lower:
            return "string_concatenation"
        
        elif "extract" in derivation_lower or "substring" in derivation_lower:
            return "string_extraction"
        
        elif "group" in derivation_lower or "by " in derivation_lower:
            return "grouping_operation"
        
        elif "sort" in derivation_lower or "order" in derivation_lower:
            return "sorting"
        
        elif "filter" in derivation_lower or "where" in derivation_lower or "subset" in derivation_lower:
            return "filter_rows"
        
        elif "calculate" in derivation_lower or any(op in derivation_lower for op in ["+", "-", "*", "/"]):
            return "numeric_calculation"
        
        else:
            return "direct_derivation"


class PromptBuilder:
    """Build prompts for code generation and rationale"""
    
    def __init__(self):
        self.template_selector = TemplateSelector()
        self.rule_service = RuleLoadingService()
        self.rules_cache: Dict[str, str] = {}
        logger.info("Initialized PromptBuilder with RuleLoadingService")
    
    async def load_rules(self) -> None:
        """Load all ADAM rules into cache"""
        if not self.rules_cache:
            self.rules_cache = await self.rule_service.load_all_rules()
            logger.info(f"Loaded {len(self.rules_cache)} ADAM rule files")
    
    def _format_rules_context(self, adam_dataset: str = "ADSL") -> str:
        """
        Format ADAM rules for inclusion in prompts
        
        Args:
            adam_dataset: ADAM dataset type (e.g., "ADSL")
            
        Returns:
            Formatted rules text
        """
        if not self.rules_cache:
            return ""
        
        rules_text = "\n**ADAM Standards and Rules:**\n"
        
        # Include variable naming rules (always relevant)
        if "ADAM_VariablenamingRules" in self.rules_cache:
            rules_text += "\n*Variable Naming Conventions:*\n"
            rules_text += self.rules_cache["ADAM_VariablenamingRules"] + "\n"
        
        # Include dataset-specific rules
        dataset_prefix = adam_dataset.upper()
        for rule_name, rule_content in self.rules_cache.items():
            if rule_name.startswith(dataset_prefix):
                rules_text += f"\n*{rule_name.replace('_', ' ')}:*\n"
                rules_text += rule_content + "\n"
        
        return rules_text
    
    async def build_code_generation_prompt(
        self,
        variable_name: str,
        variable_label: str,
        variable_type: str,
        derivation_logic: str,
        language: str,
        context: Dict[str, Any],
        user_note: Optional[str] = None
    ) -> str:
        """
        Build comprehensive prompt for code generation
        
        Args:
            variable_name: Name of the variable to generate code for
            variable_label: Label/description of the variable
            variable_type: Data type of the variable
            derivation_logic: Derivation logic from specification
            language: Programming language (R or SAS)
            context: Additional context (dataset, standards, etc.)
            user_note: Optional user-provided intention that should guide regeneration
            
        Returns:
            Formatted prompt for Gemini
        """
        # Load rules if not already loaded
        await self.load_rules()
        
        # Select appropriate template
        template_name = self.template_selector.select_template(derivation_logic, language)
        template_hint = ""
        
        if template_name:
            if language.upper() == "R":
                template_code = get_r_template(template_name)
            else:
                template_code = get_sas_template(template_name)
            
            if template_code:
                template_hint = f"\n\nSuggested Template Pattern:\n{template_code}\n"
        
        # Get ADAM rules context
        adam_dataset = context.get('adam_dataset', 'ADSL')
        rules_context = self._format_rules_context(adam_dataset)
        user_note_section = ""
        if user_note:
            cleaned_note = user_note.strip()
            if cleaned_note:
                user_note_section = (
                    "\n**User Intent / Requested Adjustments:**\n"
                    f"{cleaned_note}\n"
                    "Honor these instructions while keeping CDISC/ADaM compliance."
                )
        
        # Build prompt
        prompt = f"""You are an expert CDISC ADAM programmer. Generate ONLY the essential {language} code to implement the derivation logic - nothing more.

**Variable:** {variable_name} ({variable_label})
**Type:** {variable_type}
**Derivation:** {derivation_logic}
**Dataset:** {adam_dataset}
**Standards:** ADAM IG v{context.get('adam_ig_version', '1.3')}, SDTM v{context.get('sdtm_version', 'Unknown')}

{rules_context}

{user_note_section}

{template_hint}

**CRITICAL REQUIREMENTS:**
1. Generate ONLY the core derivation code - the direct conversion of the derivation logic into {language}
2. NO introductory comments (e.g., "Derivation of variable...", "Based on standards...")
3. NO library loading statements (e.g., library(dplyr))
4. NO example usage code (e.g., "Example usage:", test data frames, print statements)
5. NO explanatory text before or after the code
6. Include ONLY minimal inline comments for complex logic
7. The code must be a pure function or logic block that can be directly integrated
8. Follow CDISC standards and variable naming conventions

Return ONLY executable {language} code that implements the derivation logic."""
        
        return prompt.strip()
    
    def build_rationale_prompt(
        self,
        variable_name: str,
        code_snippet: str,
        derivation_logic: str,
        language: str
    ) -> str:
        """
        Build prompt for generating high-level coding rationale
        
        Args:
            variable_name: Name of the variable
            code_snippet: Generated code snippet
            derivation_logic: Original derivation logic
            language: Programming language
            
        Returns:
            Formatted prompt for rationale generation
        """
        prompt = f"""Provide a brief, high-level rationale (2-3 sentences) explaining how the derivation logic was translated into {language} code for the variable {variable_name}.

**Derivation Logic:**
{derivation_logic}

**Generated Code:**
{code_snippet}

**Instructions:**
Write a concise explanation focusing on:
1. The main transformation approach used
2. Key data sources or operations involved
3. Any special handling applied

Keep the explanation business-friendly and non-technical. Avoid code-level details.
Write in clear, professional language suitable for clinical study documentation.
"""
        
        return prompt.strip()
    
    def build_syntax_validation_prompt(
        self,
        code_snippet: str,
        language: str
    ) -> str:
        """
        Build prompt for syntax validation
        
        Args:
            code_snippet: Code to validate
            language: Programming language
            
        Returns:
            Validation prompt
        """
        prompt = f"""Review the following {language} code for syntax errors and best practices.

**Code:**
{code_snippet}

**Instructions:**
1. Check for syntax errors
2. Verify proper formatting
3. Ensure code follows {language} best practices
4. Identify any potential runtime issues

Respond with:
- "VALID" if the code is syntactically correct
- "INVALID: [reason]" if there are errors, with a brief explanation
"""
        
        return prompt.strip()
    
    def get_template_suggestion(self, derivation: str, language: str) -> Optional[str]:
        """Get template suggestion for a derivation"""
        template_name = self.template_selector.select_template(derivation, language)
        if not template_name:
            return None
        
        if language.upper() == "R":
            return get_r_template(template_name)
        else:
            return get_sas_template(template_name)
