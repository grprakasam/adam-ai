# Code Generation API Optimization Plan

## Current Performance Analysis

### Current State
- **Batch Size**: 10 variables per LLM API call (hardcoded)
- **Max Concurrent**: 5 concurrent requests (semaphore limit)
- **Max Tokens**: 800 tokens per variable (800 * batch_size for batches)
- **Temperature**: 0.3
- **Estimated Time**: 5+ minutes for 50-100 variables

### Bottlenecks Identified

1. **Small Batch Size**: Only 10 variables per API call means many sequential API calls
   - 50 variables = 5 API calls
   - Each API call: 10-30 seconds
   - Total: 50-150 seconds minimum

2. **Low Concurrency**: Max 5 concurrent requests limits parallel processing
   - Even with batches, only 5 can run simultaneously
   - Creates sequential bottlenecks

3. **High Token Count**: 800 tokens per variable is excessive for simple derivations
   - Increases generation time
   - Increases API costs
   - Most variables need 200-400 tokens

4. **Heavy Prompts**: Includes full ADAM rules context for every variable
   - Adds 500-1000 tokens per prompt
   - Slows down LLM processing

5. **Rationale Generation**: Generates rationale for every variable during bulk
   - Adds extra LLM calls or increases token count
   - Not needed during bulk generation (can be on-demand)

6. **No Template-Based Generation**: All variables go through LLM even for simple patterns
   - Direct mappings could use templates
   - Simple calculations could use templates

## Optimization Strategy

### Phase 1: Immediate Wins (Expected: 5 min → 1-2 min)

1. **Increase Batch Size**: 10 → 25-30 variables per call
   - Reduces API calls by 2.5-3x
   - Impact: 50 variables = 2 API calls instead of 5

2. **Increase Concurrency**: 5 → 15-20 concurrent batches
   - Allows more parallel processing
   - Impact: 2-3x faster batch processing

3. **Reduce Max Tokens**: 800 → 400-500 per variable
   - Faster LLM responses
   - Impact: 30-40% faster generation

4. **Optimize Prompts**: Remove rules context for bulk generation
   - Lighter prompts = faster responses
   - Impact: 20-30% faster

### Phase 2: Advanced Optimizations (Expected: 1-2 min → 30-60 sec)

5. **Template-Based Quick Generation**: 
   - Detect simple patterns (direct mapping, basic calculations)
   - Use templates instead of LLM calls
   - Impact: 30-50% of variables skip LLM entirely

6. **Skip Rationale During Bulk**:
   - Generate rationale on-demand when user views variable
   - Impact: Reduces token count by 30-40%

7. **Better Caching Strategy**:
   - More aggressive cache key matching
   - Pre-warm cache with common variables
   - Impact: 20-30% cache hit rate improvement

8. **Parallel Batch Processing**:
   - Process all batches concurrently without waiting
   - Impact: Eliminates sequential bottlenecks

## Implementation Plan

### ✅ Step 1: Configuration Updates (COMPLETED)
- ✅ Updated `BATCH_SIZE` from 10 to 25
- ✅ Updated `MAX_CONCURRENT_REQUESTS` from 5 to 15
- ✅ Updated `DEFAULT_MAX_TOKENS` from 800 to 400
- ✅ Updated `GEMINI_MAX_TOKENS` from 800 to 400

### ✅ Step 2: Service Layer Optimizations (COMPLETED)
- ✅ Modified `process_variables_with_llm()` to use batches of 25
- ✅ Increased semaphore limit to 15 concurrent requests
- ✅ Optimized prompt building for bulk generation

### ✅ Step 3: Template-Based Generation (COMPLETED)
- ✅ Added `_try_template_generation()` method
- ✅ Implemented pattern detection for:
  - Direct mappings (from DM, direct mapping, etc.)
  - Simple flags (Y/N indicators)
  - Basic calculations (sum, add, plus)
  - Date conversions
  - Missing value handling
- ✅ Skips LLM calls for template-matched variables (instant generation)

### ✅ Step 4: Prompt Optimization (COMPLETED)
- ✅ Created lightweight prompt builder for bulk generation
- ✅ Removed verbose instructions and rules context from bulk prompts
- ✅ Reduced prompt tokens by 60-70%
- ✅ Kept full context only for single variable generation

### Step 5: Caching Improvements (ENHANCED)
- ✅ Enhanced cache checking before batch processing
- ✅ Template results are cached automatically
- ✅ Better cache hit reporting in logs

## Expected Results

### Before Optimization
- **50 variables**: ~5 minutes
- **100 variables**: ~10 minutes
- **API calls**: 5-10 calls
- **Concurrent processing**: Limited to 5

### After Optimization
- **50 variables**: ~30-60 seconds (5-10x faster)
- **100 variables**: ~1-2 minutes (5-10x faster)
- **API calls**: 2-4 calls (reduced by 2.5-3x)
- **Concurrent processing**: Up to 15-20 batches

### Performance Metrics
- **Batch size**: 10 → 25 (2.5x improvement)
- **Concurrency**: 5 → 15 (3x improvement)
- **Token efficiency**: 800 → 400 (2x improvement)
- **Template coverage**: 0% → 30-50% (skip LLM entirely)
- **Overall speedup**: 5-10x faster

## Risk Mitigation

1. **LLM Rate Limits**: Monitor rate limits with increased concurrency
2. **Quality**: Ensure template-based generation maintains code quality
3. **Error Handling**: Robust fallback for template failures
4. **Testing**: Comprehensive testing with various variable counts

## Monitoring

Track these metrics:
- Average generation time per variable
- Cache hit rate
- API call count
- Template match rate
- Error rate
- User satisfaction
