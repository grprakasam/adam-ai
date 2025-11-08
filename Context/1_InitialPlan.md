# ADAM AI Code Generator - FINAL COMPREHENSIVE MVP Plan
## (Fully Aligned with ProjectArchitecture.md)

## Document Information
- **Created**: November 8, 2025
- **Project**: ADAM AI - Clinical Trial ADAM Code Generator (MVP)
- **Version**: 3.0 FINAL (Architecture-Aligned)
- **Status**: Complete & Ready for Implementation

---

## 1. Architecture Requirements Analysis (from ProjectArchitecture.md)

### 1.1 Key Architecture Principles Identified

#### System Architecture Requirements
✅ **Modular Design**: Separate concerns into independent modules
✅ **Scalability**: Support multiple concurrent users (future)
✅ **Extensibility**: Easy to add new ADAM datasets beyond ADSL
✅ **Provider Agnostic**: Seamless switching between LLM providers
✅ **Deployment Ready**: Docker containerization for AWS on-premise

#### Technology Stack (STRICTLY as per ProjectArchitecture.md)
✅ **Frontend**: React with TypeScript
✅ **Backend**: Python FastAPI
✅ **LLM Providers**: OpenAI (GPT-4), Anthropic (Claude), Google (Gemini)
✅ **Code Editor**: Monaco Editor (VS Code engine)
✅ **Deployment**: Docker containers on AWS

#### Core System Components (from Architecture doc)

**1. Input Collection Module**
- User input forms (study metadata, SDTM specs)
- File upload capability (future enhancement)
- Input validation

**2. Rule Loading & Processing Module**
- Parse all markdown files from Context/ADAMRules/
- Extract variable definitions, derivation logic, validation rules
- Build comprehensive rule repository

**3. Context Building Module**
- Combine user inputs with loaded rules
- Create conversation context
- Maintain state across interactions

**4. Prompt Engineering Module**
- Construct optimal prompts for each LLM provider
- Include all rules, examples, and constraints
- Optimize for token efficiency

**5. LLM Integration Module**
- Abstract interface for multiple providers
- Handle API calls, retries, error handling
- Stream responses for better UX

**6. Code Generation Module**
- Parse LLM responses
- Extract code blocks
- Format and structure code properly

**7. Validation Module**
- Syntax validation
- CDISC compliance checking
- Variable naming convention validation
- Data type validation

**8. Output Management Module**
- Display generated code
- Enable code editing
- Download functionality
- Documentation generation

**9. User Interface Module**
- Responsive React application
- Intuitive workflow
- Real-time feedback

---

## 2. Complete System Architecture (Architecture.md Aligned)

### 2.1 High-Level Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                         PRESENTATION LAYER                            │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              React Frontend (TypeScript)                     │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │   Input      │  │   Chat       │  │   Code       │      │    │
│  │  │   Module     │  │   Interface  │  │   Editor     │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │  Validation  │  │  Provider    │  │  Download    │      │    │
│  │  │  Display     │  │  Selector    │  │  Manager     │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
                                ↓ ↑
                          REST API / WebSocket
                                ↓ ↑
┌───────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                             │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │              FastAPI Backend (Python)                        │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │   Input      │  │   Rule       │  │   Context    │      │    │
│  │  │  Collection  │  │   Loading    │  │   Building   │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │   Prompt     │  │     LLM      │  │     Code     │      │    │
│  │  │ Engineering  │  │ Integration  │  │  Generation  │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  │                                                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │  Validation  │  │    Output    │  │   Session    │      │    │
│  │  │    Engine    │  │  Management  │  │   Manager    │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  └─────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
                                ↓ ↑
┌───────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION LAYER                             │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   OpenAI     │  │  Anthropic   │  │   Google     │              │
│  │   Provider   │  │   Provider   │  │   Provider   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │     Rule     │  │   Validation │  │     Code     │              │
│  │   Files      │  │    Rules     │  │   Templates  │              │
│  │  (.md files) │  │   (CDISC)    │  │   (R/SAS)    │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└───────────────────────────────────────────────────────────────────────┘
                                ↓ ↑
┌───────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER (Future)                           │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  PostgreSQL  │  │    Redis     │  │   AWS S3     │              │
│  │  (Sessions)  │  │   (Cache)    │  │ (File Store) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.2 Detailed Module Architecture

#### Module 1: Input Collection Module

**Purpose**: Collect and validate all user inputs

**Components**:
```
Input Collection Module
├── StudyMetadataCollector
│   ├── Protocol ID
│   ├── Indication
│   ├── Phase
│   └── Sponsor
├── SDTMDatasetSelector
│   ├── Available datasets list
│   ├── Multi-select with dependencies
│   └── Dataset metadata
├── VariableSelector
│   ├── ADSL variable catalog
│   ├── Dependency checker
│   ├── Category grouping
│   └── Search functionality
├── DerivationRulesCollector
│   ├── Population flag definitions
│   ├── Missing data strategy
│   ├── Date handling options
│   └── Custom study rules
└── InputValidator
    ├── Required field checker
    ├── Format validator
    └── Dependency resolver
```

**Input Schema**:
```python
class UserInput(BaseModel):
    study_metadata: StudyMetadata
    sdtm_datasets: List[str]
    variables_requested: List[str]
    derivation_rules: DerivationRules
    custom_rules: str
    output_preferences: OutputPreferences
```

#### Module 2: Rule Loading & Processing Module

**Purpose**: Load and parse all rule files from Context/ADAMRules/

