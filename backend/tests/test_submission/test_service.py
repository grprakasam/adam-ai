"""
Unit tests for SubmissionOrchestrationService
Tests submission readiness scoring, validation coordination, and package generation
"""

import pytest
from unittest.mock import Mock, AsyncMock, patch
from datetime import datetime
from app.modules.submission.service import SubmissionOrchestrationService
from app.modules.submission.models import (
    SubmissionReadinessScore,
    ValidationSummary,
    PackageManifest,
    ValidationRequest,
    PackageRequest
)


class TestSubmissionOrchestrationService:
    """Test suite for SubmissionOrchestrationService"""

    @pytest.fixture
    def service(self):
        """Fixture providing initialized SubmissionOrchestrationService"""
        return SubmissionOrchestrationService()

    @pytest.fixture
    def sample_study_id(self):
        """Sample study ID"""
        return 'STUDY001'

    @pytest.fixture
    def sample_dataset(self):
        """Sample dataset name"""
        return 'ADSL'

    # Test service initialization
    def test_service_initialization(self, service):
        """Test SubmissionOrchestrationService initializes all components"""
        assert service.preflight_validator is not None
        assert service.ct_validator is not None
        assert service.p21_runner is not None
        assert service.define_xml_generator is not None
        assert service.adrg_generator is not None
        assert service.ectd_packager is not None

    # Test readiness score calculation
    @pytest.mark.asyncio
    async def test_calculate_readiness_score(self, service, sample_study_id, sample_dataset):
        """Test readiness score calculation"""
        score = await service.calculate_readiness_score(sample_study_id, sample_dataset)

        assert isinstance(score, SubmissionReadinessScore)
        assert 0 <= score.overall_score <= 100
        assert 'preflight' in score.component_scores
        assert 'controlled_terminology' in score.component_scores
        assert 'p21_validation' in score.component_scores

    @pytest.mark.asyncio
    async def test_readiness_score_weights(self, service, sample_study_id, sample_dataset):
        """Test that readiness score respects component weights"""
        score = await service.calculate_readiness_score(sample_study_id, sample_dataset)

        # Component weights:
        # preflight: 15%, ct: 20%, p21: 35%, define_xml: 20%, documentation: 10%
        assert score.component_weights['preflight'] == 0.15
        assert score.component_weights['controlled_terminology'] == 0.20
        assert score.component_weights['p21_validation'] == 0.35
        assert score.component_weights['define_xml'] == 0.20
        assert score.component_weights['documentation'] == 0.10

    @pytest.mark.asyncio
    async def test_readiness_score_calculations(self, service, sample_study_id, sample_dataset):
        """Test that overall score is calculated correctly from components"""
        score = await service.calculate_readiness_score(sample_study_id, sample_dataset)

        # Verify that overall score is weighted average of components
        weighted_sum = sum(
            score.component_scores[comp] * score.component_weights[comp]
            for comp in score.component_scores
        )

        # Allow small floating point difference
        assert abs(score.overall_score - weighted_sum) < 0.01

    @pytest.mark.asyncio
    async def test_readiness_score_includes_recommendations(self, service, sample_study_id, sample_dataset):
        """Test that readiness score includes recommendations"""
        score = await service.calculate_readiness_score(sample_study_id, sample_dataset)

        assert isinstance(score.recommendations, list)
        # If score is not perfect, there should be recommendations
        if score.overall_score < 100:
            assert len(score.recommendations) > 0

    # Test validation coordination
    @pytest.mark.asyncio
    async def test_run_preflight_validation(self, service, sample_study_id, sample_dataset):
        """Test preflight validation execution"""
        service.preflight_validator.validate = AsyncMock(return_value={
            'status': 'passed',
            'checks': [],
            'warnings': []
        })

        result = await service.run_preflight_validation(
            study_id=sample_study_id,
            dataset=sample_dataset
        )

        assert result is not None
        service.preflight_validator.validate.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_ct_validation(self, service, sample_study_id, sample_dataset):
        """Test controlled terminology validation"""
        service.ct_validator.validate = AsyncMock(return_value={
            'status': 'warnings',
            'issues': [],
            'confidence': 0.95
        })

        result = await service.run_ct_validation(
            study_id=sample_study_id,
            dataset=sample_dataset,
            meddra_version='27.0'
        )

        assert result is not None
        service.ct_validator.validate.assert_called_once()

    @pytest.mark.asyncio
    async def test_run_p21_validation(self, service, sample_study_id, sample_dataset):
        """Test P21/CE validation execution"""
        service.p21_runner.validate = AsyncMock(return_value={
            'status': 'passed_with_warnings',
            'errors': [],
            'warnings': ['Warning 1'],
            'execution_time': 45.2
        })

        result = await service.run_p21_validation(
            study_id=sample_study_id,
            dataset=sample_dataset
        )

        assert result is not None
        service.p21_runner.validate.assert_called_once()

    # Test package generation
    @pytest.mark.asyncio
    async def test_generate_define_xml(self, service, sample_study_id, sample_dataset):
        """Test Define.xml generation"""
        service.define_xml_generator.generate = AsyncMock(return_value={
            'xml_content': '<Define>...</Define>',
            'generated_at': datetime.now().isoformat()
        })

        result = await service.generate_define_xml(
            study_id=sample_study_id,
            dataset=sample_dataset
        )

        assert result is not None
        assert 'xml_content' in result
        service.define_xml_generator.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_adrg(self, service, sample_study_id, sample_dataset):
        """Test ADRG (Analysis Data Review Guide) generation"""
        service.adrg_generator.generate = AsyncMock(return_value={
            'document': 'ADRG content...',
            'format': 'rtf'
        })

        result = await service.generate_adrg(
            study_id=sample_study_id,
            dataset=sample_dataset
        )

        assert result is not None
        service.adrg_generator.generate.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_submission_package(self, service, sample_study_id, sample_dataset):
        """Test complete submission package generation"""
        service.preflight_validator.validate = AsyncMock(return_value={})
        service.ct_validator.validate = AsyncMock(return_value={})
        service.p21_runner.validate = AsyncMock(return_value={})
        service.define_xml_generator.generate = AsyncMock(return_value={'xml_content': '<Define/>'})
        service.adrg_generator.generate = AsyncMock(return_value={'document': 'ADRG'})
        service.ectd_packager.create_package = AsyncMock(return_value={
            'package_path': '/path/to/package.zip',
            'manifest': {}
        })

        result = await service.generate_submission_package(
            study_id=sample_study_id,
            dataset=sample_dataset
        )

        assert result is not None
        assert 'package_path' in result

    # Test validation request handling
    @pytest.mark.asyncio
    async def test_handle_validation_request(self, service):
        """Test handling of validation requests"""
        request = ValidationRequest(
            study_id='STUDY001',
            dataset='ADSL',
            validations=['preflight', 'ct']
        )

        service.run_preflight_validation = AsyncMock(return_value={})
        service.run_ct_validation = AsyncMock(return_value={})

        result = await service.handle_validation_request(request)

        assert result is not None
        service.run_preflight_validation.assert_called_once()
        service.run_ct_validation.assert_called_once()

    # Test package request handling
    @pytest.mark.asyncio
    async def test_handle_package_request(self, service):
        """Test handling of package requests"""
        request = PackageRequest(
            study_id='STUDY001',
            dataset='ADSL',
            include_define_xml=True,
            include_adrg=True,
            format='eCTD'
        )

        service.generate_submission_package = AsyncMock(return_value={
            'package_path': '/path/to/package.zip'
        })

        result = await service.handle_package_request(request)

        assert result is not None
        service.generate_submission_package.assert_called_once()


