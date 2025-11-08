"""
Quick test script to verify backend setup
"""
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

def test_imports():
    """Test that all core modules can be imported"""
    print("Testing imports...")
    
    try:
        import fastapi
        print(f"✓ FastAPI {fastapi.__version__}")
    except ImportError as e:
        print(f"✗ FastAPI: {e}")
        return False
    
    try:
        import pydantic
        print(f"✓ Pydantic {pydantic.__version__}")
    except ImportError as e:
        print(f"✗ Pydantic: {e}")
        return False
    
    try:
        import loguru
        print("✓ Loguru")
    except ImportError as e:
        print(f"✗ Loguru: {e}")
        return False
    
    try:
        import openai
        print(f"✓ OpenAI {openai.__version__}")
    except ImportError as e:
        print(f"✗ OpenAI: {e}")
        return False
    
    try:
        import anthropic
        print(f"✓ Anthropic {anthropic.__version__}")
    except ImportError as e:
        print(f"✗ Anthropic: {e}")
        return False
    
    try:
        import google.generativeai
        print("✓ Google GenerativeAI")
    except ImportError as e:
        print(f"✗ Google GenerativeAI: {e}")
        return False
    
    print("\nAll core packages imported successfully!")
    return True

def test_app_imports():
    """Test that application modules can be imported"""
    print("\nTesting application modules...")
    
    try:
        from app import config
        print("✓ app.config")
    except ImportError as e:
        print(f"✗ app.config: {e}")
        return False
    
    try:
        from app.models import input_models
        print("✓ app.models.input_models")
    except ImportError as e:
        print(f"✗ app.models.input_models: {e}")
        return False
    
    try:
        from app.modules.input_collection import service
        print("✓ app.modules.input_collection.service")
    except ImportError as e:
        print(f"✗ app.modules.input_collection.service: {e}")
        return False
    
    try:
        from app.modules.rule_loading import service
        print("✓ app.modules.rule_loading.service")
    except ImportError as e:
        print(f"✗ app.modules.rule_loading.service: {e}")
        return False
    
    try:
        from app.modules.llm_integration import service
        print("✓ app.modules.llm_integration.service")
    except ImportError as e:
        print(f"✗ app.modules.llm_integration.service: {e}")
        return False
    
    print("\nAll application modules imported successfully!")
    return True

def test_fastapi_app():
    """Test that the FastAPI app can be created"""
    print("\nTesting FastAPI application...")
    
    try:
        from app.main import app
        print(f"✓ FastAPI app created: {app.title}")
        print(f"  Version: {app.version}")
        print(f"  Docs URL: {app.docs_url}")
        return True
    except Exception as e:
        print(f"✗ FastAPI app creation failed: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("ADAM AI Backend - Setup Verification")
    print("=" * 60)
    print()
    
    results = []
    results.append(("Core Imports", test_imports()))
    results.append(("App Modules", test_app_imports()))
    results.append(("FastAPI App", test_fastapi_app()))
    
    print()
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "PASS" if passed else "FAIL"
        symbol = "✓" if passed else "✗"
        print(f"{symbol} {name}: {status}")
    
    all_passed = all(passed for _, passed in results)
    
    if all_passed:
        print("\n✓ All tests passed! Backend is ready.")
        print("\nTo start the server, run:")
        print("  cd backend")
        print("  ..\\prakenv\\Scripts\\python.exe -m uvicorn app.main:app --reload")
        sys.exit(0)
    else:
        print("\n✗ Some tests failed. Please fix the issues above.")
        sys.exit(1)