**Components**:
```
Rule Loading Module
├── RuleFileLoader
│   ├── Load ADSL_MacroLogic.md
│   ├── Load ADSL_ApplicationBehaviourRules.md
│   └── Load ADSL_IGSpecificRules.md
├── RuleParser
│   ├── Extract variable definitions
│   ├── Parse derivation logic
│   ├── Extract validation rules
│   └── Parse examples
├── RuleRepository
│   ├── Store parsed rules
│   ├── Index by variable
│   ├── Cache for performance
│   └── Query interface
└── RuleDependencyAnalyzer
    ├── Build dependency graph
    ├── Detect circular dependencies
    └── Calculate derivation order
```

**Rule Structure**:
```python
class ParsedRule(BaseModel):
    variable_name: str
    variable_label: str
    data_type: str
    derivation_logic: str
    dependencies: List[str]
    validation_rules: List[str]
    examples: List[str]
    source_file: str
```

#### Module 3: Context Building Module

**Purpose**: Combine user inputs with rules to create comprehensive context

**Components**:
```
Context Building Module
├── ContextAssembler
│   ├── Merge user inputs
│   ├── Merge loaded rules
│   ├── Add conversation history
│   └── Format for LLM
├── TokenOptimizer
│   ├── Calculate token count
│   ├── Prioritize essential content
│   ├── Truncate if needed
│   └── Maintain context coherence
├── ExampleSelector
│   ├── Select relevant examples
│   ├── Match similar scenarios
│   └── Include best practices
└── ContextVersionManager
    ├── Track context changes
    ├── Support context rollback
    └── Context history
```

**Context Structure**:
```python
class GenerationContext(BaseModel):
    study_context: StudyMetadata
    available_datasets: List[str]
    requested_variables: List[str]
    derivation_rules: Dict[str, Rule]
    custom_requirements: str
    conversation_history: List[Message]
    examples: List[Example]
    constraints: List[str]
    metadata: ContextMetadata
```

#### Module 4: Prompt Engineering Module

**Purpose**: Construct optimal prompts for each LLM provider

**Components**:
```
Prompt Engineering Module
├── PromptTemplateManager
│   ├── Base template
│   ├── Provider-specific templates
│   └── Template versioning
├── PromptBuilder
│   ├── Assemble prompt sections
│   ├── Format for provider
│   ├── Add instructions
│   └── Include constraints
├── PromptOptimizer
│   ├── Optimize token usage
│   ├── Enhance clarity
│   ├── Add examples strategically
│   └── Structure for best results
└── PromptValidator
    ├── Check completeness
    ├── Verify formatting
    └── Ensure provider compatibility
```

**Prompt Template Structure**:
```python
class PromptTemplate:
    system_message: str
    context_section: str
    rules_section: str
    examples_section: str
    instructions_section: str
    constraints_section: str
    output_format_section: str
```

**Example Prompt Structure**:
```
# System Message
You are an expert R programmer specializing in CDISC ADAM datasets.
Your task is to generate production-ready R code for clinical trial analysis.

# Study Context
Protocol: {protocol_id}
Indication: {indication}
Phase: {phase}
Available SDTM Datasets: {datasets}

# ADSL Variable Requirements
Generate code for the following ADSL variables:
{variable_list_with_descriptions}

# Derivation Rules (from ADSL_MacroLogic.md)
{macro_logic_rules}

# Application Behavior Rules (from ADSL_ApplicationBehaviourRules.md)
{behaviour_rules}

# Implementation Group Specific Rules
{ig_specific_rules}

# Study-Specific Custom Requirements
{custom_rules}

# Code Requirements
1. Use tidyverse/dplyr syntax
2. Include comprehensive comments
3. Handle missing data explicitly
4. Follow CDISC naming conventions
5. Generate variables in correct derivation order
6. Include data quality checks

# Output Format
Return ONLY the R code within a code block.
Include inline comments explaining derivations.
```

#### Module 5: LLM Integration Module

**Purpose**: Handle all LLM provider interactions

**Components**:
```
LLM Integration Module
├── ProviderFactory
│   ├── Create provider instances
│   ├── Manage credentials
│   └── Provider selection
├── AbstractProvider (Base Class)
│   ├── generate()
│   ├── generate_streaming()
│   ├── validate_response()
│   └── handle_errors()
├── OpenAIProvider
│   ├── GPT-4 integration
│   ├── Token management
│   └── Streaming support
├── AnthropicProvider
│   ├── Claude 3.5 Sonnet integration
│   ├── Prompt formatting
│   └── Response parsing
├── GoogleProvider
│   ├── Gemini integration
│   ├── Safety settings
│   └── Response handling
├── ResponseParser
│   ├── Extract code blocks
│   ├── Parse markdown
│   └── Structure response
├── ErrorHandler
│   ├── Retry logic
│   ├── Fallback providers
│   └── Error reporting
└── UsageTracker
    ├── Token counting
    ├── Cost calculation
    └── Performance metrics
```

**Provider Interface**:
```python
class LLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.3,
        max_tokens: int = 4000
    ) -> str:
        pass
    
    @abstractmethod
    async def generate_streaming(
        self,
        prompt: str,
        model: str
    ) -> AsyncGenerator[str, None]:
        pass
    
    @abstractmethod
    def validate_response(self, response: str) -> bool:
        pass
    
    @abstractmethod
    async def handle_error(self, error: Exception) -> str:
        pass
```

#### Module 6: Code Generation Module

**Purpose**: Process LLM output and generate final code

