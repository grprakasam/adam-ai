"""
Rule Linker - Links ADAM variables to ADAM IG rule references
"""

import yaml
from pathlib import Path
from typing import List, Dict
from loguru import logger


class RuleLinker:
    """Link ADAM variables to ADAM IG rule references"""

    def __init__(self):
        self.rules_db = self._load_rules_database()

    def _load_rules_database(self) -> Dict:
        """
        Load ADAM IG rules from structured YAML

        Expected format:
        # Context/ADAMRules/ADSL_IGRules.yaml
        rules:
          - rule_id: "ADSL-001"
            variables: ["USUBJID", "STUDYID"]
            description: "Subject identifiers must be unique"
            ig_reference: "ADaM IG v1.3 Section 3.1.1"
        """
        # Path resolution: backend/app/modules/traceability/rule_linker.py
        # parents[4] = ADAM_AI/ (project root)
        project_root = Path(__file__).resolve().parents[4]
        rules_path = project_root / "Context" / "ADAMRules"
        
        # Fallback: try relative to current working directory
        if not rules_path.exists():
            rules_path = Path.cwd() / "Context" / "ADAMRules"
        
        rules_db = {}

        # Check if rules directory exists
        if not rules_path.exists():
            logger.warning(f"Rules directory not found: {rules_path}")
            return rules_db

        logger.info(f"Loading ADAM IG rules from: {rules_path}")

        # Load YAML files
        for yaml_file in rules_path.glob("*_IGRules.yaml"):
            try:
                with open(yaml_file, 'r') as f:
                    data = yaml.safe_load(f)
                    if not data or 'rules' not in data:
                        logger.warning(f"No rules found in {yaml_file}")
                        continue

                    for rule in data.get('rules', []):
                        for var in rule.get('variables', []):
                            if var not in rules_db:
                                rules_db[var] = []
                            rules_db[var].append({
                                'rule_id': rule.get('rule_id'),
                                'reference': rule.get('ig_reference'),
                                'description': rule.get('description')
                            })
                logger.debug(f"Loaded {len(data.get('rules', []))} rules from {yaml_file.name}")
            except Exception as e:
                logger.error(f"Failed to load {yaml_file}: {e}")

        logger.info(f"Loaded rules for {len(rules_db)} variables")
        return rules_db

    async def link_rules(
        self,
        spec_variables: List[Dict],
        dataset: str
    ) -> Dict[str, List[str]]:
        """
        Link variables to ADAM IG rule references

        Returns: {variable_name: [rule_reference, ...]}
        """
        linked_rules = {}

        for spec_var in spec_variables:
            var_name = spec_var['variable_name']

            # Check rules database
            if var_name in self.rules_db:
                linked_rules[var_name] = [
                    rule['reference']
                    for rule in self.rules_db[var_name]
                ]
            else:
                # Fallback: pattern-based linking
                inferred_refs = self._infer_rules_from_pattern(var_name, dataset)
                if inferred_refs:
                    linked_rules[var_name] = inferred_refs

        logger.info(f"Linked rules for {len(linked_rules)} variables")
        return linked_rules

    def _infer_rules_from_pattern(self, var_name: str, dataset: str) -> List[str]:
        """Infer rule references from variable naming patterns"""
        refs = []

        # Subject identifiers
        if var_name in ['STUDYID', 'USUBJID', 'SUBJID']:
            refs.append('ADaM IG v1.3 §3.1.1 (Subject Identifiers)')

        # Treatment variables
        if var_name.startswith('TRT') and var_name.endswith(('P', 'A')):
            refs.append('ADaM IG v1.3 §3.2.4 (Treatment Variables)')

        # Date variables
        if var_name.endswith('DT') or var_name.endswith('DTM'):
            refs.append('ADaM IG v1.3 §3.3.2 (Date/Time Variables)')

        # Flag variables
        if var_name.endswith('FL'):
            refs.append('ADaM IG v1.3 §3.4.1 (Flag Variables)')

        return refs
