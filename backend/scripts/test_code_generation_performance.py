"""
Performance Test for Code Generation API
Tests the optimized code generation with timing measurements
"""

import asyncio
import time
import requests
import json
from typing import List, Dict, Any
from loguru import logger

# Test configuration
BASE_URL = "http://localhost:8000/api/v1"
TIMEOUT = 300  # 5 minutes timeout


def create_test_variables(count: int) -> Dict[str, Any]:
    """Create test variables for bulk generation"""
    variables = []
    
    # Mix of simple (template-friendly) and complex variables
    simple_patterns = [
        {"name": "AGE", "derivation": "AGE from DM", "type": "Num"},
        {"name": "SEX", "derivation": "SEX directly from DM", "type": "Char"},
        {"name": "RACE", "derivation": "RACE from DM", "type": "Char"},
        {"name": "ETHNIC", "derivation": "ETHNIC copy from DM", "type": "Char"},
        {"name": "COUNTRY", "derivation": "COUNTRY taken from DM", "type": "Char"},
    ]
    
    complex_patterns = [
        {"name": "AGEGR1", "derivation": "Create age groups: <65, 65-75, >75", "type": "Char"},
        {"name": "ITTFL", "derivation": "Intent-to-treat flag: Y if randomized, N otherwise", "type": "Char"},
        {"name": "SAFFL", "derivation": "Safety flag: Y if received at least one dose", "type": "Char"},
        {"name": "EFFFL", "derivation": "Efficacy flag: Y if completed baseline and at least one post-baseline visit", "type": "Char"},
        {"name": "TRTSDT", "derivation": "Treatment start date: first dose date from EX", "type": "Date"},
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
                "type": "Num" if i % 2 == 0 else "Char"
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


def test_bulk_generation_performance(variable_count: int = 50) -> Dict[str, Any]:
    """Test bulk code generation performance"""
    print(f"\n{'='*70}")
    print(f"PERFORMANCE TEST: Generating code for {variable_count} variables")
    print(f"{'='*70}\n")
    
    url = f"{BASE_URL}/code-generation/generate-code-bulk"
    
    categorized_variables = create_test_variables(variable_count)
    
    payload = {
        "study_id": "PERF_TEST_001",
        "dataset": "ADSL",
        "language": "R",
        "categorized_variables": categorized_variables,
        "standards": {
            "sdtm_version": "1.7",
            "adam_ig_version": "1.3",
            "meddra_version": "26.0"
        },
        "llm_provider": "groq"
    }
    
    print(f"📤 Sending request to: {url}")
    print(f"   Variables: {variable_count}")
    print(f"   Language: R")
    print(f"   Provider: groq")
    print(f"\n⏱️  Starting timer...\n")
    
    start_time = time.time()
    
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT)
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        print(f"📥 Response Status: {response.status_code}")
        print(f"⏱️  Total Time: {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)\n")
        
        if response.status_code == 200:
            results = response.json()
            result_count = len(results) if isinstance(results, list) else 0
            
            # Analyze results
            template_count = sum(1 for r in results if r.get('metadata', {}).get('generation_method') == 'template_based')
            llm_count = result_count - template_count
            
            print(f"✅ SUCCESS!")
            print(f"   Generated: {result_count} code snippets")
            print(f"   Template-based: {template_count} ({template_count/result_count*100:.1f}%)")
            print(f"   LLM-generated: {llm_count} ({llm_count/result_count*100:.1f}%)")
            print(f"   Time per variable: {elapsed_time/result_count:.2f} seconds")
            
            # Performance metrics
            vars_per_second = result_count / elapsed_time if elapsed_time > 0 else 0
            print(f"\n📊 Performance Metrics:")
            print(f"   Variables/second: {vars_per_second:.2f}")
            print(f"   Expected time for 100 vars: {(100/vars_per_second):.1f} seconds")
            
            # Check optimization targets
            print(f"\n🎯 Optimization Targets:")
            target_time_50 = 60  # 60 seconds for 50 variables
            target_time_100 = 120  # 120 seconds for 100 variables
            
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
            
            return {
                "success": True,
                "variable_count": variable_count,
                "result_count": result_count,
                "elapsed_time": elapsed_time,
                "template_count": template_count,
                "llm_count": llm_count,
                "vars_per_second": vars_per_second,
                "results": results
            }
        else:
            print(f"❌ FAILED!")
            print(f"   Status: {response.status_code}")
            print(f"   Error: {response.text[:500]}")
            return {
                "success": False,
                "variable_count": variable_count,
                "elapsed_time": elapsed_time,
                "error": response.text
            }
            
    except requests.exceptions.Timeout:
        end_time = time.time()
        elapsed_time = end_time - start_time
        print(f"❌ TIMEOUT after {elapsed_time:.1f} seconds!")
        return {
            "success": False,
            "variable_count": variable_count,
            "elapsed_time": elapsed_time,
            "error": "Timeout"
        }
    except Exception as e:
        end_time = time.time()
        elapsed_time = end_time - start_time
        print(f"❌ ERROR: {str(e)}")
        return {
            "success": False,
            "variable_count": variable_count,
            "elapsed_time": elapsed_time,
            "error": str(e)
        }


