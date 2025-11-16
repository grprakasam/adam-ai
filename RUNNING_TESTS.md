# Running the Test Suite

**Quick Start Guide for ADAM AI Testing Framework**

---

## 📋 Prerequisites

Ensure you have the following installed:
- Python 3.9+
- pytest 7.4.3+
- pytest-asyncio 0.21.1+
- faker 33.1.0 (already in requirements.txt)

---

## 🚀 Quick Start

### 1. Install Test Dependencies

```bash
cd backend
..\\prakenv\\Scripts\\python.exe -m pip install pytest pytest-asyncio pytest-cov pytest-mock
```

### 2. Run All Tests

```bash
# Run all tests with verbose output
..\\prakenv\\Scripts\\python.exe -m pytest tests/ -v

# Run with coverage report
..\\prakenv\\Scripts\\python.exe -m pytest tests/ -v --cov=app --cov-report=html

# Run specific test module
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_program_generation/ -v
```

### 3. Run Tests by Category

#### Program Generation Tests
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_program_generation/test_service.py -v
```

#### Traceability Tests
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_traceability/test_service.py -v
```

#### Submission Tests
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_submission/test_service.py -v
```

#### Code Generation & Data Tests
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_code_generation/test_data_generation.py -v
```

#### Integration Tests
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_integration/test_end_to_end_workflows.py -v
```

### 4. Run with Coverage

```bash
# Generate coverage report
..\\prakenv\\Scripts\\python.exe -m pytest tests/ --cov=app --cov-report=html --cov-report=term

# View in browser
start htmlcov/index.html
```

### 5. Run Specific Test

```bash
# Run single test by name
..\\prakenv\\Scripts\\python.exe -m pytest tests/test_program_generation/test_service.py::TestProgramGeneratorService::test_generate_sas_header -v

# Run tests matching pattern
..\\prakenv\\Scripts\\python.exe -m pytest tests/ -k "sas" -v
```

---

## 🎯 Test Commands Cheat Sheet

| Command | Purpose |
|---------|---------|
| `pytest tests/ -v` | Run all tests verbosely |
| `pytest tests/ -q` | Run all tests quietly (summary only) |
| `pytest tests/ --tb=short` | Short traceback format |
| `pytest tests/ -x` | Stop on first failure |
| `pytest tests/ --lf` | Run last failed tests |
| `pytest tests/ --ff` | Run last failed first, then others |
| `pytest tests/ -m "not slow"` | Skip slow tests |

---

## 📊 Expected Test Results

After running the complete test suite:

```
====== test session starts ======
Platform: win32 -- Python 3.x.x, pytest-7.x.x, ...
collected 275 items

tests/test_program_generation/test_service.py ............... [18%]
tests/test_traceability/test_service.py .................... [38%]
tests/test_submission/test_service.py ...................... [55%]
tests/test_code_generation/test_data_generation.py ......... [78%]
tests/test_integration/test_end_to_end_workflows.py ........ [100%]

====== 275 passed in X.XXs ======
```

---

## 🔍 Debugging Tests

### Verbose Output
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/ -vv
```

### Print Statements
```bash
# Capture print statements (-s flag)
..\\prakenv\\Scripts\\python.exe -m pytest tests/ -s
```

### Show Local Variables
```bash
# Display local variables on failure
..\\prakenv\\Scripts\\python.exe -m pytest tests/ -l
```

### Debug Mode
```bash
# Drop into debugger on failure
..\\prakenv\\Scripts\\python.exe -m pytest tests/ --pdb
```

---

## 📈 Coverage Analysis

### Generate Coverage Report
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/ --cov=app --cov-report=html --cov-report=term-missing
```

### View Coverage Report
```bash
# Opens in default browser
start htmlcov/index.html
```

### Coverage by Module
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/ --cov=app.modules.program_generation --cov-report=term-missing
```

---

## 🚨 Common Issues & Solutions

### Issue: `ModuleNotFoundError: No module named 'pytest'`
**Solution**: Install pytest first
```bash
..\\prakenv\\Scripts\\python.exe -m pip install pytest pytest-asyncio
```

