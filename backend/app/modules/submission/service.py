"""
Submission Orchestration Service

Main service coordinating all submission readiness workflows:
- Validation orchestration (preflight, CT, P21)
- Readiness score calculation
- Package generation
- Artifact management
"""

from typing import Optional, List, Dict, Any
from loguru import logger
from .models import (
    SubmissionReadinessScore,
    ValidationSummary,
    PackageManifest,
    ValidationRequest,
    PackageRequest,
)
from .validation.preflight import PreflightValidator
from .validation.controlled_terminology import ControlledTerminologyValidator
from .validation.p21_runner import P21CERunner
from .generation.define_xml import DefineXMLGenerator
from .generation.adrg import ADRGGenerator
from .packaging.ectd_builder import eCTDPackager


class SubmissionOrchestrationService:
    """
    Main orchestration service for submission readiness.
    Coordinates validation, generation, and packaging workflows.
    """

    def __init__(self):
        # Initialize all services
        self.preflight_validator = PreflightValidator()
        self.ct_validator = ControlledTerminologyValidator()
        self.p21_runner = P21CERunner()
        self.define_xml_generator = DefineXMLGenerator()
        self.adrg_generator = ADRGGenerator()
        self.ectd_packager = eCTDPackager()
        logger.info("SubmissionOrchestrationService initialized with all validators and generators")

    async def calculate_readiness_score(
        self,
        study_id: str,
        dataset: str
    ) -> SubmissionReadinessScore:
        """
        Calculate composite submission readiness score.
        Returns score 0-100 with component breakdown.
        
        Weights:
        - Preflight: 15%
        - CT: 20%
        - P21: 35%
        - Define.xml: 20%
        - Documentation: 10%
        """
        logger.info(f"Calculating readiness score for {study_id}/{dataset}")
        
        # Initialize component scores
        components = {
            "preflight": 0,
            "controlled_terminology": 0,
            "p21_validation": 0,
            "define_xml": 0,
            "documentation": 0
        }
        
        recommendations = []
        
        # TODO: Check cached validation results
        # For now, return demo data based on study configuration
        
        # Simulate some progress
        components["preflight"] = 100  # Demo: preflight always passes
        components["controlled_terminology"] = 95  # Demo: CT mostly good
        components["p21_validation"] = 87  # Demo: P21 has some warnings
        components["define_xml"] = 0  # Not yet generated
        components["documentation"] = 0  # Not yet generated
        
        # Calculate weighted overall score
        overall = int(
            components["preflight"] * 0.15 +
            components["controlled_terminology"] * 0.20 +
            components["p21_validation"] * 0.35 +
            components["define_xml"] * 0.20 +
            components["documentation"] * 0.10
        )
        
        # Generate recommendations
        if components["define_xml"] == 0:
            recommendations.append("Generate Define.xml to increase score by 20%")
        if components["documentation"] == 0:
            recommendations.append("Generate ADRG/SDRG documentation to increase score by 10%")
        if components["p21_validation"] < 100:
            recommendations.append("Address P21 validation warnings for full compliance")
        if components["controlled_terminology"] < 100:
            recommendations.append("Fix controlled terminology issues")
        
        score = SubmissionReadinessScore(
            overall=overall,
            components=components,
            recommendations=recommendations
        )

        return score

    async def run_all_validations(
        self,
        study_id: str,
        dataset: str,
        options: Optional[Dict[str, Any]] = None
    ) -> ValidationSummary:
        """
        Run all validation checks in sequence.
        Pre-flight → CT → P21 CE
        
        Args:
            study_id: Study identifier
            dataset: Dataset name (e.g., ADSL)
            options: Optional configuration for validation
            
        Returns:
            ValidationSummary with results from all checks
        """
        logger.info(f"Starting full validation for {study_id}/{dataset}")
        
        # Initialize summary
        summary = ValidationSummary(
            overall_passed=True,
            summary={"errors": 0, "warnings": 0, "info": 0}
        )

        # Step 1: Pre-flight (fast, catches obvious issues)
        logger.info("Running pre-flight checks")
        preflight_result = await self.preflight_validator.validate(study_id, dataset)
        summary.preflight = preflight_result
        
        if preflight_result.has_blocking_errors:
            logger.warning("Pre-flight failed with blocking errors, skipping further validation")
            summary.overall_passed = False
            return summary
        
        # Update summary counts
        for issue in preflight_result.issues:
            if issue.severity == "ERROR":
                summary.summary["errors"] += 1
            elif issue.severity == "WARNING":
                summary.summary["warnings"] += 1
            else:
                summary.summary["info"] += 1

        # Step 2: Controlled Terminology
        logger.info("Running CT validation")
        ct_result = await self.ct_validator.validate(study_id, dataset)
        summary.controlled_terminology = ct_result
        
        for issue in ct_result.issues:
            if issue.severity == "ERROR":
                summary.summary["errors"] += 1
                summary.overall_passed = False
            elif issue.severity == "WARNING":
                summary.summary["warnings"] += 1
            else:
                summary.summary["info"] += 1
        
        # Step 3: P21 CE
        logger.info("Running P21 CE validation")
        p21_result = await self.p21_runner.validate(study_id, dataset)
        summary.p21 = p21_result
        
        for issue in p21_result.issues:
            if issue.severity == "ERROR":
                summary.summary["errors"] += 1
                summary.overall_passed = False
            elif issue.severity == "WARNING":
                summary.summary["warnings"] += 1
            else:
                summary.summary["info"] += 1

        logger.info(f"Full validation workflow complete: {summary.summary}")
        return summary

    async def run_preflight_check(
        self,
        study_id: str,
        dataset: str
    ):
        """Run quick pre-flight structural checks"""
        logger.info(f"Running preflight check for {study_id}/{dataset}")
        return await self.preflight_validator.validate(study_id, dataset)

    async def run_ct_validation(
        self,
        study_id: str,
        dataset: str,
        ct_file_path: Optional[str] = None
    ):
        """Run Controlled Terminology validation"""
        logger.info(f"Running CT validation for {study_id}/{dataset}")
        return await self.ct_validator.validate(study_id, dataset, ct_file_path)

    async def run_p21_validation(
        self,
        study_id: str,
        dataset: str,
        timeout_seconds: int = 300
    ):
        """Run Pinnacle 21 Community Edition validation"""
        logger.info(f"Running P21 validation for {study_id}/{dataset}")
        return await self.p21_runner.validate(study_id, dataset, timeout_seconds)

    async def generate_define_xml(
        self,
        study_id: str,
        datasets: List[str],
        options: Optional[Dict[str, Any]] = None
    ) -> str:
        """Generate Define.xml file"""
        logger.info(f"Generating Define.xml for {study_id}")
        return await self.define_xml_generator.generate(study_id, datasets, options)

    async def generate_adrg(
        self,
        study_id: str,
        datasets: List[str],
        template: str = "fda_standard"
    ) -> str:
        """Generate ADRG document"""
        logger.info(f"Generating ADRG for {study_id}")
        return await self.adrg_generator.generate(study_id, datasets, template)

    async def generate_package(
        self,
        study_id: str,
        datasets: List[str],
        include_define: bool = True,
        include_adrg: bool = True,
        include_sdrg: bool = True,
        create_zip: bool = True
    ) -> PackageManifest:
        """
        Generate complete submission package.
        
        Args:
            study_id: Study identifier
            datasets: List of dataset names to include
            include_define: Generate Define.xml
            include_adrg: Generate ADRG
            include_sdrg: Generate SDRG
            create_zip: Create ZIP archive
            
        Returns:
            PackageManifest with paths and checksums
        """
        logger.info(f"Starting package generation for {study_id}")
        
        artifacts = []
        
        # 1. Generate Define.xml if requested
        if include_define:
            define_path = await self.define_xml_generator.generate(study_id, datasets)
            artifacts.append(define_path)
        
        # 2. Generate ADRG if requested
        if include_adrg:
            adrg_path = await self.adrg_generator.generate(study_id, datasets)
            artifacts.append(adrg_path)
        
        # 3. Generate SDRG if requested (using ADRG generator for now)
        if include_sdrg:
            sdrg_path = await self.adrg_generator.generate(study_id, datasets, template="sdrg")
            artifacts.append(sdrg_path)
        
        # 4. Create eCTD package
        manifest = await self.ectd_packager.package(
            study_id=study_id,
            artifacts=artifacts,
            create_zip=create_zip
        )

        logger.info(f"Package generation complete: {manifest.package_path}")
        return manifest

    async def generate_sdrg(
        self,
        study_id: str,
        datasets: List[str]
    ) -> str:
        """Generate Study Data Reviewer's Guide (SDRG)"""
        logger.info(f"Generating SDRG for {study_id}")
        # TODO: Implement
        return f"Content/Submissions/{study_id}/SDRG.docx"
