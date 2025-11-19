"""
eCTD (Electronic Common Technical Document) packager
Creates FDA-style M5 folder structure for ADAM submissions
"""

import shutil
import json
import hashlib
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import zipfile

from .models import ECTDPackageRequest, ECTDPackageResponse, ArtifactRef


class ECTDPackager:
    """
    Creates FDA-style eCTD M5 folder structure
    Packages ADAM artifacts for regulatory submission
    """
    
    def __init__(self):
        self.m5_structure = [
            "m5/datasets/analysis/adam/datasets",
            "m5/datasets/analysis/adam/programs",
            "m5/datasets/analysis/adam/documentation"
        ]
    
    def _create_directory_structure(self, base_dir: Path) -> None:
        """Create eCTD M5 directory structure"""
        for path in self.m5_structure:
            (base_dir / path).mkdir(parents=True, exist_ok=True)
    
    def _calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA-256 checksum"""
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()
    
    def _create_manifest(
        self,
        base_dir: Path,
        file_list: List[Dict[str, str]]
    ) -> Dict[str, Any]:
        """Create manifest.json with file inventory"""
        manifest = {
            "created_at": datetime.utcnow().isoformat(),
            "ectd_version": "3.2.2",
            "structure": "FDA M5",
            "files": file_list,
            "total_files": len(file_list)
        }
        
        manifest_path = base_dir / "manifest.json"
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        return manifest
    
    def _copy_artifact(
        self,
        source_path: Path,
        dest_dir: Path
    ) -> Dict[str, str]:
        """Copy artifact and return file info"""
        dest_path = dest_dir / source_path.name
        shutil.copy2(source_path, dest_path)
        
        return {
            "name": source_path.name,
            "path": str(dest_path.relative_to(dest_path.parents[3])),  # Relative to eCTD root
            "size_bytes": dest_path.stat().st_size,
            "checksum": self._calculate_checksum(dest_path),
            "copied_at": datetime.utcnow().isoformat()
        }
    
    def _create_zip(self, source_dir: Path, zip_path: Path) -> None:
        """Create ZIP archive of eCTD package"""
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in source_dir.rglob('*'):
                if file_path.is_file():
                    arcname = file_path.relative_to(source_dir)
                    zipf.write(file_path, arcname)
    
    def package(
        self,
        study_id: str,
        include_define_xml: bool = True,
        include_adrg: bool = True,
        include_sdrg: bool = True,
        include_programs: bool = False,
        create_zip: bool = False,
        target_dir: Optional[Path] = None
    ) -> ECTDPackageResponse:
        """
        Create eCTD package
        
        Args:
            study_id: Study identifier
            include_define_xml: Include Define.xml
            include_adrg: Include ADRG
            include_sdrg: Include SDRG
            include_programs: Include program files
            create_zip: Create ZIP archive
            target_dir: Target directory for eCTD package
        
        Returns:
            ECTDPackageResponse with artifact and tree structure
        """
        # Set up directories
        base_submissions_dir = Path(__file__).parents[4] / "Content" / "Submissions" / study_id
        
        if target_dir is None:
            target_dir = base_submissions_dir / "ectd"
        else:
            target_dir = Path(target_dir)
        
        # Create eCTD structure
        self._create_directory_structure(target_dir)
        
        file_list = []
        
        # Copy Define.xml
        if include_define_xml:
            define_dir = base_submissions_dir / "definexml"
            if define_dir.exists():
                for define_file in define_dir.glob("*.xml"):
                    dest_dir = target_dir / "m5" / "datasets" / "analysis" / "adam"
                    file_info = self._copy_artifact(define_file, dest_dir)
                    file_list.append(file_info)
        
        # Copy ADRG
        if include_adrg:
            docs_dir = base_submissions_dir / "docs"
            if docs_dir.exists():
                for adrg_file in docs_dir.glob("adrg_*.docx"):
                    dest_dir = target_dir / "m5" / "datasets" / "analysis" / "adam" / "documentation"
                    file_info = self._copy_artifact(adrg_file, dest_dir)
                    file_list.append(file_info)
        
        # Copy SDRG
        if include_sdrg:
            docs_dir = base_submissions_dir / "docs"
            if docs_dir.exists():
                for sdrg_file in docs_dir.glob("sdrg_*.docx"):
                    dest_dir = target_dir / "m5" / "datasets" / "analysis" / "adam" / "documentation"
                    file_info = self._copy_artifact(sdrg_file, dest_dir)
                    file_list.append(file_info)
        
        # Copy program files (if requested)
        if include_programs:
            programs_dir = base_submissions_dir / "programs"
            if programs_dir.exists():
                for program_file in programs_dir.rglob("*"):
                    if program_file.is_file():
                        dest_dir = target_dir / "m5" / "datasets" / "analysis" / "adam" / "programs"
                        file_info = self._copy_artifact(program_file, dest_dir)
                        file_list.append(file_info)
        
        # Create manifest
        manifest = self._create_manifest(target_dir, file_list)
        
        # Get directory tree
        tree = []
        for path in sorted(target_dir.rglob('*')):
            if path.is_file():
                rel_path = path.relative_to(target_dir)
                tree.append(str(rel_path))
        
        # Create ZIP if requested
        if create_zip:
            zip_path = target_dir.parent / f"{study_id}_ectd_package.zip"
            self._create_zip(target_dir, zip_path)
            
            # Update artifact to point to ZIP
            artifact = ArtifactRef(
                name=zip_path.name,
                path=str(zip_path),
                created_at=datetime.utcnow().isoformat(),
                checksum=self._calculate_checksum(zip_path),
                size_bytes=zip_path.stat().st_size
            )
        else:
            # Artifact points to directory
            artifact = ArtifactRef(
                name=target_dir.name,
                path=str(target_dir),
                created_at=datetime.utcnow().isoformat(),
                checksum=None,  # Directory doesn't have single checksum
                size_bytes=sum(f.stat().st_size for f in target_dir.rglob('*') if f.is_file())
            )
        
        return ECTDPackageResponse(
            artifact=artifact,
            tree=tree,
            manifest=manifest
        )
