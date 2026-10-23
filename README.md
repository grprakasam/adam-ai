# ADAM AI

AI-powered code generation and review system for ADAM (Analysis Data Model) specifications following CDISC standards.

## 🎯 Overview

ADAM AI is a comprehensive system that automates the generation of ADAM dataset code for clinical trials. It combines multiple Large Language Models (LLMs) with rule-based validation to produce high-quality, CDISC-compliant code in R and SAS.

## ✨ Features

- 🤖 **Multi-LLM Support**: OpenAI, Anthropic Claude, Google Gemini, Groq, OpenRouter, Ollama, Amazon Bedrock
- 🧠 **Agentic pipeline**: LangGraph generate → validate → execute → evaluate loop with human sign-off
- 📊 **SDTM to ADAM Conversion**: Automated transformation of SDTM datasets
- 📝 **Rule-Based Generation**: Follows CDISC ADAM implementation guidelines
- ✅ **Automated Validation**: Syntax and compliance checking for generated code
- 🔄 **Multi-Language Support**: R and SAS code generation
- 🌐 **RESTful API**: FastAPI backend with comprehensive endpoints
- 🎨 **Modern Frontend**: React + TypeScript with Monaco Editor
- 🔐 **Authentication & Security**: JWT-based auth with rate limiting

## 🧠 Agentic ADaM Pipeline (v2)

A LangGraph agent turns an ADaM spec into an R program, then proves it before a
person signs it off:

```mermaid
flowchart LR
    G[Generate<br/>cheap model first] --> V{Static gates}
    V -->|fail| G
    V --> X{Run in sandbox}
    X -->|R error| G
    X --> E{Compare with<br/>reference}
    E -->|mismatch| G
    E --> H[[Human sign-off<br/>independent reviewer]]
    H --> F([Signed program<br/>+ Dataset-JSON])
```

* **Capped repair loop**: failures (sandbox violations, R errors, mismatched
  variables with example subjects) are fed back to the model, then escalated to a
  stronger model and finally to a person.
* **QC-grade evaluation**: exact match overall and per variable, as in
  double-programming QC.
* **Audit and cost**: hash-chained audit log (prompt, response and code SHA-256,
  model version, reviewer) and tokens/USD/INR per dataset.
* **Platforms**: OpenAI, Anthropic, Gemini, Groq, OpenRouter, Ollama, and now
  **Amazon Bedrock** with prompt caching; optional **Langfuse** tracing.
* **MCP server**: the deterministic checks are available to any MCP client.

**Public benchmark** (`benchmarks/pharmaverse`): pharmaversesdtm v1.5.0 →
ADSL vs pharmaverseadam v1.4.0, 28 variables × 306 subjects, run in CI on every
push. Replay (harness validation): **100% match after 1 repair loop**. Live model
scores: run `--mode live` (see the benchmark README).

Docs: [architecture](docs/architecture/agentic-pipeline.md) ·
[decision records](docs/adr/README.md) · [benchmark](benchmarks/pharmaverse/README.md)

## 📁 Project Structure

```
ADAMAINov25/
├── backend/              # FastAPI backend service
│   ├── app/             # Application code
│   │   ├── api/         # API endpoints
│   │   ├── core/        # Core utilities (auth, validation, etc.)
│   │   ├── models/      # Pydantic models
│   │   ├── modules/     # Business logic modules
│   │   └── main.py      # FastAPI application
│   ├── tests/           # Test suite
│   ├── scripts/         # Utility scripts
│   └── requirements.txt # Python dependencies
├── frontend/            # React + TypeScript frontend
│   ├── src/            # Source code
│   │   ├── components/ # React components
│   │   ├── services/   # API integration
│   │   └── types/      # TypeScript definitions
│   └── package.json    # Node.js dependencies
├── benchmarks/         # Public pharmaverse benchmark (ADSL) and CI quality gate
├── docs/               # Architecture notes and decision records (ADRs)
├── Context/            # Project documentation and specifications
│   ├── ADAMRules/      # CDISC ADAM rules and guidelines
│   └── ProjectArchitecture/ # Architecture documentation
├── Content/            # User inputs and specifications
│   └── UserInputs/     # Excel specifications and SAS code files
└── README.md           # This file
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.13+** (for backend)
- **Node.js 18+** and **npm** (for frontend)
- **API Keys** for at least one LLM provider:
  - OpenAI API key
  - Anthropic API key
  - Google API key

### Backend Setup

1. **Navigate to backend directory**:
   ```powershell
   cd backend
   ```

2. **Create and activate virtual environment**:
   ```powershell
   python -m venv prakenv
   .\prakenv\Scripts\Activate.ps1
   ```

3. **Install dependencies**:
   ```powershell
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   Create a `.env` file in the `backend/` directory:
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
   ```

5. **Run the backend server**:
   ```powershell
   cd backend
   ..\prakenv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at:
   - **API Base**: http://localhost:8000/api/v1
   - **Swagger Docs**: http://localhost:8000/api/docs
   - **ReDoc**: http://localhost:8000/api/redoc

