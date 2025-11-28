---
description: Create a critical infrastructure review identifying production deployment issues and technical solutions
---

# Production Infrastructure Review & Issue Identification

You are tasked with creating a comprehensive **infrastructure and technical readiness review** for the ADAM AI application.

## Your Task

**Simulate a production environment** for this clinical trials application and conduct a thorough technical analysis:

### 1. Production Infrastructure Issues (10 scenarios)
Identify 10 different scenarios where the application may fail or not work as expected in a production environment. Focus on:
- Performance bottlenecks
- Scalability issues
- Resource exhaustion (memory, CPU, disk)
- Concurrency problems
- Security vulnerabilities
- Data integrity issues
- Deployment challenges
- Monitoring gaps
- Database issues
- API reliability

### 2. Technical Integration Issues (5 scenarios)
Identify 5 different scenarios where the application may fail in technical aspects for real-world deployment. Focus on:
- LLM provider failures/rate limits
- Database connection issues
- File system problems
- External API dependencies
- Network/connectivity issues

### 3. For Each Issue Identified:
Provide:
- **Issue Title**: Clear, descriptive name
- **Root Cause**: Technical explanation of why this happens
- **Impact**: Severity and business consequences
- **Proposed Solution**: Detailed technical fix with implementation steps
- **Priority**: CRITICAL, HIGH, MEDIUM, or LOW

## Output Requirements

Create a **crisp, simple, and easy-to-follow** review report in `Context/My_Production_Review_Report.md` with the following structure:

```markdown
# Production Readiness Review Report
**Date**: [Current Date]
**Application**: ADAM AI - Clinical Trials Code Generation Platform

## Executive Summary
[3-5 sentences summarizing findings]

## Part 1: Production Infrastructure Issues (10)

### Issue #1: [Title]
- **Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
- **Root Cause**: [Explanation]
- **Impact**: [Consequences]
- **Proposed Solution**: [Detailed fix]
- **Implementation Effort**: [Hours/Days]

[Repeat for all 10 infrastructure issues]

## Part 2: Technical Integration Issues (5)

### Issue #1: [Title]
- **Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
- **Root Cause**: [Explanation]
- **Impact**: [Consequences]
- **Proposed Solution**: [Detailed fix]
- **Implementation Effort**: [Hours/Days]

[Repeat for all 5 integration issues]

## Implementation Roadmap
[3-phase plan with priorities and timelines]

## Conclusion
[Summary and recommendations]
```

## Important Guidelines

1. **Be specific**: Use actual code references, file paths, and technical details from the codebase
2. **Be realistic**: Base issues on actual production failure patterns in clinical trials software
3. **Be actionable**: Every solution should be implementable with clear steps
4. **Be concise**: Keep each issue description to 1 paragraph max
5. **Prioritize**: Focus on issues that would cause the most harm in production

## Investigation Process

1. **Read key application files** to understand architecture
2. **Identify critical paths** (code generation, SDTM generation, LLM integration, validation)
3. **Simulate production load** scenarios mentally
4. **Think about edge cases** and failure modes
5. **Consider regulatory requirements** (21 CFR Part 11, CDISC, FDA)

Start by exploring the codebase to identify the most critical production risks.


