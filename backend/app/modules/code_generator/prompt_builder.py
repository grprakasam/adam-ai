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
        context: Dict[str, Any]
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
        
        # Build prompt
        prompt = f"""You are an expert CDISC ADAM programmer specializing in {language}.

Generate production-ready {language} code for the following ADAM variable.

**Variable Information:**
- Variable Name: {variable_name}
- Variable Label: {variable_label}
- Variable Type: {variable_type}
- Derivation Logic: {derivation_logic}

**Dataset Context:**
- ADAM Dataset: {adam_dataset}
- Available SDTM Domains: {', '.join(context.get('sdtm_domains', []))}
- CDISC ADAM IG Version: {context.get('adam_ig_version', 'Unknown')}
- CDISC SDTM Version: {context.get('sdtm_version', 'Unknown')}

{rules_context}

**Programming Requirements:**
1. Follow CDISC ADAM Implementation Guide v{context.get('adam_ig_version', '1.3')} standards
2. Apply CDISC variable naming conventions (see ADAM Standards and Rules above)
3. Handle missing values appropriately (use NA in R, . or "" in SAS)
4. Include clear, concise comments
5. Use consistent indentation and formatting
6. Code must be executable and production-ready
7. Follow best practices for {language} programming
8. Ensure compliance with all ADAM rules and standards listed above

{template_hint}

**Instructions:**
Generate ONLY the code snippet. Do not include explanations, markdown formatting, or additional commentary.
The code should be directly executable in {language}.
"""
        
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
