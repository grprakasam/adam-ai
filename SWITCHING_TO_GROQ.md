# Switching to Groq (Free LLM Provider)

## 🎉 What Changed?

Your ADAM_AI project now uses **Groq** as the default LLM provider instead of Google Gemini. Groq offers a generous free tier with no rate limit issues!

## 🆓 Why Groq?

- **Free Tier**: 30 requests/minute, 14,400 requests/day (no credit card required)
- **Fast**: Ultra-fast inference with excellent performance
- **No Rate Limits**: Unlike Gemini's restrictive free tier
- **Quality Models**: Llama 3.3 70B, Mixtral 8x7B, Gemma 2 9B

## 📝 How to Get Your Groq API Key

### Step 1: Sign Up
1. Go to [https://console.groq.com/](https://console.groq.com/)
2. Click "Sign Up" or "Get Started"
3. Create an account (GitHub/Google login available)

### Step 2: Create API Key
1. Once logged in, navigate to "API Keys" section
2. Click "Create API Key"
3. Give it a name (e.g., "ADAM_AI")
4. Copy the API key (starts with `gsk_...`)

### Step 3: Add to Your .env File
1. Open `backend/.env` in your editor
2. Find the line `GROQ_API_KEY=`
3. Paste your API key: `GROQ_API_KEY=gsk_your_actual_key_here`
4. Save the file

## 🚀 Quick Start

### 1. Install Dependencies (Already Done)
```powershell
cd backend
..\prakenv\Scripts\Activate.ps1
pip install groq
```

### 2. Configure .env
```properties
# In backend/.env
GROQ_API_KEY=gsk_your_actual_key_here
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.3-70b-versatile
```

### 3. Test the Integration
```powershell
cd backend
..\prakenv\Scripts\Activate.ps1
python scripts/test_groq.py
```

You should see:
```
✅ ALL TESTS PASSED - Groq integration is working!
```

### 4. Restart Backend Server
Stop the current backend server (Ctrl+C) and restart:
```powershell
cd backend
..\prakenv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## 🎯 Available Models

You can choose from several free models by updating `DEFAULT_MODEL` in `.env`:

### Recommended Models:

1. **llama-3.3-70b-versatile** (Default)
   - Best quality, most capable
   - Speed: ~280 tokens/sec
   - Context: 128k tokens

2. **llama-3.1-8b-instant**
   - Fastest, good for simple tasks
   - Speed: ~1200 tokens/sec
   - Context: 128k tokens

3. **mixtral-8x7b-32768**
   - Balanced speed and quality
   - Speed: ~600 tokens/sec
   - Context: 32k tokens

4. **gemma2-9b-it**
   - Google's Gemma, instruction-tuned
   - Speed: ~800 tokens/sec
   - Context: 8k tokens

## 📊 Rate Limits

Groq Free Tier:
- **30 requests per minute**
- **14,400 requests per day**
- **No credit card required**

For comparison, Google Gemini free tier had:
- 60 requests per minute (but quota issues)
- Frequent 429 errors

## 🔧 Troubleshooting

### Test Script Shows No API Key
```
❌ ERROR: Groq provider not initialized!
```
**Solution**: Make sure `GROQ_API_KEY` is set in `backend/.env`

### Import Error: No module named 'groq'
```
ModuleNotFoundError: No module named 'groq'
```
**Solution**: Install the package:
```powershell
pip install groq
```

### Connection Failed
```
❌ Connection failed!
```
**Solution**: 
1. Check your API key is correct
2. Verify internet connection
3. Check Groq status at https://status.groq.com/

### Backend Server Not Using Groq
**Solution**: Make sure these are set in `backend/.env`:
```properties
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.3-70b-versatile
```

Then restart the backend server.

## 🔄 Switching Between Providers

You can easily switch between providers by changing `.env`:

### Use Groq (Free)
```properties
DEFAULT_LLM_PROVIDER=groq
DEFAULT_MODEL=llama-3.3-70b-versatile
```

### Use Google Gemini
```properties
DEFAULT_LLM_PROVIDER=google
DEFAULT_MODEL=gemini-2.0-flash-exp
GOOGLE_API_KEY=your_key_here
```

### Use OpenAI (Paid)
```properties
DEFAULT_LLM_PROVIDER=openai
DEFAULT_MODEL=gpt-4
OPENAI_API_KEY=your_key_here
```

### Use Anthropic (Paid)
```properties
DEFAULT_LLM_PROVIDER=anthropic
DEFAULT_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=your_key_here
```

## ✅ Verification Checklist

- [ ] Signed up for Groq account
- [ ] Created API key
- [ ] Added API key to `backend/.env`
- [ ] Set `DEFAULT_LLM_PROVIDER=groq`
- [ ] Installed groq package (`pip install groq`)
- [ ] Ran test script successfully
- [ ] Restarted backend server
- [ ] Tested "Get AI Inputs" button in frontend

## 📚 Additional Resources

- **Groq Console**: https://console.groq.com/
- **Groq Documentation**: https://console.groq.com/docs
- **API Reference**: https://console.groq.com/docs/api-reference
- **Model Comparison**: https://console.groq.com/docs/models

## 🎊 Benefits Summary

✅ **No more quota exceeded errors**
✅ **Faster code generation** (up to 4x faster than Gemini)
✅ **Higher rate limits** (14,400 requests/day)
✅ **No credit card required**
✅ **Better reliability**
✅ **Same quality output** (Llama 3.3 70B is excellent)

---

**Need Help?** If you encounter any issues, run the test script first:
```powershell
python scripts/test_groq.py
```

This will diagnose configuration problems and verify your setup.
