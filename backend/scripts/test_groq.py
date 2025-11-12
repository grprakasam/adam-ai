"""
Test script to verify Groq LLM integration
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.modules.llm_integration.service import llm_service
from app.config import settings


async def test_groq_connection():
    """Test Groq provider connection and generation"""
    
    print("=" * 60)
    print("GROQ LLM INTEGRATION TEST")
    print("=" * 60)
    
    # Check configuration
    print(f"\n1. Configuration Check:")
    print(f"   Default Provider: {settings.DEFAULT_LLM_PROVIDER}")
    print(f"   Default Model: {settings.DEFAULT_MODEL}")
    print(f"   Groq API Key Set: {'Yes' if getattr(settings, 'GROQ_API_KEY', None) else 'No'}")
    
    # Check available providers
    print(f"\n2. Available Providers:")
    providers = await llm_service.get_available_providers()
    print(f"   {providers}")
    
    if 'groq' not in providers:
        print("\n❌ ERROR: Groq provider not initialized!")
        print("   Please set GROQ_API_KEY in your .env file")
        print("   Get your API key at: https://console.groq.com/")
        return False
    
    # Test connection
    print(f"\n3. Testing Groq Connection:")
    try:
        is_valid = await llm_service.validate_provider('groq')
        if is_valid:
            print(f"   ✅ Connection successful!")
        else:
            print(f"   ❌ Connection failed!")
            return False
    except Exception as e:
        print(f"   ❌ Connection error: {str(e)}")
        return False
    
    # Test code generation
    print(f"\n4. Testing Code Generation:")
    test_prompt = """
Generate R code to derive a baseline height variable (ABLFL) in an ADSL dataset.
The logic should:
- Set ABLFL = 'Y' if VISITNUM == 1
- Set ABLFL = NA otherwise

Return only the R code with comments.
"""
    
    try:
        print(f"   Sending test prompt...")
        result = await llm_service.generate(
            prompt=test_prompt,
            provider='groq',
            temperature=0.2,
            max_tokens=500
        )
        
        print(f"   ✅ Generation successful!")
        print(f"   Model: {result['model']}")
        print(f"   Tokens: {result['usage']['total_tokens']}")
        print(f"\n5. Generated Code:")
        print("   " + "-" * 56)
        print(f"{result['content']}")
        print("   " + "-" * 56)
        
        return True
        
    except Exception as e:
        print(f"   ❌ Generation error: {str(e)}")
        return False


async def main():
    """Main test function"""
    success = await test_groq_connection()
    
    print("\n" + "=" * 60)
    if success:
        print("✅ ALL TESTS PASSED - Groq integration is working!")
    else:
        print("❌ TESTS FAILED - Please check configuration")
    print("=" * 60)
    
    return success


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
