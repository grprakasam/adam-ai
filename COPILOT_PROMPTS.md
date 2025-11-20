# Quick Copilot Prompts for ADAM AI

Instead of custom slash commands, use these prompts in GitHub Copilot Chat:

## Code Quality & Review

**Code Review:**
```
Review this code for best practices, bugs, performance, security, and maintainability. Provide specific suggestions with examples.
```

**Explain Code:**
```
Explain this code in detail: what it does, how it works, key concepts, and potential edge cases.
```

**Optimize:**
```
Analyze this code for performance, memory efficiency, and algorithmic improvements. Provide refactored code.
```

**Refactor:**
```
Refactor this code to improve structure, naming, decomposition, and follow SOLID/DRY principles.
```

**Fix Bugs:**
```
Identify and fix bugs including logic errors, type errors, null handling, edge cases, and resource leaks.
```

## Testing & Documentation

**Add Tests:**
```
Generate comprehensive unit tests covering all functionality, edge cases, and error handling.
```

**Add Documentation:**
```
Generate comprehensive documentation including function descriptions, parameters, return values, and usage examples.
```

## Conversions

**To TypeScript:**
```
Convert this JavaScript to TypeScript with proper type annotations, interfaces, and strict mode compatibility.
```

**To Python:**
```
Convert this code to Python following PEP 8, with type hints and docstrings.
```

## Security & Design

**Security Audit:**
```
Perform a security audit checking for SQL injection, XSS, auth issues, input validation, and sensitive data exposure.
```

**API Design:**
```
Review this API for RESTful principles, naming conventions, HTTP methods, error handling, and documentation.
```

**Database Schema:**
```
Review this database schema for normalization, indexes, constraints, relationships, and performance.
```

## ADAM-Specific

**ADAM Review:**
```
Review this ADAM dataset code for CDISC ADaM IG compliance, variable naming, required variables, derivation logic, metadata, and SDTM traceability.
```

## Development

**Create Component:**
```
Create a React component with TypeScript, proper prop types, JSDoc, best practices, styling, and accessibility.
```

**Git Commit Message:**
```
Generate a conventional commit message for these changes using the format: type(scope): subject
```

## Pro Tips

1. **Select code first** before running prompts for context-specific analysis
2. **Use @workspace** to include workspace context in your prompts
3. **Use @file** to reference specific files
4. **Combine prompts** for complex tasks

Example:
```
@workspace Review this code for CDISC ADaM compliance and security issues. Focus on the dataset generation logic.
```
