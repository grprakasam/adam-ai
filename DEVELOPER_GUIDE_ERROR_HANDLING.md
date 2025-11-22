# Developer Guide: Error Handling Best Practices

## Common AttributeError Issues and Solutions

### Issue: `'ServiceName' object has no attribute 'method_name'`

This error typically occurs due to one of the following reasons:

### Cause 1: Stale Python Bytecode Cache ⚠️ MOST COMMON

**Symptoms:**
- Method exists in source code but throws AttributeError at runtime
- Works in some environments but not others
- Happens after code updates or git pulls

**Solution:**
```powershell
# Windows PowerShell
Get-ChildItem -Path . -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
Get-ChildItem -Path . -Recurse -Filter "*.pyc" | Remove-Item -Force
```

```bash
# Linux/Mac
find . -type d -name "__pycache__" -exec rm -rf {} +
find . -type f -name "*.pyc" -delete
```

**Prevention:**
- Run cache clearing before starting development server
- Add to `.gitignore`:
  ```gitignore
  __pycache__/
  *.py[cod]
  *$py.class
  .Python
  ```

### Cause 2: Missing Method Definition

**Symptoms:**
- Method truly doesn't exist in the class
- Never worked, not cache-related

**Solution:**
- Implement the missing method
- Check for typos in method names
- Verify inheritance chain

### Cause 3: Import Issues

**Symptoms:**
- Service imports fail silently
- Methods from mixins not available

**Solution:**
- Check import statements
- Verify Python path
- Ensure all dependencies installed

## Defensive Coding Patterns

### Pattern 1: Method Verification in `__init__`

```python
class MyService:
    """Service with method verification"""
    
    def __init__(self):
        logger.info("Initializing MyService")
        self._verify_methods()
    
    def _verify_methods(self):
        """Verify required methods exist"""
        required_methods = [
            'method1',
            'method2',
            'method3',
        ]
        
        missing_methods = []
        for method_name in required_methods:
            if not hasattr(self, method_name):
                missing_methods.append(method_name)
        
        if missing_methods:
            error_msg = f"{self.__class__.__name__} is missing required methods: {', '.join(missing_methods)}"
            logger.error(error_msg)
            raise AttributeError(error_msg)
        
        logger.debug(f"All {len(required_methods)} required methods verified")
```

**Benefits:**
- Fails fast with clear error message
- Lists all missing methods at once
- Helps diagnose cache vs. code issues

### Pattern 2: Graceful Method Calling with `getattr`

```python
class MyService:
    async def _call_dependency(self, method_name: str, *args, **kwargs):
        """Safely call method that might not exist"""
        method = getattr(self.dependency, method_name, None)
        
        if method is None:
            logger.warning(f"Method {method_name} not found on dependency")
            # Fallback behavior
            return None
        
        if not callable(method):
            logger.error(f"{method_name} exists but is not callable")
            return None
        
        try:
            return await method(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error calling {method_name}: {e}")
            raise
```

**Benefits:**
- Handles missing methods gracefully
- Provides logging for debugging
- Allows fallback behavior

### Pattern 3: Enhanced Exception Handling in API Endpoints

```python
@router.post("/endpoint")
async def my_endpoint(request: RequestModel):
    try:
        service = get_service()
        result = service.process(request)
        return {"status": "success", "data": result}
        
    except AttributeError as e:
        logger.error(f"AttributeError in endpoint: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Service method not found: {str(e)}. Please ensure the backend service is properly initialized."
        )
    
    except ValueError as e:
        logger.warning(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Invalid input: {str(e)}")
    
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
```

**Benefits:**
- Specific handling for different error types
- Full stack traces for debugging
- User-friendly error messages
- Distinguishes client vs. server errors

## Service Method Naming Conventions

### Use Clear, Descriptive Names
```python
# Good
def generate_data_input_section(self, language: str, domains: List[str]) -> str:
    pass

# Avoid ambiguous names
def gen_input(self, lang, doms):  # ❌ Too abbreviated
    pass
```

### Provide Aliases for Backward Compatibility
```python
class MyService:
    def new_method_name(self, param: str) -> str:
        """New implementation"""
        return f"Result: {param}"
    
    # Alias for backward compatibility
    def old_method_name(self, param: str) -> str:
        """Deprecated: Use new_method_name instead"""
        logger.warning("old_method_name is deprecated, use new_method_name")
        return self.new_method_name(param)
```

