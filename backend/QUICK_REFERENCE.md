# Backend Code Generator - Quick Reference

## 🚀 Quick Start

### Initialize Service
```python
from app.modules.code_generator.service import get_code_generator_service

service = get_code_generator_service()  # Singleton pattern
```

### Generate Code for All Variables
```python
results = await service.generate_code_for_all_variables(
    categorized_variables={
        "categories": [
            {
                "name": "demographic",
                "variables": [
                    {
                        "name": "AGEGR1",
                        "label": "Age Group 1",
                        "derivation": "If AGE < 65 then '<65' else '>=65'",
                        "type": "text"
                    }
                ]
            }
        ]
    },
    study_id="STUDY001",
    dataset="ADSL",
    language="R",  # or "SAS"
    standards={"sdtm_version": "3.4", "adam_ig_version": "1.3"}
)
```

### Generate Code for Single Variable
```python
result = await service.generate_single_variable(
    variable={
        "name": "CHG",
        "label": "Change from Baseline",
        "derivation": "AVAL - BASE",
        "type": "numeric"
    },
    language="R",
    context={
        "dataset": "ADVS",
        "standards": {"sdtm_version": "3.4"}
    }
)
```

## 📡 API Endpoints

### 1. Bulk Generation
```http
POST /api/v1/code-generation/generate-code-bulk
Content-Type: application/json

{
  "categorized_variables": { ... },
  "study_id": "STUDY001",
  "dataset": "ADSL",
  "language": "R",
  "standards": { "sdtm_version": "3.4" }
}

Response: List[CodeSnippetResponse]
```

### 2. Single Variable
```http
POST /api/v1/code-generation/generate-code-snippet
Content-Type: application/json

{
  "variable": {
    "name": "AGEGR1",
    "label": "Age Group 1",
    "derivation": "Categorize AGE",
    "type": "text"
  },
  "language": "R",
  "context": { "dataset": "ADSL" }
}

Response: CodeSnippetResponse
```

### 3. Cache Management
```http
POST /api/v1/code-generation/clear-cache

Response: { "message": "Cache cleared successfully" }
```

### 4. Statistics
```http
GET /api/v1/code-generation/stats

Response: {
  "cache_hit_rate": 0.75,
  "total_cached_entries": 42,
  "hits": 100,
  "misses": 33
}
```

## 🎯 Template Patterns

### Supported Derivation Patterns
| Pattern | Example Derivation | Template Used |
|---------|-------------------|---------------|
| Conditional Flag | "If AGE >= 65 then 'Y' else 'N'" | `conditional_flag` |
| Baseline Flag | "Flag baseline visit" | `baseline_flag` |
| Worst Case | "Maximum toxicity grade" | `worst_case_flag` |
| Date Conversion | "Convert RFSTDTC to date" | `date_conversion` |
| DateTime | "Parse AESTDTC to datetime" | `datetime_conversion` |
| Merge | "Merge ADSL with VS by USUBJID" | `merge_datasets` |
| Calculation | "AVAL - BASE" | `numeric_calculation` |
| Aggregate | "Mean of AVAL by subject" | `aggregate_function` |
| Concatenate | "Combine LNAME and FNAME" | `string_concatenation` |
| Extract | "Extract first 3 characters" | `string_extraction` |
| Group By | "Group by USUBJID and VISIT" | `grouping_operation` |
| Sort | "Sort by ADT" | `sorting` |
| Filter | "Where SAFFL = 'Y'" | `filter_rows` |
| Select | "Select specific columns" | `select_columns` |
| Direct | "Derived from DM.AGE" | `direct_derivation` |

## ⚙️ Configuration

### Environment Variables
```env
# Required
GEMINI_API_KEY=your-api-key-here

# Optional (defaults shown)
GEMINI_MODEL=gemini-2.0-flash-exp
GEMINI_TEMPERATURE=0.2
GEMINI_MAX_TOKENS=2048
BATCH_SIZE=10
MAX_CONCURRENT_REQUESTS=5
REQUEST_TIMEOUT=30
CACHE_TTL=3600
```

### Getting API Key
1. Visit https://aistudio.google.com/app/apikey
2. Create new API key
3. Add to `.env` file as `GEMINI_API_KEY`

## 🔍 Response Format

### CodeSnippetResponse
```python
{
  "variable": "AGEGR1",
  "code_snippet": "adsl$AGEGR1 <- ifelse(adsl$AGE < 65, '<65', '>=65')",
  "coding_rationale": "Categorize age into two groups based on 65-year threshold",
  "success": True,
  "error": None,
  "metadata": {
    "model": "gemini-2.0-flash-exp",
    "tokens_used": 150,
    "cached": False,
    "generation_time": 1.23
  }
}
```

