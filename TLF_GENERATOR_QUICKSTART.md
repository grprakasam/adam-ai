# TLF Generator - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites
- Backend server running on `localhost:8000`
- Frontend server running on `localhost:3000`
- LLM API key configured (Groq, OpenAI, Anthropic, or Google)

---

## For Users

### Step 1: Access the TLF Generator

1. **From Landing Page:**
   - Click the **"TLF Generator"** card in the "All Tools" section
   - Look for the FileText icon with "Live" status badge

2. **From Workspace:**
   - Navigate to the Utilities section
   - Select **"TLF Generator"** tab

### Step 2: Select Output Type

Choose from three options:

| Type | Use Case | Examples |
|------|----------|----------|
| **Table** | Statistical summaries | Demographics, AE Summary, Lab Values |
| **Listing** | Subject-level details | Disposition, AE Listings, Medications |
| **Figure** | Visual plots | Kaplan-Meier, Time Series, Lab Trends |

**Action:** Click on your desired output type card

### Step 3: Provide Details & Upload

Fill out the form:

```
Study ID:        STUDY-001           [Required]
Dataset Name:    ADSL                [Optional]
Output Name:     T_14_1_01           [Optional]
Description:     Demographics Table   [Optional]
```

**Upload your mockshell:**
- Supported formats: PDF, Word (docx), Excel (xlsx), PNG, JPG
- Max size: 10MB
- Click **"Upload"** button

**Add context (optional):**
```
Example: "Include footnotes for missing data. 
Use 1 decimal place for continuous variables."
```

**Action:** Click **"Analyze Document"** (AI processing: 2-10 seconds)

### Step 4: Review AI Understanding

Review the extracted specifications:

- **Confidence Score**: How confident AI is (aim for >70%)
- **Structure**: Columns, rows, sections identified
- **Formatting**: Decimal places, alignment, etc.
- **Requirements**: Statistical elements needed

**If satisfied:**
- Click **"Approve & Generate"**

**If not satisfied:**
- Click **"Re-upload Document"** to try again with clearer mockshell
- Or manually modify the understanding (future feature)

### Step 5: Download Your TLF

Your generated TLF is ready!

**Actions available:**
- **Download**: Save as HTML/PDF/RTF
- **Edit**: Make manual adjustments
- **Create Another**: Start a new TLF

---

## For Developers

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment (if not exists)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GROQ_API_KEY="your_api_key_here"
export DEFAULT_LLM_PROVIDER="groq"

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Verify backend:**
```bash
curl http://localhost:8000/api/v1/tlf-generator/examples
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies (if not done)
npm install

# Start development server
npm run dev
```

**Verify frontend:**
- Open browser: `http://localhost:3000`
- Login and navigate to TLF Generator

### API Testing

**Test Analysis Endpoint:**

```bash
curl -X POST "http://localhost:8000/api/v1/tlf-generator/analyze" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test_mockshell.pdf" \
  -F "tlf_type=table" \
  -F "study_id=TEST-001" \
  -F "dataset_name=ADSL"
```

**Expected Response:**
```json
{
  "session_id": "abc-123-def-456",
  "tlf_type": "table",
  "understanding": {
    "structure": {...},
    "formatting": {...}
  },
  "confidence_score": 0.85
}
```

---

## Common Use Cases

### Use Case 1: Demographics Table

**Input:**
- Type: Table
- Mockshell: Excel with demographic columns
- Context: "Standard demographics table with N, mean, SD"

**Output:**
- HTML table with proper formatting
- Statistics by treatment group
- Footnotes for missing data

### Use Case 2: Adverse Events Listing

**Input:**
- Type: Listing
- Mockshell: PDF showing AE columns layout
- Context: "Sort by subject ID, then by start date"

**Output:**
- Line-by-line AE listing
- Proper column alignment
- Page breaks at subject level

### Use Case 3: Kaplan-Meier Curve

**Input:**
- Type: Figure
- Mockshell: Image showing desired plot layout
- Context: "Include 95% CI, risk table below"

**Output:**
- Professional survival curve
- Confidence intervals
- At-risk numbers table

