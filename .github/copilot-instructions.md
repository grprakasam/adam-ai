# GitHub Copilot Instructions for ADAM AI Project

## Project Context
This is an ADAM AI project for generating CDISC-compliant ADaM datasets for clinical trial data analysis.

## Key Technologies
- Backend: Python with FastAPI
- Frontend: React with TypeScript
- Database: PostgreSQL
- API: RESTful with JWT authentication
- Standards: CDISC ADaM Implementation Guide

## Code Review Guidelines

When reviewing code, always check for:

1. **CDISC Compliance** (for ADAM-related code):
   - Variable naming follows ADaM conventions
   - Required variables are present (STUDYID, USUBJID, etc.)
   - Derivation logic is correct and traceable
   - Metadata is complete

2. **Security**:
   - Input validation
   - SQL injection prevention
   - XSS protection
   - Authentication/authorization checks
   - Sensitive data handling

3. **Performance**:
   - Database query optimization
   - API response efficiency
   - Memory management
   - Caching strategies

4. **Code Quality**:
   - Follow Python PEP 8 / TypeScript best practices
   - Proper error handling
   - Clear naming conventions
   - DRY principles
   - Type safety

5. **Testing**:
   - Unit test coverage
   - Integration tests
   - Edge case handling

## Common Tasks

### For ADAM Dataset Code
- Verify CDISC ADaM IG compliance
- Check variable derivations against specifications
- Ensure traceability to SDTM
- Validate metadata completeness

### For API Development
- Use RESTful conventions
- Implement proper error responses
- Add request/response validation
- Include comprehensive logging

### For React Components
- Use TypeScript with strict types
- Follow React best practices
- Implement proper error boundaries
- Ensure accessibility (ARIA)

## Documentation Standards
- Add JSDoc for TypeScript/JavaScript
- Add docstrings for Python (Google style)
- Include usage examples
- Document edge cases and limitations
