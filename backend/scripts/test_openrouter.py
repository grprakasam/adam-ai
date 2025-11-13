"""
Test script to verify OpenRouter integration
Run this to test if OpenRouter API is working
"""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.modules.llm_integration.service import get_llm_service
from loguru import logger


async def test_openrouter():
    """Test OpenRouter provider"""
    logger.info("=" * 60)
    logger.info("Testing OpenRouter Integration")
    logger.info("=" * 60)
    
    # Get LLM service
    llm_service = get_llm_service()
    
    # Check available providers
    providers = await llm_service.get_available_providers()
    logger.info(f"\n✅ Available providers: {providers}")
    
    # Check if OpenRouter is available
    if 'openrouter' not in providers:
        logger.error("\n❌ OpenRouter provider not initialized!")
        logger.error("Check your OPENROUTER_API_KEY in .env file")
        return False
    
    logger.info("\n✅ OpenRouter provider is initialized")
    
    # Test fetching models
    try:
        logger.info("\n📥 Fetching OpenRouter models...")
        models = await llm_service.get_openrouter_models()
        
        logger.info(f"\n✅ Successfully fetched {len(models)} models")
        
        # Show first 10 models
        logger.info("\n📋 First 10 models:")
        for i, model in enumerate(models[:10], 1):
            logger.info(f"  {i}. {model.get('name', model.get('id'))}")
            logger.info(f"     ID: {model.get('id')}")
            if model.get('context_length'):
                logger.info(f"     Context: {model.get('context_length'):,} tokens")
            if model.get('pricing'):
                pricing = model.get('pricing', {})
                logger.info(f"     Pricing: ${pricing.get('prompt')}/1K prompt, ${pricing.get('completion')}/1K completion")
            logger.info("")
        
        logger.info("=" * 60)
        logger.info("✅ OpenRouter integration test PASSED")
        logger.info("=" * 60)
        return True
        
    except Exception as e:
        logger.error(f"\n❌ Failed to fetch models: {str(e)}")
        logger.exception(e)
        logger.error("\n=" * 60)
        logger.error("❌ OpenRouter integration test FAILED")
        logger.error("=" * 60)
        return False


if __name__ == "__main__":
    success = asyncio.run(test_openrouter())
    sys.exit(0 if success else 1)