**Components**:
```
Code Generation Module
├── ResponseProcessor
│   ├── Parse LLM output
│   ├── Extract code sections
│   ├── Remove artifacts
│   └── Format code
├── CodeEnhancer
│   ├── Add missing comments
│   ├── Format consistently
│   ├── Add headers/metadata
│   └── Optimize structure
├── DerivationSequencer
│   ├── Order variables correctly
│   ├── Resolve dependencies
│   └── Generate step-by-step
├── MissingDataHandler
│   ├── Add NA handling code
│   ├── Add validation checks
│   └── Add informative comments
├── CodeFormatter
│   ├── Apply style guide
│   ├── Consistent indentation
│   ├── Line wrapping
│   └── Spacing rules
└── CodeDocumenter
    ├── Generate inline docs
    ├── Create header block
    ├── Add derivation notes
    └── Include metadata
```

**Generated Code Structure**:
```r
# ============================================================================
# ADSL Dataset Creation
# ============================================================================
# Protocol: ABC-123
# Generated: 2025-11-08
# Generator: ADAM AI Code Generator
# LLM Provider: OpenAI GPT-4
# Total Variables: 45
# ============================================================================

# Load Required Libraries
library(tidyverse)
library(lubridate)
library(haven)

# Read SDTM Datasets
dm <- read_sas("path/to/dm.sas7bdat")
ex <- read_sas("path/to/ex.sas7bdat")
ds <- read_sas("path/to/ds.sas7bdat")

# Initialize ADSL with Core Variables
adsl <- dm %>%
  select(STUDYID, USUBJID, SUBJID, SITEID, BRTHDTC, SEX, RACE)

# [Step-by-step derivations with comments...]

# Variable Validation
# Check for missing required variables
# Validate data types
# Check naming conventions
```

#### Module 7: Validation Module

**Purpose**: Comprehensive code validation

**Components**:
```
Validation Module
├── SyntaxValidator
│   ├── R syntax checker
│   ├── Parse tree validation
│   └── Error detection
├── NamingValidator
│   ├── Variable name rules (uppercase, ≤8 chars)
│   ├── Label length rules (≤40 chars)
│   └── CDISC conventions
├── TypeValidator
│   ├── Numeric variable check
│   ├── Character variable check
│   ├── Date format check
│   └── Type consistency
├── DependencyValidator
│   ├── Check variable dependencies met
│   ├── Verify derivation order
│   └── Detect circular dependencies
├── ComplianceValidator
│   ├── CDISC ADAM IG compliance
│   ├── Required variable presence
│   ├── Standard naming
│   └── Label requirements
├── QualityValidator
│   ├── Comment density
│   ├── Code complexity
│   ├── Readability score
│   └── Best practices
└── ValidationReporter
    ├── Compile validation results
    ├── Categorize issues (error/warning/info)
    ├── Provide fix suggestions
    └── Generate report
```

**Validation Result Structure**:
```python
class ValidationResult(BaseModel):
    is_valid: bool
    overall_score: float
    
    syntax_check: ValidationCheck
    naming_check: ValidationCheck
    type_check: ValidationCheck
    dependency_check: ValidationCheck
    compliance_check: ValidationCheck
    quality_check: ValidationCheck
    
    errors: List[ValidationError]
    warnings: List[ValidationWarning]
    suggestions: List[ValidationSuggestion]
    
    summary: ValidationSummary
```

#### Module 8: Output Management Module

**Purpose**: Manage all outputs and downloads

**Components**:
```
Output Management Module
├── CodeDisplayManager
│   ├── Monaco editor integration
│   ├── Syntax highlighting
│   ├── Line numbering
│   └── Code folding
├── DownloadManager
│   ├── Generate .R file
│   ├── Generate .SAS file (future)
│   ├── Zip multiple files
│   └── Include documentation
├── DocumentationGenerator
│   ├── Specification document
│   ├── Derivation map
│   ├── Validation report
│   └── User guide
├── ExportManager
│   ├── Export to various formats
│   ├── Include metadata
│   ├── Version tracking
│   └── Audit trail
└── ShareManager
    ├── Generate shareable links
    ├── Export configurations
    └── Save templates
```

#### Module 9: User Interface Module

**Purpose**: Complete React-based UI

**Components**:
```
User Interface Module
├── Layout Components
│   ├── Header
│   ├── Sidebar (if needed)
│   ├── Main Content Area
│   └── Footer
├── Input Components
│   ├── Study Metadata Form
│   ├── Dataset Selector
│   ├── Variable Selector
│   ├── Derivation Rules Config
│   └── Custom Rules Input
├── Interaction Components
│   ├── Chat Interface
│   ├── Message Display
│   ├── Streaming Response Handler
│   └── Quick Actions
├── Display Components
│   ├── Code Editor (Monaco)
│   ├── Validation Panel
│   ├── Derivation Sequence Display
│   ├── Quality Metrics Panel
│   └── Documentation Viewer
├── Control Components
│   ├── Provider Selector
│   ├── Model Selector
│   ├── Generate Button
│   ├── Download Button
│   └── Settings Panel
└── Feedback Components
    ├── Loading Indicators
    ├── Progress Bars
    ├── Error Messages
    ├── Success Notifications
    └── Tooltips
```

---

## 3. Complete Implementation Plan

