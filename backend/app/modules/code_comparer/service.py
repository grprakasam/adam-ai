"""
Code Comparer Service

Orchestrates code comparison pipeline:
1. Preprocessing & validation
2. Static diff computation
3. Syntax checking
4. AI-powered categorization (optional)
5. ADaM domain mapping (Deep mode only)
"""

import asyncio
import hashlib
import time
from typing import List, Optional, Dict, Any
from loguru import logger

from .schemas import (
    CodeComparisonRequest,
    CodeComparisonResult,
    Difference,
    SyntaxIssue,
    ComplianceIssue,
    AdamInsights,
    ComparisonOptions,
)
from .diff_engine import DiffEngine, DiffResult
from .syntax_checker import SyntaxChecker
from ..llm_integration.service import get_llm_service
# CDISCRuleEngine import - optional, will be None if not available
try:
    from ..cdisc_rules.rule_engine import CDISCRuleEngine
except ImportError:
    CDISCRuleEngine = None


# Timeouts per stage
TIMEOUT_DIFF = 2  # seconds
TIMEOUT_SYNTAX = 1  # seconds
TIMEOUT_AI_CATEGORIZATION = 10  # seconds
TIMEOUT_ADAM_ANALYSIS = 15  # seconds


class CodeComparerService:
    """
    Main service for code comparison.
    
    Handles the complete comparison pipeline with graceful degradation.
    """
    
    def __init__(self):
        self.diff_engine = DiffEngine()
        self.syntax_checker = SyntaxChecker()
        self.llm_service = get_llm_service()
        self.rule_engine = CDISCRuleEngine() if CDISCRuleEngine is not None else None
    
    async def compare(self, request: CodeComparisonRequest) -> CodeComparisonResult:
        """
        Compare two code snippets and return detailed analysis.
        
        Args:
            request: CodeComparisonRequest with codes and options
            
        Returns:
            CodeComparisonResult with similarity scores and differences
        """
        start_time = time.time()
        
        try:
            # 1. Preprocess codes
            code1_norm, code2_norm = self._preprocess(
                request.code_1,
                request.code_2,
                request.options
            )
            
            # Detect languages if auto
            language1 = self._detect_language(request.code_1, request.language_1)
            language2 = self._detect_language(request.code_2, request.language_2)
            
            # 2. Static diff (always runs, <1s)
            try:
                diff_result = await asyncio.wait_for(
                    asyncio.to_thread(self.diff_engine.compute, code1_norm, code2_norm),
                    timeout=TIMEOUT_DIFF
                )
                similarity_score = diff_result.similarity_ratio * 100
            except asyncio.TimeoutError:
                logger.warning("Diff computation timeout")
                raise ValueError("Diff computation exceeded maximum time")
            
            # 3. Syntax check (parallel, <500ms)
            syntax_issues = []
            try:
                syntax_results = await asyncio.wait_for(
                    asyncio.gather(
                        self.syntax_checker.check_r(request.code_1) if language1 == 'r' 
                        else self.syntax_checker.check_sas(request.code_1),
                        self.syntax_checker.check_r(request.code_2) if language2 == 'r'
                        else self.syntax_checker.check_sas(request.code_2),
                    ),
                    timeout=TIMEOUT_SYNTAX
                )
                # Set correct side for syntax issues
                for issue in syntax_results[0]:
                    issue.side = "code1"
                for issue in syntax_results[1]:
                    issue.side = "code2"
                syntax_issues = syntax_results[0] + syntax_results[1]
            except asyncio.TimeoutError:
                logger.warning("Syntax check timeout, proceeding without syntax validation")
            except Exception as e:
                logger.warning(f"Syntax check failed: {e}, proceeding anyway")
            
            # 4. AI categorization (Standard & Deep modes)
            differences = []
            llm_used = False
            if request.comparison_mode in ["standard", "deep"]:
                try:
                    differences = await asyncio.wait_for(
                        self._categorize_with_ai(
                            diff_result,
                            request.code_1,
                            request.code_2,
                            language1,
                            language2
                        ),
                        timeout=TIMEOUT_AI_CATEGORIZATION
                    )
                    llm_used = True
                except asyncio.TimeoutError:
                    logger.warning("AI categorization timeout, using basic categorization")
                    differences = self._basic_categorization(diff_result)
                except Exception as e:
                    logger.warning(f"AI categorization failed: {e}, using basic categorization")
                    differences = self._basic_categorization(diff_result)
            else:
                differences = self._basic_categorization(diff_result)
            
            # 5. ADaM domain mapping (Deep mode only)
            adam_insights = None
            if request.comparison_mode == "deep" and request.context:
                try:
                    adam_insights = await asyncio.wait_for(
                        self._analyze_adam_domain(
                            differences,
                            request.context.study_id,
                            request.context.dataset,
                        ),
                        timeout=TIMEOUT_ADAM_ANALYSIS
                    )
                except asyncio.TimeoutError:
                    logger.warning("ADaM analysis timeout")
                except Exception as e:
                    logger.warning(f"ADaM analysis failed: {e}")
            
            # 6. Assemble result
            execution_time_ms = int((time.time() - start_time) * 1000)
            
            return CodeComparisonResult(
                overall_similarity_score=similarity_score,
                classification_label=self._classify_similarity(similarity_score),
                subscores=self._compute_subscores(diff_result, differences),
                summary=self._generate_summary(differences),
                differences=differences,
                adam_insights=adam_insights,
                syntax_issues=syntax_issues,
                metadata={
                    "comparison_mode": request.comparison_mode,
                    "language_1": language1,
                    "language_2": language2,
                    "execution_time_ms": execution_time_ms,
                    "llm_used": llm_used,
                }
            )
        
        except Exception as e:
            logger.error(f"Code comparison failed: {e}", exc_info=True)
            raise
    
    def _preprocess(self, code1: str, code2: str, options: ComparisonOptions) -> tuple[str, str]:
        """Preprocess codes based on options"""
        code1_norm = code1
        code2_norm = code2
        
        if options.ignore_whitespace:
            # Normalize whitespace
            code1_norm = '\n'.join(line.rstrip() for line in code1_norm.splitlines())
            code2_norm = '\n'.join(line.rstrip() for line in code2_norm.splitlines())
        
        if options.ignore_comments:
            # Remove comments (basic implementation)
            code1_norm = self._remove_comments(code1_norm)
            code2_norm = self._remove_comments(code2_norm)
        
        if not options.case_sensitive:
            # Case-insensitive comparison
            code1_norm = code1_norm.lower()
            code2_norm = code2_norm.lower()
        
        return code1_norm, code2_norm
    
    def _remove_comments(self, code: str) -> str:
        """Remove comments from code (basic implementation)"""
        lines = code.splitlines()
        cleaned = []
        for line in lines:
            # Remove SAS comments (* and /* */)
            if line.strip().startswith('*'):
                continue
            # Remove inline comments (basic)
            if '/*' in line:
                # Simple removal, doesn't handle nested comments
                import re
                line = re.sub(r'/\*.*?\*/', '', line)
            cleaned.append(line)
        return '\n'.join(cleaned)
    
    def _detect_language(self, code: str, language: str) -> str:
        """Detect language if auto"""
        if language != "auto":
            return language
        
        # Simple heuristics
        code_lower = code.lower()
        if any(keyword in code_lower for keyword in ['data ', 'proc ', 'run;', 'quit;']):
            return "sas"
        elif any(keyword in code_lower for keyword in ['<-', 'library(', 'function(', '%>%']):
            return "r"
        else:
            return "sas"  # Default
    
    def _basic_categorization(self, diff_result: DiffResult) -> List[Difference]:
        """Basic categorization without AI"""
        differences = []
        
        for i, hunk in enumerate(diff_result.diff_hunks):
            diff_id = f"diff_{i+1}"
            
            if hunk.type == 'add':
                diff_type = "style"
                severity = "minor"
                title = "Line added"
                summary = f"Added {len(hunk.code2_lines)} line(s) in code 2"
            elif hunk.type == 'remove':
                diff_type = "style"
                severity = "minor"
                title = "Line removed"
                summary = f"Removed {len(hunk.code1_lines)} line(s) from code 1"
            else:  # change
                diff_type = "logical"
                severity = "important"
                title = "Code modified"
                summary = f"Modified code at line {hunk.code1_start + 1}"
            
            differences.append(Difference(
                id=diff_id,
                type=diff_type,
                severity=severity,
                code1_span={"start_line": hunk.code1_start + 1, "end_line": hunk.code1_end} if hunk.code1_start < hunk.code1_end else None,
                code2_span={"start_line": hunk.code2_start + 1, "end_line": hunk.code2_end} if hunk.code2_start < hunk.code2_end else None,
                title=title,
                summary=summary,
            ))
        
        return differences
    
    async def _categorize_with_ai(
        self,
        diff_result: DiffResult,
        code1: str,
        code2: str,
        lang1: str,
        lang2: str
    ) -> List[Difference]:
        """Use LLM to categorize differences"""
        try:
            # Prepare prompt
            prompt = self._build_categorization_prompt(diff_result, code1, code2, lang1, lang2)
            
            # Call LLM
            response = await self.llm_service.generate(
                prompt=prompt,
                model="gpt-4o-mini",  # Fast, accurate
                temperature=0.1,  # Deterministic
                max_tokens=4000,
            )
            
            # Parse response
            return self._parse_llm_categorization(response.content, diff_result)
        
        except Exception as e:
            logger.error(f"AI categorization failed: {e}")
            return self._basic_categorization(diff_result)
    
    def _build_categorization_prompt(
        self,
        diff_result: DiffResult,
        code1: str,
        code2: str,
        lang1: str,
        lang2: str
    ) -> str:
        """Build prompt for LLM categorization"""
        # Get context around differences
        code1_lines = code1.splitlines()
        code2_lines = code2.splitlines()
        
        diff_contexts = []
        for hunk in diff_result.diff_hunks[:10]:  # Limit to first 10 for prompt size
            start1 = max(0, hunk.code1_start - 2)
            end1 = min(len(code1_lines), hunk.code1_end + 2)
            start2 = max(0, hunk.code2_start - 2)
            end2 = min(len(code2_lines), hunk.code2_end + 2)
            
            context1 = '\n'.join(code1_lines[start1:end1])
            context2 = '\n'.join(code2_lines[start2:end2])
            
            diff_contexts.append(f"""
Hunk {len(diff_contexts) + 1}:
CODE 1 (lines {hunk.code1_start + 1}-{hunk.code1_end}):
{context1}

CODE 2 (lines {hunk.code2_start + 1}-{hunk.code2_end}):
{context2}
""")
        
        prompt = f"""You are an expert {lang1}/{lang2} code reviewer specializing in clinical trial data programming (CDISC ADaM).

Compare these two code snippets and categorize each difference:

CODE 1:
{code1[:2000]}...

CODE 2:
{code2[:2000]}...

DIFFERENCES DETECTED:
{''.join(diff_contexts)}

For each difference, provide JSON with:
1. type: "functional" (changes output), "logical" (different approach), "style" (formatting), or "comment"
2. severity: "critical" (must fix), "important" (should review), "minor" (acceptable), or "informational"
3. title: Brief description (max 50 chars)
4. summary: One sentence explanation
5. recommendation: "Review required", "Acceptable difference", or "Fix QC code"

Return as JSON array of objects.
"""
        return prompt
    
    def _parse_llm_categorization(self, llm_response: str, diff_result: DiffResult) -> List[Difference]:
        """Parse LLM response into Difference objects"""
        import json
        import re
        
        # Try to extract JSON from response
        json_match = re.search(r'\[.*\]', llm_response, re.DOTALL)
        if not json_match:
            logger.warning("Could not parse LLM response as JSON, using basic categorization")
            return self._basic_categorization(diff_result)
        
        try:
            llm_diffs = json.loads(json_match.group(0))
        except json.JSONDecodeError:
            logger.warning("Invalid JSON in LLM response, using basic categorization")
            return self._basic_categorization(diff_result)
        
        # Map LLM results to diff hunks
        differences = []
        for i, (hunk, llm_diff) in enumerate(zip(diff_result.diff_hunks, llm_diffs[:len(diff_result.diff_hunks)])):
            differences.append(Difference(
                id=f"diff_{i+1}",
                type=llm_diff.get("type", "logical"),
                severity=llm_diff.get("severity", "important"),
                code1_span={"start_line": hunk.code1_start + 1, "end_line": hunk.code1_end} if hunk.code1_start < hunk.code1_end else None,
                code2_span={"start_line": hunk.code2_start + 1, "end_line": hunk.code2_end} if hunk.code2_start < hunk.code2_end else None,
                title=llm_diff.get("title", "Code difference"),
                summary=llm_diff.get("summary", "Difference detected"),
                details=llm_diff.get("details"),
                recommendation=llm_diff.get("recommendation"),
            ))
        
        return differences
    
    async def _analyze_adam_domain(
        self,
        differences: List[Difference],
        study_id: Optional[str],
        dataset: Optional[str]
    ) -> Optional[AdamInsights]:
        """Analyze ADaM domain impact (Deep mode only)"""
        # Extract variable names from differences
        affected_vars = self._extract_adam_variables(differences)
        
        # Map to CDISC rules (if rule engine available)
        cdisc_rules = []
        if self.rule_engine and dataset:
            try:
                # Use rule engine to find relevant rules
                cdisc_rules = [f"ADaM IG {dataset}"]  # Placeholder
            except:
                pass
        
        # Detect common patterns
        patterns = self._detect_patterns(differences)
        
        return AdamInsights(
            affected_variables=affected_vars,
            cdisc_rules_referenced=cdisc_rules,
            common_patterns_detected=patterns,
            potential_compliance_issues=[],
        )
    
    def _extract_adam_variables(self, differences: List[Difference]) -> List[str]:
        """Extract ADaM variable names from differences"""
        # Common ADaM variables to look for
        adam_vars = ['SAFFL', 'ITTFL', 'ABLFL', 'TRTEMFL', 'AVAL', 'BASE', 'CHG', 'PCHG']
        found_vars = []
        
        for diff in differences:
            # Check title and summary for variable names
            text = f"{diff.title} {diff.summary}".upper()
            for var in adam_vars:
                if var in text and var not in found_vars:
                    found_vars.append(var)
        
        return found_vars
    
    def _detect_patterns(self, differences: List[Difference]) -> List[str]:
        """Detect common ADaM programming patterns"""
        patterns = []
        all_text = ' '.join([d.title + ' ' + d.summary for d in differences]).upper()
        
        if any(term in all_text for term in ['TRTEMFL', 'RFSTDTC', 'RFENDTC']):
            patterns.append("Treatment-emergent event logic")
        
        if any(term in all_text for term in ['ABLFL', 'BASELINE', 'PRE-DOSE']):
            patterns.append("Baseline flag derivation")
        
        if any(term in all_text for term in ['AVAL', 'BASE', 'CHG']):
            patterns.append("Analysis value (AVAL/CHG) derivation")
        
        return patterns
    
    def _classify_similarity(self, score: float) -> str:
        """Classify similarity score into label"""
        if score >= 90:
            return "Very similar"
        elif score >= 70:
            return "Similar with differences"
        elif score >= 50:
            return "Moderately different"
        else:
            return "Significantly different"
    
    def _compute_subscores(self, diff_result: DiffResult, differences: List[Difference]) -> Dict[str, float]:
        """Compute subscores"""
        code_similarity = diff_result.similarity_ratio * 100
        
        # Functional equivalence (heuristic based on critical differences)
        critical_count = sum(1 for d in differences if d.severity == "critical")
        functional_equivalence = max(0, 100 - (critical_count * 20))
        
        # Logical alignment
        important_count = sum(1 for d in differences if d.severity == "important")
        logical_alignment = max(0, 100 - (important_count * 10))
        
        # Syntax quality (assume good if no syntax issues)
        syntax_quality = 100  # Will be adjusted based on syntax_issues
        
        return {
            "code_similarity": code_similarity,
            "functional_equivalence": functional_equivalence,
            "logical_alignment": logical_alignment,
            "syntax_quality": syntax_quality,
        }
    
    def _generate_summary(self, differences: List[Difference]) -> Dict[str, Any]:
        """Generate executive summary"""
        total = len(differences)
        critical = sum(1 for d in differences if d.severity == "critical")
        important = sum(1 for d in differences if d.severity == "important")
        minor = sum(1 for d in differences if d.severity == "minor")
        
        # Generate narrative
        if total == 0:
            narrative = "The codes are identical."
        elif critical > 0:
            narrative = f"Found {critical} critical difference(s) that may affect output. Review required."
        elif important > 0:
            narrative = f"Found {important} important difference(s) that should be reviewed."
        else:
            narrative = f"Found {minor} minor difference(s), likely acceptable."
        
        return {
            "total_differences": total,
            "critical_count": critical,
            "important_count": important,
            "minor_count": minor,
            "executive_narrative": narrative,
        }

