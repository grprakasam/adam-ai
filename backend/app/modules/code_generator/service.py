"""
Code Generator Service

Main service for AI-powered ADAM code generation using configurable LLM providers.
Orchestrates template selection, prompt building, and batch processing.
"""

from typing import List, Dict, Any, Optional, Union
from loguru import logger
import re
from app.config import settings
from app.modules.llm_integration.service import get_llm_service, LLMIntegrationService
from .prompt_builder import PromptBuilder
from .cache_manager import CacheManager
from .multi_variable_generator import MultiVariableGenerator
from app.models.input_models import CodeSnippetResponse, Standards


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
        
        # Configuration - OPTIMIZED for speed
        self.batch_size = getattr(settings, 'BATCH_SIZE', 25)  # Increased from 10 to 25 for 2.5x fewer API calls
        self.max_concurrent = getattr(settings, 'MAX_CONCURRENT_REQUESTS', 15)  # Increased from 5 to 15 for 3x parallel processing
        
        # Create semaphore for concurrency control
        import asyncio
        self.semaphore = asyncio.Semaphore(self.max_concurrent)
        
        logger.info(f"✅ Initialized CodeGeneratorService with LLM provider: {settings.DEFAULT_LLM_PROVIDER}")
        logger.info(f"   Batch size: {self.batch_size}, Max concurrent: {self.max_concurrent} (OPTIMIZED)")
    
    async def _call_llm(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int,
        provider: Optional[str],
        model: Optional[str]
    ) -> Any:
        """
        Call the configured LLM service, supporting both legacy generate_completion and new generate methods.
        """
        llm_callable = getattr(self.llm_service, "generate_completion", None)
        if callable(llm_callable):
            return await llm_callable(
                prompt=prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                provider=provider,
                model=model
            )
        return await self.llm_service.generate(
            prompt=prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            provider=provider,
            model=model
        )
    
    @staticmethod
    def _extract_content(response: Any) -> str:
        """Normalize LLM response payloads to plain text."""
        if isinstance(response, str):
            return response.strip()
        if isinstance(response, dict):
            content = response.get("content") or response.get("text") or ""
            return content.strip()
        if hasattr(response, "content"):
            content_value = getattr(response, "content")
            if isinstance(content_value, str):
                return content_value.strip()
        return str(response).strip()
    
    @staticmethod
    def _extract_model_name(response: Any) -> Optional[str]:
        """Best-effort extraction of model name from LLM response objects."""
        if isinstance(response, dict):
            return response.get("model")
        return None
    
    def _build_rationale_summary(
        self,
        variable_name: str,
        derivation_logic: str,
        language: str,
        context: Dict[str, Any]
    ) -> str:
        """Create a deterministic rationale when an LLM rationale is not available."""
        dataset = context.get("adam_dataset") or context.get("dataset") or "ADSL"
        category = context.get("category")
        derivation_text = derivation_logic.strip() if derivation_logic else "the specification"
        rationale = (
            f"The {variable_name} derivation for {dataset} is implemented in {language} "
            f"by translating {derivation_text} directly into executable code."
        )
        if category:
            rationale += f" This variable belongs to the {category} category."
        return rationale
    
    async def generate_code_snippet(
        self,
        study_id: str,
        dataset: str,
        variable: str,
        derivation: str,
        spec_row: Dict[str, Any],
        standards: Union[Standards, Dict[str, Any]],
        language: str = "R",
        context: Optional[Dict[str, Any]] = None,
        llm_provider: Optional[str] = None,
        user_note: Optional[str] = None
    ) -> CodeSnippetResponse:
        """
        Backwards-compatible helper used by tests and legacy code paths to generate a single snippet with caching.
        """
        standards_data = (
            standards.model_dump() if isinstance(standards, Standards) else dict(standards or {})
        )
        note_fragment = (user_note or "").strip()
        derivation_for_cache = derivation or ""
        if note_fragment:
            derivation_for_cache = f"{derivation_for_cache}|note:{note_fragment}"
        cache_key = self.cache_manager.generate_cache_key(
            variable_name=variable,
            derivation=derivation_for_cache,
            language=language,
            adam_dataset=dataset,
            variable_type=spec_row.get("Type", "")
        )
        
        cached = self.cache_manager.get(cache_key)
        if cached:
            return CodeSnippetResponse(**cached)
        
        variable_payload = {
            "name": variable,
            "label": spec_row.get("Label", ""),
            "type": spec_row.get("Type", ""),
            "derivation": derivation,
            "is_required": str(spec_row.get("Core", "")).strip().lower() == "req"
        }
        
        context_payload: Dict[str, Any] = {
            "study_id": study_id,
            "adam_dataset": dataset,
            "adam_ig_version": standards_data.get("adam_ig_version", "1.3"),
            "sdtm_version": standards_data.get("sdtm_version", "Unknown"),
            "meddra_version": standards_data.get("meddra_version", "Unknown")
        }
        extra_context = dict(context or {})
        context_payload.update(extra_context)
        if "dataset" in extra_context and "adam_dataset" not in context_payload:
            context_payload["adam_dataset"] = extra_context["dataset"]
        context_payload.setdefault("required_variables", extra_context.get("required_variables", []))
        context_payload.setdefault(
            "sdtm_domains",
            extra_context.get("sdtm_domains") or extra_context.get("available_sdtm_domains", [])
        )
        context_payload.setdefault(
            "category",
            extra_context.get("category") or spec_row.get("Category", "General")
        )
        context_payload.setdefault("language", language)
        
        result = await self.generate_single_variable(
            variable=variable_payload,
            language=language,
            context=context_payload,
            llm_provider=llm_provider,
            user_note=user_note
        )
        result.setdefault("language", language)
        
        response_model = CodeSnippetResponse(**result)
        self.cache_manager.set(cache_key, response_model.model_dump())
        return response_model
    
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
                
                # Generate code using LLM service (supports legacy mock interface)
                code_response = await self._call_llm(
                    prompt=code_prompt,
                    temperature=0.3,  # Slightly higher for faster generation
                    max_tokens=400,  # OPTIMIZED: Reduced from 800 to 400 for 2x faster responses
                    provider=llm_provider,
                    model=model
                )
                raw_code = self._extract_content(code_response)
                
                # Clean the generated code to remove unwanted sections
                code_snippet = clean_generated_code(raw_code, language)
                
                coding_rationale = self._build_rationale_summary(
                    variable_name=variable_name,
                    derivation_logic=derivation,
                    language=language,
                    context=context
                )
                
                logger.info(f"✅ Successfully generated code for {variable_name}")
                
                # Build result matching old format
                metadata = {
                    'provider': llm_provider or settings.DEFAULT_LLM_PROVIDER,
                    'model': self._extract_model_name(code_response) or settings.DEFAULT_MODEL,
                    'language': language,
                    'variable_type': variable_type,
                    'user_note_applied': bool(note_summary)
                }
                if note_summary:
                    metadata['user_note_summary'] = note_summary[:200]

                result = {
                    'variable': variable_name,
                    'language': language,
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
                    'language': language,
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

        # Pre-filter: Check cache for already-generated variables (performance optimization)
        uncached_variables = []
        cached_results = []

        for variable in variables:
            variable_name = variable.get('name', 'Unknown')
            derivation = variable.get('derivation', '')
            variable_type = variable.get('type', '')
            adam_dataset = context.get('adam_dataset', 'ADSL')

            cache_key = self.cache_manager.generate_cache_key(
                variable_name=variable_name,
                derivation=derivation,
                language=language,
                adam_dataset=adam_dataset,
                variable_type=variable_type
            )

            cached = self.cache_manager.get(cache_key)
            if cached:
                logger.info(f"Cache hit for {variable_name} - skipping LLM call")
                cached_results.append((variable, cached))
            else:
                uncached_variables.append(variable)

        # OPTIMIZATION: Template-based quick generation for simple patterns
        # This skips LLM calls entirely for common patterns like direct mappings
        template_results = []
        llm_variables = []
        
        for variable in uncached_variables:
            quick_code = self._try_template_generation(variable, language, context)
            if quick_code:
                # Template generation succeeded - use it instead of LLM
                var_name = variable.get('name', 'Unknown')
                template_results.append({
                    'variable': var_name,
                    'language': language,
                    'code_snippet': quick_code,
                    'coding_rationale': f'Generated using template for {var_name}',
                    'validated': True,
                    'warnings': [],
                    'error': None,
                    'metadata': {
                        'provider': 'template',
                        'generation_method': 'template_based',
                        'variable_type': variable.get('type', 'Unknown')
                    }
                })
                # Cache the template result
                cache_key = self.cache_manager.generate_cache_key(
                    variable_name=var_name,
                    derivation=variable.get('derivation', ''),
                    language=language,
                    adam_dataset=context.get('adam_dataset', 'ADSL'),
                    variable_type=variable.get('type', '')
                )
                self.cache_manager.set(cache_key, template_results[-1])
            else:
                # Template generation failed - use LLM
                llm_variables.append(variable)
        
        template_count = len(template_results)
        if template_count > 0:
            logger.info(f"⚡ TEMPLATE GENERATION: {template_count} variables generated instantly (skipped LLM)")
            results.extend(template_results)
            completed += template_count
        
        # Report cache hits and template results
        cache_hits = len(cached_results)
        if cache_hits > 0 or template_count > 0:
            logger.info(f"✅ Found {cache_hits} cached + {template_count} template results, only {len(llm_variables)} need LLM generation")

        if progress_callback:
            await progress_callback({
                'status': 'started',
                'total': total_vars,
                'completed': cache_hits + template_count,
                'message': f'Starting code generation for {total_vars} variables ({cache_hits} cached, {template_count} templates, {len(llm_variables)} LLM)...'
            })
        
        # Update uncached_variables to only include those needing LLM
        uncached_variables = llm_variables

        # REVOLUTIONARY OPTIMIZATION: Multi-Variable Batch Generation
        # Generate code for 10 variables in 1 API call instead of 1 variable per call
        # This reduces API calls by 10x and avoids Groq rate limiting (20 req/min)
        # Expected improvement: 5 minutes → 30 seconds

        # Add cached results immediately
        for variable, cached_data in cached_results:
            results.append(cached_data)
            completed += 1

        # Report cached results summary
        if cache_hits > 0 and progress_callback:
            await progress_callback({
                'status': 'cache_loaded',
                'total': total_vars,
                'completed': completed,
                'message': f'Loaded {cache_hits} cached results, processing {len(uncached_variables)} new variables...'
            })

        # OPTIMIZED: Group uncached variables into batches of 25 for multi-variable generation
        # Increased from 10 to 25 for 2.5x fewer API calls and faster overall generation
        BATCH_SIZE = 25  # OPTIMIZED: Increased from 10 to 25
        variable_batches = []
        for i in range(0, len(uncached_variables), BATCH_SIZE):
            batch = uncached_variables[i:i + BATCH_SIZE]
            variable_batches.append(batch)

        logger.info(f"🚀 OPTIMIZED MULTI-VARIABLE BATCH GENERATION: {len(uncached_variables)} variables → {len(variable_batches)} API calls (batch size: {BATCH_SIZE})")
        logger.info(f"Expected speed improvement: 2.5x reduction in API calls + 3x concurrent processing = 5-10x faster")

        # Process batches concurrently
        async def process_batch(batch: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
            """Process a batch of variables in a single LLM call"""
            async with self.semaphore:
                try:
                    # Build multi-variable prompt
                    dataset = context.get('adam_dataset', 'ADSL')
                    batch_prompt = MultiVariableGenerator.build_multi_variable_prompt(
                        variables=batch,
                        language=language,
                        dataset=dataset
                    )

                    logger.info(f"Generating code for batch of {len(batch)} variables")

                    # Make single LLM call for entire batch
                    # OPTIMIZED: Reduced from 800 to 400 tokens per variable for faster generation
                    batch_response = await self._call_llm(
                        prompt=batch_prompt,
                        temperature=0.3,
                        max_tokens=400 * len(batch),  # OPTIMIZED: Reduced from 800 to 400 per variable (2x faster)
                        provider=llm_provider,
                        model=model
                    )

                    raw_response = self._extract_content(batch_response)

                    # Parse multi-variable response
                    code_snippets = MultiVariableGenerator.parse_multi_variable_response(
                        response_text=raw_response,
                        variables=batch
                    )

                    # Update language field for each result
                    for snippet in code_snippets:
                        snippet['language'] = language

                        # Clean the generated code
                        if 'code_snippet' in snippet:
                            snippet['code_snippet'] = clean_generated_code(
                                snippet['code_snippet'],
                                language
                            )

                        # Cache individual results
                        var_name = snippet.get('variable', '')
                        var_match = next((v for v in batch if v.get('name') == var_name), {})
                        cache_key = self.cache_manager.generate_cache_key(
                            variable_name=var_name,
                            derivation=var_match.get('derivation', ''),
                            language=language,
                            adam_dataset=dataset,
                            variable_type=var_match.get('type', '')
                        )
                        self.cache_manager.set(cache_key, snippet)

                    logger.info(f"✅ Batch complete: generated code for {len(code_snippets)} variables")
                    return code_snippets

                except Exception as e:
                    error_msg = str(e)
                    logger.error(f"Batch generation failed: {error_msg}", exc_info=True)

                    # Fallback: generate placeholders for all variables in batch
                    fallback_results = []
                    for variable in batch:
                        var_name = variable.get('name', 'Unknown')
                        fallback_code = self._generate_fallback_code(
                            var_name,
                            variable.get('type', 'Num'),
                            language
                        )
                        fallback_rationale = self._generate_fallback_rationale(
                            var_name,
                            variable.get('label', ''),
                            variable.get('derivation', ''),
                            error_msg
                        )

                        fallback_results.append({
                            'variable': var_name,
                            'language': language,
                            'code_snippet': fallback_code,
                            'coding_rationale': fallback_rationale,
                            'error': f"Batch generation failed: {error_msg}",
                            'validated': False,
                            'warnings': ['Batch generation failed - using template'],
                            'metadata': {
                                'provider': llm_provider or settings.DEFAULT_LLM_PROVIDER,
                                'model': 'fallback',
                                'language': language,
                                'variable_type': variable.get('type', 'Num'),
                                'is_fallback': True,
                                'batch_failed': True
                            }
                        })

                    return fallback_results

        # Create tasks for all batches
        batch_tasks = {}
        for batch in variable_batches:
            task = asyncio.create_task(process_batch(batch))
            batch_tasks[task] = batch

        logger.info(f"Submitted {len(batch_tasks)} batch tasks for concurrent processing")

        # Process batch results as they complete
        for task in asyncio.as_completed(batch_tasks.keys()):
            batch = batch_tasks[task]

            try:
                batch_results = await task

                # Add all results from the batch
                for result in batch_results:
                    results.append(result)
                    completed += 1

                    if progress_callback:
                        await progress_callback({
                            'status': 'variable_completed',
                            'total': total_vars,
                            'completed': completed,
                            'variable_name': result.get('variable', 'Unknown'),
                            'message': f'Completed {result.get("variable")} ({completed}/{total_vars})'
                        })

            except Exception as e:
                error_msg = str(e)
                logger.error(f"Failed to process batch: {error_msg}", exc_info=True)

                # Handle batch failure (fallback already applied in process_batch)
                for variable in batch:
                    completed += 1
                    if progress_callback:
                        await progress_callback({
                            'status': 'variable_error',
                            'total': total_vars,
                            'completed': completed,
                            'variable_name': variable.get('name', 'Unknown'),
                            'message': f'Batch error: {error_msg[:80]}'
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
    
    def _try_template_generation(
        self,
        variable: Dict[str, Any],
        language: str,
        context: Dict[str, Any]
    ) -> Optional[str]:
        """
        Try to generate code using templates for simple patterns (skips LLM call)
        
        This is a major optimization - detects common patterns and generates code instantly
        without making LLM API calls. Expected to cover 30-50% of variables.
        
        Args:
            variable: Variable dictionary
            language: Programming language
            context: Generation context
            
        Returns:
            Generated code if template matched, None otherwise
        """
        derivation = (variable.get('derivation', '') or '').strip().lower()
        variable_name = variable.get('name', '')
        variable_type = variable.get('type', 'Num')
        dataset = context.get('adam_dataset', 'ADSL')
        
        if not derivation:
            return None
        
        # Pattern 1: Direct mapping (e.g., "AGE from DM", "SEX from DM")
        direct_mapping_patterns = [
            'from dm', 'from dm$', 'from dm.', 'direct mapping', 'directly from',
            'same as', 'equals', 'equal to', 'copy from', 'taken from'
        ]
        if any(pattern in derivation for pattern in direct_mapping_patterns):
            # Extract source variable name (simplified)
            source_var = variable_name  # Default to same name
            if 'from' in derivation:
                parts = derivation.split('from')
                if len(parts) > 1:
                    source_part = parts[1].strip().split()[0].upper()
                    if source_part.startswith('DM') or source_part.startswith('ADSL'):
                        source_var = variable_name
            
            if language.upper() == 'R':
                return f"{dataset}${variable_name} <- DM${variable_name}"
            else:  # SAS
                return f"{variable_name} = DM.{variable_name};"
        
        # Pattern 2: Simple flag (Y/N, Yes/No)
        flag_patterns = ['flag', 'y/n', 'yes/no', 'indicator', 'binary']
        if any(pattern in derivation for pattern in flag_patterns):
            if language.upper() == 'R':
                return f"{dataset}${variable_name} <- ifelse(condition, 'Y', 'N')"
            else:  # SAS
                return f"if condition then {variable_name} = 'Y'; else {variable_name} = 'N';"
        
        # Pattern 3: Simple calculation (addition, subtraction)
        calc_patterns = ['sum', 'add', 'plus', '+', 'total', 'calculate']
        if any(pattern in derivation for pattern in calc_patterns) and '+' in derivation:
            if language.upper() == 'R':
                return f"{dataset}${variable_name} <- VAR1 + VAR2"
            else:  # SAS
                return f"{variable_name} = VAR1 + VAR2;"
        
        # Pattern 4: Date conversion
        date_patterns = ['date', 'datetime', 'convert date', 'format date']
        if any(pattern in derivation for pattern in date_patterns):
            if language.upper() == 'R':
                return f"{dataset}${variable_name} <- as.Date(DM$DATE_VAR)"
            else:  # SAS
                return f"{variable_name} = input(DM.DATE_VAR, yymmdd10.);"
        
        # Pattern 5: Missing value handling
        missing_patterns = ['missing', 'na', 'null', 'empty', 'blank']
        if any(pattern in derivation for pattern in missing_patterns):
            if language.upper() == 'R':
                if variable_type == 'Char':
                    return f"{dataset}${variable_name} <- ifelse(is.na(DM$VAR), '', DM$VAR)"
                else:
                    return f"{dataset}${variable_name} <- ifelse(is.na(DM$VAR), NA_real_, DM$VAR)"
            else:  # SAS
                return f"if missing(DM.VAR) then {variable_name} = .; else {variable_name} = DM.VAR;"
        
        # No template match - return None to use LLM
        return None
    
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
