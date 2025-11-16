"""
Unit tests for TraceabilityService
Tests traceability matrix generation, specification parsing, and lineage tracking
"""

import pytest
import asyncio
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime
from app.modules.traceability.service import TraceabilityService
from app.modules.traceability.models import (
    TraceabilityMatrix,
    TraceabilityVariable,
    SourceVariable,
    DerivationStep
)


class TestTraceabilityService:
    """Test suite for TraceabilityService"""

    @pytest.fixture
    def service(self):
        """Fixture providing initialized TraceabilityService"""
        return TraceabilityService()

    @pytest.fixture
    def sample_spec_data(self):
        """Fixture providing sample specification data"""
        return [
            {
                'variable_name': 'STUDYID',
                'label': 'Study Identifier',
                'sources': ['DM.STUDYID'],
                'algorithm': 'Direct copy from DM'
            },
            {
                'variable_name': 'AGE',
                'label': 'Age at Baseline',
                'sources': ['DM.DOB', 'DM.RFSTDTC'],
                'algorithm': 'Calculate from birth date and reference start date'
            },
            {
                'variable_name': 'AGEFL',
                'label': 'Age Flag',
                'sources': ['AGE'],
                'algorithm': 'Flag if AGE >= 18'
            }
        ]

    @pytest.fixture
    def sample_code_snippets(self):
        """Fixture providing sample code snippets"""
        return {
            'STUDYID': {'code': 'STUDYID = DM.STUDYID;', 'language': 'sas'},
            'AGE': {'code': 'AGE = floor(yrdif(DM.DOB, DM.RFSTDTC, "age"));', 'language': 'sas'},
            'AGEFL': {'code': 'AGEFL = (AGE >= 18);', 'language': 'sas'}
        }

    # Test service initialization
    def test_service_initialization(self, service):
        """Test TraceabilityService initializes all components"""
        assert service.spec_parser is not None
        assert service.code_inspector is not None
        assert service.rule_linker is not None
        assert service.graph_builder is not None
        assert service.ai_analyzer is not None
        assert service.cache is not None

    # Test traceability generation
    @pytest.mark.asyncio
    async def test_generate_traceability_basic(self, service, sample_spec_data, sample_code_snippets):
        """Test basic traceability matrix generation"""
        # Mock all dependencies
        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = AsyncMock(return_value={})
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value=None)
        service.cache.set = AsyncMock()

        # Mock _build_sources method
        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        result = await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets=sample_code_snippets,
            include_ai_insights=False
        )

        assert result is not None
        assert isinstance(result, TraceabilityMatrix)
        service.cache.set.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_traceability_with_cache(self, service):
        """Test that cached traceability is returned"""
        cached_data = {
            'study_id': 'STUDY001',
            'dataset': 'ADSL',
            'variables': [],
            'sources': [],
            'generated_at': datetime.now().isoformat()
        }

        service.cache.get = AsyncMock(return_value=cached_data)

        result = await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets={}
        )

        service.cache.get.assert_called_once()
        assert isinstance(result, TraceabilityMatrix)

    @pytest.mark.asyncio
    async def test_generate_traceability_force_refresh(self, service, sample_spec_data, sample_code_snippets):
        """Test force refresh bypasses cache"""
        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = AsyncMock(return_value={})
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value={'cached': 'data'})
        service.cache.set = AsyncMock()

        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        result = await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets=sample_code_snippets,
            force_refresh=True
        )

        # Cache.get should not be called when force_refresh=True
        assert not service.cache.get.called

    @pytest.mark.asyncio
    async def test_generate_traceability_with_ai_insights(self, service, sample_spec_data, sample_code_snippets):
        """Test traceability generation with AI insights"""
        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = AsyncMock(return_value={})
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value=None)
        service.cache.set = AsyncMock()
        service.ai_analyzer.analyze = AsyncMock(return_value={'insights': []})

        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        result = await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets=sample_code_snippets,
            include_ai_insights=True
        )

        service.ai_analyzer.analyze.assert_called_once()

    # Test code analysis error handling
    @pytest.mark.asyncio
    async def test_generate_traceability_handles_code_analysis_errors(self, service, sample_spec_data):
        """Test that code analysis errors are handled gracefully"""
        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = AsyncMock(side_effect=Exception("Analysis failed"))
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value=None)
        service.cache.set = AsyncMock()

        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        result = await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets={'VAR': {'code': 'invalid'}}
        )

        assert result is not None

    # Test specification parsing
    @pytest.mark.asyncio
    async def test_spec_parser_called_with_correct_parameters(self, service, sample_spec_data):
        """Test that spec parser is called with correct parameters"""
        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = AsyncMock(return_value={})
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value=None)
        service.cache.set = AsyncMock()

        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets={}
        )

        service.spec_parser.parse.assert_called_once_with('path/to/spec.xlsx', 'ADSL')

    # Test rule linking
    @pytest.mark.asyncio
    async def test_rule_linker_called_with_parsed_spec(self, service, sample_spec_data):
        """Test that rule linker is called with parsed specification"""
        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = AsyncMock(return_value={})
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value=None)
        service.cache.set = AsyncMock()

        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets={}
        )

        service.rule_linker.link_rules.assert_called_once()

    # Test parallel code analysis
    @pytest.mark.asyncio
    async def test_parallel_code_analysis(self, service, sample_spec_data, sample_code_snippets):
        """Test that code analysis is performed in parallel"""
        call_count = 0

        async def mock_analyze(var_name, snippet):
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.01)  # Simulate async operation
            return {'analyzed': True}

        service.spec_parser.parse = AsyncMock(return_value=sample_spec_data)
        service.code_inspector.analyze = mock_analyze
        service.rule_linker.link_rules = AsyncMock(return_value={})
        service.cache.get = AsyncMock(return_value=None)
        service.cache.set = AsyncMock()

        service._build_sources = Mock(return_value=[])
        service._build_derivations = Mock(return_value=[])
        service._calculate_confidence = Mock(return_value=1.0)
        service._build_graph_data = Mock(return_value={'nodes': [], 'edges': []})

        await service.generate_traceability(
            study_id='STUDY001',
            dataset='ADSL',
            spec_path='path/to/spec.xlsx',
            code_snippets=sample_code_snippets
        )

        assert call_count == len(sample_code_snippets)

    # Test variable processing
    def test_build_sources_from_spec(self, service):
        """Test building source variables from specification"""
        spec_sources = ['DM.STUDYID', 'DM.SUBJID']
        sources = service._build_sources(spec_sources=spec_sources, code_sources=[])

        assert len(sources) > 0

    def test_build_sources_from_code(self, service):
        """Test building source variables from code analysis"""
        code_sources = {'DM': ['STUDYID'], 'VS': ['VSVAL']}
        sources = service._build_sources(spec_sources=[], code_sources=code_sources)

        assert len(sources) > 0

    def test_calculate_confidence_full_match(self, service):
        """Test confidence calculation with full spec and code match"""
        confidence = service._calculate_confidence(
            spec_sources=['DM.STUDYID'],
            code_sources={'DM': ['STUDYID']}
        )

        assert confidence >= 0.8  # High confidence

    def test_calculate_confidence_partial_match(self, service):
        """Test confidence calculation with partial match"""
        confidence = service._calculate_confidence(
            spec_sources=['DM.STUDYID'],
            code_sources={'VS': ['VSVAL']}
        )

        assert confidence < 0.8  # Lower confidence

    def test_calculate_confidence_spec_only(self, service):
        """Test confidence calculation with specification only"""
        confidence = service._calculate_confidence(
            spec_sources=['DM.STUDYID'],
            code_sources={}
        )

        assert 0 < confidence < 0.8  # Medium confidence