### 3.1 Backend Project Structure (Complete)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI application entry point
│   ├── config.py                        # Configuration management
│   ├── dependencies.py                  # Dependency injection
│   │
│   ├── api/                             # API endpoints
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── generate.py              # Code generation endpoint
│   │   │   ├── validate.py              # Validation endpoint
│   │   │   ├── providers.py             # Provider management
│   │   │   ├── documentation.py         # Documentation generation
│   │   │   └── chat.py                  # Chat interaction
│   │
│   ├── core/                            # Core functionality
│   │   ├── __init__.py
│   │   ├── security.py                  # Authentication (simple for MVP)
│   │   └── exceptions.py                # Custom exceptions
│   │
│   ├── modules/                         # Core modules (per architecture)
│   │   ├── __init__.py
│   │   │
│   │   ├── input_collection/
│   │   │   ├── __init__.py
│   │   │   ├── collector.py
│   │   │   └── validator.py
│   │   │
│   │   ├── rule_loading/
│   │   │   ├── __init__.py
│   │   │   ├── loader.py
│   │   │   ├── parser.py
│   │   │   └── repository.py
│   │   │
│   │   ├── context_building/
│   │   │   ├── __init__.py
│   │   │   ├── assembler.py
│   │   │   └── optimizer.py
│   │   │
│   │   ├── prompt_engineering/
│   │   │   ├── __init__.py
│   │   │   ├── builder.py
│   │   │   ├── templates.py
│   │   │   └── optimizer.py
│   │   │
│   │   ├── llm_integration/
│   │   │   ├── __init__.py
│   │   │   ├── factory.py
│   │   │   ├── base_provider.py
│   │   │   ├── openai_provider.py
│   │   │   ├── anthropic_provider.py
│   │   │   ├── google_provider.py
│   │   │   └── response_parser.py
│   │   │
│   │   ├── code_generation/
│   │   │   ├── __init__.py
│   │   │   ├── processor.py
│   │   │   ├── enhancer.py
│   │   │   ├── sequencer.py
│   │   │   └── formatter.py
│   │   │
│   │   ├── validation/
│   │   │   ├── __init__.py
│   │   │   ├── syntax_validator.py
│   │   │   ├── naming_validator.py
│   │   │   ├── type_validator.py
│   │   │   ├── dependency_validator.py
│   │   │   ├── compliance_validator.py
│   │   │   └── quality_validator.py
│   │   │
│   │   └── output_management/
│   │       ├── __init__.py
│   │       ├── display_manager.py
│   │       ├── download_manager.py
│   │       └── doc_generator.py
│   │
│   ├── models/                          # Data models
│   │   ├── __init__.py
│   │   ├── input_models.py
│   │   ├── rule_models.py
│   │   ├── context_models.py
│   │   ├── generation_models.py
│   │   └── validation_models.py
│   │
│   ├── constants/                       # Constants and configurations
│   │   ├── __init__.py
│   │   ├── adsl_variables.py
│   │   ├── variable_types.py
│   │   ├── derivation_order.py
│   │   └── validation_rules.py
│   │
│   └── utils/                           # Utility functions
│       ├── __init__.py
│       ├── file_utils.py
│       ├── logging_utils.py
│       └── helpers.py
│
├── tests/                               # Test suite
│   ├── __init__.py
│   ├── test_modules/
│   ├── test_api/
│   └── test_integration/
│
├── scripts/                             # Utility scripts
│   ├── init_rules.py
│   └── test_providers.py
│
├── requirements.txt                     # Python dependencies
├── requirements-dev.txt                 # Development dependencies
├── Dockerfile
├── .env.example
├── pytest.ini
└── README.md
```

### 3.2 Frontend Project Structure (Complete)

```
frontend/
├── public/
│   ├── index.html
│   ├── favicon.ico
│   └── assets/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   ├── vite-env.d.ts
│   │
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.tsx
│   │   │   ├── ConfigPanel.tsx
│   │   │   ├── OutputPanel.tsx
│   │   │   └── MainLayout.tsx
│   │   │
│   │   ├── Configuration/
│   │   │   ├── StudyMetadataForm.tsx
│   │   │   ├── SDTMDatasetSelector.tsx
│   │   │   ├── VariableSelector.tsx
│   │   │   ├── DerivationRulesConfig.tsx
│   │   │   ├── CustomRulesInput.tsx
│   │   │   └── AdvancedOptions.tsx
│   │   │
│   │   ├── Output/
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── EditorToolbar.tsx
│   │   │   ├── ValidationPanel.tsx
│   │   │   ├── DerivationSequencePanel.tsx
│   │   │   ├── QualityMetricsPanel.tsx
│   │   │   └── DocumentationPanel.tsx
│   │   │
│   │   ├── Chat/
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ChatMessage.tsx
│   │   │   └── ChatInput.tsx
│   │   │
│   │   └── Common/
│   │       ├── ProviderSelector.tsx
│   │       ├── LoadingSpinner.tsx
│   │       ├── LoadingOverlay.tsx
│   │       ├── ErrorBoundary.tsx
│   │       ├── ErrorMessage.tsx
│   │       ├── ToastContainer.tsx
│   │       └── Tooltip.tsx
│   │
│   ├── services/
│   │   ├── api.ts
│   │   ├── storage.ts
│   │   └── websocket.ts
│   │
│   ├── types/
│   │   ├── index.ts
│   │   ├── api.types.ts
│   │   ├── models.types.ts
│   │   └── ui.types.ts
│   │
│   ├── constants/
│   │   ├── adsl_variables.ts
│   │   ├── variable_categories.ts
│   │   ├── sdtm_datasets.ts
│   │   └── validation_rules.ts
│   │
│   ├── hooks/
│   │   ├── useApi.ts
│   │   ├── useValidation.ts
│   │   └── useLocalStorage.ts
│   │
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   └── helpers.ts
│   │
│   └── styles/
│       └── globals.css
│
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

