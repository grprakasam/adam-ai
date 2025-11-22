# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ADAM AI is an AI-powered code generation system for creating CDISC-compliant ADAM (Analysis Data Model) datasets for clinical trials. The system uses multiple LLM providers (OpenAI GPT-4, Anthropic Claude, Google Gemini, Groq) to generate R and SAS code with automated validation and traceability.

## Development Commands

### Backend (Python 3.13+ with FastAPI)

**Virtual Environment**: The project uses `prakenv` for Python dependencies.

```powershell
# Activate virtual environment (PowerShell)
.\prakenv\Scripts\Activate.ps1

# Or use direct python path (if activation fails)
.\prakenv\Scripts\python.exe
```

**Running the Backend**:
```powershell
cd backend
..\prakenv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Testing**:
```powershell
# Run all tests
.\prakenv\Scripts\python.exe -m pytest backend\tests\ -v

# Run specific test file
.\prakenv\Scripts\python.exe -m pytest backend\tests\test_variable_categorizer.py -v
```

**Code Quality**:
```powershell
# Format code with black
.\prakenv\Scripts\python.exe -m black app/

# Lint with flake8
.\prakenv\Scripts\python.exe -m flake8 app/
```

### Frontend (React + TypeScript with Vite)

```powershell
cd frontend

# Install dependencies
npm install

# Run development server (port 5173)
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## Architecture Overview

### Backend Module Structure

The backend follows a modular architecture organized by domain responsibility:

