"""
Code Understanding API Endpoint

Accepts SAS or R code and returns AI-generated explanations:
- 2-line summary
- 10-line summary
- Detailed walkthrough
- Visual flow (nodes/edges + text)
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from loguru import logger
import json
import re

from app.modules.llm_integration.service import (
    get_llm_service,
    LLMProviderError,
    LLMRateLimitError,
    LLMConnectionError,
)

router = APIRouter(prefix="/code-understanding", tags=["code-understanding"])


class VisualFlowNode(BaseModel):
    """Node for the visual flow graph"""

    id: str
    label: str
    type: Optional[Literal["input", "transform", "output", "other"]] = "transform"
    description: Optional[str] = None


class VisualFlowEdge(BaseModel):
    """Edge for the visual flow graph"""

    source: str
    target: str
    label: Optional[str] = None


class VisualFlow(BaseModel):
    """Visual flow representation"""

    text_walkthrough: str
    nodes: List[VisualFlowNode] = []
    edges: List[VisualFlowEdge] = []
    mermaid: Optional[str] = None


class CodeUnderstandingRequest(BaseModel):
    """Request model for code understanding"""

    code: str = Field(..., min_length=10, description="SAS or R code to analyze")
    language: Optional[Literal["SAS", "R", "auto"]] = Field(
        "auto", description="Language hint; auto will detect SAS vs R"
    )
    audience: Optional[Literal["non-technical", "developer", "reviewer"]] = Field(
        "non-technical",
        description="Tone/style for the explanation",
    )


class CodeUnderstandingResponse(BaseModel):
    """Response model for code understanding"""

    language_detected: Optional[str] = None
    two_line_summary: str
    ten_line_summary: List[str]
    detailed_summary: str
    key_insights: List[str] = []
    risks: List[str] = []
    assumptions: List[str] = []
    visual_flow: VisualFlow
    tokens_used: Optional[int] = None


class CodeQuestionRequest(BaseModel):
    """Request model for Q&A about the code"""

    code: str = Field(..., min_length=10, description="SAS or R code to analyze")
    question: str = Field(..., min_length=3, description="User question about the code")
    language: Optional[Literal["SAS", "R", "auto"]] = Field(
        "auto", description="Language hint; auto will detect SAS vs R"
    )
    audience: Optional[Literal["non-technical", "developer", "reviewer"]] = Field(
        "non-technical",
        description="Tone/style for the answer",
    )


class CodeQuestionResponse(BaseModel):
    """Response for Q&A"""

    answer: str
    bullets: List[str] = []
    assumptions: List[str] = []
    tokens_used: Optional[int] = None


def _build_prompt(code: str, language: str, audience: str) -> str:
    """Builds the system/user prompt for the LLM"""
    lang_text = "SAS" if language == "SAS" else "R" if language == "R" else "SAS or R"
    audience_text = (
        "Explain like a senior clinical programming tutor speaking to a new hire."
        if audience == "non-technical"
        else "Explain for an experienced developer, concise and precise."
        if audience == "developer"
        else "Explain for a reviewer/stakeholder with limited coding context."
    )

    return f"""
You are an expert clinical programming mentor who teaches SAS and R code with clarity and kindness.
- Prioritize understandability: simple language, crisp bullet points.
- Highlight data flow, key variables, and purpose of each step.
- Keep tone encouraging and confident. Avoid heavy jargon.

Input Code (language hint: {lang_text}):
```
{code}
```

{audience_text}