---

## 4. Implementation Timeline (Detailed)

### Phase 1: Backend Core Modules (Days 1-4)

#### Day 1: Foundational Modules
**Morning (4 hours)**
- Set up project structure
- Configure FastAPI application
- Implement Module 1 (Input Collection)
  - collector.py
  - validator.py
- Write unit tests

**Afternoon (4 hours)**
- Implement Module 2 (Rule Loading)
  - loader.py (load all .md files)
  - parser.py (parse markdown structure)
  - repository.py (store parsed rules)
- Write unit tests
- Test with actual rule files

**Deliverables**: 
- Working input collection
- All rule files loaded and parsed
- Unit tests passing

---

#### Day 2: Context & Prompt Engineering
**Morning (4 hours)**
- Implement Module 3 (Context Building)
  - assembler.py (merge inputs + rules)
  - optimizer.py (token optimization)
- Test context assembly

**Afternoon (4 hours)**
- Implement Module 4 (Prompt Engineering)
  - builder.py
  - templates.py (system prompts for each provider)
  - optimizer.py
- Create comprehensive prompt templates
- Test prompt generation

**Deliverables**: 
- Context building working
- Provider-specific prompt templates
- Integration tests passing

---

#### Day 3: LLM Integration
**Morning (4 hours)**
- Implement Module 5 (LLM Integration)
  - factory.py
  - base_provider.py (abstract interface)
  - openai_provider.py (GPT-4 integration)
- Test OpenAI connection

**Afternoon (4 hours)**
- Implement remaining providers:
  - anthropic_provider.py (Claude integration)
  - google_provider.py (Gemini integration)
  - response_parser.py
- Error handling and retries
- Test all providers

**Deliverables**: 
- All 3 LLM providers working
- Provider switching functional
- Error handling implemented

---

#### Day 4: Code Generation & Validation
**Morning (4 hours)**
- Implement Module 6 (Code Generation)
  - processor.py (extract and parse code)
  - enhancer.py (add comments, formatting)
  - sequencer.py (variable ordering)
  - formatter.py (code style)

**Afternoon (4 hours)**
- Implement Module 7 (Validation)
  - syntax_validator.py
  - naming_validator.py
  - dependency_validator.py
  - compliance_validator.py
  - quality_validator.py
- Integration tests for full pipeline

**Deliverables**: 
- Complete backend pipeline working
- Code generation functional
- All validations working

---

### Phase 2: Frontend Implementation (Days 5-7)

#### Day 5: Core UI Components
**Morning (4 hours)**
- Set up React + TypeScript + Vite project
- Install dependencies (Monaco, Tailwind, Axios)
- Implement layout components:
  - Header.tsx
  - MainLayout.tsx
  - ConfigPanel.tsx
  - OutputPanel.tsx

**Afternoon (4 hours)**
- Implement configuration components:
  - StudyMetadataForm.tsx
  - SDTMDatasetSelector.tsx
  - VariableSelector.tsx (with search, grouping, dependencies)
- Basic styling with Tailwind

**Deliverables**: 
- React app running
- All input forms functional
- Basic layout complete

---

#### Day 6: Output Components
**Morning (4 hours)**
- Implement output components:
  - CodeEditor.tsx (Monaco integration)
  - EditorToolbar.tsx
  - ValidationPanel.tsx
  - DerivationSequencePanel.tsx

**Afternoon (4 hours)**
- Implement additional features:
  - QualityMetricsPanel.tsx
  - DocumentationPanel.tsx
  - ChatPanel.tsx
  - Common components (loading, errors, toasts)

**Deliverables**: 
- All UI components complete
- Monaco editor integrated
- Validation display working

---

#### Day 7: Integration & Polish
**Morning (4 hours)**
- Connect frontend to backend API
  - api.ts service
  - Handle all API calls
  - Error handling
  - Loading states

**Afternoon (4 hours)**
- Polish UI/UX:
  - Responsive design
  - Toast notifications
  - Error boundaries
  - Performance optimization
- End-to-end testing

**Deliverables**: 
- Full integration working
- Responsive UI
- Error handling complete
- Ready for testing

---

### Phase 3: Testing & Documentation (Days 8-9)

#### Day 8: Comprehensive Testing
**Morning (4 hours)**
- Backend testing:
  - Unit tests for all modules
  - Integration tests
  - Provider switching tests
  - Error scenario tests

**Afternoon (4 hours)**
- Frontend testing:
  - Component tests
  - Integration tests
  - E2E test scenarios
- Bug fixes

**Test Scenarios**:
1. Generate ADSL with all variables
2. Generate ADSL with subset of variables
3. Test each LLM provider
4. Test validation catching errors
5. Test dependency resolution
6. Test missing data handling
7. Test custom rules
8. Test download functionality

**Deliverables**: 
- All tests passing
- Bugs fixed
- Test coverage > 80%

---

#### Day 9: Documentation & Polish
**Morning (4 hours)**
- Documentation:
  - API documentation (OpenAPI/Swagger)
  - User guide
  - Developer documentation
  - Code comments

**Afternoon (4 hours)**
- Final polish:
  - Code cleanup
  - Performance optimization
  - Security review
  - Final testing

**Deliverables**: 
- Complete documentation
- Optimized performance
- Production-ready code

---

### Phase 4: Deployment (Day 10)

#### Day 10: Deployment & Handoff
**Morning (4 hours)**
- Docker configuration:
  - Backend Dockerfile
  - Frontend Dockerfile
  - docker-compose.yml
  - nginx.conf
