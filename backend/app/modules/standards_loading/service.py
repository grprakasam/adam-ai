"""
Standards Loading Service
Loads and processes CDISC standards documents from Content/StandardDocuments/
"""

from typing import Dict, List, Optional
from pathlib import Path
from loguru import logger

from app.config import settings


class StandardsLoadingService:
    """Service for loading and processing CDISC standards documents"""
    
    def __init__(self):
        self.standards_dir = Path(settings.BASE_DIR) / ".." / ".." / "Content" / "StandardDocuments"
        self.ig_dir = self.standards_dir / "IG"
        self.toxicity_dir = self.standards_dir / "AETOXGRADING"
        self.meddra_dir = self.standards_dir / "MedraDictionaries"
        self.standards_cache: Dict[str, any] = {}
        
        logger.info(f"Initialized StandardsLoadingService")
        logger.info(f"Standards directory: {self.standards_dir}")
    
    async def load_ig_documents(self) -> Dict[str, str]:
        """
        Load CDISC Implementation Guide documents
        
        Returns:
            Dictionary mapping document names to their contents
        """
        ig_docs = {}
        
        if not self.ig_dir.exists():
            logger.warning(f"IG directory not found: {self.ig_dir}")
            return ig_docs
        
        # Load PDF, DOCX, or markdown files
        for ext in ['*.pdf', '*.docx', '*.md', '*.txt']:
            for doc_file in self.ig_dir.glob(ext):
                try:
                    doc_name = doc_file.stem
                    
                    # For now, just store metadata (actual parsing would require libraries)
                    ig_docs[doc_name] = {
                        'path': str(doc_file),
                        'type': doc_file.suffix,
                        'size': doc_file.stat().st_size
                    }
                    logger.info(f"Found IG document: {doc_name} ({doc_file.suffix})")
                except Exception as e:
                    logger.error(f"Error loading IG document {doc_file}: {str(e)}")
        
        self.standards_cache['ig_documents'] = ig_docs
        logger.info(f"Loaded {len(ig_docs)} IG documents")
        return ig_docs
    
    async def load_toxicity_grading(self) -> Dict[str, any]:
        """
        Load adverse event toxicity grading standards
        
        Returns:
            Dictionary with toxicity grading information
        """
        toxicity_data = {}
        
        if not self.toxicity_dir.exists():
            logger.warning(f"Toxicity directory not found: {self.toxicity_dir}")
            return toxicity_data
        
        # Load toxicity grading files (CSV, Excel, etc.)
        for ext in ['*.csv', '*.xlsx', '*.xls', '*.txt']:
            for tox_file in self.toxicity_dir.glob(ext):
                try:
                    tox_name = tox_file.stem
                    toxicity_data[tox_name] = {
                        'path': str(tox_file),
                        'type': tox_file.suffix,
                        'size': tox_file.stat().st_size
                    }
                    logger.info(f"Found toxicity grading file: {tox_name}")
                except Exception as e:
                    logger.error(f"Error loading toxicity file {tox_file}: {str(e)}")
        
        self.standards_cache['toxicity_grading'] = toxicity_data
        logger.info(f"Loaded {len(toxicity_data)} toxicity grading files")
        return toxicity_data
    
    async def load_meddra_dictionaries(self) -> Dict[str, any]:
        """
        Load MedDRA terminology dictionaries
        
        Returns:
            Dictionary with MedDRA dictionary information
        """
        meddra_data = {}
        
        if not self.meddra_dir.exists():
            logger.warning(f"MedDRA directory not found: {self.meddra_dir}")
            return meddra_data
        
        # Load MedDRA files (usually ASC or TXT files)
        for ext in ['*.asc', '*.txt', '*.csv']:
            for meddra_file in self.meddra_dir.glob(ext):
                try:
                    meddra_name = meddra_file.stem
                    meddra_data[meddra_name] = {
                        'path': str(meddra_file),
                        'type': meddra_file.suffix,
                        'size': meddra_file.stat().st_size
                    }
                    logger.info(f"Found MedDRA file: {meddra_name}")
                except Exception as e:
                    logger.error(f"Error loading MedDRA file {meddra_file}: {str(e)}")
        
        self.standards_cache['meddra_dictionaries'] = meddra_data
        logger.info(f"Loaded {len(meddra_data)} MedDRA dictionary files")
        return meddra_data
    
    async def load_all_standards(self) -> Dict[str, any]:
        """
        Load all standards documents
        
        Returns:
            Dictionary with all standards information
        """
        logger.info("Loading all standards documents...")
        
        all_standards = {
            'ig_documents': await self.load_ig_documents(),
            'toxicity_grading': await self.load_toxicity_grading(),
            'meddra_dictionaries': await self.load_meddra_dictionaries()
        }
        
        total_count = (
            len(all_standards['ig_documents']) +
            len(all_standards['toxicity_grading']) +
            len(all_standards['meddra_dictionaries'])
        )
        
        logger.info(f"Loaded {total_count} total standards documents")
        return all_standards
    
    async def get_standards_summary(self) -> Dict[str, any]:
        """
        Get summary of available standards
        
        Returns:
            Dictionary with standards summary
        """
        if not self.standards_cache:
            await self.load_all_standards()
        
        summary = {
            'ig_documents': {
                'count': len(self.standards_cache.get('ig_documents', {})),
                'available': list(self.standards_cache.get('ig_documents', {}).keys())
            },
            'toxicity_grading': {
                'count': len(self.standards_cache.get('toxicity_grading', {})),
                'available': list(self.standards_cache.get('toxicity_grading', {}).keys())
            },
            'meddra_dictionaries': {
                'count': len(self.standards_cache.get('meddra_dictionaries', {})),
                'available': list(self.standards_cache.get('meddra_dictionaries', {}).keys())
            }
        }
        
        return summary
    
    def get_standard_by_name(self, category: str, name: str) -> Optional[Dict]:
        """
        Get specific standard document by name
        
        Args:
            category: Category (ig_documents, toxicity_grading, meddra_dictionaries)
            name: Document name
            
        Returns:
            Document information or None
        """
        if category not in self.standards_cache:
            return None
        
        return self.standards_cache[category].get(name)
    
    def validate_standards_availability(self) -> Dict[str, bool]:
        """
        Validate that required standards are available
        
        Returns:
            Dictionary with validation results
        """
        return {
            'ig_documents': self.ig_dir.exists() and any(self.ig_dir.iterdir()),
            'toxicity_grading': self.toxicity_dir.exists() and any(self.toxicity_dir.iterdir()),
            'meddra_dictionaries': self.meddra_dir.exists() and any(self.meddra_dir.iterdir())
        }
