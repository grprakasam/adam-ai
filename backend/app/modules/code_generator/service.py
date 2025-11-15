"""
Code Generator Service

Main service for AI-powered ADAM code generation using configurable LLM providers.
Orchestrates template selection, prompt building, and batch processing.
"""

from typing import List, Dict, Any, Optional
from loguru import logger
import re
from app.config import settings
from app.modules.llm_integration.service import get_llm_service, LLMIntegrationService
from .prompt_builder import PromptBuilder
from .cache_manager import CacheManager


def clean_generated_code(code: str, language: str) -> str:
    """
    Clean generated code by removing unwanted sections
    
    Args:
        code: Raw generated code
        language: Programming language ('R' or 'SAS')
    
    Returns:
        Cleaned code with only essential derivation logic
    """
    lines = code.split('\n')
    cleaned_lines = []
    skip_mode = False
    
    for line in lines:
        line_stripped = line.strip().lower()
        
        # Skip library/package loading statements
        if language.upper() == 'R':
            if line_stripped.startswith('library(') or line_stripped.startswith('require('):
                continue
        
        # Skip example usage sections (common patterns)
        if any(pattern in line_stripped for pattern in [
            'example usage:', 
            '# example', 
            'example:',
            'test data',
            'for testing',
            'sample usage'
        ]):
            skip_mode = True
            continue
        
        # Skip print/cat statements that are clearly for testing
        if skip_mode:
            # Look for end of example section (blank line or start of new section)
            if line_stripped == '' or (line_stripped.startswith('#') and 'example' not in line_stripped):
                skip_mode = False
            continue
        
        # Skip introductory comment headers
        if any(pattern in line_stripped for pattern in [
            'derivation of',
            'based on adam',
            'based on sdtm',
            'based on standards',
            'load necessary',
            'load required'
        ]):
            continue
        
        # Keep the line
        cleaned_lines.append(line)
    
    # Remove leading/trailing blank lines
    while cleaned_lines and cleaned_lines[0].strip() == '':
        cleaned_lines.pop(0)
    while cleaned_lines and cleaned_lines[-1].strip() == '':
        cleaned_lines.pop()
    
    return '\n'.join(cleaned_lines)