1. **program_generation/** - Core code generation orchestrator
   - `consolidated_service.py`: Main service coordinating code generation workflow
   - `assembler.py`: Assembles code snippets by category
   - `optimizer.py`: Optimizes generated code
   - `comment_engine.py`: Adds structured comments
   - `validators.py`: Validates code safety and correctness
   - `progress_tracker.py`: Tracks generation progress

2. **llm_integration/** - Multi-provider LLM abstraction layer
   - Unified interface for OpenAI, Anthropic, Google Gemini, and Groq
   - Handles rate limiting, retries, and fallback logic

3. **variable_categorizer/** - Variable analysis and categorization
   - Parses Excel specifications to extract variable metadata
   - Categorizes variables (analysis flags, dates, demographics, etc.)
   - Maps CDISC ADaM variable types

4. **traceability/** - End-to-end traceability system
   - `service.py`: Main orchestrator
   - `code_inspector.py`: AST-based code analysis
   - `spec_parser.py`: Specification parsing
   - `rule_linker.py`: Links variables to CDISC rules
   - `graph_builder.py`: Builds dependency graphs
   - `ai_analyzer.py`: LLM-powered logic extraction

5. **validation/** - Code validation
   - `adam_rules_validator.py`: CDISC compliance checking
   - Syntax validation for R and SAS

6. **submission/** - Regulatory submission support
   - `generation/define_xml.py`: Define.xml generation
   - `generation/adrg.py`: Analysis Data Reviewer's Guide
   - `packaging/ectd_builder.py`: eCTD package creation

7. **test_data_generation/** - SDTM test data generation
   - `sdtm_generator.py`: Generates realistic test datasets

8. **testing/test_execution/** - Code execution engine
   - `r_executor.py`: R code execution with isolation
   - `service.py`: Test orchestration

### Frontend Component Organization

**Main Application Flow**:
- `App.tsx`: Root component with routing
- `LandingPage.tsx`: Entry point and study selection
- `WorkspaceNavigation.tsx`: Main navigation
- `LeftPanel.tsx` / `RightPanel.tsx`: Panel-based layout

**Key Feature Components**:
- `VariablesAnalysisTab.tsx`: Variable selection and approval workflow
- `PairProgrammingArea.tsx`: AI-assisted code modification
- `ConsolidatedCodeTab.tsx`: Final code generation and display
- `TraceabilityTab.tsx`: Traceability matrix visualization
- `LineageGraph.tsx`: Variable lineage visualization using React Flow
- `TestingTab.tsx`: Code testing interface

**Supporting Components**:
- `ChatPanel.tsx`: AI chat assistant
- `CodeGenerationProgressModal.tsx`: Real-time generation progress
- `ValidationResults`: Code validation display

### API Structure

All API endpoints are under `/api/v1` prefix:

- `/specification/*` - Specification upload and parsing
- `/code-generation/*` - Variable-level code generation
- `/program-generation/*` - Consolidated program generation
- `/llm/*` - LLM configuration
- `/llm-models/*` - Available models management
- `/rules/*` - CDISC rule loading
- `/standards/*` - CDISC standards loading
- `/traceability/*` - Traceability generation
- `/test-data/*` - Test data generation
- `/code-execution/*` - Code execution
- `/testing/*` - Test orchestration
- `/validation/*` - Code validation
- `/submission/*` - Submission document generation

### Key Data Flows

**Code Generation Workflow**:
1. User uploads specification Excel → `/specification/upload`
2. Variables categorized → `variable_categorizer` module
3. User selects variables → Frontend state management
4. Individual code snippets generated → `/code-generation/generate` (uses LLM)
5. User approves/modifies code → `PairProgrammingArea`
6. Consolidated code generated → `/program-generation/consolidated`
7. Validation → `validation` module
8. Traceability matrix → `/traceability/generate`

**LLM Request Flow**:
1. Request enters via API endpoint
2. Routed to `llm_integration` module
3. Provider selected based on config (defaults: Gemini Flash for speed, GPT-4 for quality)
4. Prompt engineering in `prompt_engineering` module
5. Response validated and parsed
6. Cached in `cache_manager` for reuse

### Environment Configuration

Backend requires `.env` file in `backend/` directory:

```env
# At least one LLM API key required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
GROQ_API_KEY=...

# Default LLM (options: openai, anthropic, google, groq)
DEFAULT_LLM_PROVIDER=google
DEFAULT_MODEL=gemini-2.5-flash
DEFAULT_TEMPERATURE=0.2
DEFAULT_MAX_TOKENS=4000
```

### CDISC Compliance Requirements

When working with ADAM-related code:

1. **Required Variables**: All ADAM datasets must include STUDYID, USUBJID, and appropriate analysis variables
2. **Variable Naming**: Follow CDISC ADaM IG naming conventions (8-char limit, uppercase)
3. **Derivation Rules**: All derivations must be traceable to SDTM source variables
4. **Metadata**: Complete variable labels, formats, and controlled terminology
5. **Rule Files**: CDISC rules are stored in `Context/ADAMRules/` as markdown files

### Testing Strategy

**Backend Tests**:
- Unit tests in `backend/tests/`
- Integration tests for LLM providers
- Code generator tests with mock data
- Focus on `test_variable_categorizer.py` and `test_code_generator/`

**Frontend**:
- Component testing with React Testing Library
- ESLint for TypeScript validation
- Manual testing via browser (primary strategy)

### Common Development Patterns

**Error Handling**:
- Backend uses custom `ADAMError` exceptions
- All API endpoints return structured error responses
- Frontend uses `ErrorBoundary.tsx` for component-level error catching

**Logging**:
- Backend uses `loguru` with structured logging
- Logs to console and `backend/logs/adam_ai.log` (10MB rotation)
- Log level controlled by `LOG_LEVEL` env var

**State Management**:
- Frontend uses Zustand for global state (`frontend/src/store/`)
- Component-level state with React hooks

**Security**:
- JWT-based authentication (`app/api/auth_routes.py`)
- Rate limiting middleware (`app/middleware/rate_limiter.py`)
- Input validation with Pydantic models

### File Locations

**Input Files**:
- Excel specifications: `Content/UserInputs/*.xlsx`
- CDISC rules: `Context/ADAMRules/*.md`
- Project architecture docs: `Context/ProjectArchitecture/`

**Generated Outputs**:
- Logs: `backend/logs/`
- Cached results: In-memory or database (PostgreSQL for production)

### Known Issues & Workarounds

**PowerShell Execution Policy**:
If virtual environment activation fails, use direct python path:
```powershell
.\prakenv\Scripts\python.exe
```

**Import Errors**:
Always run commands from project root with proper virtual environment activated.

**API Key Configuration**:
Ensure `.env` is in `backend/` directory (not root). At least one LLM provider key must be configured.

### Development Workflow

1. **Backend Changes**: Modify Python files → Run tests → Check logs → Test via Swagger UI (`http://localhost:8000/api/docs`)
2. **Frontend Changes**: Modify TypeScript/React files → Hot reload in browser → Check console for errors
3. **Database Changes**: Use Alembic migrations in `backend/alembic/`
4. **API Changes**: Update both backend endpoint and frontend service layer (`frontend/src/services/`)

### Documentation Standards

**Python (Google Style)**:
```python
def function(arg: str) -> dict:
    """Brief description.

    Args:
        arg: Description

    Returns:
        Description
    """
```

**TypeScript (JSDoc)**:
```typescript
/**
 * Brief description
 * @param arg - Description
 * @returns Description
 */
function myFunction(arg: string): object {}
```

### Project-Specific Conventions

- **Variable Categories**: Analysis Flags, Dates, Demographics, Efficacy, Safety, PK/PD, Study Metadata
- **Code Languages**: R and SAS (controlled by user selection)
- **Comment Verbosity**: minimal, standard, detailed (affects generated code comments)
- **Optimization Levels**: basic, standard, advanced (affects code consolidation)
