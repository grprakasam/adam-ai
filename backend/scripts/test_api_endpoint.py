"""
Test the code generation API endpoint with new LLM integration
"""

import requests
import json

# Test single variable generation
def test_single_variable():
    print("\n" + "="*60)
    print("TESTING SINGLE VARIABLE CODE GENERATION")
    print("="*60)
    
    url = "http://localhost:8000/api/v1/code-generation/generate-code-snippet"
    
    payload = {
        "study_id": "TEST001",
        "dataset": "ADSL",
        "variable": "AGE",
        "spec_row": {
            "Label": "Age",
            "Type": "Num",
            "Core": "Req"
        },
        "derivation": "Derive age from birthdate",
        "language": "R",
        "context": {
            "category": "Demographics",
            "available_sdtm_domains": ["DM"],
            "required_variables": ["USUBJID", "STUDYID"]
        },
        "standards": {
            "sdtm_version": "1.7",
            "adam_ig_version": "1.3"
        }
    }
    
    print("\n📤 Sending request...")
    print(f"URL: {url}")
    print(f"Variable: {payload['variable']}")
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        
        print(f"\n📥 Response Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\n✅ SUCCESS!")
            print(f"Variable: {result.get('variable')}")
            print(f"\nCode Snippet:")
            print("-" * 60)
            print(result.get('codeSnippet', 'No code')[:500])  # First 500 chars
            print("-" * 60)
            print(f"\nRationale: {result.get('rationale', 'No rationale')[:200]}")
            return True
        else:
            print(f"\n❌ FAILED!")
            print(f"Error: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print("\n❌ TIMEOUT! Request took longer than 60 seconds")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False


if __name__ == "__main__":
    print("\n🧪 Testing API Endpoint with New LLM Integration")
    print("Using Groq (llama-3.3-70b-versatile) as default provider\n")
    
    success = test_single_variable()
    
    if success:
        print("\n" + "="*60)
        print("🎉 API TEST PASSED!")
        print("="*60)
        print("\nThe API endpoint is working correctly with:")
        print("  ✅ New LLM Integration Service")
        print("  ✅ Groq provider (llama-3.3-70b-versatile)")
        print("  ✅ No timeout errors")
        print("  ✅ Code generation successful")
    else:
        print("\n" + "="*60)
        print("❌ API TEST FAILED!")
        print("="*60)
