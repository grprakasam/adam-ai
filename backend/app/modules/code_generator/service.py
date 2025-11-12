"""
Code Generator Service

Main service for AI-powered ADAM code generation using Google Gemini.
Orchestrates template selection, prompt building, and batch processing.
"""

from typing import List, Dict, Any
from loguru import logger
from app.config import settings
from .gemini_client import GeminiClient
from .prompt_builder import PromptBuilder
from .cache_manager import CacheManager
from .batch_processor import BatchProcessor


class CodeGeneratorService:
    """Main service for code generation"""
    
    def __init__(self):
        """Initialize code generation service"""
        # Initialize components
        self.gemini_client = GeminiClient(
            api_key=settings.GEMINI_API_KEY,
            model=getattr(settings, 'GEMINI_MODEL', 'gemini-2.0-flash-exp'),
            max_retries=3,
            timeout=30
        )
        
        self.prompt_builder = PromptBuilder()
        
        self.cache_manager = CacheManager(
            ttl=getattr(settings, 'CACHE_TTL', 3600)
        )
        
        self.batch_processor = BatchProcessor(
            gemini_client=self.gemini_client,
            prompt_builder=self.prompt_builder,
            cache_manager=self.cache_manager,
            batch_size=getattr(settings, 'BATCH_SIZE', 10),
            max_concurrent=getattr(settings, 'MAX_CONCURRENT_REQUESTS', 5)
        )
        
        logger.info("Initialized CodeGeneratorService")
    
    async def generate_code_for_all_variables(
        self,
        study_id: str,
        dataset: str,
        categorized_variables: Dict[str, Any],
        language: str,
        standards: Dict[str, Any]
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
            
            # Build generation context
            context = self.build_generation_context(
                study_id=study_id,
                dataset=dataset,
                standards=standards,
                categorized_variables=categorized_variables
            )
            
            # Process in batches with caching
            results = await self.batch_processor.process_variables_batch(
                variables=all_variables,
                language=language,
                context=context
            )
            
            logger.info(f"Bulk code generation complete: {len(results)} results")
            return results
            
        except Exception as e:
            logger.error(f"Bulk code generation failed: {str(e)}")
            raise
    
    async def generate_single_variable(
        self,
        variable: Dict[str, Any],
        language: str,
        context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Generate code for a single variable (for retry/regeneration)
        
        Args:
            variable: Variable dictionary
            language: Programming language
            context: Generation context
            
        Returns:
            CodeSnippetResponse dictionary
        """
        logger.info(f"Generating code for single variable: {variable.get('name', 'Unknown')}")
        
        try:
            result = await self.batch_processor.generate_single_variable(
                variable=variable,
                language=language,
                context=context
            )
            return result
            
        except Exception as e:
            logger.error(f"Single variable generation failed: {str(e)}")
            raise
    
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
    
    def clear_cache(self):
        """Clear the code generation cache"""
        self.cache_manager.clear()
        logger.info("Cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics"""
        return {
            'service': 'code_generator',
            'gemini_client': self.gemini_client.get_usage_stats(),
            'batch_processor': self.batch_processor.get_stats()
        }


# Global service instance (will be initialized on first use)
_code_generator_service: CodeGeneratorService = None


def get_code_generator_service() -> CodeGeneratorService:
    """Get or create code generator service instance"""
    global _code_generator_service
    if _code_generator_service is None:
        _code_generator_service = CodeGeneratorService()
    return _code_generator_service