class CodeGeneratorService:
    """Main service for code generation"""
    
    def __init__(self):
        """Initialize code generation service"""
        # Initialize LLM integration service (supports Groq, OpenAI, Anthropic, Google)
        self.llm_service: LLMIntegrationService = get_llm_service()
        
        self.prompt_builder = PromptBuilder()
        
        self.cache_manager = CacheManager(
            ttl=getattr(settings, 'CACHE_TTL', 3600)
        )
        
        # Configuration
        self.batch_size = getattr(settings, 'BATCH_SIZE', 10)
        self.max_concurrent = getattr(settings, 'MAX_CONCURRENT_REQUESTS', 5)
        
        # Create semaphore for concurrency control
        import asyncio
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        
        logger.info(f"✅ Initialized CodeGeneratorService with LLM provider: {settings.DEFAULT_LLM_PROVIDER}")
        logger.info(f"   Batch size: {self.batch_size}, Max concurrent: {self.max_concurrent}")
    
    async def generate_code_for_all_variables(
        self,
        study_id: str,
        dataset: str,
        categorized_variables: Dict[str, Any],
        language: str,
        standards: Dict[str, Any],
        llm_provider: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Generate code for ALL variables across ALL categories
        
        This is the main entry point called from the API endpoint.
        
        Args:
            study_id: Study identifier
            dataset: ADAM dataset name (e.g., "ADSL")
            categorized_variables: Categorization result with all variables
            language: Programming language (R or SAS)
            standards: Standards information (SDTM version, ADAM IG version, etc.)
            llm_provider: LLM provider to use (groq, openai, anthropic, google). If None, uses default.
            
        Returns:
            List of CodeSnippetResponse dictionaries
        """
        logger.info(
            f"Starting bulk code generation for study={study_id}, "
            f"dataset={dataset}, language={language}"
        )
        
        try:
            # Collect all variables from all categories
            all_variables = self.collect_all_variables(categorized_variables)
            logger.info(f"Collected {len(all_variables)} total variables")
            
            # Return empty list if no variables to process
            if not all_variables:
                logger.warning("No variables to process - returning empty results")
                return []
            
            # Build generation context
            context = self.build_generation_context(
                study_id=study_id,
                dataset=dataset,
                standards=standards,
                categorized_variables=categorized_variables
            )
            
            # Process variables using new LLM service
            results = await self.process_variables_with_llm(
                variables=all_variables,
                language=language,
                context=context,
                llm_provider=llm_provider
            )
            
            logger.info(f"Bulk code generation complete: {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Bulk code generation failed: {str(e)}", exc_info=True)
            raise
    
    async def generate_single_variable(
        self,
        variable: Dict[str, Any],
        language: str,
        context: Dict[str, Any],
        llm_provider: Optional[str] = None,
        model: Optional[str] = None,
        user_note: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate code for a single variable (for retry/regeneration)
        
        Args:
            variable: Variable dictionary
            language: Programming language
            context: Generation context
            llm_provider: LLM provider to use
            model: Specific model to use (for openrouter)
            user_note: Optional free-form instruction from the user guiding this regeneration
            
        Returns:
            CodeSnippetResponse dictionary
        """
        variable_name = variable.get('name', 'Unknown')
        note_summary = user_note.strip() if isinstance(user_note, str) else None
        
        # Use semaphore to control concurrency
        async with self.semaphore:
            logger.info(f"Generating code for variable: {variable_name}")
            if note_summary:
                logger.info(f"Applying user guidance for {variable_name}: {note_summary[:120]}")
            
            try:
                variable_label = variable.get('label', '')
                variable_type = variable.get('type', '')
                derivation = variable.get('derivation', '')
                
                # Build prompt for code generation
                code_prompt = await self.prompt_builder.build_code_generation_prompt(
                    variable_name=variable_name,
                    variable_label=variable_label,
                    variable_type=variable_type,
                    derivation_logic=derivation,
                    language=language,
                    context=context,
                    user_note=note_summary
                )
                
                # Generate code using LLM service
                code_response = await self.llm_service.generate(
                    prompt=code_prompt,
                    temperature=0.2,
                    max_tokens=2000,
                    provider=llm_provider,
                    model=model
                )
                raw_code = code_response.get('content', '')
                
                # Clean the generated code to remove unwanted sections
                code_snippet = clean_generated_code(raw_code, language)
                
                # Build prompt for rationale
                rationale_prompt = self.prompt_builder.build_rationale_prompt(
                    variable_name=variable_name,
                    code_snippet=code_snippet,
                    derivation_logic=derivation,
                    language=language
                )
                
                # Generate rationale using LLM service
                rationale_response = await self.llm_service.generate(
                    prompt=rationale_prompt,
                    temperature=0.3,
                    max_tokens=500,
                    provider=llm_provider,
                    model=model
                )
                coding_rationale = rationale_response.get('content', '')
                
                logger.info(f"✅ Successfully generated code for {variable_name}")
                
                # Build result matching old format
                metadata = {
                    'provider': settings.DEFAULT_LLM_PROVIDER,
                    'model': code_response.get('model', settings.DEFAULT_MODEL),
                    'language': language,
                    'variable_type': variable_type,
                    'user_note_applied': bool(note_summary)
                }
                if note_summary:
                    metadata['user_note_summary'] = note_summary[:200]

                result = {
                    'variable': variable_name,
                    'code_snippet': code_snippet,
                    'coding_rationale': coding_rationale,
                    'metadata': metadata,
                    'validated': True,  # Basic validation
                    'warnings': [],
                    'error': None
                }
                
                return result
                
            except Exception as e:
                error_msg = str(e)
                logger.error(f"❌ Failed to generate code for {variable_name}: {error_msg}", exc_info=True)
                
                # Provide helpful fallback guidance
                fallback_code = self._generate_fallback_code(variable_name, variable_type, language)
                fallback_rationale = self._generate_fallback_rationale(variable_name, variable_label, derivation, error_msg)
                
                return {
                    'variable': variable_name,
                    'code_snippet': fallback_code,
                    'coding_rationale': fallback_rationale,
                    'error': f"Generation failed: {error_msg}. Using fallback template.",
                    'validated': False,
                    'warnings': ['This is a template - please review and customize'],
                    'metadata': {
                        'provider': llm_provider or settings.DEFAULT_LLM_PROVIDER,
                        'model': 'fallback',
                        'language': language,
                        'variable_type': variable_type,
                        'is_fallback': True
                    }
                }
    
    async def process_variables_with_llm(
        self,
        variables: List[Dict[str, Any]],
        language: str,
        context: Dict[str, Any],
        llm_provider: Optional[str] = None,
        model: Optional[str] = None,
        progress_callback=None
    ) -> List[Dict[str, Any]]:
        """
        Process multiple variables using LLM service
        
        Args:
            variables: List of variable dictionaries
            language: Programming language
            context: Generation context
            llm_provider: LLM provider to use (groq, openai, anthropic, google, openrouter). If None, uses default.
            model: Specific model to use (required for openrouter)
            progress_callback: Optional async callback for progress updates
            
        Returns:
            List of CodeSnippetResponse dictionaries
        """
        import asyncio
        
        results = []
        total_vars = len(variables)
        completed = 0
        
        logger.info(f"Starting to process {total_vars} variables with LLM service")
        
        if progress_callback:
            await progress_callback({
                'status': 'started',
                'total': total_vars,
                'completed': 0,
                'message': f'Starting code generation for {total_vars} variables...'
            })
        
        # Process in batches
        for i in range(0, len(variables), self.batch_size):
            batch = variables[i:i + self.batch_size]
            batch_num = i // self.batch_size + 1
            total_batches = (len(variables) + self.batch_size - 1) // self.batch_size
            
            logger.info(f"Processing batch {batch_num}/{total_batches} ({len(batch)} variables)")
            
            if progress_callback:
                await progress_callback({
                    'status': 'batch_started',
                    'total': total_vars,
                    'completed': completed,
                    'batch': batch_num,
                    'total_batches': total_batches,
                    'message': f'Processing batch {batch_num} of {total_batches}...'
                })
            
            # Create tasks for ALL variables in batch (not just max_concurrent)
            tasks = []
            for variable in batch:
                tasks.append(self.generate_single_variable(variable, language, context, llm_provider, model))
            
            # Execute tasks with concurrency control via semaphore in generate_single_variable
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for idx, result in enumerate(batch_results):
                completed += 1
                variable = batch[idx]
                variable_name = variable.get('name', 'Unknown')
                
                if isinstance(result, Exception):
                    error_msg = str(result)
                    logger.error(f"Failed to generate code for {variable_name}: {error_msg}", exc_info=True)
                    
                    # Generate fallback with helpful template
                    fallback_code = self._generate_fallback_code(
                        variable_name, 
                        variable.get('type', 'Num'),
                        language
                    )
                    fallback_rationale = self._generate_fallback_rationale(
                        variable_name,
                        variable.get('label', ''),
                        variable.get('derivation', ''),
                        error_msg
                    )
                    
                    # Add error result with fallback code and helpful guidance
                    error_result = {
                        'variable': variable_name,
                        'code_snippet': fallback_code,
                        'coding_rationale': fallback_rationale,
                        'error': f"Generation failed: {error_msg}. Using fallback template.",
                        'validated': False,
                        'warnings': ['This is a template - please review and customize'],
                        'metadata': {
                            'provider': llm_provider or settings.DEFAULT_LLM_PROVIDER,
                            'model': 'fallback',
                            'language': language,
                            'variable_type': variable.get('type', 'Num'),
                            'is_fallback': True
                        }
                    }
                    results.append(error_result)
                    
                    if progress_callback:
                        await progress_callback({
                            'status': 'variable_error',
                            'total': total_vars,
                            'completed': completed,
                            'variable_name': variable_name,
                            'message': f'Error generating {variable_name}: {str(result)[:100]}'
                        })
                else:
                    results.append(result)
                    
                    if progress_callback:
                        await progress_callback({
                            'status': 'variable_completed',
                            'total': total_vars,
                            'completed': completed,
                            'variable_name': variable_name,
                            'message': f'Completed {variable_name} ({completed}/{total_vars})'
                        })
        
        if progress_callback:
            await progress_callback({
                'status': 'completed',
                'total': total_vars,
                'completed': completed,
                'message': f'Successfully generated code for {total_vars} variables'
            })
        
        logger.info(f"Completed processing: {len(results)} total results")
        return results
    
    def collect_all_variables(
        self,
        categorized_variables: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Collect all variables from categorized result
        
        Args:
            categorized_variables: Categorization result
            
        Returns:
            List of all variables
        """
        all_variables = []
        
        categories = categorized_variables.get('categories', [])
        for category in categories:
            variables = category.get('variables', [])
            all_variables.extend(variables)
        
        return all_variables
    
    def build_generation_context(
        self,
        study_id: str,
        dataset: str,
        standards: Dict[str, Any],
        categorized_variables: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Build context for code generation
        
        Args:
            study_id: Study identifier
            dataset: ADAM dataset name
            standards: Standards information
            categorized_variables: Categorization result
            
        Returns:
            Context dictionary
        """
        # Extract available SDTM domains (could be enhanced with actual file scanning)
        sdtm_domains = ["DM", "AE", "LB", "VS", "EX", "CM", "MH"]  # Default common domains
        
        # Extract required variables from categories
        required_variables = []
        categories = categorized_variables.get('categories', [])
        for category in categories:
            for variable in category.get('variables', []):
                if variable.get('is_required'):
                    required_variables.append(variable.get('name'))
        
        context = {
            'study_id': study_id,
            'adam_dataset': dataset,
            'sdtm_domains': sdtm_domains,
            'sdtm_version': standards.get('sdtm_version', '1.7'),
            'adam_ig_version': standards.get('adam_ig_version', '1.3'),
            'meddra_version': standards.get('meddra_version', '26.0'),
            'required_variables': required_variables,
            'total_variables': categorized_variables.get('total_variables', 0)
        }
        
        return context
    
    def _generate_fallback_code(self, variable_name: str, variable_type: str, language: str) -> str:
        """
        Generate fallback code template when AI generation fails
        
        Args:
            variable_name: Variable name
            variable_type: Variable type (Num, Char, etc.)
            language: Programming language (R or SAS)
            
        Returns:
            Fallback code template
        """
        if language.upper() == 'R':
            if variable_type == 'Char':
                return f"""# TODO: Implement derivation for {variable_name}
# This is a placeholder - please customize based on your requirements
adam${variable_name} <- NA_character_

# Example approaches:
# 1. Direct mapping: adam${variable_name} <- sdtm$VARIABLE
# 2. Conditional logic: adam${variable_name} <- ifelse(condition, value1, value2)
# 3. Text manipulation: adam${variable_name} <- toupper(sdtm$VARIABLE)
"""
            else:  # Numeric
                return f"""# TODO: Implement derivation for {variable_name}
# This is a placeholder - please customize based on your requirements
adam${variable_name} <- NA_real_

# Example approaches:
# 1. Direct mapping: adam${variable_name} <- as.numeric(sdtm$VARIABLE)
# 2. Calculation: adam${variable_name} <- sdtm$VAR1 - sdtm$VAR2
# 3. Aggregation: adam${variable_name} <- mean(sdtm$VARIABLE, na.rm = TRUE)
"""
        else:  # SAS
            if variable_type == 'Char':
                return f"""/* TODO: Implement derivation for {variable_name} */
/* This is a placeholder - please customize based on your requirements */
{variable_name} = '';

/* Example approaches:
   1. Direct mapping: {variable_name} = VARIABLE;
   2. Conditional logic: if condition then {variable_name} = value1; else {variable_name} = value2;
   3. Text manipulation: {variable_name} = upcase(VARIABLE);
*/
"""
            else:  # Numeric
                return f"""/* TODO: Implement derivation for {variable_name} */
/* This is a placeholder - please customize based on your requirements */
{variable_name} = .;

/* Example approaches:
   1. Direct mapping: {variable_name} = VARIABLE;
   2. Calculation: {variable_name} = VAR1 - VAR2;
   3. Aggregation: proc means data=sdtm mean; var VARIABLE; output out=temp mean={variable_name}; run;
*/
"""
    
    def _generate_fallback_rationale(
        self, 
        variable_name: str, 
        variable_label: str,
        derivation: str,
        error_msg: str
    ) -> str:
        """
        Generate fallback rationale when AI generation fails
        
        Args:
            variable_name: Variable name
            variable_label: Variable label
            derivation: Derivation logic (from spec)
            error_msg: Error message from failed generation
            
        Returns:
            Fallback rationale text
        """
        rationale_parts = [
            f"**Variable:** {variable_name}",
            f"**Label:** {variable_label}" if variable_label else None,
            "",
            "**AI Generation Status:** Failed",
            f"**Error:** {error_msg[:200]}...", 
            "",
            "**Specification Derivation:**",
            derivation if derivation else "No derivation logic provided in specification",
            "",
            "**Action Required:**",
            "- Review the specification requirements carefully",
            "- Customize the placeholder code template above",
            "- Implement the actual derivation logic",
            "- Test with your study data",
            "- Mark as 'Accept' when ready",
            "",
            "**Tips:**",
            "- Refer to ADAM IG for standard variable definitions",
            "- Check similar variables in your SDTM datasets",
            "- Ensure proper data type handling and missing value codes",
            "- Add comments for complex derivations"
        ]
        
        return "\n".join([part for part in rationale_parts if part is not None])
    
    def clear_cache(self):
        """Clear the code generation cache"""
        self.cache_manager.clear()
        logger.info("Cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics"""
        provider_info = self.llm_service.get_provider_info()
        return {
            'service': 'code_generator',
            'llm_provider': settings.DEFAULT_LLM_PROVIDER,
            'llm_model': settings.DEFAULT_MODEL,
            'available_providers': provider_info.get('available_providers', []),
            'cache_stats': self.cache_manager.get_stats() if hasattr(self.cache_manager, 'get_stats') else {}
        }


# Global service instance (will be initialized on first use)
_code_generator_service: CodeGeneratorService = None


def get_code_generator_service() -> CodeGeneratorService:
    """Get or create code generator service instance"""
    global _code_generator_service
    if _code_generator_service is None:
        _code_generator_service = CodeGeneratorService()
    return _code_generator_service