- Build and test containers locally

**Afternoon (4 hours)**
- AWS deployment:
  - Deployment script
  - Environment configuration
  - Deploy to AWS instance
  - Final production testing
- Handoff documentation

**Deliverables**: 
- Docker containers working
- Deployed to AWS
- Handoff complete
- Production ready

---

## 5. Technical Implementation Details

### 5.1 Backend Dependencies

```txt
# requirements.txt

# Core Framework
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0

# LLM Providers
openai==1.3.0
anthropic==0.7.0
google-generativeai==0.3.0

# Utilities
python-dotenv==1.0.0
python-multipart==0.0.6
markdown==3.5.1
pyyaml==6.0.1

# Logging
python-json-logger==2.0.7

# HTTP
httpx==0.25.2
aiohttp==3.9.1

# Development
pytest==7.4.3
pytest-asyncio==0.21.1
pytest-cov==4.1.0
black==23.12.0
flake8==6.1.0
mypy==1.7.1
```

### 5.2 Frontend Dependencies

```json
{
  "name": "adam-ai-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.2.2",
    "axios": "^1.6.2",
    "@monaco-editor/react": "^4.6.0",
    "monaco-editor": "^0.45.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "vite": "^5.0.8"
  }
}
```

### 5.3 Environment Configuration

```bash
# .env.example (Backend)

# Environment
ENVIRONMENT=development
LOG_LEVEL=INFO

# LLM Provider API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...

# Application Settings
RULES_PATH=../Context/ADAMRules
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# LLM Settings
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4
DEFAULT_TEMPERATURE=0.3
DEFAULT_MAX_TOKENS=4000

# Feature Flags
ENABLE_STREAMING=true
ENABLE_CACHING=false
ENABLE_VALIDATION=true
```

```bash
# .env.example (Frontend)

VITE_API_URL=http://localhost:8000
VITE_APP_NAME=ADAM AI Code Generator
VITE_APP_VERSION=1.0.0
```

---

## 6. Deployment Configuration

### 6.1 Docker Configuration

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile

FROM node:18-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Docker Compose
```yaml
# docker-compose.yml

version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: adam-ai-backend
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - ENVIRONMENT=production
      - LOG_LEVEL=INFO
      - RULES_PATH=/app/Context/ADAMRules
    volumes:
      - ./Context:/app/Context:ro
      - ./logs:/app/logs
    ports:
      - "8000:8000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - adam-network

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: adam-ai-frontend
    environment:
      - REACT_APP_API_URL=http://backend:8000
      - NODE_ENV=production
    ports:
      - "3000:80"
    depends_on:
      - backend
    restart: unless-stopped
    networks:
      - adam-network

  nginx:
    image: nginx:alpine
    container_name: adam-ai-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    restart: unless-stopped
    networks:
      - adam-network

networks:
  adam-network:
    driver: bridge

volumes:
  logs:
```

### 6.2 Nginx Configuration

```nginx
# nginx/nginx.conf

upstream backend {
    server backend:8000;
}

upstream frontend {
    server frontend:80;
}

server {
    listen 80;
    server_name localhost;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'Authorization, Content-Type' always;
    }

    # Health check
    location /health {
        proxy_pass http://backend/health;
    }
}
```

### 6.3 Deployment Script

```bash
#!/bin/bash
# deployment/deploy.sh

echo "==================================="
echo "ADAM AI Code Generator Deployment"
echo "==================================="

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create .env file with required API keys"
    exit 1
fi

# Load environment variables
export $(cat .env | xargs)

# Validate required environment variables
if [ -z "$OPENAI_API_KEY" ]; then
    echo "Error: OPENAI_API_KEY not set!"
    exit 1
fi

echo "1. Building Docker images..."
docker-compose build

if [ $? -ne 0 ]; then
    echo "Error: Docker build failed!"
    exit 1
fi

echo "2. Stopping existing containers..."
docker-compose down

echo "3. Starting containers..."
docker-compose up -d

if [ $? -ne 0 ]; then
    echo "Error: Failed to start containers!"
    exit 1
fi

echo "4. Waiting for services to be ready..."
sleep 10

echo "5. Checking health..."
curl -f http://localhost:8000/health

if [ $? -eq 0 ]; then
    echo "✓ Backend is healthy"
else
    echo "✗ Backend health check failed"
    docker-compose logs backend
    exit 1
fi

echo "6. Deployment status:"
docker-compose ps

echo ""
echo "==================================="
echo "Deployment Complete!"
echo "==================================="
echo "Frontend: http://localhost"
echo "Backend API: http://localhost:8000"
echo "API Docs: http://localhost:8000/api/docs"
echo "==================================="
```

---

## 7. Success Criteria & Validation

### 7.1 MVP Success Criteria

#### Functional Requirements
- [ ] All 9 architecture modules implemented and working
- [ ] All .md rule files load correctly from Context/ADAMRules/
- [ ] All 3 LLM providers (OpenAI, Anthropic, Google) functional
- [ ] Provider switching works seamlessly
- [ ] Code generation works for all selected ADSL variables
- [ ] Variable dependencies automatically resolved
- [ ] Derivation sequence correctly calculated
- [ ] All validation checks implemented and working
- [ ] Generated code is syntactically valid
- [ ] Download functionality works (.R file)
- [ ] UI is responsive and intuitive
- [ ] Chat interface functional (basic)
- [ ] Error handling works throughout

#### Performance Requirements
- [ ] Code generation completes in < 60 seconds
- [ ] API response time < 5 seconds (non-generation endpoints)
- [ ] UI loads in < 3 seconds
- [ ] No memory leaks in long-running sessions
- [ ] Handles concurrent requests (basic)

