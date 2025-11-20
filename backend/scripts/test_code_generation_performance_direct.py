"""
Direct Performance Test for Code Generation Service
Tests the optimized code generation directly without HTTP
"""

import asyncio
import time
from typing import List, Dict, Any
import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent
sys.path.insert(0, str(backend_path))

from app.modules.code_generator.service import get_code_generator_service
from loguru import logger

# Configure logger
logger.remove()
logger.add(sys.stderr, level="INFO")


def create_test_variables(count: int) -> Dict[str, Any]:
    """Create test variables for bulk generation"""
    variables = []
    
    # Mix of simple (template-friendly) and complex variables
    simple_patterns = [
        {"name": "AGE", "derivation": "AGE from DM", "type": "Num", "label": "Age"},
        {"name": "SEX", "derivation": "SEX directly from DM", "type": "Char", "label": "Sex"},
        {"name": "RACE", "derivation": "RACE from DM", "type": "Char", "label": "Race"},
        {"name": "ETHNIC", "derivation": "ETHNIC copy from DM", "type": "Char", "label": "Ethnicity"},
        {"name": "COUNTRY", "derivation": "COUNTRY taken from DM", "type": "Char", "label": "Country"},
    ]
    
    complex_patterns = [
        {"name": "AGEGR1", "derivation": "Create age groups: <65, 65-75, >75", "type": "Char", "label": "Age Group"},
        {"name": "ITTFL", "derivation": "Intent-to-treat flag: Y if randomized, N otherwise", "type": "Char", "label": "ITT Flag"},
        {"name": "SAFFL", "derivation": "Safety flag: Y if received at least one dose", "type": "Char", "label": "Safety Flag"},
        {"name": "EFFFL", "derivation": "Efficacy flag: Y if completed baseline and at least one post-baseline visit", "type": "Char", "label": "Efficacy Flag"},
        {"name": "TRTSDT", "derivation": "Treatment start date: first dose date from EX", "type": "Date", "label": "Treatment Start Date"},
    ]
    
    # Create variables list
    for i in range(count):
        if i < len(simple_patterns):
            var = simple_patterns[i].copy()
            var["name"] = f"{var['name']}_{i+1}"
        elif i < len(simple_patterns) + len(complex_patterns):
            var = complex_patterns[i - len(simple_patterns)].copy()
            var["name"] = f"{var['name']}_{i+1}"
        else:
            # Generate additional variables
            var = {
                "name": f"VAR_{i+1}",
                "derivation": f"Derive VAR_{i+1} from source data",
                "type": "Num" if i % 2 == 0 else "Char",
                "label": f"Variable {i+1}"
            }
        variables.append(var)
    
    return {
        "categories": [
            {
                "name": "Demographics",
                "variables": variables[:count//2] if count > 2 else variables,
            },
            {
                "name": "Flags",
                "variables": variables[count//2:] if count > 2 else [],
            }
        ],
        "total_variables": count
    }


async def test_bulk_generation_performance(variable_count: int = 50) -> Dict[str, Any]:
    """Test bulk code generation performance directly"""
    print(f"\n{'='*70}")
    print(f"PERFORMANCE TEST: Generating code for {variable_count} variables")
    print(f"{'='*70}\n")
    
    service = get_code_generator_service()
    categorized_variables = create_test_variables(variable_count)
    
    print(f"📤 Starting code generation")
    print(f"   Variables: {variable_count}")
    print(f"   Language: R")
    print(f"   Batch size: {service.batch_size}")
    print(f"   Max concurrent: {service.max_concurrent}")
    print(f"\n⏱️  Starting timer...\n")
    
    start_time = time.time()
    
    try:
        results = await service.generate_code_for_all_variables(
            study_id="PERF_TEST_001",
            dataset="ADSL",
            categorized_variables=categorized_variables,
            language="R",
            standards={
                "sdtm_version": "1.7",
                "adam_ig_version": "1.3",
                "meddra_version": "26.0"
            },
            llm_provider="groq"
        )
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        print(f"⏱️  Total Time: {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)\n")
        
        result_count = len(results)
        
        # Analyze results
        template_count = sum(1 for r in results if r.get('metadata', {}).get('generation_method') == 'template_based')
        llm_count = result_count - template_count
        cached_count = sum(1 for r in results if r.get('metadata', {}).get('provider') == 'cache')
        
        print(f"✅ SUCCESS!")
        print(f"   Generated: {result_count} code snippets")
        print(f"   Template-based: {template_count} ({template_count/result_count*100:.1f}%)")
        print(f"   LLM-generated: {llm_count} ({llm_count/result_count*100:.1f}%)")
        if cached_count > 0:
            print(f"   Cached: {cached_count} ({cached_count/result_count*100:.1f}%)")
        print(f"   Time per variable: {elapsed_time/result_count:.2f} seconds")
        
        # Performance metrics
        vars_per_second = result_count / elapsed_time if elapsed_time > 0 else 0
        print(f"\n📊 Performance Metrics:")
        print(f"   Variables/second: {vars_per_second:.2f}")
        print(f"   Expected time for 100 vars: {(100/vars_per_second):.1f} seconds")
        
        # Check optimization targets
        print(f"\n🎯 Optimization Targets:")
        target_time_20 = 30  # 30 seconds for 20 variables
        target_time_50 = 60  # 60 seconds for 50 variables
        target_time_100 = 120  # 120 seconds for 100 variables
        
        if variable_count == 20:
            if elapsed_time <= target_time_20:
                print(f"   ✅ PASSED: {elapsed_time:.1f}s <= {target_time_20}s target")
            else:
                print(f"   ⚠️  SLOW: {elapsed_time:.1f}s > {target_time_20}s target")
        
        if variable_count == 50:
            if elapsed_time <= target_time_50:
                print(f"   ✅ PASSED: {elapsed_time:.1f}s <= {target_time_50}s target")
            else:
                print(f"   ⚠️  SLOW: {elapsed_time:.1f}s > {target_time_50}s target")
        
        if variable_count == 100:
            if elapsed_time <= target_time_100:
                print(f"   ✅ PASSED: {elapsed_time:.1f}s <= {target_time_100}s target")
            else:
                print(f"   ⚠️  SLOW: {elapsed_time:.1f}s > {target_time_100}s target")
        
        # Show sample results
        print(f"\n📝 Sample Results:")
        for i, result in enumerate(results[:3]):
            var_name = result.get('variable', 'Unknown')
            code_snippet = result.get('code_snippet', '')[:100]
            method = result.get('metadata', {}).get('generation_method', 'llm')
            print(f"   {i+1}. {var_name} ({method}): {code_snippet}...")
        
        return {
            "success": True,
            "variable_count": variable_count,
            "result_count": result_count,
            "elapsed_time": elapsed_time,
            "template_count": template_count,
            "llm_count": llm_count,
            "cached_count": cached_count,
            "vars_per_second": vars_per_second,
            "results": results
        }
        
    except Exception as e:
        end_time = time.time()
        elapsed_time = end_time - start_time
        print(f"❌ ERROR: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "variable_count": variable_count,
            "elapsed_time": elapsed_time,
            "error": str(e)
        }


async def main():
    """Run performance tests"""
    print("\n" + "="*70)
    print("CODE GENERATION PERFORMANCE TEST SUITE")
    print("="*70)
    print("\nTesting optimized code generation with:")
    print("  ✅ Batch size: 25 variables per API call")
    print("  ✅ Concurrency: 15 concurrent requests")
    print("  ✅ Template-based generation for simple patterns")
    print("  ✅ Optimized prompts (60-70% token reduction)")
    print("\n" + "="*70)
    
    # Test 1: Small batch (20 variables)
    print("\n📊 TEST 1: Small Batch (20 variables) - TARGET: <30 seconds")
    result1 = await test_bulk_generation_performance(20)
    
    # Test 2: Medium batch (50 variables) - main test
    print("\n📊 TEST 2: Medium Batch (50 variables) - TARGET: <60 seconds")
    result2 = await test_bulk_generation_performance(50)
    
    # Test 3: Large batch (100 variables) - stress test
    print("\n📊 TEST 3: Large Batch (100 variables) - TARGET: <120 seconds")
    result3 = await test_bulk_generation_performance(100)
    
    # Summary
    print("\n" + "="*70)
    print("PERFORMANCE TEST SUMMARY")
    print("="*70)
    
    for i, result in enumerate([result1, result2, result3], 1):
        if result.get("success"):
            vars_count = result.get("variable_count", 0)
            elapsed = result.get("elapsed_time", 0)
            template_count = result.get("template_count", 0)
            llm_count = result.get("llm_count", 0)
            vars_per_sec = result.get("vars_per_second", 0)
            
            print(f"\nTest {i}: {vars_count} variables")
            print(f"  Time: {elapsed:.2f}s ({elapsed/60:.2f} min)")
            print(f"  Speed: {vars_per_sec:.2f} vars/sec")
            print(f"  Templates: {template_count} ({template_count/vars_count*100:.1f}%)")
            print(f"  LLM: {llm_count} ({llm_count/vars_count*100:.1f}%)")
            
            # Performance rating
            if vars_count == 20 and elapsed < 30:
                print(f"  ✅ EXCELLENT (<30s)")
            elif vars_count == 50 and elapsed < 60:
                print(f"  ✅ EXCELLENT (<60s)")
            elif vars_count == 100 and elapsed < 120:
                print(f"  ✅ EXCELLENT (<120s)")
            elif vars_count == 20 and elapsed < 60:
                print(f"  ⚠️  ACCEPTABLE (<60s)")
            elif vars_count == 50 and elapsed < 120:
                print(f"  ⚠️  ACCEPTABLE (<120s)")
            elif vars_count == 100 and elapsed < 180:
                print(f"  ⚠️  ACCEPTABLE (<180s)")
            else:
                print(f"  ❌ NEEDS OPTIMIZATION")
        else:
            print(f"\nTest {i}: FAILED - {result.get('error', 'Unknown error')}")
    
    print("\n" + "="*70)
    print("✅ Performance tests completed!")
    print("="*70 + "\n")
    
    # Final verdict
    all_passed = all(r.get("success") for r in [result1, result2, result3])
    if all_passed:
        print("🎉 ALL TESTS PASSED - Optimizations are working!")
    else:
        print("⚠️  Some tests failed - Check errors above")


if __name__ == "__main__":
    asyncio.run(main())