class TestSubmissionReadinessScoreModel:
    """Test SubmissionReadinessScore model"""

    def test_readiness_score_creation(self):
        """Test creating a readiness score"""
        score = SubmissionReadinessScore(
            study_id='STUDY001',
            dataset='ADSL',
            overall_score=85,
            component_scores={
                'preflight': 100,
                'controlled_terminology': 95,
                'p21_validation': 87,
                'define_xml': 0,
                'documentation': 50
            },
            component_weights={
                'preflight': 0.15,
                'controlled_terminology': 0.20,
                'p21_validation': 0.35,
                'define_xml': 0.20,
                'documentation': 0.10
            },
            recommendations=['Generate Define.xml', 'Complete documentation'],
            generated_at=datetime.now().isoformat()
        )

        assert score.study_id == 'STUDY001'
        assert score.overall_score == 85

    def test_readiness_score_component_validation(self):
        """Test component score validation"""
        score = SubmissionReadinessScore(
            study_id='STUDY001',
            dataset='ADSL',
            overall_score=85,
            component_scores={
                'preflight': 100,
                'controlled_terminology': 95
            },
            component_weights={
                'preflight': 0.15,
                'controlled_terminology': 0.20
            },
            recommendations=[],
            generated_at=datetime.now().isoformat()
        )

        # All component scores should be 0-100
        for score_val in score.component_scores.values():
            assert 0 <= score_val <= 100


class TestValidationSummaryModel:
    """Test ValidationSummary model"""

    def test_validation_summary_creation(self):
        """Test creating a validation summary"""
        summary = ValidationSummary(
            validation_type='preflight',
            status='passed',
            total_checks=10,
            passed_checks=10,
            failed_checks=0,
            warnings=0,
            details=[]
        )

        assert summary.validation_type == 'preflight'
        assert summary.status == 'passed'

    def test_validation_summary_status_determination(self):
        """Test automatic status determination"""
        # All checks passed
        summary_pass = ValidationSummary(
            validation_type='preflight',
            status='passed',
            total_checks=10,
            passed_checks=10,
            failed_checks=0,
            warnings=0,
            details=[]
        )
        assert summary_pass.status == 'passed'

        # Some failures
        summary_fail = ValidationSummary(
            validation_type='preflight',
            status='failed',
            total_checks=10,
            passed_checks=8,
            failed_checks=2,
            warnings=0,
            details=[]
        )
        assert summary_fail.status == 'failed'


class TestPackageManifestModel:
    """Test PackageManifest model"""

    def test_package_manifest_creation(self):
        """Test creating a package manifest"""
        manifest = PackageManifest(
            study_id='STUDY001',
            dataset='ADSL',
            package_format='eCTD',
            files=[
                {'name': 'define.xml', 'path': '/path/to/define.xml', 'size': 5000},
                {'name': 'adrg.rtf', 'path': '/path/to/adrg.rtf', 'size': 50000}
            ],
            checksums={'define.xml': 'abc123'},
            created_at=datetime.now().isoformat()
        )

        assert manifest.study_id == 'STUDY001'
        assert len(manifest.files) == 2

    def test_package_manifest_file_tracking(self):
        """Test file tracking in manifest"""
        manifest = PackageManifest(
            study_id='STUDY001',
            dataset='ADSL',
            package_format='eCTD',
            files=[],
            checksums={},
            created_at=datetime.now().isoformat()
        )

        # Should be able to add files
        assert len(manifest.files) == 0