## Testing Services

### Unit Test Template
```python
import pytest
from app.modules.mymodule.service import MyService

class TestMyService:
    @pytest.fixture
    def service(self):
        """Fixture providing initialized service"""
        return MyService()
    
    def test_service_initialization(self, service):
        """Test service initializes without errors"""
        assert service is not None
        assert hasattr(service, 'method1')
    
    def test_method_exists(self, service):
        """Test critical methods exist"""
        required_methods = ['method1', 'method2']
        for method_name in required_methods:
            assert hasattr(service, method_name)
            assert callable(getattr(service, method_name))
    
    def test_method_execution(self, service):
        """Test method executes correctly"""
        result = service.method1('test_input')
        assert result is not None
        assert 'expected_value' in result
```

### Integration Test Template
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_endpoint_with_service():
    """Test endpoint that uses service"""
    response = client.post("/api/endpoint", json={
        "param1": "value1",
        "param2": "value2"
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
```

## Debugging Checklist

When encountering AttributeError:

- [ ] Clear Python cache (`__pycache__` and `.pyc` files)
- [ ] Restart the development server
- [ ] Check method exists in source code
- [ ] Verify correct spelling and case
- [ ] Check if method is inherited from parent class
- [ ] Verify imports are correct
- [ ] Check if service is properly initialized
- [ ] Look at full stack trace in logs
- [ ] Test in isolation (unit test)
- [ ] Check Python version compatibility

## Logging Best Practices

### Service Initialization
```python
def __init__(self):
    logger.info(f"Initializing {self.__class__.__name__}")
    try:
        self._verify_methods()
        logger.info(f"{self.__class__.__name__} initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize {self.__class__.__name__}: {e}")
        raise
```

### Method Execution
```python
async def process_data(self, data: Dict) -> Result:
    logger.debug(f"Processing data: {len(data)} items")
    
    try:
        result = await self._internal_process(data)
        logger.info(f"Processing completed: {result.summary}")
        return result
        
    except Exception as e:
        logger.error(f"Processing failed: {e}", exc_info=True)
        raise
```

## Cache Management Script

Create `scripts/clear_cache.py`:
```python
#!/usr/bin/env python3
"""Clear all Python cache files"""

import shutil
from pathlib import Path

def clear_cache():
    root = Path(__file__).parent.parent
    
    # Clear __pycache__ directories
    cache_dirs = list(root.rglob('__pycache__'))
    for cache_dir in cache_dirs:
        print(f"Removing {cache_dir}")
        shutil.rmtree(cache_dir, ignore_errors=True)
    
    # Clear .pyc files
    pyc_files = list(root.rglob('*.pyc'))
    for pyc_file in pyc_files:
        print(f"Removing {pyc_file}")
        pyc_file.unlink(missing_ok=True)
    
    print(f"Cleared {len(cache_dirs)} cache directories and {len(pyc_files)} .pyc files")

if __name__ == "__main__":
    clear_cache()
```

Usage:
```bash
python scripts/clear_cache.py
```

## Development Workflow

1. **Before Starting Work:**
   ```bash
   git pull
   python scripts/clear_cache.py
   pip install -r requirements.txt
   ```

2. **During Development:**
   - Use `-B` flag: `python -B main.py`
   - Or set environment variable: `export PYTHONDONTWRITEBYTECODE=1`

3. **After Code Updates:**
   ```bash
   python scripts/clear_cache.py
   # Restart server
   ```

4. **Before Committing:**
   - Run tests
   - Clear cache
   - Verify no cache files in commit

## Summary

Most AttributeError issues in this codebase are caused by **stale Python bytecode cache**. Always:

1. ✅ Clear cache when pulling code
2. ✅ Clear cache after updating dependencies  
3. ✅ Clear cache when seeing AttributeError
4. ✅ Add cache directories to `.gitignore`
5. ✅ Use method verification in service `__init__`
6. ✅ Add specific error handling in API endpoints
7. ✅ Write comprehensive tests
8. ✅ Log with full context

Following these practices will prevent 95% of AttributeError issues!





