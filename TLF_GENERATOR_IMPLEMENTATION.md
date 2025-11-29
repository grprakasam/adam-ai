# TLF Generator - Technical Implementation Guide

## Overview

The **TLF (Tables, Listings, Figures) Generator** is an innovative AI-driven feature that creates ADAM statistical outputs from mockshell documents. This feature leverages cutting-edge AI to understand document structures and generate production-ready statistical reports.

## Architecture

### Backend Architecture

#### 1. **API Layer** (`backend/app/api/v1/endpoints/tlf_generator.py`)

**Endpoints:**
- `POST /api/v1/tlf-generator/analyze` - Analyze uploaded mockshell document
- `POST /api/v1/tlf-generator/approve` - Approve or modify AI understanding
- `POST /api/v1/tlf-generator/generate` - Generate final TLF output
- `GET /api/v1/tlf-generator/session/{session_id}` - Get session status
- `DELETE /api/v1/tlf-generator/session/{session_id}` - Delete session
- `GET /api/v1/tlf-generator/examples` - Get example templates

**Key Features:**
- Multi-format document support (PDF, Word, Excel, Images)
- Session-based workflow management
- Structured request/response models using Pydantic
- Comprehensive error handling

#### 2. **Service Layer** (`backend/app/modules/tlf_generator/service.py`)

**Core Capabilities:**
- **Document Intelligence**: AI-powered analysis of mockshell documents
- **Vision Support**: Capability for image and PDF analysis using vision APIs
- **Text Analysis**: Structured extraction from text-based documents
- **Iterative Workflow**: Multi-step approval process
- **Citation Management**: Track and reference source documents

**Key Methods:**
```python
- analyze_mockshell(): Analyze uploaded document
- _analyze_document_with_ai(): Core AI analysis logic
- _analyze_visual_document(): Vision-based document analysis
- _analyze_text_document(): Text-based document analysis
- process_approval(): Handle user approval/modifications
- generate_tlf(): Generate final output
```

**AI Integration:**
- Uses LLM Integration Service for AI processing
- Supports multiple LLM providers (OpenAI, Anthropic, Google, Groq)
- Configurable temperature and token limits
- Structured JSON response parsing

### Frontend Architecture

#### 1. **Main Component** (`frontend/src/components/TLFGeneratorTab.tsx`)

**Four-Step Workflow:**

**Step 1: Type Selection**
- Visual card-based selection
- Three options: Table, Listing, Figure
- Rich descriptions and examples for each type
- Selected state tracking

**Step 2: Upload & Details Form**
- Study ID and metadata collection
- File upload with format validation
- Additional context for AI processing
- Progress indication during analysis

**Step 3: Understanding Review**
- Display AI's interpretation
- Confidence score visualization
- Structured display of extracted specifications
- Suggestions and clarification requests
- Approve or reject workflow

**Step 4: Generated Output**
- Display generated TLF
- Citation management
- Download and edit options
- Create another TLF capability

#### 2. **Styling** (`frontend/src/components/TLFGeneratorTab.css`)

**Design System:**
- Gradient backgrounds for visual appeal
- Card-based layouts for clarity
- Responsive design for mobile/tablet
- Smooth animations and transitions
- Ant Design component integration
- Accessibility-first approach

### Integration Points

#### 1. **Landing Page Integration**
- Added to utility features list
- Live status badge
- Gradient styling matching brand
- FileTextOutlined icon

#### 2. **Workspace Integration** (`RightPanel.tsx`)
- Added to utilities group
- Navigation event handling
- Tab tooltip for discoverability
- Seamless workspace experience

#### 3. **API Router Integration**
- Registered in v1 API router
- Tagged for API documentation
- Authentication middleware support

## Data Flow

```
User Upload → API Endpoint → Service Layer → LLM Analysis
     ↓
Session Storage ← Understanding Extraction ← AI Processing
     ↓
User Review → Approval/Modification → Session Update
     ↓
Generation Request → AI Generation → Formatted Output
     ↓
Display to User ← Citation Extraction ← Final Processing
```

## Key Features

### 1. **AI-Powered Document Understanding**
- Automatic structure extraction
- Column and row identification
- Formatting requirement detection
- Statistical element recognition

### 2. **Approval Workflow**
- Multi-step confirmation process
- User can approve or modify understanding
- Re-upload capability for corrections
- Prevents premature generation

### 3. **Multi-Format Support**
- **Tables**: Statistical summary tables
- **Listings**: Line-by-line data listings
- **Figures**: Graphical visualizations

### 4. **Citation Management**
- Track source documents
- Reference uploaded mockshells
- Maintain audit trail

### 5. **Session Management**
- Persistent session storage
- Resume capability
- Session cleanup
- Status tracking

## Technical Specifications

### Backend Technologies
- **Framework**: FastAPI
- **AI Integration**: LLM Integration Service
- **File Handling**: Python multipart/form-data
- **Session Storage**: In-memory (Redis/DB recommended for production)
- **Validation**: Pydantic models

