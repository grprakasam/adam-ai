"""
Test Submission Readiness Implementation
Quick verification that modules load and basic functionality works
"""

import sys
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent
sys.path.insert(0, str(backend_path))

def test_validation_modules():
    """Test that validation modules import correctly"""
    print("Testing validation modules...")
    
    try:
        from app.modules.validation.adam_conformance import AdamConformanceValidator
        from app.modules.validation.controlled_terminology import ControlledTerminologyValidator
        from app.modules.validation.p21_runner import P21Runner
        from app.modules.validation.models import (
            ValidationIssue, ValidationSummary,
            PreP21Request, PreP21Response
        )
        print("✓ Validation modules imported successfully")
        
        # Test basic functionality
        validator = AdamConformanceValidator()
        print(f"✓ AdamConformanceValidator initialized")
        print(f"  - Loaded {len(validator.required_vars)} dataset rule sets")
        
        return True
    except Exception as e:
        print(f"✗ Validation module test failed: {e}")
        return False

def test_submission_modules():
    """Test that submission modules import correctly"""
    print("\nTesting submission modules...")
    
    try:
        from app.modules.submission.define_xml_generator import DefineXMLGenerator
        from app.modules.submission.adrg_generator import ADRGGenerator
        from app.modules.submission.sdrg_generator import SDRGGenerator
        from app.modules.submission.ectd_packager import ECTDPackager
        from app.modules.submission.models import (
            StudyInfo, DatasetInfo,
            DefineXMLRequest, DocumentRequest, ECTDPackageRequest
        )
        print("✓ Submission modules imported successfully")
        
        # Test basic functionality
        generator = DefineXMLGenerator()
        print(f"✓ DefineXMLGenerator initialized")
        
        packager = ECTDPackager()
        print(f"✓ ECTDPackager initialized")
        print(f"  - M5 structure paths: {len(packager.m5_structure)}")
        
        return True
    except Exception as e:
        print(f"✗ Submission module test failed: {e}")
        return False

def test_api_endpoints():
    """Test that API endpoints import correctly"""
    print("\nTesting API endpoints...")
    
    try:
        # Set minimal environment for testing
        import os
        os.environ.setdefault('SECRET_KEY', 'test-secret-key-for-validation-only')
        os.environ.setdefault('OPENAI_API_KEY', 'test-key')
        
        from app.api.v1.endpoints.validation import router as validation_router
        from app.api.v1.endpoints.submission import router as submission_router
        print("✓ API endpoints imported successfully")
        print(f"✓ Validation routes: {len(validation_router.routes)} endpoints")
        print(f"✓ Submission routes: {len(submission_router.routes)} endpoints")
        
        return True
    except Exception as e:
        print(f"✗ API endpoint test failed: {e}")
        return False

def main():
    """Run all tests"""
    print("=" * 60)
    print("SUBMISSION READINESS IMPLEMENTATION TEST")
    print("=" * 60)
    
    results = []
    results.append(("Validation Modules", test_validation_modules()))
    results.append(("Submission Modules", test_submission_modules()))
    results.append(("API Endpoints", test_api_endpoints()))
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    
    for test_name, passed in results:
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(result[1] for result in results)
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✓ ALL TESTS PASSED - Implementation ready!")
    else:
        print("✗ SOME TESTS FAILED - Check errors above")
    print("=" * 60)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    exit(main())
