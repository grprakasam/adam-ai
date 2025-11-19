"""
SDRG (Study Data Reviewer's Guide) generator
Creates DOCX document from template
"""

from typing import List, Optional
from pathlib import Path
from datetime import datetime
import hashlib
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

from .models import StudyInfo, DatasetInfo, DocumentResponse, ArtifactRef


class SDRGGenerator:
    """
    Generates SDRG (Study Data Reviewer's Guide) in DOCX format
    Provides placeholder template with study-specific information
    """
    
    def generate(
        self,
        study_info: StudyInfo,
        datasets: List[DatasetInfo],
        notes: Optional[str] = None,
        output_dir: Optional[Path] = None
    ) -> DocumentResponse:
        """
        Generate SDRG document
        
        Args:
            study_info: Study metadata
            datasets: List of dataset information
            notes: Optional additional notes
            output_dir: Output directory
        
        Returns:
            DocumentResponse with artifact reference
        """
        # Create output directory
        if output_dir is None:
            output_dir = Path(__file__).parents[4] / "Content" / "Submissions" / study_info.study_id / "docs"
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create document
        doc = Document()
        
        # Add title
        title = doc.add_heading("Study Data Reviewer's Guide (SDRG)", level=1)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER
        
        # Study information
        doc.add_heading("1. Study Overview", level=2)
        doc.add_paragraph(f"Study ID: {study_info.study_id}")
        doc.add_paragraph(f"Protocol Number: {study_info.protocol_number}")
        doc.add_paragraph(f"Study Name: {study_info.study_name}")
        doc.add_paragraph(f"Sponsor: {study_info.sponsor}")
        
        # Purpose
        doc.add_heading("2. Purpose", level=2)
        doc.add_paragraph(
            "This Study Data Reviewer's Guide provides an overview of the analysis datasets "
            "submitted for regulatory review. It describes the structure, content, and location "
            "of datasets within the eCTD submission."
        )
        
        # Data standards
        doc.add_heading("3. Data Standards", level=2)
        doc.add_paragraph(f"• ADaM Implementation Guide Version: {study_info.adam_ig_version}")
        doc.add_paragraph("• Define-XML Version: 2.1")
        if study_info.meddra_version:
            doc.add_paragraph(f"• MedDRA Version: {study_info.meddra_version}")
        
        # Dataset inventory
        doc.add_heading("4. Dataset Inventory", level=2)
        doc.add_paragraph(f"This submission contains {len(datasets)} analysis dataset(s):")
        
        # Add numbered list of datasets
        for idx, dataset in enumerate(datasets, 1):
            doc.add_paragraph(
                f"{idx}. {dataset.name}: {dataset.label}",
                style='List Number'
            )
        
        # File locations
        doc.add_heading("5. File Locations", level=2)
        doc.add_paragraph("Analysis datasets are located in the following eCTD structure:")
        doc.add_paragraph("• Module 5 → datasets → analysis → adam → datasets", style='List Bullet')
        doc.add_paragraph("• Define-XML: Module 5 → datasets → analysis → adam → define.xml", style='List Bullet')
        doc.add_paragraph("• ADRG: Module 5 → datasets → analysis → adam → adrg.pdf", style='List Bullet')
        
        # Reviewer notes
        doc.add_heading("6. Reviewer Notes", level=2)
        doc.add_paragraph(
            "All datasets are provided in XPT format (SAS Version 5 Transport Files). "
            "Datasets can be opened using SAS, R, or other statistical software capable of reading XPT files."
        )
        
        if notes:
            doc.add_paragraph(f"\nAdditional Information:\n{notes}")
        
        # Contact information
        doc.add_heading("7. Contact Information", level=2)
        doc.add_paragraph(f"Sponsor: {study_info.sponsor}")
        doc.add_paragraph("[Contact details to be added by sponsor]")
        
        # Footer
        doc.add_paragraph(f"\n\nGenerated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        doc.add_paragraph("Note: This document is a template. Please review and customize as needed.")
        
        # Save document
        output_file = output_dir / f"sdrg_{study_info.study_id}.docx"
        doc.save(str(output_file))
        
        # Calculate checksum
        with open(output_file, 'rb') as f:
            checksum = hashlib.sha256(f.read()).hexdigest()
        
        # Create artifact reference
        artifact = ArtifactRef(
            name=output_file.name,
            path=str(output_file),
            created_at=datetime.utcnow().isoformat(),
            checksum=checksum,
            size_bytes=output_file.stat().st_size
        )
        
        return DocumentResponse(artifact=artifact)
