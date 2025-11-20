# LLM Model Configuration - API Calls

## Current Configuration

Based on the code analysis, here's which model is being called:

### Default Provider: **Groq**
- **Provider**: `groq` (configured in `backend/app/config.py`)
- **Default Model**: `llama-3.3-70b-versatile`
- **Location**: `backend/app/config.py` lines 57-58

```python
DEFAULT_LLM_PROVIDER: str = "groq"
DEFAULT_MODEL: str = "llama-3.3-70b-versatile"  # Groq's fastest 70B model
```

## Model Selection Logic

When code generation API calls are made:

1. **If `llm_provider` parameter is provided** in the request:
   - Uses that provider (groq, openai, anthropic, google, openrouter)
   - Uses the model specified for that provider

2. **If `llm_provider` is NOT provided** (default):
   - Uses `DEFAULT_LLM_PROVIDER` = **"groq"**
   - Uses `DEFAULT_MODEL` = **"llama-3.3-70b-versatile"**

## Provider-Specific Models

Each provider has its default model:

| Provider | Default Model | Configuration |
|----------|--------------|---------------|
| **Groq** (default) | `llama-3.3-70b-versatile` | `DEFAULT_MODEL` |
| OpenAI | `gpt-4` | Falls back if Groq unavailable |
| Anthropic | `claude-3-5-sonnet-20241022` | Falls back if Groq unavailable |
| Google | `gemini-2.0-flash-exp` | `GEMINI_MODEL` |
| OpenRouter | `meta-llama/llama-3.1-70b-instruct` | `OPENROUTER_MODEL` |

## Code Generation API Calls

When you call the code generation endpoint:

```python
# Default call (uses Groq)
POST /api/v1/code-generation/generate-code-bulk
{
    "llm_provider": null,  # or not provided
    ...
}
# → Uses: Groq + llama-3.3-70b-versatile

# Explicit provider call
POST /api/v1/code-generation/generate-code-bulk
{
    "llm_provider": "groq",
    ...
}
# → Uses: Groq + llama-3.3-70b-versatile

# Different provider
POST /api/v1/code-generation/generate-code-bulk
{
    "llm_provider": "openai",
    ...
}
# → Uses: OpenAI + gpt-4
```

## Model Details

### Current Model: `llama-3.3-70b-versatile` (Groq)

- **Provider**: Groq
- **Model Family**: Llama 3.3
- **Size**: 70B parameters
- **Type**: Versatile (general-purpose)
- **Speed**: Optimized for fast inference
- **Rate Limits**: 
  - Free tier: 30 req/min, 14,400 req/day
  - Paid tier: Higher limits

### Why This Model?

1. **Speed**: Groq's infrastructure is optimized for fast inference
2. **Cost**: Free tier available with generous limits
3. **Quality**: 70B model provides good code generation quality
4. **Compatibility**: Works well with batch processing (25 variables per call)

## Model Selection in Code

The model selection happens in:

1. **Service Initialization**: `backend/app/modules/llm_integration/service.py`
   - Lines 872-881: Groq provider initialization
   - Uses `DEFAULT_MODEL` if provider is groq

2. **Code Generation**: `backend/app/modules/code_generator/service.py`
   - Line 129-135: Calls LLM service with provider/model
   - Line 551-559: Batch generation uses same model

## Changing the Model

To use a different model, you can:

### Option 1: Change Default in Config
Edit `backend/app/config.py`:
```python
DEFAULT_LLM_PROVIDER: str = "openai"  # or "anthropic", "google", "openrouter"
DEFAULT_MODEL: str = "gpt-4"  # or desired model name
```

### Option 2: Specify in API Request
```json
{
    "llm_provider": "openai",
    "model": "gpt-4-turbo",
    ...
}
```

### Option 3: Use Environment Variables
```bash
export DEFAULT_LLM_PROVIDER=openai
export DEFAULT_MODEL=gpt-4-turbo
```

## Verification

To verify which model is being used, check:

1. **Service logs** when code generation starts:
   ```
   ✅ Initialized Groq provider with model: llama-3.3-70b-versatile
   ```

2. **Response metadata** in code generation results:
   ```json
   {
       "metadata": {
           "provider": "groq",
           "model": "llama-3.3-70b-versatile"
       }
   }
   ```

3. **API endpoint**: Check `/api/v1/llm-models/stats` for active providers

## Summary

**Current API Calls Go To:**
- **Provider**: Groq
- **Model**: `llama-3.3-70b-versatile`
- **API Endpoint**: `https://api.groq.com/openai/v1/chat/completions`
- **Rate Limit**: 30 requests/minute (free tier)

This model is optimized for:
- ✅ Fast inference (important for batch processing)
- ✅ Good code generation quality
- ✅ Free tier availability
- ✅ High throughput (supports 15 concurrent batches)