class TestTraceabilityVariableModel:
    """Test TraceabilityVariable model"""

    def test_traceability_variable_creation(self):
        """Test creating a traceability variable"""
        var = TraceabilityVariable(
            variable_name='AGE',
            label='Age',
            category='Demographic',
            sources=[],
            derivations=[],
            confidence=0.95,
            rule_references=[]
        )

        assert var.variable_name == 'AGE'
        assert var.confidence == 0.95

    def test_traceability_variable_with_sources(self):
        """Test traceability variable with source tracking"""
        source = SourceVariable(
            domain='DM',
            variable='DOB',
            description='Date of Birth'
        )

        var = TraceabilityVariable(
            variable_name='AGE',
            label='Age',
            category='Derived',
            sources=[source],
            derivations=[],
            confidence=0.95,
            rule_references=[]
        )

        assert len(var.sources) == 1
        assert var.sources[0].domain == 'DM'

    def test_traceability_variable_with_derivations(self):
        """Test traceability variable with derivation steps"""
        derivation = DerivationStep(
            step_number=1,
            description='Calculate age from DOB',
            formula='yrdif(DOB, RFSTDTC)',
            sources=['DM.DOB', 'DM.RFSTDTC']
        )

        var = TraceabilityVariable(
            variable_name='AGE',
            label='Age',
            category='Derived',
            sources=[],
            derivations=[derivation],
            confidence=0.95,
            rule_references=[]
        )

        assert len(var.derivations) == 1


class TestTraceabilityMatrixModel:
    """Test TraceabilityMatrix model"""

    def test_traceability_matrix_creation(self):
        """Test creating a traceability matrix"""
        matrix = TraceabilityMatrix(
            study_id='STUDY001',
            dataset='ADSL',
            variables=[],
            sources=[],
            generated_at=datetime.now().isoformat()
        )

        assert matrix.study_id == 'STUDY001'
        assert matrix.dataset == 'ADSL'

    def test_traceability_matrix_with_variables(self):
        """Test matrix with multiple variables"""
        var1 = TraceabilityVariable(
            variable_name='STUDYID',
            label='Study ID',
            category='Identifier',
            sources=[],
            derivations=[],
            confidence=1.0,
            rule_references=[]
        )
        var2 = TraceabilityVariable(
            variable_name='AGE',
            label='Age',
            category='Demographic',
            sources=[],
            derivations=[],
            confidence=0.95,
            rule_references=[]
        )

        matrix = TraceabilityMatrix(
            study_id='STUDY001',
            dataset='ADSL',
            variables=[var1, var2],
            sources=[],
            generated_at=datetime.now().isoformat()
        )

        assert len(matrix.variables) == 2
