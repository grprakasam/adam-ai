# Rate Limit Error Fix - Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION REQUEST                              │
│                    "Generate code for variable X"                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LLMIntegrationService.generate()                      │
│                                                                           │
│  Step 1: Validate Input Parameters                                       │
│          ├─ Check prompt is non-empty                                    │
│          ├─ Validate temperature (0.0-2.0)                               │
│          └─ Validate max_tokens (1-32000)                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 2: Determine Provider & Fallback Chain                             │
│                                                                           │
│  Primary: groq                                                            │
│  Fallback Chain: ['groq', 'google', 'openai', 'anthropic', 'openrouter']│
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 3: Try Each Provider in Chain                                      │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │ Provider Loop (groq → google → openai → ...)                │        │
│  │                                                               │        │
│  │  ┌──────────────────────────────────────────────────┐       │        │
│  │  │ 3a. Rate Limiter Check (TokenBucketRateLimiter)  │       │        │
│  │  │                                                    │       │        │
│  │  │  Current Usage:                                   │       │        │
│  │  │  ├─ Requests in last 60s: 20/25                  │       │        │
│  │  │  ├─ Tokens in last 60s: 8500/10000              │       │        │
│  │  │  │                                                │       │        │
│  │  │  Decision:                                        │       │        │
│  │  │  ├─ Within limits? → Proceed immediately         │       │        │
│  │  │  └─ Over limits? → Wait X seconds                │       │        │
│  │  └──────────────────────────────────────────────────┘       │        │
│  │                           │                                   │        │
│  │                           ▼                                   │        │
│  │  ┌──────────────────────────────────────────────────┐       │        │
│  │  │ 3b. Make API Request (with @retry_on_failure)   │       │        │
│  │  │                                                   │       │        │
│  │  │  Try 1 ────────────────────────────────────┐    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  ┌────────────────┐                        │    │       │        │
│  │  │  │ Success? ✅    │────────── Return       │    │       │        │
│  │  │  └────────────────┘                        │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  ┌────────────────┐                        │    │       │        │
│  │  │  │ Rate Limit? ⚠️ │                        │    │       │        │
│  │  │  └────┬───────────┘                        │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ├─ Wait 60s (retry 1/2)              │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  Try 2 ────────────────────────────────────┤    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  ┌────────────────┐                        │    │       │        │
│  │  │  │ Success? ✅    │────────── Return       │    │       │        │
│  │  │  └────────────────┘                        │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  ┌────────────────┐                        │    │       │        │
│  │  │  │ Rate Limit? ⚠️ │                        │    │       │        │
│  │  │  └────┬───────────┘                        │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ├─ Wait 120s (retry 2/2)             │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  Try 3 ────────────────────────────────────┤    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  ┌────────────────┐                        │    │       │        │
│  │  │  │ Success? ✅    │────────── Return       │    │       │        │
│  │  │  └────────────────┘                        │    │       │        │
│  │  │      │                                      │    │       │        │
│  │  │      ▼                                      │    │       │        │
│  │  │  ┌────────────────┐                        │    │       │        │
│  │  │  │ Still Failed?  │                        │    │       │        │
│  │  │  └────┬───────────┘                        │    │       │        │
│  │  │       │                                     │    │       │        │
│  │  │       └─ Continue to next provider ────────┘    │       │        │
│  │  └──────────────────────────────────────────────────┘       │        │
│  │                                                               │        │
│  │  If all providers tried and failed:                          │        │
│  │  └─ Raise LLMRateLimitError or LLMProviderError             │        │
│  └───────────────────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Step 4: Return Successful Response                                      │
│                                                                           │
│  LLMResponse:                                                             │
│  ├─ content: "Generated code..."                                         │
│  ├─ model: "llama-3.3-70b-versatile"                                     │
│  ├─ usage: {prompt_tokens, completion_tokens, total_tokens}              │
│  └─ finish_reason: "stop"                                                │
└─────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                         KEY COMPONENTS
═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│ TokenBucketRateLimiter                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Purpose: Prevent hitting rate limits proactively                        │
│                                                                           │
│  Tracks (per provider):                                                  │
│  ├─ Requests in last 60 seconds (sliding window)                         │
│  ├─ Tokens consumed in last 60 seconds                                   │
│  └─ Calculates wait time if limits would be exceeded                     │
│                                                                           │
│  Configuration (Groq):                                                   │
│  ├─ requests_per_minute: 25 (vs 30 actual limit)                        │
│  ├─ tokens_per_minute: 10,000 (vs 12,000 actual limit)                  │
│  └─ buffer_factor: 0.8 (20% safety margin)                              │
│                                                                           │
│  Algorithm:                                                              │
│  1. Check if new request would exceed limits                            │
│  2. If yes: Calculate how long to wait                                  │
│  3. Wait if necessary                                                    │
│  4. Record request in sliding window                                    │
│  5. Allow request to proceed                                            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ @retry_on_failure Decorator                                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Purpose: Automatic retry with exponential backoff                       │
│                                                                           │
│  Retry Strategy:                                                         │
│  ├─ Connection Errors: 3 retries with 1s, 2s, 4s delays                 │
│  ├─ Rate Limit Errors: 2 retries with 60s, 120s delays                  │
│  └─ Other Errors: 3 retries with exponential backoff                    │
│                                                                           │
│  Special Handling for Rate Limits:                                      │
│  ├─ Longer wait times (60s+) to allow rate limit window to reset        │
│  ├─ Separate retry counter for rate limits                              │
│  └─ Detailed logging of retry attempts                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Provider Fallback Chain                                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Purpose: Ensure service continuity when provider fails                  │
│                                                                           │
│  Fallback Priority (for Groq as primary):                               │
│  1. Groq (free, fast)           ← Try first                             │
│  2. Google (free, moderate)     ← First fallback                        │
│  3. OpenAI (paid, reliable)     ← Second fallback                       │
│  4. Anthropic (paid, reliable)  ← Third fallback                        │
│  5. OpenRouter (paid, many)     ← Last fallback                         │
│                                                                           │
│  Logic:                                                                  │
│  ├─ Try provider                                                         │
│  ├─ On failure: Log error, try next in chain                            │
│  ├─ On success: Return result (log if fallback was used)                │
│  └─ All failed: Raise comprehensive error                               │
└─────────────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
                         ERROR FLOW EXAMPLE