Return ONLY valid JSON with the exact shape:
{{
  "language_detected": "SAS|R|Unknown",
  "two_line_summary": "Two concise sentences max.",
  "ten_line_summary": ["Line 1", "Line 2", "... up to Line 10"],
  "detailed_summary": "3-6 short paragraphs covering intent, data flow, key derivations, outputs.",
  "key_insights": ["Focus on what matters most for comprehension"],
  "risks": ["Potential errors, edge cases, or data quality concerns"],
  "assumptions": ["Explicit assumptions made when interpreting the code"],
  "visual_flow": {{
    "text_walkthrough": "Stepwise, human-friendly walkthrough of the flow",
    "nodes": [
      {{"id": "n1", "label": "Read DM", "type": "input", "description": "Loads demographic data"}},
      {{"id": "n2", "label": "Filter randomized", "type": "transform", "description": "Keeps randomized subjects"}},
      {{"id": "n3", "label": "Output ADSL", "type": "output", "description": "Final analysis dataset"}}
    ],
    "edges": [
      {{"source": "n1", "target": "n2", "label": "filter"}},
      {{"source": "n2", "target": "n3", "label": "derive"}}
    ],
    "mermaid": "graph TD; n1[Read DM]-->n2[Filter randomized]; n2-->n3[Output ADSL];"
  }},
  "tokens_used": 0
}}

Rules:
- two_line_summary MUST be <= 2 sentences.
- ten_line_summary MUST be 8-10 bullet lines (strings), concise and user-friendly.
- nodes should be <= 10; use descriptive labels; keep IDs short (n1, n2...).
- Edges must reference node IDs that exist.
- If unsure about a step, note the assumption in the assumptions array.
"""


def _build_chat_prompt(code: str, language: str, audience: str, question: str) -> str:
    """Prompt for chat-style Q&A about the uploaded code"""
    lang_text = "SAS" if language == "SAS" else "R" if language == "R" else "SAS or R"
    audience_text = (
        "Explain like a senior clinical programming tutor speaking to a new hire."
        if audience == "non-technical"
        else "Explain for an experienced developer, concise and precise."
        if audience == "developer"
        else "Explain for a reviewer/stakeholder with limited coding context."
    )

    return f"""
You are an expert clinical programming mentor. Answer user questions about the provided {lang_text} code.
- Be concise and structured.
- Prefer short bullet lists when helpful.
- Call out assumptions and potential risks.

Code:
```
{code}
```

Question: "{question}"

{audience_text}

