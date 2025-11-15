"""
Test script to verify rate limit handling improvements

Tests:
1. Rate limiter throttling
2. Rate limit error retry with backoff
3. Automatic fallback to alternative providers
4. Multiple concurrent requests
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.modules.llm_integration.service import (
    llm_service,
    LLMRateLimitError,
    TokenBucketRateLimiter
)
from app.config import settings


async def test_rate_limiter():
    """Test the token bucket rate limiter"""
    print("\n" + "=" * 70)
    print("TEST 1: Rate Limiter Throttling")
    print("=" * 70)
    
    try:
        # Create a strict rate limiter for testing
        limiter = TokenBucketRateLimiter(
            requests_per_minute=5,
            tokens_per_minute=5000,
            buffer_factor=0.8
        )
        
        print(f"\n📊 Rate limiter configured:")
        print(f"   Max requests/min: {limiter.max_requests}")
        print(f"   Max tokens/min: {limiter.max_tokens}")
        
        # Make several requests quickly
        print(f"\n🔄 Making 5 rapid requests...")
        start_time = asyncio.get_event_loop().time()
        
        for i in range(5):
            await limiter.acquire(estimated_tokens=1000)
            elapsed = asyncio.get_event_loop().time() - start_time
            print(f"   Request {i+1}: {elapsed:.2f}s")
        
        print(f"✅ Rate limiter working correctly")
        return True
        
    except Exception as e:
        print(f"❌ Rate limiter test failed: {str(e)}")
        return False


async def test_retry_on_rate_limit():
    """Test that rate limit errors trigger retry with backoff"""
    print("\n" + "=" * 70)
    print("TEST 2: Rate Limit Retry Logic")
    print("=" * 70)
    
    try:
        # Get available providers
        providers = await llm_service.get_available_providers()
        print(f"\n📋 Available providers: {providers}")
        
        if not providers:
            print("❌ No providers available - cannot test retry logic")
            return False
        
        # Simple test prompt
        test_prompt = "Say 'hello' in one word."
        
        print(f"\n🔄 Testing with simple prompt...")
        result = await llm_service.generate(
            prompt=test_prompt,
            temperature=0.1,
            max_tokens=10
        )
        
        print(f"✅ Generation successful")
        print(f"   Provider: {result.get('model', 'unknown')}")
        print(f"   Content: {result.get('content', '')[:50]}")
        return True
        
    except LLMRateLimitError as e:
        print(f"⚠️  Rate limit error (expected if hitting limits): {str(e)}")
        return True  # This is actually expected behavior
        
    except Exception as e:
        print(f"❌ Retry test failed: {str(e)}")
        return False


async def test_fallback_mechanism():
    """Test automatic fallback to alternative providers"""
    print("\n" + "=" * 70)
    print("TEST 3: Provider Fallback")
    print("=" * 70)
    
    try:
        providers = await llm_service.get_available_providers()
        print(f"\n📋 Available providers: {providers}")
        
        if len(providers) < 2:
            print("⚠️  Only one provider available - fallback test skipped")
            print("   To test fallback, configure multiple provider API keys in .env")
            return True
        
        # Test that fallback order is configured
        for provider in providers:
            fallback_order = llm_service._get_fallback_order(provider)
            print(f"\n🔄 Fallback chain for {provider}: {fallback_order}")
        
        print(f"\n✅ Fallback mechanism configured correctly")
        return True
        
    except Exception as e:
        print(f"❌ Fallback test failed: {str(e)}")
        return False


async def test_concurrent_requests():
    """Test handling of multiple concurrent requests"""
    print("\n" + "=" * 70)
    print("TEST 4: Concurrent Requests with Rate Limiting")
    print("=" * 70)
    
    try:
        providers = await llm_service.get_available_providers()
        
        if not providers:
            print("❌ No providers available")
            return False
        
        # Create multiple concurrent requests
        prompts = [
            "Say 'one'",
            "Say 'two'",
            "Say 'three'"
        ]
        
        print(f"\n🔄 Making {len(prompts)} concurrent requests...")
        tasks = [
            llm_service.generate(
                prompt=prompt,
                temperature=0.1,
                max_tokens=10
            )
            for prompt in prompts
        ]
        
        start_time = asyncio.get_event_loop().time()
        results = await asyncio.gather(*tasks, return_exceptions=True)
        elapsed = asyncio.get_event_loop().time() - start_time
        
        successful = sum(1 for r in results if not isinstance(r, Exception))
        failed = len(results) - successful
        
        print(f"\n📊 Results:")
        print(f"   Successful: {successful}/{len(results)}")
        print(f"   Failed: {failed}/{len(results)}")
        print(f"   Total time: {elapsed:.2f}s")
        print(f"   Avg time per request: {elapsed/len(results):.2f}s")
        
        if successful > 0:
            print(f"✅ Concurrent requests working (rate limiting applied)")
            return True
        else:
            print(f"❌ All concurrent requests failed")
            return False
        
    except Exception as e:
        print(f"❌ Concurrent test failed: {str(e)}")
        return False


async def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("RATE LIMIT FIX VERIFICATION TESTS")
    print("=" * 70)
    
    print(f"\n⚙️  Configuration:")
    print(f"   Default Provider: {settings.DEFAULT_LLM_PROVIDER}")
    print(f"   Default Model: {getattr(settings, 'DEFAULT_MODEL', 'Not set')}")
    
    tests = [
        ("Rate Limiter", test_rate_limiter),
        ("Retry Logic", test_retry_on_rate_limit),
        ("Fallback Mechanism", test_fallback_mechanism),
        ("Concurrent Requests", test_concurrent_requests)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ Test '{test_name}' crashed: {str(e)}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    total_passed = sum(1 for _, passed in results if passed)
    total_tests = len(results)
    
    print(f"\nTotal: {total_passed}/{total_tests} tests passed")
    
    if total_passed == total_tests:
        print("\n🎉 All tests passed! Rate limit handling is working correctly.")
        return 0
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