═══════════════════════════════════════════════════════════════════════════

User Request: "Generate code for 10 variables concurrently"
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 10 Concurrent Requests to Groq                                           │
└────────┬─────────────────────────────────────────────────────────┬──────┘
         │                                                          │
         ▼                                                          ▼
┌─────────────────────┐                                   ┌─────────────────┐
│ Requests 1-3        │                                   │ Requests 4-10   │
│ ✅ Pass rate limit  │                                   │ ⏳ Throttled    │
│ Proceed immediately │                                   │ Wait 5-15s      │
└─────────┬───────────┘                                   └────────┬────────┘
          │                                                        │
          ▼                                                        ▼
┌─────────────────────┐                                   ┌─────────────────┐
│ API Call Successful │                                   │ Throttle expired│
│ Return results      │                                   │ Make API calls  │
└─────────────────────┘                                   └────────┬────────┘
                                                                   │
                                                                   ▼
                                              ┌─────────────────────────────┐
                                              │ Request 7 hits rate limit   │
                                              │ (despite throttling)        │
                                              └────────┬────────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────────────────┐
                                              │ Retry Logic Kicks In        │
                                              │ ⏳ Wait 60s                 │
                                              │ 🔄 Retry attempt 1/2        │
                                              └────────┬────────────────────┘
                                                       │
                                    ┌──────────────────┴──────────────────┐
                                    │                                     │
                                    ▼                                     ▼
                        ┌────────────────────┐              ┌────────────────────┐
                        │ Success ✅         │              │ Still rate limited │
                        │ Return result      │              │ Try fallback       │
                        └────────────────────┘              └─────────┬──────────┘
                                                                      │
                                                                      ▼
                                                        ┌──────────────────────────┐
                                                        │ Switch to Google         │
                                                        │ 🔄 Fallback provider     │
                                                        └─────────┬────────────────┘
                                                                  │
                                                                  ▼
                                                        ┌──────────────────────────┐
                                                        │ Google: Success ✅       │
                                                        │ Return result            │
                                                        └──────────────────────────┘

RESULT: All 10 requests succeed with minimal delays and no failures! 🎉


═══════════════════════════════════════════════════════════════════════════
                         MONITORING DASHBOARD
═══════════════════════════════════════════════════════════════════════════

Watch these metrics in logs:

┌─────────────────────────────────────────────────────────────────────────┐
│ Normal Operation                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│ ✅ groq generation completed: 421 tokens, finish_reason: stop            │
│ ✅ groq generation completed: 512 tokens, finish_reason: stop            │
│ ✅ groq generation completed: 389 tokens, finish_reason: stop            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Throttling Active (Proactive Protection)                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ ⏳ Rate limit throttling: waiting 3.2s                                   │
│ ⏳ Rate limit throttling: waiting 5.7s                                   │
│ ✅ groq generation completed: 456 tokens, finish_reason: stop            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Rate Limit Hit (Retry in Progress)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ ⏳ Rate limit hit (retry 1/2), waiting 60s before retry: Rate limit...  │
│ ... (60 seconds later) ...                                               │
│ ✅ groq generation completed: 478 tokens, finish_reason: stop            │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ Fallback Triggered (Provider Switch)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│ ⚠️ Rate limit hit for groq: Rate limit exceeded for groq: Error 429     │
│ 🔄 Attempting fallback to provider: google                               │
│ ✅ Fallback successful using google                                      │
│ ✅ google generation completed: 445 tokens, finish_reason: stop          │
└─────────────────────────────────────────────────────────────────────────┘
```