#### Quality Requirements
- [ ] Generated code is syntactically valid (100%)
- [ ] Variable naming follows CDISC conventions (uppercase, ≤8 chars)
- [ ] Variable labels ≤40 characters
- [ ] All dependencies resolved correctly (100%)
- [ ] Validation accuracy > 95%
- [ ] Code coverage > 80%
- [ ] No critical security vulnerabilities

#### Deployment Requirements
- [ ] Docker containers build successfully
- [ ] docker-compose runs all services
- [ ] Health checks pass
- [ ] Application accessible via browser
- [ ] All environment variables properly configured
- [ ] Logs accessible and meaningful

---

### 7.2 Test Scenarios

#### Test Scenario 1: Basic ADSL Generation
**Inputs**:
- Protocol: ABC-123
- Indication: Oncology
- Phase: III
- Datasets: DM, EX
- Variables: STUDYID, USUBJID, SUBJID, AGE, SEX, RACE

**Expected Output**:
- Valid R code with tidyverse syntax
- All 6 variables present
- Age calculation from birthdate
- Proper variable types
- Inline comments

**Validation**:
- Syntax check: PASS
- Naming check: PASS
- All required variables: PASS

---

#### Test Scenario 2: Complete ADSL with All Variables
**Inputs**:
- All SDTM datasets selected
- All ADSL variables from ADSL_MacroLogic.md selected

**Expected Output**:
- Comprehensive R code
- All variables in correct derivation order
- Population flags (SAFFL, ITTFL, FASFL, PPROTFL)
- Treatment variables
- Date variables with ISO 8601 format
- Missing data handling

**Validation**:
- All checks pass
- Code complexity reasonable
- Comment density > 15%

---

#### Test Scenario 3: Provider Switching
**Inputs**:
- Same requirements
- Test with OpenAI, then Anthropic, then Google

**Expected Output**:
- All providers generate valid code
- Similar code structure across providers
- All pass validation

---

#### Test Scenario 4: Dependency Resolution
**Inputs**:
- Select AGEGR1 without AGE
- Select SAFFL without RFXSTDTC

**Expected Behavior**:
- System detects missing dependencies
- Prompts user to add missing variables
- OR auto-adds dependencies with confirmation

---

#### Test Scenario 5: Custom Rules
**Inputs**:
- Custom age grouping: <18, 18-64, ≥65
- Custom SAFFL definition: "Received any study medication"

**Expected Output**:
- Generated code reflects custom age groups
- SAFFL logic matches custom definition
- Comments explain custom logic

---

#### Test Scenario 6: Error Scenarios
**Test Cases**:
- Invalid API key → Clear error message
- Network timeout → Retry then fallback provider
- Invalid SDTM dataset combination → Validation error
- Circular dependency in variables → Error with explanation
- LLM generates invalid code → Validation catches it

---

## 8. Risk Management

### 8.1 Technical Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| LLM API rate limits | High | High | - Implement exponential backoff<br>- Request queuing<br>- Cache responses<br>- Fallback to alternative provider |
| Token limit exceeded | Medium | High | - Smart context truncation<br>- Prioritize essential rules<br>- Chunk large prompts<br>- Optimize prompt templates |
| Provider API downtime | Medium | High | - Automatic fallback to alternative provider<br>- Health checks for all providers<br>- Queue requests during outage |
| Generated code has errors | Medium | Medium | - Multi-layer validation<br>- Allow manual editing<br>- Provide fix suggestions<br>- Learn from errors |
| Dependency resolution fails | Low | High | - Comprehensive dependency graph<br>- Circular dependency detection<br>- Clear error messages |
| Performance degradation | Low | Medium | - Code optimization<br>- Response caching<br>- Async processing<br>- Load testing |
| Security vulnerabilities | Low | High | - Input sanitization<br>- API key encryption<br>- Regular security audits<br>- HTTPS only |

### 8.2 Project Risks

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Scope creep | High | Medium | - Clear MVP definition<br>- Phased approach<br>- Feature freeze after Day 7 |
| LLM output inconsistency | Medium | Medium | - Lower temperature settings<br>- Prompt engineering<br>- Multiple validation layers |
| Integration issues | Medium | Medium | - Early integration testing<br>- Daily builds<br>- Continuous integration |
| Timeline delays | Medium | Medium | - Buffer time built in<br>- Daily progress tracking<br>- Early identification of blockers |
| API cost overruns | Medium | Low | - Usage monitoring<br>- Rate limiting<br>- Cost alerts<br>- Response caching |

---

## 9. Future Enhancements (Post-MVP)

### Phase 2: Enhanced Features (Weeks 3-6)

#### 2.1 Database Integration
- PostgreSQL for data persistence
- User management system
- Project and session management
- Conversation history storage
- Code version control

#### 2.2 Additional ADAM Datasets
- ADAE (Adverse Events)
- ADLB (Laboratory)
- ADVS (Vital Signs)
- ADTTE (Time-to-Event)
- ADRS (Response)
- Extensible framework for any ADAM dataset

#### 2.3 SAS Code Generation
- Parallel to R code generation
- Toggle between R and SAS output
- SAS-specific validation rules
- SAS macro templates

#### 2.4 Advanced UI Features
- Multi-project management
- Code comparison (diff view)
- Collaborative features
- Export to multiple formats (PDF, Word, HTML)
- Advanced code editor features

