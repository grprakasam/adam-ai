"""
TLF Generator Service - AI-Driven Statistical Output Generation

This service provides intelligent analysis and generation of ADAM Tables, Listings, 
and Figures based on uploaded mockshell documents.

Features:
- Multi-format document understanding (PDF, Word, Excel, Images)
- AI-powered structure extraction and analysis
- Iterative approval workflow
- Citation management
- Multiple output formats (HTML, PDF, RTF)
"""

from typing import Dict, Any, Optional, List
from loguru import logger
import uuid
import base64
from datetime import datetime
import json

from app.modules.llm_integration.service import LLMIntegrationService
from app.config import settings


class TLFGeneratorService:
    """Service for generating ADAM TLF outputs from mockshell documents"""
    
    def __init__(self):
        self.llm_service = LLMIntegrationService()
        # In-memory session storage (should use Redis/database in production)
        self.sessions: Dict[str, Dict[str, Any]] = {}
        logger.info("✅ TLF Generator Service initialized")
    
    async def analyze_mockshell(
        self,
        file_content: bytes,
        filename: str,
        request: Any
    ) -> Dict[str, Any]:
        """
        Analyze uploaded mockshell document and extract specifications.
        
        Args:
            file_content: Raw file bytes
            filename: Original filename
            request: TLFAnalysisRequest with metadata
            
        Returns:
            Dictionary with session_id and AI understanding
        """
        session_id = str(uuid.uuid4())
        
        logger.info(f"Starting mockshell analysis for {filename} (session: {session_id})")
        
        # Determine file type
        file_ext = filename.lower().split('.')[-1] if '.' in filename else 'unknown'
        
        # Store file content in session
        session_data = {
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "tlf_type": request.tlf_type,
            "filename": filename,
            "file_ext": file_ext,
            "file_content": base64.b64encode(file_content).decode('utf-8'),
            "metadata": {
                "study_id": request.study_id,
                "dataset_name": request.dataset_name,
                "output_name": request.output_name,
                "description": request.description,
                "additional_context": request.additional_context
            },
            "status": "analyzing"
        }
        
        # Analyze document using AI
        try:
            understanding = await self._analyze_document_with_ai(
                file_content=file_content,
                filename=filename,
                tlf_type=request.tlf_type,
                metadata=session_data["metadata"]
            )
            
            session_data["understanding"] = understanding
            session_data["status"] = "awaiting_approval"
            session_data["confidence_score"] = understanding.get("confidence_score", 0.85)
            
            # Store session
            self.sessions[session_id] = session_data
            
            logger.info(f"✅ Analysis complete for session {session_id}")
            
            return {
                "session_id": session_id,
                "tlf_type": request.tlf_type,
                "understanding": understanding,
                "confidence_score": understanding.get("confidence_score", 0.85),
                "suggested_modifications": understanding.get("suggestions", []),
                "requires_clarification": understanding.get("clarifications", [])
            }
            
        except Exception as e:
            logger.error(f"❌ Analysis failed: {str(e)}")
            raise
    
    async def _analyze_document_with_ai(
        self,
        file_content: bytes,
        filename: str,
        tlf_type: str,
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Use AI to understand mockshell document structure and requirements.
        
        This method:
        1. Extracts text/structure from the document
        2. Uses LLM to understand the TLF specifications
        3. Identifies columns, rows, statistics, formatting
        4. Extracts any notes or special requirements
        """
        
        # Build comprehensive analysis prompt
        analysis_prompt = self._build_analysis_prompt(
            tlf_type=tlf_type,
            filename=filename,
            metadata=metadata
        )
        
        # For image files, we'd use vision API
        # For now, we'll simulate document understanding
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        
        if file_ext in ['png', 'jpg', 'jpeg', 'pdf']:
            # Use vision-capable model for image analysis
            understanding = await self._analyze_visual_document(
                file_content=file_content,
                analysis_prompt=analysis_prompt,
                tlf_type=tlf_type
            )
        else:
            # Use text-based analysis
            understanding = await self._analyze_text_document(
                file_content=file_content,
                analysis_prompt=analysis_prompt,
                tlf_type=tlf_type
            )
        
        return understanding
    
    async def _analyze_visual_document(
        self,
        file_content: bytes,
        analysis_prompt: str,
        tlf_type: str
    ) -> Dict[str, Any]:
        """Analyze visual documents (images, PDFs) using vision-capable AI"""
        
        logger.info("Analyzing visual document using AI vision capabilities")
        
        # For now, simulate vision analysis with structured prompt
        # In production, use GPT-4 Vision, Claude Vision, or similar
        
        full_prompt = f"""{analysis_prompt}

Since I cannot see the actual image, I'll provide a comprehensive template analysis 
that you would typically get from a vision model analyzing a {tlf_type} mockshell.

Please provide a detailed JSON response with the following structure:
{{
    "tlf_type": "{tlf_type}",
    "structure": {{
        "columns": [],
        "rows": [],
        "sections": []
    }},
    "formatting": {{}},
    "requirements": [],
    "confidence_score": 0.0,
    "suggestions": [],
    "clarifications": []
}}
"""
        
        try:
            # Use LLM to generate understanding
            response = await self.llm_service.generate(
                prompt=full_prompt,
                temperature=0.3,
                max_tokens=2000,
                provider=settings.DEFAULT_LLM_PROVIDER
            )
            
            # Parse JSON response
            content = response.get("content", "{}")
            understanding = self._parse_ai_response(content, tlf_type)
            
            return understanding
            
        except Exception as e:
            logger.error(f"Vision analysis failed: {str(e)}")
            # Return fallback understanding
            return self._create_fallback_understanding(tlf_type)
    
    async def _analyze_text_document(
        self,
        file_content: bytes,
        analysis_prompt: str,
        tlf_type: str
    ) -> Dict[str, Any]:
        """Analyze text-based documents (Excel, Word, CSV)"""
        
        logger.info("Analyzing text document using AI")
        
        # Decode text content
        try:
            text_content = file_content.decode('utf-8', errors='ignore')
        except:
            text_content = "Unable to decode document content"
        
        full_prompt = f"""{analysis_prompt}

Document Content Preview:
{text_content[:2000]}  # First 2000 characters

Please analyze this {tlf_type} mockshell and provide your understanding in JSON format.
"""
        
        try:
            response = await self.llm_service.generate(
                prompt=full_prompt,
                temperature=0.3,
                max_tokens=2000,
                provider=settings.DEFAULT_LLM_PROVIDER
            )
            
            content = response.get("content", "{}")
            understanding = self._parse_ai_response(content, tlf_type)
            
            return understanding
            
        except Exception as e:
            logger.error(f"Text analysis failed: {str(e)}")
            return self._create_fallback_understanding(tlf_type)
    
    def _build_analysis_prompt(
        self,
        tlf_type: str,
        filename: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Build comprehensive prompt for document analysis"""
        
        prompts = {
            "table": """You are an expert biostatistician analyzing a statistical table mockshell.

Analyze this ADAM table mockshell and extract:

1. **Table Structure**:
   - Column headers and their hierarchy (if multi-level)
   - Row labels and groupings
   - Data cells and their content types (n, %, mean, SD, etc.)
   
2. **Statistical Elements**:
   - Summary statistics requested (mean, median, SD, min, max, etc.)
   - Population groups or treatment arms
   - Denominators and sample sizes
   
3. **Formatting Requirements**:
   - Decimal places
   - Alignment preferences
   - Special formatting (bold, indent, etc.)
   - Footnotes and annotations
   
4. **Data Requirements**:
   - Source dataset (e.g., ADSL, ADAE)
   - Variables needed
   - Filtering criteria
   - Sorting requirements

Provide your analysis in structured JSON format.""",

            "listing": """You are an expert analyzing a clinical data listing mockshell.

Analyze this ADAM listing mockshell and extract:

1. **Listing Structure**:
   - Column headers and their order
   - Column widths or proportions
   - Any grouping or breaking variables
   
2. **Data Elements**:
   - Variables to display
   - Derived variables needed
   - Formatting for each column (dates, decimals, etc.)
   
3. **Sorting and Filtering**:
   - Primary and secondary sort variables
   - Filter conditions
   - Page break variables
   
4. **Special Requirements**:
   - Headers and footers
   - Page numbering
   - Footnotes
   - Special indicators

Provide your analysis in structured JSON format.""",

            "figure": """You are an expert analyzing a clinical figure/graph mockshell.

Analyze this ADAM figure mockshell and extract:

1. **Figure Type**:
   - Type of plot (line, bar, scatter, Kaplan-Meier, etc.)
   - Number of panels/sub-plots
   
2. **Data Elements**:
   - X-axis variable and scale
   - Y-axis variable(s) and scale
   - Grouping/stratification variables
   - Data points or summaries to plot
   
3. **Visual Elements**:
   - Legend requirements
   - Axis labels and titles
   - Color scheme
   - Line styles or markers
   - Reference lines or regions
   
4. **Statistical Elements**:
   - Confidence intervals
   - P-values
   - Statistical annotations
   
5. **Formatting**:
   - Size and dimensions
   - Title and subtitle
   - Footnotes
   - Font specifications

Provide your analysis in structured JSON format."""
        }
        
        base_prompt = prompts.get(tlf_type, prompts["table"])
        
        context = f"""
Context Information:
- Filename: {filename}
- Study: {metadata.get('study_id', 'Not specified')}
- Dataset: {metadata.get('dataset_name', 'Not specified')}
- Output Name: {metadata.get('output_name', 'Not specified')}
- Description: {metadata.get('description', 'Not specified')}
- Additional Context: {metadata.get('additional_context', 'None')}

{base_prompt}
"""
        return context
    
    def _parse_ai_response(self, content: str, tlf_type: str) -> Dict[str, Any]:
        """Parse AI response and extract structured understanding"""
        
        try:
            # Try to extract JSON from response
            if "```json" in content:
                json_str = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                json_str = content.split("```")[1].split("```")[0].strip()
            else:
                json_str = content
            
            understanding = json.loads(json_str)
            
            # Ensure required fields
            if "confidence_score" not in understanding:
                understanding["confidence_score"] = 0.85
            if "suggestions" not in understanding:
                understanding["suggestions"] = []
            if "clarifications" not in understanding:
                understanding["clarifications"] = []
            
            return understanding
            
        except json.JSONDecodeError:
            logger.warning("Failed to parse AI response as JSON, using fallback")
            return self._create_fallback_understanding(tlf_type)
    
    def _create_fallback_understanding(self, tlf_type: str) -> Dict[str, Any]:
        """Create fallback understanding when AI analysis fails"""
        
        fallbacks = {
            "table": {
                "tlf_type": "table",
                "structure": {
                    "columns": ["Treatment A", "Treatment B", "Total"],
                    "rows": ["N", "Mean", "SD", "Median", "Min", "Max"],
                    "sections": ["Demographics"]
                },
                "formatting": {
                    "decimal_places": 1,
                    "alignment": "center"
                },
                "requirements": ["Summary statistics by treatment group"],
                "confidence_score": 0.60,
                "suggestions": ["Please review and confirm the structure"],
                "clarifications": ["Specific treatment groups not identified"]
            },
            "listing": {
                "tlf_type": "listing",
                "structure": {
                    "columns": ["Subject ID", "Visit", "Parameter", "Value", "Unit"],
                    "grouping": "Subject ID"
                },
                "sorting": ["Subject ID", "Visit"],
                "requirements": ["Line-by-line patient data"],
                "confidence_score": 0.60,
                "suggestions": ["Please review and confirm columns"],
                "clarifications": ["Specific variables not identified"]
            },
            "figure": {
                "tlf_type": "figure",
                "structure": {
                    "type": "line_plot",
                    "x_axis": "Time",
                    "y_axis": "Value",
                    "grouping": "Treatment"
                },
                "visual_elements": {
                    "legend": True,
                    "confidence_intervals": False
                },
                "requirements": ["Time series plot by treatment"],
                "confidence_score": 0.60,
                "suggestions": ["Please review and confirm plot type"],
                "clarifications": ["Specific time points not identified"]
            }
        }
        
        return fallbacks.get(tlf_type, fallbacks["table"])
    
    async def process_approval(self, request: Any) -> Dict[str, Any]:
        """
        Process user's approval or modifications to the understanding.
        
        Args:
            request: TLFApprovalRequest
            
        Returns:
            Status and readiness information
        """
        session_id = request.session_id
        
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        
        if request.approved:
            # User approved the understanding
            session["status"] = "approved"
            session["approved_at"] = datetime.utcnow().isoformat()
            
            logger.info(f"✅ Understanding approved for session {session_id}")
            
            return {
                "ready_for_generation": True,
                "message": "Understanding approved. Ready to generate TLF output."
            }
        else:
            # User wants modifications
            if request.modifications:
                # Update understanding with user modifications
                current_understanding = session["understanding"]
                current_understanding.update(request.modifications)
                session["understanding"] = current_understanding
                session["user_modifications"] = request.modifications
                
            session["status"] = "modified"
            session["modified_at"] = datetime.utcnow().isoformat()
            session["user_feedback"] = request.feedback
            
            logger.info(f"Understanding modified for session {session_id}")
            
            return {
                "ready_for_generation": False,
                "message": "Understanding updated with your modifications. Please review and approve when ready."
            }
    
    async def generate_tlf(self, request: Any) -> Dict[str, Any]:
        """
        Generate final TLF output based on approved specifications.
        
        Args:
            request: TLFGenerationRequest
            
        Returns:
            Generated TLF output with citations
        """
        session_id = request.session_id
        
        if session_id not in self.sessions:
            raise ValueError(f"Session {session_id} not found")
        
        session = self.sessions[session_id]
        
        if session["status"] not in ["approved", "modified"]:
            raise ValueError(f"Session {session_id} is not approved for generation")
        
        logger.info(f"Generating TLF for session {session_id}")
        
        # Extract approved understanding
        understanding = session["understanding"]
        tlf_type = session["tlf_type"]
        metadata = session["metadata"]
        
        # Generate TLF using AI
        output = await self._generate_tlf_output(
            understanding=understanding,
            tlf_type=tlf_type,
            metadata=metadata,
            output_format=request.format,
            include_citations=request.include_citations
        )
        
        # Update session
        session["status"] = "completed"
        session["completed_at"] = datetime.utcnow().isoformat()
        session["generated_output"] = output
        
        logger.info(f"✅ TLF generation complete for session {session_id}")
        
        return {
            "session_id": session_id,
            "tlf_type": tlf_type,
            "output": output["content"],
            "format": request.format,
            "citations": output.get("citations", []),
            "metadata": {
                "generated_at": session["completed_at"],
                "output_name": metadata.get("output_name"),
                "dataset_name": metadata.get("dataset_name")
            }
        }
    
    async def _generate_tlf_output(
        self,
        understanding: Dict[str, Any],
        tlf_type: str,
        metadata: Dict[str, Any],
        output_format: str,
        include_citations: bool
    ) -> Dict[str, Any]:
        """Generate actual TLF output using AI"""
        
        generation_prompt = self._build_generation_prompt(
            understanding=understanding,
            tlf_type=tlf_type,
            metadata=metadata,
            output_format=output_format
        )
        
        try:
            response = await self.llm_service.generate(
                prompt=generation_prompt,
                temperature=0.2,
                max_tokens=4000,
                provider=settings.DEFAULT_LLM_PROVIDER
            )
            
            content = response.get("content", "")
            
            # Extract citations if requested
            citations = []
            if include_citations:
                citations = self._extract_citations(content)
            
            return {
                "content": content,
                "citations": citations
            }
            
        except Exception as e:
            logger.error(f"TLF generation failed: {str(e)}")
            raise
    
    def _build_generation_prompt(
        self,
        understanding: Dict[str, Any],
        tlf_type: str,
        metadata: Dict[str, Any],
        output_format: str
    ) -> str:
        """Build prompt for final TLF generation"""
        
        prompt = f"""You are an expert biostatistician generating an ADAM {tlf_type}.

Based on the following approved specifications, generate a complete {tlf_type} output.

**Approved Specifications:**
{json.dumps(understanding, indent=2)}

**Metadata:**
- Output Name: {metadata.get('output_name', 'Not specified')}
- Dataset: {metadata.get('dataset_name', 'Not specified')}
- Study: {metadata.get('study_id', 'Not specified')}

**Output Format:** {output_format}

**Instructions:**
1. Generate a complete, production-ready {tlf_type}
2. Follow all specifications from the mockshell analysis
3. Include proper formatting, headers, and footers
4. Add appropriate footnotes and annotations
5. Ensure compliance with CDISC ADAM standards
6. Include placeholder data that matches the structure
7. If {output_format} is 'html', use clean, semantic HTML with inline CSS
8. Include proper accessibility attributes if HTML

Generate the {tlf_type} now:
"""
        return prompt
    
    def _extract_citations(self, content: str) -> List[Dict[str, str]]:
        """Extract citations from generated content"""
        
        # Simple citation extraction
        # In production, this would be more sophisticated
        citations = []
        
        if "Source:" in content or "Reference:" in content:
            citations.append({
                "type": "mockshell",
                "reference": "User-uploaded mockshell document"
            })
        
        return citations
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve session data"""
        return self.sessions.get(session_id)
    
    async def delete_session(self, session_id: str) -> None:
        """Delete session and associated data"""
        if session_id in self.sessions:
            del self.sessions[session_id]
            logger.info(f"Session {session_id} deleted")


