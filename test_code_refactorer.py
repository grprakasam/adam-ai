"""
Test script to verify code refactorer endpoint and LLM integration
"""
import requests
import json

# Backend URL
BASE_URL = "http://localhost:8000"

def test_code_refactorer_sas():
    """Test code refactorer with sample SAS code"""
    print(f"\n{'='*60}")
    print(f"Testing Code Refactorer - SAS Code")
    print(f"{'='*60}")

    # Code refactorer endpoint
    refactor_url = f"{BASE_URL}/api/v1/code-refactorer/analyze"

    # Sample SAS code to analyze
    sample_sas_code = """
data adeff;
    set sdtm.ex;
    where usubjid ne '';
    if visitnum = 1 then do;
        baseline = aval;
    end;
    chg = aval - baseline;
run;
"""

    request_data = {
        "code": sample_sas_code,
        "language": "SAS"
    }

    try:
        print(f"\n1. Sending SAS code to refactorer endpoint...")
        print(f"   URL: {refactor_url}")
        print(f"   Code length: {len(sample_sas_code)} characters")
        print(f"   Language: SAS")

        response = requests.post(
            refactor_url,
            json=request_data,
            headers={
                "Content-Type": "application/json"
            },
            timeout=60  # LLM calls can take longer
        )

        print(f"\n2. Response Status Code: {response.status_code}")

        if response.status_code == 200:
            print(f"   [SUCCESS] CODE REFACTORER WORKING!")

            # Parse response
            result = response.json()
            print(f"\n3. Response Data:")
            print(f"   Optimization Score: {result.get('optimization_score')}/100")
            print(f"   Improvement Percentage: {result.get('improvement_percentage')}%")
            print(f"   Number of Suggestions: {len(result.get('suggestions', []))}")

            print(f"\n4. Suggestions:")
            for i, suggestion in enumerate(result.get('suggestions', []), 1):
                print(f"\n   Suggestion {i}:")
                print(f"      Type: {suggestion.get('type')}")
                print(f"      Title: {suggestion.get('title')}")
                print(f"      Impact: {suggestion.get('impact')}")
                print(f"      Description: {suggestion.get('description')[:100]}...")

            print(f"\n5. Optimized Code (first 200 chars):")
            optimized = result.get('optimized_code', '')
            print(f"   {optimized[:200]}...")

            print(f"\n   [VERIFIED] LLM integration is working - received optimized code and suggestions!")

        elif response.status_code == 404:
            print(f"   [FAILED] ENDPOINT NOT FOUND")
            print(f"   The code refactorer endpoint is not registered")
            print(f"   Response: {response.text}")

        elif response.status_code == 500:
            print(f"   [ERROR] INTERNAL SERVER ERROR")
            print(f"   LLM integration may have failed")
            print(f"   Response: {response.text}")

        else:
            print(f"   [ERROR] UNEXPECTED ERROR: {response.status_code}")
            print(f"   Response: {response.text}")

    except requests.exceptions.ConnectionError:
        print(f"   [ERROR] CONNECTION ERROR: Cannot connect to backend at {BASE_URL}")
        print(f"   Make sure the backend is running!")

    except requests.exceptions.Timeout:
        print(f"   [ERROR] TIMEOUT: Request took too long (>60s)")
        print(f"   LLM service may be slow or unavailable")

    except Exception as e:
        print(f"   [ERROR] ERROR: {str(e)}")
        import traceback
        traceback.print_exc()


def test_code_refactorer_r():
    """Test code refactorer with sample R code"""
    print(f"\n{'='*60}")
    print(f"Testing Code Refactorer - R Code")
    print(f"{'='*60}")

    # Code refactorer endpoint
    refactor_url = f"{BASE_URL}/api/v1/code-refactorer/analyze"

    # Sample R code to analyze
    sample_r_code = """
library(dplyr)

adeff <- sdtm_ex %>%
  filter(USUBJID != "") %>%
  group_by(USUBJID) %>%
  mutate(
    BASELINE = ifelse(VISITNUM == 1, AVAL, NA),
    CHG = AVAL - BASELINE
  )
"""

    request_data = {
        "code": sample_r_code,
        "language": "R"
    }

    try:
        print(f"\n1. Sending R code to refactorer endpoint...")
        print(f"   URL: {refactor_url}")
        print(f"   Code length: {len(sample_r_code)} characters")
        print(f"   Language: R")

        response = requests.post(
            refactor_url,
            json=request_data,
            headers={
                "Content-Type": "application/json"
            },
            timeout=60
        )

        print(f"\n2. Response Status Code: {response.status_code}")

        if response.status_code == 200:
            print(f"   [SUCCESS] CODE REFACTORER WORKING!")

            # Parse response
            result = response.json()
            print(f"\n3. Response Data:")
            print(f"   Optimization Score: {result.get('optimization_score')}/100")
            print(f"   Improvement Percentage: {result.get('improvement_percentage')}%")
            print(f"   Number of Suggestions: {len(result.get('suggestions', []))}")

            print(f"\n4. Suggestions:")
            for i, suggestion in enumerate(result.get('suggestions', []), 1):
                print(f"\n   Suggestion {i}:")
                print(f"      Type: {suggestion.get('type')}")
                print(f"      Title: {suggestion.get('title')}")
                print(f"      Impact: {suggestion.get('impact')}")

            print(f"\n   [VERIFIED] LLM integration is working for R code too!")

        else:
            print(f"   [FAILED] Status: {response.status_code}")
            print(f"   Response: {response.text}")

    except Exception as e:
        print(f"   [ERROR] ERROR: {str(e)}")


def test_health_check():
    """Test code refactorer health check"""
    print(f"\n{'='*60}")
    print(f"Testing Code Refactorer Health Check")
    print(f"{'='*60}")

    health_url = f"{BASE_URL}/api/v1/code-refactorer/health"

    try:
        print(f"\n1. Checking health endpoint...")
        print(f"   URL: {health_url}")

        response = requests.get(health_url, timeout=10)

        print(f"\n2. Response Status Code: {response.status_code}")

        if response.status_code == 200:
            result = response.json()
            print(f"   [SUCCESS] Service is healthy!")
            print(f"   Status: {result.get('status')}")
            print(f"   Provider: {result.get('provider')}")
            print(f"   Model: {result.get('model')}")
        else:
            result = response.json()
            print(f"   [WARNING] Service may be unhealthy")
            print(f"   Status: {result.get('status')}")
            print(f"   Error: {result.get('error')}")

    except Exception as e:
        print(f"   [ERROR] ERROR: {str(e)}")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("ADAM AI - Code Refactorer Test Script")
    print("="*60)

    # Test health check first
    test_health_check()

    # Test with SAS code
    test_code_refactorer_sas()

    # Test with R code
    test_code_refactorer_r()

    print("\n" + "="*60)
    print("Test Complete!")
    print("="*60 + "\n")