### Frontend Technologies
- **Framework**: React with TypeScript
- **UI Library**: Ant Design
- **State Management**: React Hooks
- **File Upload**: Ant Design Upload component
- **Rendering**: dangerouslySetInnerHTML for HTML output

### Supported File Formats
- **Documents**: PDF, DOCX, XLSX
- **Images**: PNG, JPG, JPEG
- **Text**: CSV, TXT

## API Usage Examples

### 1. Analyze Mockshell

```bash
curl -X POST "http://localhost:8000/api/v1/tlf-generator/analyze" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@mockshell.pdf" \
  -F "tlf_type=table" \
  -F "study_id=STUDY-001" \
  -F "dataset_name=ADSL" \
  -F "output_name=T_14_1_01"
```

**Response:**
```json
{
  "session_id": "uuid-here",
  "tlf_type": "table",
  "understanding": {
    "structure": {...},
    "formatting": {...},
    "requirements": [...]
  },
  "confidence_score": 0.85,
  "suggested_modifications": [],
  "requires_clarification": []
}
```

### 2. Approve Understanding

```bash
curl -X POST "http://localhost:8000/api/v1/tlf-generator/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid-here",
    "approved": true
  }'
```

### 3. Generate TLF

```bash
curl -X POST "http://localhost:8000/api/v1/tlf-generator/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "uuid-here",
    "format": "html",
    "include_citations": true
  }'
```

## Best Practices

### For Users
1. **Upload Quality**: Use clear, well-formatted mockshells
2. **Context**: Provide detailed additional context
3. **Review**: Carefully review AI understanding before approval
4. **Iterate**: Use re-upload if understanding is incorrect

### For Developers
1. **Error Handling**: Comprehensive try-catch blocks
2. **Validation**: Validate all inputs at API layer
3. **Logging**: Use loguru for detailed logging
4. **Session Management**: Implement cleanup for old sessions
5. **Security**: Validate file types and sizes

## Future Enhancements

### Short-term
1. **PDF Generation**: Direct PDF output format
2. **RTF Support**: For regulatory submissions
3. **Template Library**: Pre-built templates for common TLFs
4. **Batch Processing**: Multiple TLFs at once

### Medium-term
1. **Database Integration**: PostgreSQL for session storage
2. **Redis Cache**: For improved performance
3. **Advanced Vision**: GPT-4 Vision or Claude Vision integration
4. **Data Integration**: Connect to actual ADAM datasets

### Long-term
1. **Collaborative Editing**: Multi-user editing of TLFs
2. **Version Control**: Track TLF changes over time
3. **Regulatory Package**: Auto-generate submission packages
4. **Machine Learning**: Learn from user corrections

## Troubleshooting

### Common Issues

**1. File Upload Fails**
- Check file size limits
- Verify file format is supported
- Ensure proper multipart/form-data encoding

**2. Low Confidence Score**
- Upload clearer mockshell
- Add more context in additional_context field
- Use standard mockshell formats

**3. Generation Timeout**
- Increase LLM timeout settings
- Simplify mockshell structure
- Check LLM provider status

**4. Incorrect Understanding**
- Use re-upload feature
- Provide more detailed context
- Modify understanding manually before approval

## Performance Considerations

### Backend
- **LLM Latency**: 2-10 seconds for analysis
- **File Processing**: < 1 second for most files
- **Session Storage**: O(1) lookup with proper indexing

### Frontend
- **Initial Load**: Lazy loading of components
- **File Upload**: Progress indication for large files
- **Rendering**: Efficient React rendering with hooks

## Security Considerations

1. **File Validation**: Strict file type and size validation
2. **Session Security**: UUID-based session IDs
3. **Authentication**: JWT token-based auth (to be implemented)
4. **Input Sanitization**: All user inputs validated
5. **XSS Prevention**: Careful use of dangerouslySetInnerHTML

## Testing Strategy

### Backend Tests
- Unit tests for service methods
- Integration tests for API endpoints
- Mock LLM responses for consistency
- File upload edge cases

### Frontend Tests
- Component rendering tests
- User interaction flows
- Upload workflow tests
- Error handling tests

## Deployment

### Backend Deployment
```bash
# Navigate to backend
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations (if using DB)
alembic upgrade head

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Deployment
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Serve with nginx or similar
```

## Monitoring & Logging

### Key Metrics
- API response times
- LLM success/failure rates
- Session completion rates
- User satisfaction scores

### Logs
- All LLM interactions logged
- File uploads tracked
- Session lifecycle events
- Error traces with stack traces

## Conclusion

The TLF Generator represents a significant advancement in automated statistical output generation. By leveraging AI to understand mockshell documents, it dramatically reduces the time and effort required to create ADAM Tables, Listings, and Figures while maintaining high quality and compliance standards.

---

**Version**: 1.0.0
**Last Updated**: November 29, 2025
**Maintained By**: ADAM AI Development Team



