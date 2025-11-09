# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADAM AI is a full-stack web application that auto-generates ADAM (Analysis Data Model) code for clinical trials following CDISC standards. It combines a React + TypeScript frontend with a Python FastAPI backend powered by multiple LLM providers (OpenAI GPT-4, Anthropic Claude, Google Gemini) to generate compliant R/SAS code.

**Key Domain**: Clinical trial data standardization (CDISC SDTM → ADAM conversion)

## Development Commands

### Frontend (React + TypeScript + Vite)

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Development server (http://localhost:5173)
npm run dev

# Type checking and linting
npm run lint
tsc --noEmit

# Production build
npm run build
npm run preview
```

### Backend (Python FastAPI)

```bash
# Activate virtual environment (PowerShell)
.\prakenv\Scripts\Activate.ps1
# Or use direct python path if execution policy issues
.\prakenv\Scripts\python.exe

# Install dependencies
.\prakenv\Scripts\python.exe -m pip install -r backend\requirements.txt

# Run development server (http://localhost:8000)
cd backend
..\prakenv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# API Documentation
# Swagger UI: http://localhost:8000/api/docs
# ReDoc: http://localhost:8000/api/redoc

# Run tests
.\prakenv\Scripts\python.exe -m pytest backend\tests\ -v

# Code formatting and linting
.\prakenv\Scripts\python.exe -m black backend\app\
.\prakenv\Scripts\python.exe -m flake8 backend\app\
.\prakenv\Scripts\python.exe -m mypy backend\app\
```

### Environment Setup

Backend requires `.env` file in `backend/` directory with:
- At least one LLM provider API key (OpenAI, Anthropic, or Google)
- Default provider configuration
- See `backend/.env.example` for template

## High-Level Architecture

### Full-Stack Structure

```
ADAM_AI/
├── frontend/          # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── components/   # UI components (tabs, panels, forms)
│   │   ├── store/        # Zustand state management
│   │   └── services/     # API integration layer
│   └── package.json
│
├── backend/           # Python FastAPI + multi-LLM
│   ├── app/
│   │   ├── api/v1/      # REST API endpoints
│   │   ├── modules/     # 8-module pipeline
│   │   ├── models/      # Pydantic models
│   │   └── main.py
│   └── requirements.txt
│
├── Content/           # CDISC reference documents
└── Context/ADAMRules/ # Markdown-based ADAM derivation rules
```

### Frontend Architecture

**State Management**: Zustand store (`frontend/src/store/projectStore.ts`)
- Single source of truth for all project configuration
- No props drilling - components access store directly
- LocalStorage persistence via Zustand middleware
- Computed values: `getCompletionPercentage()`, `getTabStatus()`

**UI Pattern**: Tab-based navigation with 5 main tabs
1. **Project Config Tab**: Study metadata and identification
2. **Standards Tab**: CDISC version selection (SDTM, ADaM, MedDRA)
3. **Data Tab**: Dataset selection/upload with DatasetExplorer
4. **Rules Tab**: ADAM derivation rule management
5. **Generate Tab**: Code generation with validation (requires 80% completion)

**Key Components**:
- `LandingPage`: Entry point with project start flow
- `LeftPanel`: 380px fixed-width configuration panel with tabs
- `RightPanel`: Monaco Editor for code display and validation results
- `ChatPanel`: Floating AI assistant
- Custom form components: `FormBlock`, `TextField`, `SelectField`, `MultiSelectField`, `FileUpload`, `DatasetExplorer`

**Vite Proxy**: `/api/*` → `http://localhost:8000/api/*`

### Backend Architecture: 8-Module Pipeline

The backend implements a **sequential 8-module pipeline** for code generation:

1. **Input Collection** (`modules/input_collection/`): Validates user data, datasets, parameters
2. **Rule Loading** (`modules/rule_loading/`): Loads ADAM rules from `Context/ADAMRules/*.md`
3. **Context Building** (`modules/context_building/`): Aggregates inputs + rules + standards
4. **Prompt Engineering** (`modules/prompt_engineering/`): Constructs optimized LLM prompts
5. **LLM Integration** (`modules/llm_integration/`): Multi-provider LLM calls (OpenAI, Anthropic, Google)
6. **Code Generation** (`modules/code_generation/`): Orchestrates LLM and processes responses
7. **Validation** (`modules/validation/`): CDISC compliance and syntax validation
8. **Output Management** (`modules/output_management/`): Code export and artifact delivery

**Multi-LLM Support**:
- Abstract `BaseLLMProvider` class in `modules/llm_integration/service.py`
- Concrete implementations: `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`
- Default provider configurable via `DEFAULT_LLM_PROVIDER` env variable
- All operations are async (`async/await`)

**Configuration**: Pydantic-based type-safe config in `app/config.py`
- Environment variables from `.env`
- Sensible defaults (Gemini 2.5 Flash)
- CORS configured for frontend dev servers (localhost:3000, localhost:5173)

**Logging**: Loguru with rotation to `backend/logs/adam_ai.log` (10MB max)

## Key Interaction Flow

1. User fills configuration in `LeftPanel` tabs → Zustand store tracks progress
2. Generate button clicked (validates 80% completion threshold)
3. Frontend sends request to `POST /api/v1/generate/adam`
4. Backend pipeline executes sequentially:
   - Validates input → Loads ADAM rules → Builds context
   - Constructs prompt → Calls LLM provider → Generates code
   - Validates output → Returns results
5. `RightPanel` displays generated code in Monaco Editor with validation results

## Important Patterns & Conventions

### Frontend Patterns
- **State-Driven UI**: All state in Zustand, components subscribe directly
- **Tab Status Computation**: Derived from store state, not hardcoded
- **Old File Backups**: During refactoring, old implementations saved as `*_old.tsx`
- **Design System**: Custom CSS in `src/styles/` with design tokens (`design-tokens.css`, `utilities.css`, `components.css`)

### Backend Patterns
- **Async-First**: Full async/await throughout for non-blocking operations
- **Modular Pipeline**: Clear separation of concerns across 8 modules
- **Markdown-Based Rules**: Domain knowledge in `Context/ADAMRules/*.md` files, not hardcoded
- **Provider Abstraction**: Extensible LLM support via base class pattern
- **Type Safety**: Pydantic models for all request/response data

### API Design
- RESTful with `/api/v1/` namespace
- Comprehensive docs via FastAPI's auto-generated Swagger/ReDoc
- Endpoints: `/health`, `/api/v1/status`, `/api/v1/llm/providers`, `/api/v1/llm/defaults`
- Future: `/api/v1/generate/adam`, `/api/v1/validate/code`

## Domain-Specific Notes

### CDISC Standards
- **SDTM** (Study Data Tabulation Model): Input datasets
- **ADAM** (Analysis Data Model): Output datasets (ADSL, ADAE, ADLB, etc.)
- Rules stored as markdown in `Context/ADAMRules/` with specific logic per dataset type
- Specification documents in `Content/StandardDocuments/`

### ADAM Rule Application
- When generating ADSL, load `Context/ADAMRules/ADSL_*.md` files
- Rules define:
  - Variable derivation logic
  - IG-specific requirements (e.g., `ADSL_IGSpecificRules.md`)
  - Macro logic patterns (e.g., `ADSL_MacroLogic.md`)
  - Application behavior rules (e.g., `ADSL_ApplicationBehaviourRules.md`)

### Code Generation Output
- Supports R and SAS programming languages
- Configurable comment levels (none, minimal, verbose)
- Code style options (base R, tidyverse, etc.)
- Optimization flags for performance

## Testing

### Frontend
- ESLint configured with React hooks plugin
- TypeScript strict mode enabled
- No test framework currently installed (consider Vitest + Testing Library)

### Backend
- pytest with async support (`pytest-asyncio`)
- Test files in `backend/tests/`
- Run with: `.\prakenv\Scripts\python.exe -m pytest backend\tests\ -v`
- Example test: `tests/test_llm_defaults.py`

## Git Workflow

Current branch: `techsetup`
Main branch: `main`

**Phased Implementation**: 15 planned phases, 10 completed
- See `PHASES_5-10_COMPLETE.md` for progress
- Old planning docs in `Context/` directory

## Adding New Features

### New LLM Provider
1. Extend `BaseLLMProvider` in `backend/app/modules/llm_integration/service.py`
2. Implement `async def generate()` method
3. Add API key to `.env` and `config.py`
4. Register in provider factory

### New ADAM Dataset Support
1. Add markdown rules to `Context/ADAMRules/[DATASET]_*.md`
2. Update rule loading logic in `modules/rule_loading/service.py`
3. Add dataset type to frontend `StandardsTab` options
4. Update validation rules in `modules/validation/`

### New Frontend Tab
1. Create component in `frontend/src/components/tabs/`
2. Add to `LeftPanel.tsx` tab list
3. Update Zustand store in `store/projectStore.ts` with new state
4. Implement tab status computation in `getTabStatus()`

## Common Issues

### PowerShell Execution Policy
If virtual environment activation fails, use direct python path:
```powershell
.\prakenv\Scripts\python.exe
```

### CORS Errors
Ensure backend `app/config.py` includes frontend origin in `ALLOWED_ORIGINS`:
```python
ALLOWED_ORIGINS = ["http://localhost:5173", "http://localhost:3000"]
```

### Module Import Errors
Backend uses package-relative imports. Always run from `backend/` directory:
```bash
cd backend
..\prakenv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## Project Goals & Success Criteria

**Goal**: Domain-friendly AI pair programming tool for ADAM code generation

**Success Criteria**:
- Generated code follows CDISC industry standards
- Programs work correctly when run in SAS/R with proper SDTM inputs
- Tool feels domain-specific, not generic AI
- User experience is intuitive for both expert and novice ADAM programmers

**Design Principles**:
- Simple yet efficient
- Logical flow of controls
- Scalable and deployment-friendly
- Test for robustness
- Never break existing features when adding new ones
