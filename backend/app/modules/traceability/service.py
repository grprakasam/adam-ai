"""
Traceability Service - Main orchestrator for traceability generation
"""

import asyncio
import hashlib
from typing import Dict, List, Optional
from loguru import logger
from .models import (
    TraceabilityMatrix,
    TraceabilityVariable,
    SourceVariable,
    DerivationStep,
    CodeReference
)
from .spec_parser import SpecificationParser
from .code_inspector import CodeInspector
from .rule_linker import RuleLinker
from .graph_builder import GraphBuilder
from .ai_analyzer import AIAnalyzer
from .cache_manager import CacheManager


class TraceabilityService:
    """Main orchestrator for traceability generation"""

    def __init__(self):
        self.spec_parser = SpecificationParser()
        self.code_inspector = CodeInspector()
        self.rule_linker = RuleLinker()
        self.graph_builder = GraphBuilder()
        self.ai_analyzer = AIAnalyzer()
        self.cache = CacheManager()

    async def generate_traceability(
        self,
        study_id: str,
        dataset: str,
        spec_path: str,
        code_snippets: Dict[str, Dict],
        include_ai_insights: bool = True,
        force_refresh: bool = False
    ) -> TraceabilityMatrix:
        """
        Generate complete traceability matrix

        Pipeline:
        1. Check cache (unless force_refresh)
        2. Parse specification → extract variables, sources, algorithms
        3. Inspect code snippets → confirm SDTM sources, operations
        4. Link ADAM IG rules → map variables to rule references
        5. Calculate confidence scores → spec-only vs spec+code-confirmed
        6. Build graph data → React Flow nodes/edges
        7. AI insights (optional) → anomaly detection, suggestions
        8. Cache result
        """

        # Create cache key that includes spec_path to ensure different specs get fresh results
        # Hash the spec_path to avoid excessively long cache keys
        spec_path_hash = hashlib.md5(spec_path.encode()).hexdigest()[:12]
        cache_key = f"traceability:{study_id}:{dataset}:{spec_path_hash}"
        
        logger.info(f"=== TRACEABILITY GENERATION ===")
        logger.info(f"Study ID: {study_id}")
        logger.info(f"Dataset: {dataset}")
        logger.info(f"Spec Path: {spec_path}")
        logger.info(f"Cache Key: {cache_key}")
        logger.info(f"Force Refresh: {force_refresh}")

        # Check cache
        if not force_refresh:
            cached = await self.cache.get(cache_key)
            if cached:
                logger.info(f"Cache hit for {cache_key}")
                return TraceabilityMatrix(**cached)
            else:
                logger.info(f"Cache miss for {cache_key}, generating fresh traceability")

        logger.info(f"Generating traceability for {study_id} - {dataset} using spec: {spec_path}")

        # Step 1: Parse specification
        spec_data = await self.spec_parser.parse(spec_path, dataset)
        logger.debug(f"Parsed {len(spec_data)} variables from spec")

        # Step 2: Inspect code snippets (parallel processing)
        code_analysis_tasks = [
            self.code_inspector.analyze(var_name, snippet)
            for var_name, snippet in code_snippets.items()
        ]
        code_analyses = await asyncio.gather(*code_analysis_tasks, return_exceptions=True)
        code_analysis_map = {}
        for var_name, analysis in zip(code_snippets.keys(), code_analyses):
            if isinstance(analysis, Exception):
                logger.warning(f"Code analysis failed for {var_name}: {analysis}")
                code_analysis_map[var_name] = {}
            else:
                code_analysis_map[var_name] = analysis

        # Step 3: Link ADAM IG rules
        rule_links = await self.rule_linker.link_rules(spec_data, dataset)

        # Step 4: Build traceability variables
        variables: List[TraceabilityVariable] = []

        for spec_var in spec_data:
            var_name = spec_var['variable_name']

            # Merge spec + code analysis
            code_analysis = code_analysis_map.get(var_name, {})

            # Build sources
            sources = self._build_sources(
                spec_sources=spec_var.get('sources', []),
                code_sources=code_analysis.get('detected_sources', [])
            )

            # Calculate confidence
            confidence = self._calculate_confidence(
                has_spec=bool(spec_var.get('algorithm')),
                has_code=bool(code_analysis),
                sources_match=self._sources_match(
                    spec_var.get('sources', []),
                    code_analysis.get('detected_sources', [])
                )
            )

            # Build derivation steps
            derivation_steps = self._build_derivation_steps(
                spec_var, code_analysis
            )

            # Link rules
            rule_refs = rule_links.get(var_name, [])

            # Build code references
            code_refs = []
            if var_name in code_snippets:
                code_refs.append(CodeReference(
                    language=code_snippets[var_name].get('language', 'R'),
                    snippet_id=var_name,
                    code=code_snippets[var_name].get('code', '')
                ))

            # Create variable record
            var_record = TraceabilityVariable(
                variable_name=var_name,
                label=spec_var.get('label', ''),
                category=spec_var.get('category', 'Other Variables'),
                data_type=spec_var.get('type', 'Text'),
                length=spec_var.get('length'),
                format=spec_var.get('format'),
                sources=sources,
                algorithm=spec_var.get('algorithm', ''),
                derivation_steps=derivation_steps,
                rule_refs=rule_refs,
                code_refs=code_refs,
                confidence=confidence,
            )

            # AI insights (optional)
            if include_ai_insights:
                try:
                    var_record.ai_insights = await self.ai_analyzer.analyze_variable(var_record)
                except Exception as e:
                    logger.warning(f"AI analysis failed for {var_name}: {e}")

            variables.append(var_record)

        # Step 5: Build graph data
        try:
            graph_data = await self.graph_builder.build_react_flow_graph(variables)
        except Exception as e:
            logger.error(f"Graph building failed: {e}")
            graph_data = None

        # Step 6: Calculate summary statistics
        total = len(variables)
        high_conf = sum(1 for v in variables if v.confidence > 0.8)
        medium_conf = sum(1 for v in variables if 0.5 <= v.confidence <= 0.8)
        low_conf = sum(1 for v in variables if v.confidence < 0.5)
        avg_conf = sum(v.confidence for v in variables) / total if total > 0 else 0

        # Build final matrix
        matrix = TraceabilityMatrix(
            study_id=study_id,
            dataset=dataset,
            sdtm_version="3.4",  # TODO: Get from config
            adam_ig_version="1.3",  # TODO: Get from config
            variables=variables,
            total_variables=total,
            traced_variables=total,  # All have some traceability
            average_confidence=avg_conf,
            high_confidence_count=high_conf,
            medium_confidence_count=medium_conf,
            low_confidence_count=low_conf,
            graph_data=graph_data,
        )

        # Cache result (1 hour TTL)
        await self.cache.set(cache_key, matrix.model_dump(), ttl=3600)

        logger.info(f"Traceability generation complete: {total} variables, avg confidence {avg_conf:.2f}")

        return matrix

    def _calculate_confidence(
        self,
        has_spec: bool,
        has_code: bool,
        sources_match: bool
    ) -> float:
        """
        Calculate confidence score based on available evidence

        Scoring:
        - Spec only: 0.5
        - Spec + code (sources mismatch): 0.65
        - Spec + code (sources match): 0.85
        """
        if not has_spec:
            return 0.3  # Low confidence

        if not has_code:
            return 0.5  # Spec only

        if sources_match:
            return 0.85  # High confidence
        else:
            return 0.65  # Medium confidence

    def _sources_match(self, spec_sources: List, code_sources: List) -> bool:
        """Check if spec sources match code-detected sources"""
        if not spec_sources or not code_sources:
            return False

        spec_domains = {s.get('domain') for s in spec_sources if s.get('domain')}
        code_domains = {s.get('domain') for s in code_sources if s.get('domain')}

        return len(spec_domains & code_domains) > 0  # At least one domain matches

    def _build_sources(self, spec_sources: List, code_sources: List) -> List[SourceVariable]:
        """Merge spec and code sources, prefer code if available"""
        sources_dict = {}

        # Add spec sources
        for s in spec_sources:
            key = f"{s.get('domain', '')}.{s.get('variable', '')}"
            sources_dict[key] = SourceVariable(
                domain=s.get('domain', ''),
                variable=s.get('variable', ''),
                label=None
            )

        # Add code sources (override spec if present)
        for s in code_sources:
            key = f"{s.get('domain', '')}.{s.get('variable', '')}"
            sources_dict[key] = SourceVariable(
                domain=s.get('domain', ''),
                variable=s.get('variable', ''),
                label=None
            )

        # Return unique sources
        return list(sources_dict.values())

    def _build_derivation_steps(self, spec_var: Dict, code_analysis: Dict) -> List[DerivationStep]:
        """Build step-by-step derivation from spec and code"""
        steps = []

        # Extract operations from code analysis
        operations = code_analysis.get('operations', [])

        if operations:
            for i, op in enumerate(operations):
                steps.append(DerivationStep(
                    step_number=i + 1,
                    operation=op.capitalize(),
                    detail=f"{op.capitalize()} operation detected in code",
                    code_reference=None
                ))
        else:
            # Fallback: single step from spec algorithm
            if spec_var.get('algorithm'):
                steps.append(DerivationStep(
                    step_number=1,
                    operation='Derivation',
                    detail=spec_var.get('algorithm', ''),
                    code_reference=None
                ))

        return steps
