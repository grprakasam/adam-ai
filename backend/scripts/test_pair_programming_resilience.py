"""
Test script to verify error-free pair programming for all variables

Tests:
1. Single variable generation with fallback on error
2. Bulk generation with error resilience
3. Fallback code template generation
4. Fallback rationale generation
5. All variables get meaningful responses
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.modules.code_generator.service import CodeGeneratorService
from app.config import settings


async def test_fallback_code_generation():
    """Test fallback code generation for different variable types"""
    print("\n" + "=" * 70)
    print("TEST 1: Fallback Code Generation")
    print("=" * 70)
    
    service = CodeGeneratorService()
    
    test_cases = [
        ("USUBJID", "Char", "R"),
        ("AGE", "Num", "R"),
        ("STUDYID", "Char", "SAS"),
        ("WEIGHT", "Num", "SAS")
    ]
    
    all_passed = True
    
    for var_name, var_type, language in test_cases:
        print(f"\n📝 Testing {var_name} ({var_type}, {language})...")
        
        try:
            fallback_code = service._generate_fallback_code(var_name, var_type, language)
            
            # Verify fallback code is not empty
            if not fallback_code or len(fallback_code.strip()) == 0:
                print(f"   ❌ Fallback code is empty!")
                all_passed = False
                continue
            
            # Verify it contains the variable name
            if var_name not in fallback_code:
                print(f"   ❌ Fallback code doesn't contain variable name!")
                all_passed = False
                continue
            
            # Verify it contains TODO or placeholder guidance
            if "TODO" not in fallback_code and "placeholder" not in fallback_code.lower():
                print(f"   ❌ Fallback code lacks guidance!")
                all_passed = False
                continue
            
            print(f"   ✅ Fallback code generated ({len(fallback_code)} chars)")
            print(f"   Preview: {fallback_code[:100]}...")
            
        except Exception as e:
            print(f"   ❌ Error generating fallback: {str(e)}")
            all_passed = False
    
    return all_passed


async def test_fallback_rationale_generation():
    """Test fallback rationale generation"""
    print("\n" + "=" * 70)
    print("TEST 2: Fallback Rationale Generation")
    print("=" * 70)
    
    service = CodeGeneratorService()
    
    test_case = {
        'variable_name': 'AVAL',
        'variable_label': 'Analysis Value',
        'derivation': 'Copy from SDTM.LB.LBORRES when LBTESTCD = "GLUCOSE"',
        'error_msg': 'Rate limit exceeded'
    }
    
    try:
        rationale = service._generate_fallback_rationale(
            test_case['variable_name'],
            test_case['variable_label'],
            test_case['derivation'],
            test_case['error_msg']
        )
        
        # Verify rationale is comprehensive
        checks = [
            ('variable_name' in rationale.lower(), "Contains variable name"),
            ('error' in rationale.lower() or 'failed' in rationale.lower(), "Mentions error"),
            ('action required' in rationale.lower() or 'todo' in rationale.lower(), "Has action items"),
            (test_case['derivation'] in rationale, "Includes derivation logic"),
            (len(rationale) > 200, "Has substantial content")
        ]
        
        all_passed = True
        for check, description in checks:
            if check:
                print(f"   ✅ {description}")
            else:
                print(f"   ❌ {description}")
                all_passed = False
        
        print(f"\n   Rationale length: {len(rationale)} chars")
        print(f"   Preview:\n   {rationale[:200]}...")
        
        return all_passed
        
    except Exception as e:
        print(f"   ❌ Error generating fallback rationale: {str(e)}")
        return False


async def test_error_handling_in_generation():
    """Test that errors in generation produce meaningful fallbacks"""
    print("\n" + "=" * 70)
    print("TEST 3: Error Handling in Variable Generation")
    print("=" * 70)
    
    service = CodeGeneratorService()
    
    # Create a test variable
    test_variable = {
        'name': 'TESTVAR',
        'label': 'Test Variable',
        'type': 'Num',
        'derivation': 'Test derivation logic',
        'is_required': True
    }
    
    context = {
        'study_id': 'TEST001',
        'adam_dataset': 'ADSL',
        'sdtm_domains': ['DM'],
        'sdtm_version': '1.7',
        'adam_ig_version': '1.3',
        'required_variables': []
    }
    
    print(f"\n🔄 Testing generation with invalid provider (should trigger fallback)...")
    
    try:
        # Use an invalid provider to force error handling
        result = await service.generate_single_variable(
            variable=test_variable,
            language='R',
            context=context,
            llm_provider='invalid_provider_that_does_not_exist'
        )
        
        # Verify result structure
        checks = [
            ('variable' in result, "Has 'variable' field"),
            ('code_snippet' in result, "Has 'code_snippet' field"),
            ('coding_rationale' in result, "Has 'coding_rationale' field"),
            (result.get('code_snippet', '') != '', "Code snippet is not empty"),
            (result.get('coding_rationale', '') != '', "Rationale is not empty"),
            ('TODO' in result.get('code_snippet', '') or 'placeholder' in result.get('code_snippet', '').lower(), "Has placeholder guidance"),
            ('metadata' in result, "Has metadata"),
            (result.get('metadata', {}).get('is_fallback') == True, "Marked as fallback")
        ]
        
        print(f"\n📊 Result validation:")
        all_passed = True
        for check, description in checks:
            if check:
                print(f"   ✅ {description}")
            else:
                print(f"   ❌ {description}")
                all_passed = False
        
        if result.get('error'):
            print(f"\n   📝 Error message: {result['error'][:150]}...")
        
        if result.get('code_snippet'):
            print(f"\n   📝 Code snippet preview:\n{result['code_snippet'][:200]}...")
        
        return all_passed
        
    except Exception as e:
        print(f"   ❌ Unexpected exception (should be handled gracefully): {str(e)}")
        return False


async def test_bulk_generation_resilience():
    """Test that bulk generation continues even when some variables fail"""
    print("\n" + "=" * 70)
    print("TEST 4: Bulk Generation Resilience")
    print("=" * 70)
    
    service = CodeGeneratorService()
    
    # Create test variables
    test_variables = [
        {'name': 'VAR1', 'label': 'Variable 1', 'type': 'Num', 'derivation': 'Test 1', 'is_required': True},
        {'name': 'VAR2', 'label': 'Variable 2', 'type': 'Char', 'derivation': 'Test 2', 'is_required': False},
        {'name': 'VAR3', 'label': 'Variable 3', 'type': 'Num', 'derivation': 'Test 3', 'is_required': True},
    ]
    
    context = {
        'study_id': 'TEST001',
        'adam_dataset': 'ADSL',
        'sdtm_domains': ['DM'],
        'sdtm_version': '1.7',
        'adam_ig_version': '1.3',
        'required_variables': ['VAR1', 'VAR3']
    }
    
    print(f"\n🔄 Processing {len(test_variables)} variables...")
    
    try:
        results = await service.process_variables_with_llm(
            variables=test_variables,
            language='R',
            context=context,
            llm_provider='invalid_provider_to_trigger_fallback'
        )
        
        print(f"\n📊 Results:")
        print(f"   Total variables: {len(test_variables)}")
        print(f"   Total results: {len(results)}")
        
        # Verify all variables got results
        if len(results) != len(test_variables):
            print(f"   ❌ Mismatch: {len(results)} results for {len(test_variables)} variables!")
            return False
        
        # Check each result
        all_have_code = True
        all_have_rationale = True
        
        for result in results:
            var_name = result.get('variable', 'Unknown')
            has_code = bool(result.get('code_snippet', '').strip())
            has_rationale = bool(result.get('coding_rationale', '').strip())
            has_error = 'error' in result
            
            print(f"\n   {var_name}:")
            print(f"      Code: {'✅ Yes' if has_code else '❌ No'}")
            print(f"      Rationale: {'✅ Yes' if has_rationale else '❌ No'}")
            print(f"      Error: {'⚠️ Yes (with fallback)' if has_error else '✅ No error'}")
            
            if not has_code:
                all_have_code = False
            if not has_rationale:
                all_have_rationale = False
        
        success = all_have_code and all_have_rationale and len(results) == len(test_variables)
        
        if success:
            print(f"\n   ✅ All variables have complete responses!")
        else:
            print(f"\n   ❌ Some variables have incomplete responses!")
        
        return success
        
    except Exception as e:
        print(f"   ❌ Bulk generation failed completely: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests"""
    print("\n" + "=" * 70)
    print("PAIR PROGRAMMING ERROR-FREE VERIFICATION TESTS")
    print("=" * 70)
    
    print(f"\n⚙️  Configuration:")
    print(f"   Default Provider: {settings.DEFAULT_LLM_PROVIDER}")
    print(f"   Default Model: {getattr(settings, 'DEFAULT_MODEL', 'Not set')}")
    
    tests = [
        ("Fallback Code Generation", test_fallback_code_generation),
        ("Fallback Rationale Generation", test_fallback_rationale_generation),
        ("Error Handling in Generation", test_error_handling_in_generation),
        ("Bulk Generation Resilience", test_bulk_generation_resilience)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"\n❌ Test '{test_name}' crashed: {str(e)}")
            import traceback
            traceback.print_exc()
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
        print("\n🎉 All tests passed! Pair programming is error-free.")
        print("✅ All variables will receive meaningful responses")
        print("✅ Fallback templates provided when AI fails")
        print("✅ Comprehensive guidance for manual implementation")
        return 0
    else:
        print(f"\n⚠️  {total_tests - total_passed} test(s) failed.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
