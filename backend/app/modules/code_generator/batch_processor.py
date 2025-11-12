"""
Batch Processor for Code Generation

Handles batch processing of variables with parallel execution and caching.
"""

import asyncio
from typing import List, Dict, Any
from loguru import logger
from .cache_manager import CacheManager
from .gemini_client import GeminiClient
from .prompt_builder import PromptBuilder


class BatchProcessor:
    """Process variables in batches with caching and parallel execution"""
    
    def __init__(
        self,
        gemini_client: GeminiClient,
        prompt_builder: PromptBuilder,
        cache_manager: CacheManager,
        batch_size: int = 10,
        max_concurrent: int = 5
    ):
        """
        Initialize batch processor
        
        Args:
            gemini_client: Gemini API client
            prompt_builder: Prompt builder instance
            cache_manager: Cache manager instance
            batch_size: Number of variables per batch
            max_concurrent: Maximum concurrent API requests
        """
        self.gemini_client = gemini_client
        self.prompt_builder = prompt_builder
        self.cache_manager = cache_manager
        self.batch_size = batch_size
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        
        logger.info(
            f"Initialized BatchProcessor "
            f"(batch_size={batch_size}, max_concurrent={max_concurrent})"
        )
    
    def create_batches(
        self,
        variables: List[Dict[str, Any]],
        batch_size: int
    ) -> List[List[Dict[str, Any]]]:
        """
        Split variables into batches
        
        Args:
            variables: List of variables
            batch_size: Size of each batch
            
        Returns:
            List of batches
        """
        batches = []
        for i in range(0, len(variables), batch_size):
            batches.append(variables[i:i + batch_size])
        return batches
    
    async def process_variables_batch(
        self,
        variables: List[Dict[str, Any]],
        language: str,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Process variables in batches with caching
        
        Args:
            variables: List of variable dictionaries
            language: Programming language (R or SAS)
            context: Generation context
            
        Returns:
            List of CodeSnippetResponse dictionaries
        """
        logger.info(f"Starting batch processing for {len(variables)} variables")
        
        # Step 1: Check cache for existing snippets
        cached_results, uncached_variables = self.cache_manager.split_cached_uncached(
            variables=variables,
            language=language,
            adam_dataset=context.get('adam_dataset', '')
        )
        
        results = list(cached_results)  # Start with cached results
        
        # Step 2: Process uncached variables in batches
        if uncached_variables:
            batches = self.create_batches(uncached_variables, self.batch_size)
            logger.info(f"Processing {len(batches)} batches for {len(uncached_variables)} uncached variables")
            
            for batch_index, batch in enumerate(batches):
                logger.info(f"Processing batch {batch_index + 1}/{len(batches)}")
                
                batch_results = await self.process_batch(
                    batch=batch,
                    language=language,
                    context=context
                )
                
                results.extend(batch_results)
                
                # Cache successful results
                for variable, result in zip(batch, batch_results):
                    if not result.get('error'):
                        cache_key = self.cache_manager.generate_cache_key(
                            variable_name=variable.get('name', ''),
                            derivation=variable.get('derivation', ''),
                            language=language,
                            adam_dataset=context.get('adam_dataset', ''),
                            variable_type=variable.get('type', '')
                        )
                        self.cache_manager.set(cache_key, result)
        
        logger.info(f"Batch processing complete: {len(results)} results")
        return results
    
    async def process_batch(
        self,
        batch: List[Dict[str, Any]],
        language: str,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Process a single batch of variables in parallel
        
        Args:
            batch: Batch of variables
            language: Programming language
            context: Generation context
            
        Returns:
            List of results
        """
        tasks = [
            self.generate_single_variable(variable, language, context)
            for variable in batch
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Error processing variable {batch[i].get('name', 'Unknown')}: {str(result)}")
                processed_results.append({
                    'variable': batch[i].get('name', ''),
                    'code_snippet': '',
                    'coding_rationale': '',
                    'error': str(result),
                    'validated': False
                })
            else:
                processed_results.append(result)
        
        return processed_results
    
    async def generate_single_variable(
        self,
        variable: Dict[str, Any],
        language: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate code for a single variable with concurrency control
        
        Args:
            variable: Variable dictionary
            language: Programming language
            context: Generation context
            
        Returns:
            CodeSnippetResponse dictionary
        """
        async with self.semaphore:  # Control concurrency
            try:
                variable_name = variable.get('name', '')
                variable_label = variable.get('label', '')
                variable_type = variable.get('type', '')
                derivation = variable.get('derivation', '')
                
                logger.debug(f"Generating code for variable: {variable_name}")
                
                # Build prompt for code generation (now async)
                code_prompt = await self.prompt_builder.build_code_generation_prompt(
                    variable_name=variable_name,
                    variable_label=variable_label,
                    variable_type=variable_type,
                    derivation_logic=derivation,
                    language=language,
                    context=context
                )
                
                # Generate code
                code_snippet = await self.gemini_client.generate_code(
                    prompt=code_prompt,
                    language=language,
                    temperature=0.2
                )
                
                # Build prompt for rationale
                rationale_prompt = self.prompt_builder.build_rationale_prompt(
                    variable_name=variable_name,
                    code_snippet=code_snippet,
                    derivation_logic=derivation,
                    language=language
                )
                
                # Generate rationale
                coding_rationale = await self.gemini_client.generate_text(
                    prompt=rationale_prompt,
                    temperature=0.3
                )
                
                # Basic syntax validation
                is_valid = self.validate_syntax_basic(code_snippet, language)
                
                return {
                    'variable': variable_name,
                    'code_snippet': code_snippet,
                    'coding_rationale': coding_rationale,
                    'metadata': {
                        'provider': 'gemini',
                        'model': self.gemini_client.model,
                        'language': language,
                        'variable_type': variable_type,
                        'template_used': self.prompt_builder.get_template_suggestion(derivation, language)
                    },
                    'validated': is_valid,
                    'warnings': [] if is_valid else ['Syntax validation failed'],
                    'error': None
                }
                
            except Exception as e:
                logger.error(f"Failed to generate code for {variable.get('name', 'Unknown')}: {str(e)}")
                return {
                    'variable': variable.get('name', ''),
                    'code_snippet': '',
                    'coding_rationale': '',
                    'error': str(e),
                    'validated': False,
                    'warnings': [],
                    'metadata': {}
                }
    
    def validate_syntax_basic(self, code: str, language: str) -> bool:
        """
        Basic syntax validation
        
        Args:
            code: Code snippet to validate
            language: Programming language
            
        Returns:
            True if syntax appears valid
        """
        if not code or len(code.strip()) == 0:
            return False
        
        # Basic checks
        if language.upper() == "R":
            # Check for balanced parentheses and brackets
            if code.count('(') != code.count(')'):
                return False
            if code.count('[') != code.count(']'):
                return False
            if code.count('{') != code.count('}'):
                return False
        
        elif language.upper() == "SAS":
            # Check for semicolons and run statements
            lines = code.split('\n')
            code_lines = [line.strip() for line in lines if line.strip() and not line.strip().startswith('/*')]
            if code_lines and not any(';' in line for line in code_lines):
                return False
        
        return True
    
    def get_stats(self) -> Dict[str, Any]:
        """Get batch processor statistics"""
        return {
            'batch_size': self.batch_size,
            'max_concurrent': self.max_concurrent,
            'cache_stats': self.cache_manager.get_stats()
        }
