"""
eCTD Packager

Creates eCTD-compliant submission packages with proper folder structure,
checksums, and manifest files.
"""

from pathlib import Path
from typing import List, Dict, Any
import hashlib
import shutil
import zipfile
from datetime import datetime
from loguru import logger

from ..models import PackageManifest, Artifact


class eCTDPackager:
    """
    Creates eCTD submission packages.
    Handles folder structure, checksums, and ZIP creation.
    """

    def __init__(self, base_path: Path = None):
        if base_path is None:
            base_path = Path("Content/Submissions")
        self.base_path = base_path

    async def package(
        self,
        study_id: str,
        artifacts: List[str],
        create_zip: bool = True
    ) -> PackageManifest:
        """
        Create eCTD package.
        
        Args:
            study_id: Study identifier
            artifacts: List of artifact file paths
            create_zip: Whether to create ZIP archive
            
        Returns:
            PackageManifest with package details
        """
        logger.info(f"Creating eCTD package for {study_id}")

        # Create eCTD directory structure
        ectd_dir = self.base_path / study_id / "ectd"
        self._create_ectd_structure(ectd_dir)

        # Copy artifacts to eCTD structure
        artifact_list = []
        total_size = 0

        for artifact_path in artifacts:
            artifact_file = Path(artifact_path)
            if artifact_file.exists():
                # Determine target location in eCTD structure
                target = self._get_ectd_location(ectd_dir, artifact_file)
                target.parent.mkdir(parents=True, exist_ok=True)
                
                # Copy file
                shutil.copy2(artifact_file, target)
                
                # Calculate checksums
                md5_hash = self._calculate_checksum(target, "md5")
                sha256_hash = self._calculate_checksum(target, "sha256")
                
                artifact_list.append(Artifact(
                    name=artifact_file.name,
                    path=str(target.relative_to(ectd_dir)),
                    size_bytes=target.stat().st_size,
                    checksum_md5=md5_hash,
                    checksum_sha256=sha256_hash
                ))
                
                total_size += target.stat().st_size

        # Create manifest
        manifest_path = ectd_dir / "manifest.json"
        self._create_manifest(manifest_path, artifact_list)

        # Create ZIP if requested
        zip_file = None
        if create_zip:
            zip_file = self._create_zip_archive(ectd_dir, study_id)

        logger.info(f"eCTD package created: {ectd_dir}")

        return PackageManifest(
            study_id=study_id,
            package_path=str(ectd_dir),
            zip_file=zip_file,
            artifacts=artifact_list,
            total_size_bytes=total_size,
            audit_id=f"pkg_{study_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        )

    def _create_ectd_structure(self, ectd_dir: Path):
        """Create standard eCTD folder structure"""
        # Module 5: Clinical Study Reports
        (ectd_dir / "m5" / "datasets" / "analysis" / "adam").mkdir(parents=True, exist_ok=True)
        (ectd_dir / "m5" / "datasets" / "analysis" / "adam" / "programs").mkdir(parents=True, exist_ok=True)
        (ectd_dir / "m5" / "datasets" / "tabulations" / "sdtm").mkdir(parents=True, exist_ok=True)

    def _get_ectd_location(self, ectd_dir: Path, artifact: Path) -> Path:
        """Determine eCTD location for artifact"""
        name = artifact.name.lower()
        
        if "define" in name:
            return ectd_dir / "m5" / "datasets" / "analysis" / "adam" / artifact.name
        elif "adrg" in name or "sdrg" in name:
            return ectd_dir / "m5" / "datasets" / "analysis" / "adam" / artifact.name
        elif artifact.suffix in [".xpt", ".sas7bdat"]:
            return ectd_dir / "m5" / "datasets" / "analysis" / "adam" / artifact.name
        elif artifact.suffix in [".sas", ".r"]:
            return ectd_dir / "m5" / "datasets" / "analysis" / "adam" / "programs" / artifact.name
        else:
            return ectd_dir / artifact.name

    def _calculate_checksum(self, file_path: Path, algorithm: str = "md5") -> str:
        """Calculate file checksum"""
        hash_func = hashlib.md5() if algorithm == "md5" else hashlib.sha256()
        
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_func.update(chunk)
        
        return hash_func.hexdigest()

    def _create_manifest(self, manifest_path: Path, artifacts: List[Artifact]):
        """Create JSON manifest file"""
        import json
        
        manifest_data = {
            "created_at": datetime.utcnow().isoformat() + "Z",
            "artifact_count": len(artifacts),
            "artifacts": [
                {
                    "name": a.name,
                    "path": a.path,
                    "size_bytes": a.size_bytes,
                    "checksum_md5": a.checksum_md5,
                    "checksum_sha256": a.checksum_sha256,
                }
                for a in artifacts
            ]
        }
        
        manifest_path.write_text(json.dumps(manifest_data, indent=2), encoding="utf-8")

    def _create_zip_archive(self, ectd_dir: Path, study_id: str) -> str:
        """Create ZIP archive of eCTD package"""
        timestamp = datetime.now().strftime("%Y%m%d")
        zip_filename = f"{study_id}_eCTD_{timestamp}.zip"
        zip_path = ectd_dir.parent / zip_filename

        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in ectd_dir.rglob("*"):
                if file.is_file():
                    arcname = file.relative_to(ectd_dir.parent)
                    zipf.write(file, arcname)

        logger.info(f"ZIP archive created: {zip_path} ({zip_path.stat().st_size / 1024 / 1024:.2f} MB)")
        return zip_filename
