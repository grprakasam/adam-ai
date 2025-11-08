"""
Rule Loading Service
Loads and processes ADAM rules from markdown files in Context/ADAMRules/
"""

from typing import Dict, List, Optional
from pathlib import Path
from loguru import logger

from app.config import settings


class RuleLoadingService:
    """Service for loading and processing ADAM rules"""
    
    def __init__(self):
        self.rules_dir = Path(settings.RULES_DIR)
        self.rules_cache: Dict[str, str] = {}
        
    async def load_all_rules(self) -> Dict[str, str]:
        """
        Load all ADAM rule files from the Context/ADAMRules directory
        
        Returns:
            Dictionary mapping rule file names to their contents
        """
        rules = {}
        
        if not self.rules_dir.exists():
            logger.error(f"Rules directory not found: {self.rules_dir}")
            return rules
        
        # Load all markdown files in the rules directory
        for rule_file in self.rules_dir.glob("*.md"):
            try:
                rule_name = rule_file.stem
                rule_content = rule_file.read_text(encoding='utf-8')
                rules[rule_name] = rule_content
                logger.info(f"Loaded rule file: {rule_name} ({len(rule_content)} chars)")
            except Exception as e:
                logger.error(f"Error loading rule file {rule_file}: {str(e)}")
        
        # Cache the loaded rules
        self.rules_cache = rules
        logger.info(f"Loaded {len(rules)} rule files")
        return rules
    
    async def load_rule_by_name(self, rule_name: str) -> Optional[str]:
        """
        Load a specific rule file by name
        
        Args:
            rule_name: Name of the rule file (without .md extension)
            
        Returns:
            Rule file content, or None if not found
        """
        # Check cache first
        if rule_name in self.rules_cache:
            return self.rules_cache[rule_name]
        
        rule_file = self.rules_dir / f"{rule_name}.md"
        
        if not rule_file.exists():
            logger.warning(f"Rule file not found: {rule_name}")
            return None
        
        try:
            rule_content = rule_file.read_text(encoding='utf-8')
            self.rules_cache[rule_name] = rule_content
            logger.info(f"Loaded rule file: {rule_name} ({len(rule_content)} chars)")
            return rule_content
        except Exception as e:
            logger.error(f"Error loading rule file {rule_name}: {str(e)}")
            return None
    
    async def load_adsl_rules(self) -> Dict[str, str]:
        """
        Load all ADSL-specific rules
        
        Returns:
            Dictionary with ADSL rule files
        """
        adsl_rules = {}
        
        # ADSL rule files based on your structure
        adsl_rule_files = [
            "ADSL_ApplicationBehaviourRules",
            "ADSL_IGSpecificRules",
            "ADSL_MacroLogic"
        ]
        
        for rule_name in adsl_rule_files:
            rule_content = await self.load_rule_by_name(rule_name)
            if rule_content:
                adsl_rules[rule_name] = rule_content
        
        logger.info(f"Loaded {len(adsl_rules)} ADSL rule files")
        return adsl_rules
    
    async def parse_rule_sections(self, rule_content: str) -> Dict[str, List[str]]:
        """
        Parse rule content into logical sections
        
        Args:
            rule_content: Raw markdown content of a rule file
            
        Returns:
            Dictionary mapping section names to their content
        """
        sections = {}
        current_section = "header"
        current_content = []
        
        for line in rule_content.split('\n'):
            # Check for markdown headers (## or ###)
            if line.startswith('##'):
                # Save previous section
                if current_content:
                    sections[current_section] = current_content
                
                # Start new section
                current_section = line.strip('#').strip()
                current_content = []
            else:
                current_content.append(line)
        
        # Save last section
        if current_content:
            sections[current_section] = current_content
        
        return sections
    
    async def extract_rule_requirements(self, rule_content: str) -> List[str]:
        """
        Extract specific requirements from rule content
        
        Args:
            rule_content: Rule file content
            
        Returns:
            List of requirement statements
        """
        requirements = []
        
        # Look for lines that indicate requirements
        # Common patterns: "MUST", "SHALL", "REQUIRED", numbered lists, bullet points
        for line in rule_content.split('\n'):
            line_stripped = line.strip()
            
            # Check for requirement indicators
            if any(keyword in line_stripped.upper() for keyword in ['MUST', 'SHALL', 'REQUIRED', 'MANDATORY']):
                requirements.append(line_stripped)
            # Check for numbered requirements (e.g., "1.", "2.")
            elif line_stripped and line_stripped[0].isdigit() and '.' in line_stripped[:3]:
                requirements.append(line_stripped)
            # Check for bullet points (-, *, •)
            elif line_stripped.startswith(('-', '*', '•')):
                requirements.append(line_stripped)
        
        logger.info(f"Extracted {len(requirements)} requirements from rule content")
        return requirements
    
    async def get_rules_summary(self) -> Dict[str, any]:
        """
        Get a summary of available rules
        
        Returns:
            Dictionary with rule summary information
        """
        if not self.rules_cache:
            await self.load_all_rules()
        
        summary = {
            "total_rules": len(self.rules_cache),
            "rules": []
        }
        
        for rule_name, rule_content in self.rules_cache.items():
            rule_info = {
                "name": rule_name,
                "size": len(rule_content),
                "lines": len(rule_content.split('\n'))
            }
            summary["rules"].append(rule_info)
        
        return summary
    
    async def validate_rule_completeness(self, adam_dataset: str) -> Dict[str, bool]:
        """
        Validate that all required rules for a dataset are available
        
        Args:
            adam_dataset: ADAM dataset type (e.g., "ADSL")
            
        Returns:
            Dictionary with validation results
        """
        required_rules = {
            "ADSL": [
                "ADSL_ApplicationBehaviourRules",
                "ADSL_IGSpecificRules",
                "ADSL_MacroLogic"
            ]
            # Add more dataset types as needed
        }
        
        dataset_upper = adam_dataset.upper()
        
        if dataset_upper not in required_rules:
            logger.warning(f"No rule validation defined for dataset: {dataset_upper}")
            return {"validated": False, "message": "No rule validation defined"}
        
        validation = {}
        for rule_name in required_rules[dataset_upper]:
            validation[rule_name] = rule_name in self.rules_cache or \
                                   (self.rules_dir / f"{rule_name}.md").exists()
        
        all_present = all(validation.values())
        logger.info(f"Rule validation for {dataset_upper}: {all_present}")
        
        return {
            "validated": all_present,
            "rules": validation
        }


# Global service instance
rule_service = RuleLoadingService()