Return ONLY valid JSON:
{{
  "answer": "Short direct answer",
  "bullets": ["Key point 1", "Key point 2"],
  "assumptions": ["If applicable, list them here"],
  "tokens_used": 0
}}
"""


def _parse_json_response(content: str) -> dict:
    """Parse JSON from LLM content safely"""
    text = content.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        text = match.group()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        fixed = text.replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")
        return json.loads(fixed)


@router.post("/analyze", response_model=CodeUnderstandingResponse)
async def analyze_code(request: CodeUnderstandingRequest):
    """
    Analyze SAS/R code and return multi-level summaries plus a visual flow.
    """
    logger.info(
        "🧠 Code understanding request received | lang=%s | chars=%s",
        request.language,
        len(request.code),
    )

    try:
        llm_service = get_llm_service()
        prompt = _build_prompt(request.code, request.language or "auto", request.audience or "non-technical")

        llm_response = await llm_service.generate(
            prompt=prompt,
            temperature=0.25,
            max_tokens=2200,
        )

        content = llm_response.get("content", "")
        parsed = _parse_json_response(content)

        # Build structured visual flow with safe defaults
        vf = parsed.get("visual_flow", {}) or {}
        nodes_raw = vf.get("nodes") or []
        edges_raw = vf.get("edges") or []

        nodes: List[VisualFlowNode] = []
        for idx, node in enumerate(nodes_raw):
            try:
                nodes.append(
                    VisualFlowNode(
                        id=str(node.get("id") or f"n{idx+1}"),
                        label=node.get("label") or f"Step {idx+1}",
                        type=node.get("type") or "transform",
                        description=node.get("description"),
                    )
                )
            except Exception:
                continue

        edges: List[VisualFlowEdge] = []
        for edge in edges_raw:
            try:
                edges.append(
                    VisualFlowEdge(
                        source=str(edge.get("source")),
                        target=str(edge.get("target")),
                        label=edge.get("label"),
                    )
                )
            except Exception:
                continue

        response_payload = CodeUnderstandingResponse(
            language_detected=parsed.get("language_detected"),
            two_line_summary=parsed.get("two_line_summary", "No summary returned."),
            ten_line_summary=parsed.get("ten_line_summary", []),
            detailed_summary=parsed.get("detailed_summary", "No details returned."),
            key_insights=parsed.get("key_insights", []),
            risks=parsed.get("risks", []),
            assumptions=parsed.get("assumptions", []),
            visual_flow=VisualFlow(
                text_walkthrough=vf.get(
                    "text_walkthrough",
                    "No visual walkthrough provided.",
                ),
                nodes=nodes,
                edges=edges,
                mermaid=vf.get("mermaid"),
            ),
            tokens_used=llm_response.get("usage", {}).get("total_tokens"),
        )

        logger.info(
            "✅ Code understanding generated | nodes=%s edges=%s",
            len(response_payload.visual_flow.nodes),
            len(response_payload.visual_flow.edges),
        )
        return response_payload

    except (LLMRateLimitError, LLMConnectionError, LLMProviderError) as e:
        logger.error("❌ LLM error during code understanding: %s", e)
        status_code = (
            status.HTTP_429_TOO_MANY_REQUESTS
            if isinstance(e, LLMRateLimitError)
            else status.HTTP_503_SERVICE_UNAVAILABLE
            if isinstance(e, LLMConnectionError)
            else status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        detail = (
            "AI service rate limit exceeded. Please retry shortly."
            if isinstance(e, LLMRateLimitError)
            else "Unable to connect to AI service. Please try again."
            if isinstance(e, LLMConnectionError)
            else f"AI provider error: {str(e)}"
        )
        raise HTTPException(status_code=status_code, detail=detail)

    except Exception as e:  # pragma: no cover - safety net
        logger.exception("Unexpected error during code understanding")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}",
        )


@router.post("/chat", response_model=CodeQuestionResponse)
async def chat_about_code(request: CodeQuestionRequest):
    """
    Answer user questions about the provided code using the same AI context.
    """
    logger.info(
        "💬 Code understanding chat | lang=%s | qchars=%s | codechars=%s",
        request.language,
        len(request.question),
        len(request.code),
    )

    try:
        llm_service = get_llm_service()
        prompt = _build_chat_prompt(
            request.code,
            request.language or "auto",
            request.audience or "non-technical",
            request.question,
        )

        llm_response = await llm_service.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=1200,
        )

        parsed = _parse_json_response(llm_response.get("content", ""))

        return CodeQuestionResponse(
            answer=parsed.get("answer", "No answer returned."),
            bullets=parsed.get("bullets", []),
            assumptions=parsed.get("assumptions", []),
            tokens_used=llm_response.get("usage", {}).get("total_tokens"),
        )

    except (LLMRateLimitError, LLMConnectionError, LLMProviderError) as e:
        logger.error("❌ LLM error during code chat: %s", e)
        status_code = (
            status.HTTP_429_TOO_MANY_REQUESTS
            if isinstance(e, LLMRateLimitError)
            else status.HTTP_503_SERVICE_UNAVAILABLE
            if isinstance(e, LLMConnectionError)
            else status.HTTP_500_INTERNAL_SERVER_ERROR
        )
        detail = (
            "AI service rate limit exceeded. Please retry shortly."
            if isinstance(e, LLMRateLimitError)
            else "Unable to connect to AI service. Please try again."
            if isinstance(e, LLMConnectionError)
            else f"AI provider error: {str(e)}"
        )
        raise HTTPException(status_code=status_code, detail=detail)

    except Exception as e:  # pragma: no cover - safety net
        logger.exception("Unexpected error during code chat")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {e}",
        )


@router.get("/health")
async def health_check():
    """Health check for code understanding service"""
    try:
        llm_service = get_llm_service()
        provider_info = await llm_service.get_provider_info()
        return {
            "status": "healthy",
            "provider": provider_info.get("provider", "unknown"),
            "model": provider_info.get("model", "unknown"),
        }
    except Exception as e:  # pragma: no cover - safety net
        return {"status": "unhealthy", "error": str(e)}

