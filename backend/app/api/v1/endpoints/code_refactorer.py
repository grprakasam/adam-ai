"""
Code Refactorer API Endpoint
Provides AI-powered code analysis and optimization for SAS and R clinical programming code.
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from loguru import logger

from app.modules.llm_integration.service import (
    get_llm_service,
    LLMProviderError,
    LLMRateLimitError,
    LLMConnectionError,
)

router = APIRouter(prefix="/code-refactorer", tags=["code-refactorer"])


class CodeRefactorRequest(BaseModel):
    """Request model for code refactoring"""
    code: str = Field(..., min_length=1, description="The code to analyze and refactor")
    language: Literal["SAS", "R"] = Field(..., description="Programming language")


class Suggestion(BaseModel):
    """A single optimization suggestion"""
    id: int
    type: Literal["performance", "readability", "best-practice"]
    title: str
    description: str
    impact: str
    original_code: Optional[str] = None
    suggested_code: Optional[str] = None


class CodeRefactorResponse(BaseModel):
    """Response model for code refactoring"""
    optimized_code: str
    suggestions: List[Suggestion]
    optimization_score: int = Field(..., ge=0, le=100)
    improvement_percentage: int = Field(..., ge=0)



def build_refactor_prompt(code: str, language: str) -> str:
    """Build the prompt for code refactoring with system context"""
    system_context = """You are an expert clinical programmer specializing in SAS and R programming for pharmaceutical and clinical trial data analysis. Your expertise includes:
- CDISC standards (SDTM, ADaM, Define-XML)
- ADAM Implementation Guide (IG) best practices
- Regulatory submission requirements (FDA, EMA)
- Performance optimization for large clinical datasets
- Clean code practices and documentation standards

When analyzing code, focus on:
1. **Performance**: Identify inefficient patterns (nested loops, sequential reads) and suggest optimizations (HASH objects in SAS, vectorized operations in R)
2. **Readability**: Suggest better variable naming, add missing labels, improve code structure
3. **Best Practices**: Ensure CDISC compliance, proper LENGTH/FORMAT statements, explicit variable typing
"""
    
    task_prompt = f"""Analyze and optimize the following {language} clinical programming code.

**Code to Analyze:**
```{language.lower()}
{code}
```

**Your Task:**
1. Analyze the code for performance issues, readability problems, and best practice violations
2. Generate an optimized version of the code
3. Provide specific suggestions with impact estimates

**Response Format (JSON):**
{{
    "optimized_code": "// The complete optimized code here",
    "suggestions": [
        {{
            "id": 1,
            "type": "performance|readability|best-practice",
            "title": "Short title describing the issue",
            "description": "Detailed explanation of the issue and how the fix improves it",
            "impact": "Expected impact, e.g., '+30% faster', 'Improved documentation', '100% CDISC compliant'"
        }}
    ],
    "optimization_score": 85,
    "improvement_percentage": 25
}}