### Frontend Setup

1. **Navigate to frontend directory**:
   ```powershell
   cd frontend
   ```

2. **Install dependencies**:
   ```powershell
   npm install
   ```

3. **Run the development server**:
   ```powershell
   npm run dev
   ```

   The frontend will be available at: http://localhost:5173

## 📚 Documentation

- **Backend Documentation**: See [backend/README.md](backend/README.md)
- **Frontend Documentation**: See [frontend/README.md](frontend/README.md)
- **Project Architecture**: See [Context/ProjectArchitecture/](Context/ProjectArchitecture/)
- **ADAM Rules**: See [Context/ADAMRules/](Context/ADAMRules/)

## 🧪 Testing

### Backend Tests
```powershell
.\prakenv\Scripts\python.exe -m pytest backend\tests\ -v
```

### Frontend Tests
```powershell
cd frontend
npm run lint
```

## 🏗️ Architecture

### Backend Modules

1. **Input Collection**: Handles user input collection (SDTM datasets, specifications)
2. **Rule Loading**: Loads and processes ADAM rules from markdown files
3. **Context Building**: Aggregates context from inputs and rules
4. **Prompt Engineering**: Constructs optimized prompts for LLM
5. **LLM Integration**: Manages interactions with multiple LLM providers
6. **Code Generation**: Orchestrates the complete code generation workflow
7. **Validation**: Validates generated code for syntax and CDISC compliance
8. **Output Management**: Handles export and delivery of generated code

### Frontend Components

- **Setup Tab**: Study metadata and generation options
- **Datasets Tab**: SDTM dataset selection
- **Variables Tab**: Variable selection with search and categories
- **Rules Tab**: CDISC rule display
- **Code Editor**: Monaco Editor with syntax highlighting
- **Validation Results**: Visual validation grid
- **Quality Metrics**: Dashboard-style metrics
- **AI Chat Assistant**: Floating chat panel for guidance

## 🔧 Development

### Code Style

**Backend**:
- Follow PEP 8 guidelines
- Use type hints
- Format with `black`: `.\prakenv\Scripts\python.exe -m black app/`
- Lint with `flake8`: `.\prakenv\Scripts\python.exe -m flake8 app/`

**Frontend**:
- TypeScript with strict mode
- ESLint for linting: `npm run lint`
- Follow React best practices

### Logging

Backend uses `loguru` for logging:
- Console output (colored)
- File logging: `backend/logs/adam_ai.log` (10MB rotation)

## 🔐 Security

- JWT-based authentication
- Rate limiting on API endpoints
- Environment variables for sensitive data
- Input validation with Pydantic

## 📦 Dependencies

### Backend Key Dependencies
- FastAPI (0.104.1) - Web framework
- Uvicorn (0.24.0) - ASGI server
- OpenAI (1.3.5) - GPT integration
- Anthropic (0.7.1) - Claude integration
- Google-generativeai (0.3.1) - Gemini integration
- Pydantic (2.10.5) - Data validation
- Pandas (2.3.3) - Data processing
- Loguru (0.7.2) - Logging

### Frontend Key Dependencies
- React (18.2.0) - UI framework
- TypeScript (5.2.2) - Type safety
- Vite (5.0.8) - Build tool
- Ant Design (5.12.0) - UI components
- Monaco Editor - Code editor
- Axios (1.6.2) - HTTP client

See `backend/requirements.txt` and `frontend/package.json` for complete lists.

## 🐛 Troubleshooting

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
- Verify API keys are set in `backend/.env` file
- Check that `.env` is in the `backend/` directory
- Ensure at least one LLM provider key is configured

## 📝 License

Proprietary

## 👥 Support

For issues and questions, contact the ADAM AI development team.

## 🔗 Links

- **GitHub Repository**: https://github.com/grprakasam/ADAMAINov25
- **API Documentation**: http://localhost:8000/api/docs (when running)

---

**Built with ❤️ for automated CDISC ADAM dataset code generation**