### Issue: `ImportError: cannot import name 'asyncio'`
**Solution**: Ensure Python 3.9+ is installed

### Issue: Tests fail with `fixture 'service' not found`
**Solution**: Verify pytest can find fixtures in `conftest.py` files

### Issue: `TimeoutError` in async tests
**Solution**: Increase timeout or check for blocking operations
```bash
..\\prakenv\\Scripts\\python.exe -m pytest tests/ --timeout=300
```

### Issue: Windows path issues
**Solution**: Use raw strings or forward slashes
```python
# Good
path = r"c:\path\to\file"
path = "c:/path/to/file"

# Avoid
path = "c:\path\to\file"  # Escape sequences
```

---

## 📝 Test Structure Overview

```
backend/tests/
├── test_program_generation/
│   ├── __init__.py
│   ├── test_service.py (45+ tests)
│   ├── conftest.py
│   └── ...
├── test_traceability/
│   ├── __init__.py
│   ├── test_service.py (55+ tests)
│   └── ...
├── test_submission/
│   ├── __init__.py
│   ├── test_service.py (50+ tests)
│   └── ...
├── test_code_generation/
│   ├── __init__.py
│   ├── test_data_generation.py (65+ tests)
│   └── ...
└── test_integration/
    ├── __init__.py
    ├── test_end_to_end_workflows.py (60+ tests)
    └── ...
```

---

## 🔄 Continuous Integration

### Run Tests Before Commit
```bash
# Pre-commit hook
..\\prakenv\\Scripts\\python.exe -m pytest tests/ --tb=short
```

### Automated Test Runs
Tests should be run:
- On every commit (pre-commit hook)
- In CI/CD pipeline (GitHub Actions, etc.)
- Before pull request merge
- In release pipelines

---

## 📚 Test Documentation

For detailed information about specific test modules, see:

- [Program Generation Tests](backend/tests/test_program_generation/test_service.py)
- [Traceability Tests](backend/tests/test_traceability/test_service.py)
- [Submission Tests](backend/tests/test_submission/test_service.py)
- [Code Generation Tests](backend/tests/test_code_generation/test_data_generation.py)
- [Integration Tests](backend/tests/test_integration/test_end_to_end_workflows.py)

---

## 🎓 Writing New Tests

### Test Template
```python
import pytest
from unittest.mock import Mock, AsyncMock

class TestMyFeature:
    """Test suite for my feature"""

    @pytest.fixture
    def service(self):
        """Fixture providing service instance"""
        return MyService()

    def test_my_feature_basic(self, service):
        """Test basic functionality"""
        result = service.do_something()
        assert result is not None
        assert result.status == 'success'

    @pytest.mark.asyncio
    async def test_my_async_feature(self, service):
        """Test async functionality"""
        result = await service.do_something_async()
        assert result is not None
```

### Naming Conventions
- Test files: `test_*.py` or `*_test.py`
- Test classes: `Test*` (e.g., `TestMyService`)
- Test methods: `test_*` (e.g., `test_basic_functionality`)
- Fixtures: `lowercase_with_underscores`

---

## 💡 Tips & Best Practices

1. **Use Fixtures**: Reusable setup code
2. **Mock External Services**: Isolate unit tests
3. **Test Edge Cases**: Null, empty, negative values
4. **Async Testing**: Use `@pytest.mark.asyncio`
5. **Parameterize Tests**: Test multiple inputs
6. **Keep Tests Fast**: Avoid real I/O
7. **Clear Assertions**: Obvious failure messages
8. **DRY**: Don't repeat test code

---

## 🤝 Contributing Tests

When adding new features:
1. Write tests first (TDD)
2. Ensure 85%+ coverage
3. Follow naming conventions
4. Document complex test logic
5. Run full suite before commit

---

## 📞 Support

For test-related questions:
- Review existing test examples
- Check pytest documentation: https://docs.pytest.org/
- Check asyncio documentation: https://docs.python.org/3/library/asyncio.html

---

**Last Updated**: November 16, 2025
**Status**: ✅ Ready for use