#### 2.5 Enhanced Validation
- Execute code in sandbox environment
- Data-driven validation with sample datasets
- Pinnacle 21 integration
- Automated testing suite generation

#### 2.6 File Upload Capabilities
- Upload SDTM datasets (.xpt, .sas7bdat, .csv)
- Data preview and profiling
- Automatic variable detection
- Data quality checks

#### 2.7 Analytics & Monitoring
- Usage analytics dashboard
- Code generation success rates
- Performance metrics
- Cost tracking per provider

---

## 10. Documentation Requirements

### 10.1 User Documentation
- [ ] Getting Started Guide
- [ ] User Manual
- [ ] Video tutorials
- [ ] FAQ
- [ ] Troubleshooting guide
- [ ] Best practices

### 10.2 Technical Documentation
- [ ] API Documentation (OpenAPI/Swagger)
- [ ] Architecture documentation
- [ ] Module documentation
- [ ] Database schema (future)
- [ ] Deployment guide
- [ ] Configuration guide

### 10.3 Developer Documentation
- [ ] Code documentation (docstrings)
- [ ] Development setup guide
- [ ] Contributing guidelines
- [ ] Testing guidelines
- [ ] Code style guide

### 10.4 ADAM Documentation
- [ ] ADAM rules reference
- [ ] Variable definitions
- [ ] Derivation logic explanation
- [ ] Validation criteria
- [ ] Examples and templates

---

## 11. Maintenance & Support Plan

### 11.1 Maintenance Activities
- **Weekly**: Review logs, check API usage, monitor errors
- **Monthly**: Update dependencies, security patches, performance optimization
- **Quarterly**: Feature updates, LLM model updates, user feedback implementation

### 11.2 Support Channels
- Email support
- Documentation portal
- Issue tracking (GitHub)
- User community (future)

### 11.3 Monitoring
- Application health monitoring
- API endpoint monitoring
- Error tracking and alerting
- Performance metrics
- Usage analytics

---

## 12. Handoff Checklist

### 12.1 Code Delivery
- [ ] Source code repository access
- [ ] All code documented
- [ ] Tests passing (>80% coverage)
- [ ] No known critical bugs

### 12.2 Deployment
- [ ] Docker images built and tested
- [ ] Deployment scripts provided
- [ ] Environment configuration documented
- [ ] AWS deployment guide provided

### 12.3 Documentation
- [ ] User documentation complete
- [ ] Technical documentation complete
- [ ] API documentation complete
- [ ] README files updated

### 12.4 Training
- [ ] Admin training session
- [ ] User training materials
- [ ] Video walkthrough

### 12.5 Support
- [ ] Support contact information
- [ ] Issue escalation process
- [ ] Maintenance schedule
- [ ] Update procedure

---

## END OF FINAL COMPREHENSIVE PLAN

**This plan is now 100% aligned with:**
- ✅ **ProjectArchitecture.md** - All 9 core modules implemented
- ✅ **ProjectRequirements.md** - All features covered
- ✅ **ADSL_MacroLogic.md** - All variable derivations included
- ✅ **ADSL_ApplicationBehaviourRules.md** - All behavior rules implemented
- ✅ **ADSL_IGSpecificRules.md** - Placeholder for future rules

**Architecture Compliance:**
- ✅ Modular design with 9 independent modules
- ✅ Scalable architecture
- ✅ Extensible for future ADAM datasets
- ✅ Provider-agnostic LLM integration
- ✅ Comprehensive validation framework
- ✅ Production-ready deployment configuration

**Ready for Implementation:** 🚀

### Implementation Start Date: Upon Confirmation
### Expected Completion: 10 Working Days
### Deployment Target: AWS On-Premise

---

## Appendix A: ADSL Variables Reference

### Core Variables (Required)
- STUDYID - Study Identifier
- USUBJID - Unique Subject Identifier
- SUBJID - Subject Identifier
- SITEID - Study Site Identifier

### Demographics
- AGE - Age in Years
- AGEGR1 - Age Group 1
- AGEGR1N - Age Group 1 (N)
- SEX - Sex
- RACE - Race
- RACEN - Race (N)
- ETHNIC - Ethnicity
- ETHNICN - Ethnicity (N)

### Treatment Variables
- TRT01P - Planned Treatment
- TRT01PN - Planned Treatment (N)
- TRT01A - Actual Treatment
- TRT01AN - Actual Treatment (N)
- ARM - Arm
- ARMCD - Arm Code

### Study Dates
- RFSTDTC - Reference Start Date
- RFENDTC - Reference End Date
- RFXSTDTC - First Exposure Date
- RFXENDTC - Last Exposure Date
- RFPENDT - End of Participation Date

### Population Flags
- SAFFL - Safety Population Flag
- ITTFL - Intent-to-Treat Population Flag
- FASFL - Full Analysis Set Flag
- PPROTFL - Per-Protocol Population Flag

### Derived Variables
- DTHFL - Death Flag
- DTHDTC - Death Date
- EOSSTT - End of Study Status
- EOTSTT - End of Treatment Status

---

## Appendix B: Quick Reference Commands

### Development
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

### Testing
```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app

# Frontend tests
cd frontend
npm test
```

### Deployment
```bash
# Build and run with Docker
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Full cleanup
docker-compose down -v
```

### Monitoring
```bash
# Check health
curl http://localhost:8000/health

# View backend logs
docker-compose logs backend

# View all services status
docker-compose ps
```

---

**Document Version**: 3.0 FINAL  
**Last Updated**: November 8, 2025  
**Status**: Ready for Implementation  
**Questions?** Contact the development team before starting implementation.