---

## Tips for Best Results

### For Better AI Understanding

1. **Clear Mockshells:**
   - Use well-formatted documents
   - Include all headers and labels
   - Show example data if possible

2. **Provide Context:**
   - Specify decimal places
   - Mention special formatting needs
   - Note any footnotes required

3. **Iterate if Needed:**
   - If confidence score is low, re-upload
   - Add more detailed context
   - Use more standard mockshell format

### For Developers

1. **Error Handling:**
   - Check API responses for errors
   - Handle timeout scenarios
   - Implement retry logic for transient failures

2. **Performance:**
   - Use appropriate LLM provider (Groq is fastest)
   - Cache common mockshell patterns
   - Implement session cleanup

3. **Security:**
   - Validate file types and sizes
   - Sanitize user inputs
   - Use HTTPS in production

---

## Troubleshooting

### Issue: "Analysis Failed"

**Causes:**
- LLM API key not configured
- File format not supported
- File too large

**Solutions:**
```bash
# Check LLM configuration
echo $GROQ_API_KEY

# Check file format
file mockshell.pdf

# Check file size
ls -lh mockshell.pdf
```

### Issue: "Low Confidence Score"

**Causes:**
- Mockshell is unclear or complex
- Unusual formatting
- Missing information

**Solutions:**
- Re-create mockshell with clearer structure
- Add more context in "Additional Context" field
- Try a simpler mockshell first

### Issue: "Session Not Found"

**Causes:**
- Session expired (in-memory storage)
- Server restarted
- Invalid session ID

**Solutions:**
- Start a new analysis
- Implement persistent session storage (Redis/DB)

---

## Environment Variables

### Required

```env
# LLM Provider Configuration
DEFAULT_LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key_here
```

### Optional

```env
# Alternative LLM Providers
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# Configuration
TLF_MAX_FILE_SIZE=10485760  # 10MB in bytes
TLF_SESSION_TIMEOUT=3600    # 1 hour in seconds
```

---

## API Quick Reference

### Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| POST | `/api/v1/tlf-generator/analyze` | Analyze mockshell | Yes* |
| POST | `/api/v1/tlf-generator/approve` | Approve understanding | Yes* |
| POST | `/api/v1/tlf-generator/generate` | Generate TLF | Yes* |
| GET | `/api/v1/tlf-generator/session/{id}` | Get session | Yes* |
| DELETE | `/api/v1/tlf-generator/session/{id}` | Delete session | Yes* |
| GET | `/api/v1/tlf-generator/examples` | Get examples | No |

*Auth: To be implemented in production

### Request Examples

**Analyze:**
```bash
curl -X POST /api/v1/tlf-generator/analyze \
  -F "file=@mockshell.pdf" \
  -F "tlf_type=table" \
  -F "study_id=STUDY-001"
```

**Approve:**
```bash
curl -X POST /api/v1/tlf-generator/approve \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc-123", "approved": true}'
```

**Generate:**
```bash
curl -X POST /api/v1/tlf-generator/generate \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc-123", "format": "html"}'
```

---

## Support

### Documentation
- **Implementation Guide**: `TLF_GENERATOR_IMPLEMENTATION.md`
- **Architecture**: `TLF_GENERATOR_ARCHITECTURE.md`
- **Summary**: `TLF_GENERATOR_SUMMARY.md`

### Logs
- **Backend**: Check console output or log files
- **Frontend**: Check browser console (F12)

### Contact
- Technical Issues: Create GitHub issue
- Feature Requests: Product team
- Questions: Development team

---

## Next Steps

1. **Try the Feature:**
   - Upload a test mockshell
   - Review AI understanding
   - Generate your first TLF

2. **Explore Advanced Features:**
   - Different output formats (HTML, PDF, RTF)
   - Citation management
   - Batch processing (coming soon)

3. **Provide Feedback:**
   - Report bugs or issues
   - Suggest improvements
   - Share success stories

---

**🎉 You're ready to start creating TLFs with AI!**

*For questions or support, refer to the comprehensive documentation or contact the development team.*


