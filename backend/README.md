# ADAM AI Code Generator - Backend

AI-powered ADAM (Analysis Data Model) code generator for clinical trials following CDISC standards.

## Features

- 🤖 Multi-LLM Support: OpenAI GPT-4, Anthropic Claude 3.5, Google Gemini
- 📊 SDTM to ADAM conversion
- 📝 Rule-based code generation following CDISC standards
- ✅ Automated code validation
- 🔄 R and SAS support
- 🌐 RESTful API with FastAPI

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/                 # API endpoints
│   ├── core/                   # Core utilities
│   ├── models/                 # Pydantic models
│   ├── modules/
│   │   ├── input_collection/   # Module 1: Input handling
│   │   ├── rule_loading/       # Module 2: Rule processing
│   │   ├── context_building/   # Module 3: Context aggregation
│   │   ├── prompt_engineering/ # Module 4: Prompt construction
│   │   ├── llm_integration/    # Module 5: LLM providers
│   │   ├── code_generation/    # Module 6: Code generation
│   │   ├── validation/         # Module 7: Code validation
│   │   └── output_management/  # Module 8: Output handling
│   ├── constants/              # Constants and enums
│   ├── utils/                  # Utility functions
│   ├── config.py               # Configuration management
│   └── main.py                 # FastAPI application
├── tests/                      # Test suite
├── scripts/                    # Utility scripts
├── requirements.txt            # Python dependencies
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## Setup Instructions

### Prerequisites

- Python 3.13+ installed
- Virtual environment created (`prakenv`)
- API keys for at least one LLM provider:
  - OpenAI API key
  - Anthropic API key
  - Google API key

### Installation

1. **Activate virtual environment** (PowerShell):
   ```powershell
   .\prakenv\Scripts\Activate.ps1
   ```
   
   If you encounter execution policy errors, use the direct python path instead:
   ```powershell
   .\prakenv\Scripts\python.exe
   ```

2. **Install dependencies**:
   ```powershell
   .\prakenv\Scripts\python.exe -m pip install --upgrade pip
   .\prakenv\Scripts\python.exe -m pip install -r backend\requirements.txt
   ```

3. **Configure environment variables**:
   ```powershell
   cd backend
   copy .env.example .env
   # Edit .env file and add your API keys
   ```

4. **Create logs directory**:
   ```powershell
   mkdir backend\logs
   ```

### Configuration

Edit `backend/.env` with your settings:

```env
# LLM API Keys (at least one required)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here

# Default LLM Configuration
DEFAULT_LLM_PROVIDER=google
DEFAULT_MODEL=gemini-2.5-flash
DEFAULT_TEMPERATURE=0.2
DEFAULT_MAX_TOKENS=4000

# Server Configuration
HOST=0.0.0.0
PORT=8000
DEBUG=False

# Security
SECRET_KEY=generate_a_random_64_char_value
```

### Running the Application

From the project root directory:

```powershell
# Using the virtual environment
cd backend
..\prakenv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API Base: http://localhost:8000/api/v1
- Swagger Docs: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### Running Tests

```powershell
.\prakenv\Scripts\python.exe -m pytest backend\tests\ -v
```

## API Endpoints

### Health Check
- `GET /health` - Application health status
- `GET /api/v1/status` - API version status

### Code Generation (Coming Soon)
- `POST /api/v1/generate/adam` - Generate ADAM code
- `POST /api/v1/validate/code` - Validate generated code
- `GET /api/v1/llm/providers` - List available LLM providers
 - `GET /api/v1/llm/providers` - List available LLM providers
 - `GET /api/v1/llm/defaults` - Get current default provider and model (and available providers info)

## Module Architecture

### 1. Input Collection Module
Handles user input collection including SDTM datasets, specifications, and parameters.

### 2. Rule Loading Module
Loads and processes ADAM rules from markdown files in `Context/ADAMRules/`.

### 3. Context Building Module
Aggregates and structures context from inputs and rules for LLM prompts.

### 4. Prompt Engineering Module
Constructs optimized prompts for LLM code generation.

### 5. LLM Integration Module
Manages interactions with OpenAI, Anthropic, and Google LLM providers.

### 6. Code Generation Module
Orchestrates the complete code generation workflow.

### 7. Validation Module
Validates generated R code for syntax, CDISC compliance, and quality.

### 8. Output Management Module
Handles export and delivery of generated code and artifacts.

## Development

### Code Style
- Follow PEP 8 guidelines
- Use type hints
- Run `black` for formatting: `.\prakenv\Scripts\python.exe -m black app/`
- Run `flake8` for linting: `.\prakenv\Scripts\python.exe -m flake8 app/`

### Logging
Application uses `loguru` for logging. Logs are written to:
- Console (stderr) with colored output
- `logs/adam_ai.log` with 10MB rotation

### Adding New LLM Providers
Extend the `BaseLLMProvider` class in `app/modules/llm_integration/service.py`:
```python
class NewProvider(BaseLLMProvider):
    async def generate(self, prompt, temperature, max_tokens, **kwargs):
        # Implementation
        pass
```

## Dependencies

Key dependencies:
- **FastAPI** (0.104.1) - Web framework
- **Uvicorn** (0.24.0) - ASGI server
- **OpenAI** (1.3.5) - OpenAI GPT integration
- **Anthropic** (0.7.1) - Claude integration
- **Google-generativeai** (0.3.1) - Gemini integration
- **Pydantic** (2.5.0) - Data validation
- **Pandas** (2.1.3) - Data processing
- **Loguru** (0.7.2) - Logging

See `requirements.txt` for complete list.

## Troubleshooting

### PowerShell Execution Policy
If you cannot activate the virtual environment:
```powershell
# Option 1: Use direct python path
.\prakenv\Scripts\python.exe

# Option 2: Change execution policy (requires admin)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Import Errors
Make sure you're using the virtual environment python:
```powershell
.\prakenv\Scripts\python.exe -c "import sys; print(sys.executable)"
```

### API Key Issues
- Verify API keys are set in `.env` file
- Check that `.env` is in the `backend/` directory
- Ensure at least one LLM provider key is configured

## License

Proprietary - Ephicacy Lifesciences Analytics

## Support

For issues and questions, contact the ADAM AI development team.
