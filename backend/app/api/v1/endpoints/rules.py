"""
Rules API Endpoints

Endpoints for accessing ADAM rules and standards
"""

from fastapi import APIRouter, HTTPException
from loguru import logger
from typing import Dict, List, Optional

from app.modules.rule_loading.service import RuleLoadingService

router = APIRouter(prefix="/rules")

# Initialize rule service
rule_service = RuleLoadingService()


@router.get("/list")
async def list_rules():
    """
    Get list of available ADAM rule files
    
    Returns:
        Summary of available rules
    """
    try:
        summary = await rule_service.get_rules_summary()
        logger.info(f"Retrieved rules summary: {summary['total_rules']} rules")
        return summary
    except Exception as e:
        logger.error(f"Failed to list rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list rules: {str(e)}")


@router.get("/load-all")
async def load_all_rules():
    """
    Load all ADAM rule files
    
    Returns:
        Dictionary mapping rule names to their contents
    """
    try:
        rules = await rule_service.load_all_rules()
        logger.info(f"Loaded {len(rules)} rule files")
        return {
            "total_rules": len(rules),
            "rules": rules
        }
    except Exception as e:
        logger.error(f"Failed to load all rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load rules: {str(e)}")


@router.get("/load/{rule_name}")
async def load_rule_by_name(rule_name: str):
    """
    Load a specific rule file by name
    
    Args:
        rule_name: Name of the rule file (without .md extension)
        
    Returns:
        Rule file content
    """
    try:
        rule_content = await rule_service.load_rule_by_name(rule_name)
        
        if not rule_content:
            raise HTTPException(status_code=404, detail=f"Rule '{rule_name}' not found")
        
        logger.info(f"Loaded rule: {rule_name}")
        return {
            "rule_name": rule_name,
            "content": rule_content,
            "size": len(rule_content)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to load rule {rule_name}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load rule: {str(e)}")


@router.get("/adsl")
async def load_adsl_rules():
    """
    Load all ADSL-specific rules
    
    Returns:
        Dictionary with ADSL rule files
    """
    try:
        rules = await rule_service.load_adsl_rules()
        logger.info(f"Loaded {len(rules)} ADSL rule files")
        return {
            "dataset": "ADSL",
            "total_rules": len(rules),
            "rules": rules
        }
    except Exception as e:
        logger.error(f"Failed to load ADSL rules: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to load ADSL rules: {str(e)}")


@router.post("/parse-sections")
async def parse_rule_sections(rule_content: str):
    """
    Parse rule content into logical sections
    
    Args:
        rule_content: Raw markdown content of a rule file
        
    Returns:
        Dictionary mapping section names to their content
    """
    try:
        sections = await rule_service.parse_rule_sections(rule_content)
        logger.info(f"Parsed {len(sections)} sections from rule content")
        return {
            "total_sections": len(sections),
            "sections": sections
        }
    except Exception as e:
        logger.error(f"Failed to parse rule sections: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse sections: {str(e)}")


@router.post("/extract-requirements")
async def extract_requirements(rule_content: str):
    """
    Extract specific requirements from rule content
    
    Args:
        rule_content: Rule file content
        
    Returns:
        List of requirement statements
    """
    try:
        requirements = await rule_service.extract_rule_requirements(rule_content)
        logger.info(f"Extracted {len(requirements)} requirements")
        return {
            "total_requirements": len(requirements),
            "requirements": requirements
        }
    except Exception as e:
        logger.error(f"Failed to extract requirements: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract requirements: {str(e)}")


@router.get("/validate/{adam_dataset}")
async def validate_rule_completeness(adam_dataset: str):
    """
    Validate that all required rules for a dataset are available
    
    Args:
        adam_dataset: ADAM dataset type (e.g., "ADSL")
        
    Returns:
        Dictionary with validation results
    """
    try:
        validation_result = await rule_service.validate_rule_completeness(adam_dataset)
        logger.info(f"Validated rules for {adam_dataset}")
        return {
            "dataset": adam_dataset,
            "validation": validation_result
        }
    except Exception as e:
        logger.error(f"Failed to validate rules for {adam_dataset}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to validate rules: {str(e)}")