Provide at least 2-5 actionable suggestions. Focus on clinical programming best practices.
Return ONLY valid JSON, no markdown code blocks or additional text."""
    
    return f"{system_context}\n\n{task_prompt}"


def parse_llm_response(response_content: str) -> dict:
    """Parse the LLM response JSON"""
    import json
    import re

    # Clean up the response - remove markdown code blocks if present
    content = response_content.strip()

    # Remove markdown code block if present
    if content.startswith("```"):
        # Find the end of the opening code block marker
        first_newline = content.find("\n")
        if first_newline != -1:
            content = content[first_newline + 1:]
        # Remove closing code block
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

    # Try to find JSON object in the response
    json_match = re.search(r'\{[\s\S]*\}', content)
    if json_match:
        content = json_match.group()

    try:
        # Try parsing with strict=False to handle control characters more gracefully
        return json.loads(content, strict=False)
    except json.JSONDecodeError as e:
        # If that fails, try to fix common JSON issues
        logger.warning(f"Initial JSON parse failed, attempting to fix: {e}")
        try:
            # Replace unescaped newlines, tabs, and carriage returns with escaped versions
            # This fixes LLM responses that include literal newlines in JSON strings
            fixed_content = content.replace('\n', '\\n').replace('\r', '\\r').replace('\t', '\\t')

            # Try again with the fixed content
            return json.loads(fixed_content, strict=False)
        except Exception as fix_error:
            # Last resort: log and raise original error
            logger.error(f"Failed to parse LLM response as JSON even after fixing: {fix_error}")
            logger.error(f"Original error: {e}")
            logger.error(f"Response content: {content[:500]}...")
            raise ValueError(f"Invalid JSON response from LLM: {e}")


@router.post("/analyze", response_model=CodeRefactorResponse)
async def analyze_and_refactor_code(request: CodeRefactorRequest):
    """
    Analyze and refactor SAS or R code using AI.
    
    This endpoint makes a real LLM API call to analyze the provided code
    and return optimization suggestions with an improved version of the code.
    """
    logger.info(f"🔧 Code refactoring request received: {request.language}, {len(request.code)} chars")
    
    try:
        # Get the LLM service instance
        llm_service = get_llm_service()
        
        # Build the prompt
        prompt = build_refactor_prompt(request.code, request.language)
        
        # Make the LLM API call
        logger.info(f"📤 Sending code to LLM for analysis...")
        response = await llm_service.generate(
            prompt=prompt,
            temperature=0.3,  # Lower temperature for more consistent code output
            max_tokens=4000   # Allow enough tokens for code + suggestions
        )
        
        logger.info(f"📥 LLM response received: {response['usage']['total_tokens']} tokens used")
        
        # Parse the response
        try:
            result = parse_llm_response(response["content"])
        except ValueError as e:
            logger.error(f"Failed to parse LLM response: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to parse AI response. Please try again."
            )
        
        # Validate and build response
        suggestions = []
        for i, sugg in enumerate(result.get("suggestions", []), 1):
            suggestions.append(Suggestion(
                id=sugg.get("id", i),
                type=sugg.get("type", "best-practice"),
                title=sugg.get("title", "Optimization suggestion"),
                description=sugg.get("description", ""),
                impact=sugg.get("impact", "Improvement"),
                original_code=sugg.get("original_code"),
                suggested_code=sugg.get("suggested_code")
            ))
        
        # Ensure we have the optimized code
        optimized_code = result.get("optimized_code", request.code)
        if not optimized_code or len(optimized_code.strip()) == 0:
            optimized_code = request.code  # Fallback to original if empty
        
        response_data = CodeRefactorResponse(
            optimized_code=optimized_code,
            suggestions=suggestions,
            optimization_score=min(100, max(0, result.get("optimization_score", 75))),
            improvement_percentage=min(100, max(0, result.get("improvement_percentage", 20)))
        )
        
        logger.info(f"✅ Code refactoring complete: {len(suggestions)} suggestions, score: {response_data.optimization_score}")
        return response_data
        
    except LLMRateLimitError as e:
        logger.error(f"❌ Rate limit exceeded during code refactoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="AI service rate limit exceeded. Please wait a moment and try again."
        )
    
    except LLMConnectionError as e:
        logger.error(f"❌ Connection error during code refactoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to connect to AI service. Please check your connection and try again."
        )
    
    except LLMProviderError as e:
        logger.error(f"❌ LLM provider error during code refactoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"AI service error: {str(e)}"
        )
    
    except Exception as e:
        logger.error(f"❌ Unexpected error during code refactoring: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Check if the code refactorer service is available"""
    try:
        llm_service = get_llm_service()
        provider_info = await llm_service.get_provider_info()
        return {
            "status": "healthy",
            "provider": provider_info.get("provider", "unknown"),
            "model": provider_info.get("model", "unknown")
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