def test_streaming_performance(variable_count: int = 50) -> Dict[str, Any]:
    """Test streaming bulk code generation performance"""
    print(f"\n{'='*70}")
    print(f"STREAMING PERFORMANCE TEST: {variable_count} variables")
    print(f"{'='*70}\n")
    
    url = f"{BASE_URL}/code-generation/generate-code-bulk-stream"
    
    categorized_variables = create_test_variables(variable_count)
    
    payload = {
        "study_id": "PERF_TEST_STREAM_001",
        "dataset": "ADSL",
        "language": "R",
        "categorized_variables": categorized_variables,
        "standards": {
            "sdtm_version": "1.7",
            "adam_ig_version": "1.3",
            "meddra_version": "26.0"
        },
        "llm_provider": "groq"
    }
    
    print(f"📤 Sending streaming request to: {url}")
    print(f"   Variables: {variable_count}\n")
    
    start_time = time.time()
    first_result_time = None
    progress_updates = []
    results = []
    
    try:
        response = requests.post(url, json=payload, stream=True, timeout=TIMEOUT)
        
        if response.status_code != 200:
            print(f"❌ FAILED! Status: {response.status_code}")
            print(f"   Error: {response.text[:500]}")
            return {"success": False, "error": response.text}
        
        # Process streaming response
        for line in response.iter_lines():
            if line:
                line_text = line.decode('utf-8')
                if line_text.startswith('data: '):
                    data_text = line_text[6:]  # Remove 'data: ' prefix
                    try:
                        data = json.loads(data_text)
                        
                        if 'status' in data:
                            status = data.get('status')
                            if status == 'started':
                                print(f"🚀 Started: {data.get('message', '')}")
                            elif status == 'variable_completed':
                                if first_result_time is None:
                                    first_result_time = time.time() - start_time
                                    print(f"⚡ First result: {first_result_time:.2f}s")
                                completed = data.get('completed', 0)
                                total = data.get('total', 0)
                                if completed % 10 == 0 or completed == total:
                                    print(f"   Progress: {completed}/{total} ({completed/total*100:.1f}%)")
                            elif status == 'completed':
                                print(f"✅ Completed: {data.get('message', '')}")
                        
                        if 'data' in data and isinstance(data['data'], list):
                            results = data['data']
                    
                    except json.JSONDecodeError:
                        continue
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        print(f"\n⏱️  Total Time: {elapsed_time:.2f} seconds")
        print(f"   First result: {first_result_time:.2f}s" if first_result_time else "")
        print(f"   Results: {len(results)} code snippets")
        
        return {
            "success": True,
            "variable_count": variable_count,
            "result_count": len(results),
            "elapsed_time": elapsed_time,
            "first_result_time": first_result_time,
            "results": results
        }
        
    except Exception as e:
        end_time = time.time()
        elapsed_time = end_time - start_time
        print(f"❌ ERROR: {str(e)}")
        return {
            "success": False,
            "variable_count": variable_count,
            "elapsed_time": elapsed_time,
            "error": str(e)
        }


def main():
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
    print("\n📊 TEST 1: Small Batch (20 variables)")
    result1 = test_bulk_generation_performance(20)
    
    # Test 2: Medium batch (50 variables) - main test
    print("\n📊 TEST 2: Medium Batch (50 variables) - TARGET: <60 seconds")
    result2 = test_bulk_generation_performance(50)
    
    # Test 3: Large batch (100 variables) - stress test
    print("\n📊 TEST 3: Large Batch (100 variables) - TARGET: <120 seconds")
    result3 = test_bulk_generation_performance(100)
    
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
            
            print(f"\nTest {i}: {vars_count} variables")
            print(f"  Time: {elapsed:.2f}s ({elapsed/60:.2f} min)")
            print(f"  Speed: {vars_count/elapsed:.2f} vars/sec")
            print(f"  Templates: {template_count} ({template_count/vars_count*100:.1f}%)")
            print(f"  LLM: {llm_count} ({llm_count/vars_count*100:.1f}%)")
            
            # Performance rating
            if vars_count == 20 and elapsed < 30:
                print(f"  ✅ EXCELLENT (<30s)")
            elif vars_count == 50 and elapsed < 60:
                print(f"  ✅ EXCELLENT (<60s)")
            elif vars_count == 100 and elapsed < 120:
                print(f"  ✅ EXCELLENT (<120s)")
            else:
                print(f"  ⚠️  Needs optimization")
        else:
            print(f"\nTest {i}: FAILED - {result.get('error', 'Unknown error')}")
    
    print("\n" + "="*70)
    print("✅ Performance tests completed!")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