## 💾 Caching

### How Caching Works
- Cache key: MD5 hash of `variable + derivation + language + dataset`
- TTL: 1 hour (3600 seconds)
- Automatic expiration and cleanup

### Check Cache Stats
```python
from app.modules.code_generator.cache_manager import CacheManager

cache = CacheManager()
stats = cache.get_stats()
print(f"Hit rate: {stats['hit_rate']:.2%}")
print(f"Total entries: {stats['total_entries']}")
```

### Clear Cache
```python
cache.clear()  # Clear all entries
cache.clear_expired()  # Clear only expired entries
```

## 🎨 Prompt Customization

### Select Template Manually
```python
from app.modules.code_generator.prompt_builder import TemplateSelector

selector = TemplateSelector()
template = selector.select_template(
    derivation="If AGE >= 65 then 'Y' else 'N'",
    language="R"
)
# Returns: "conditional_flag"
```

### Build Custom Prompt
```python
from app.modules.code_generator.prompt_builder import PromptBuilder

builder = PromptBuilder()
prompt = builder.build_code_generation_prompt(
    variable_name="AGEGR1",
    derivation_logic="Categorize AGE",
    language="R",
    adam_dataset="ADSL",
    variable_type="text",
    variable_label="Age Group 1",
    sdtm_domains=["DM", "VS"],
    cdisc_standards={"sdtm_version": "3.4"}
)
```

## 📊 Performance Tips

### Optimize for Speed
1. **Use Caching**: Let cache warm up with common variables
2. **Batch Processing**: Process multiple variables at once
3. **Concurrent Requests**: Max 5 simultaneous (configurable)
4. **Template Reuse**: Similar derivations use templates

### Monitor Performance
```python
# Check generation time
result = await service.generate_single_variable(...)
print(f"Generation time: {result['metadata']['generation_time']}s")

# Check cache effectiveness
stats = cache.get_stats()
print(f"Cache hit rate: {stats['hit_rate']:.2%}")
```

## 🐛 Troubleshooting

### Common Issues

**1. API Key Error**
```
Error: GEMINI_API_KEY not found
Solution: Add API key to .env file
```

**2. Rate Limit Exceeded**
```
Error: Rate limit exceeded (60 calls/minute)
Solution: Wait or adjust MAX_CONCURRENT_REQUESTS
```

**3. Timeout**
```
Error: Request timed out after 30s
Solution: Adjust REQUEST_TIMEOUT in config
```

**4. Invalid Template**
```
Error: Template not found for derivation
Solution: Check derivation text, falls back to direct_derivation
```

## 🧪 Testing

### Run All Tests
```bash
cd backend
python -m pytest tests/test_code_generator/ -v
```

### Run Specific Test
```bash
python -m pytest tests/test_code_generator/test_simplified.py -v
```

### Run with Coverage
```bash
python -m pytest tests/test_code_generator/ --cov=app.modules.code_generator
```

## 📚 Available Templates

### R Templates (16)
```python
from app.modules.code_generator.templates.r_templates.derivation_templates import list_r_templates

templates = list_r_templates()
# Returns: ['direct_derivation', 'conditional_flag', ...]
```

### SAS Templates (17)
```python
from app.modules.code_generator.templates.sas_templates.derivation_templates import list_sas_templates

templates = list_sas_templates()
# Returns: ['direct_derivation', 'conditional_flag', 'data_step', ...]
```

## 🔗 Related Files

### Core Modules
- `gemini_client.py` - API client
- `prompt_builder.py` - Prompt construction
- `cache_manager.py` - Caching
- `batch_processor.py` - Batch processing
- `service.py` - Main service

### Configuration
- `app/config.py` - App settings
- `.env` - Environment variables

### API Endpoints
- `api/v1/endpoints/code_generation.py`

### Tests
- `tests/test_code_generator/test_simplified.py`

## 💡 Best Practices

1. **Always use the singleton**: `get_code_generator_service()`
2. **Batch when possible**: Process multiple variables together
3. **Monitor cache hit rate**: Aim for >50% hit rate
4. **Use appropriate templates**: Match derivation to template pattern
5. **Handle errors gracefully**: Check `success` field in response
6. **Set realistic timeouts**: Allow 30s for complex generations
7. **Clear cache periodically**: Prevent stale code accumulation

## 📞 Support

For issues or questions:
1. Check logs in `logs/adam_ai.log`
2. Verify API key is valid
3. Check service statistics
4. Review error messages in response

---

**Phase 4 Complete** ✅ | Ready for Phase 5 (Frontend Integration)
