"""
Program Generator Service
Assembles complete ADAM programs from individual variable code snippets
"""

from typing import List, Dict, Any, Optional
from loguru import logger
from datetime import datetime


class ProgramGeneratorService:
    """Service for generating complete ADAM programs"""
    
    def __init__(self):
        logger.info("Initialized ProgramGeneratorService")
    
    def generate_program_header(
        self,
        language: str,
        dataset: str,
        study_id: str,
        author: str = "ADAM AI Code Generator",
        standards: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Generate program header with metadata
        
        Args:
            language: Programming language (R or SAS)
            dataset: ADAM dataset name
            study_id: Study identifier
            author: Program author
            standards: Standards versions
            
        Returns:
            Formatted program header
        """
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        if language.upper() == "SAS":
            header = f"""/*******************************************************************************
* Program: {dataset}.sas
* Purpose: Generate ADAM {dataset} dataset
* Study: {study_id}
* Author: {author}
* Date: {current_date}
* 
* Standards:
*   CDISC SDTM Version: {standards.get('sdtm_version', 'Unknown') if standards else 'Unknown'}
*   CDISC ADAM IG Version: {standards.get('adam_ig_version', 'Unknown') if standards else 'Unknown'}
*   MedDRA Version: {standards.get('meddra_version', 'Unknown') if standards else 'Unknown'}
*
* Description:
*   This program creates the {dataset} (ADaM) dataset from SDTM data
*   following CDISC ADAM Implementation Guide specifications.
*
* Input Datasets: SDTM datasets from library
* Output Dataset: {dataset}
*
* Modifications:
*   Date        Author          Description
*   {current_date}   {author}    Initial version
*******************************************************************************/

options mprint mlogic symbolgen;

"""
        else:  # R
            header = f"""################################################################################
# Program: {dataset}.R
# Purpose: Generate ADAM {dataset} dataset
# Study: {study_id}
# Author: {author}
# Date: {current_date}
#
# Standards:
#   CDISC SDTM Version: {standards.get('sdtm_version', 'Unknown') if standards else 'Unknown'}
#   CDISC ADAM IG Version: {standards.get('adam_ig_version', 'Unknown') if standards else 'Unknown'}
#   MedDRA Version: {standards.get('meddra_version', 'Unknown') if standards else 'Unknown'}
#
# Description:
#   This program creates the {dataset} (ADaM) dataset from SDTM data
#   following CDISC ADAM Implementation Guide specifications.
#
# Input Datasets: SDTM datasets
# Output Dataset: {dataset}
#
# Modifications:
#   Date        Author          Description
#   {current_date}   {author}    Initial version
################################################################################

# Load required libraries
library(tidyverse)
library(haven)
library(lubridate)

"""
        
        return header
    
    def generate_data_input_section(
        self,
        language: str,
        sdtm_domains: List[str]
    ) -> str:
        """
        Generate data input section to read SDTM datasets
        
        Args:
            language: Programming language
            sdtm_domains: List of SDTM domains to read
            
        Returns:
            Data input code
        """
        if language.upper() == "SAS":
            input_code = "\n/* Read input SDTM datasets */\n"
            for domain in sdtm_domains:
                input_code += f"libname sdtm '&sdtmpath';\n"
                input_code += f"data {domain.lower()};\n"
                input_code += f"    set sdtm.{domain.lower()};\n"
                input_code += f"run;\n\n"
        else:  # R
            input_code = "\n# Read input SDTM datasets\n"
            for domain in sdtm_domains:
                input_code += f"{domain.lower()} <- read_sas(file.path(sdtm_path, '{domain.lower()}.sas7bdat'))\n"
        
        return input_code
    
    def order_variables_by_dependency(
        self,
        variables: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Order variables based on dependencies
        
        Args:
            variables: List of variable specifications with code
            
        Returns:
            Ordered list of variables
        """
        # Simple ordering: categories first, then derivations
        ordered = []
        
        # First: Direct mappings and simple derivations
        for var in variables:
            derivation = var.get('derivation', '').lower()
            if any(word in derivation for word in ['direct', 'copy', 'retain', 'from sdtm']):
                ordered.append(var)
        
        # Second: Calculated fields
        for var in variables:
            if var not in ordered:
                derivation = var.get('derivation', '').lower()
                if any(word in derivation for word in ['calculate', 'compute', 'derive']):
                    ordered.append(var)
        
        # Third: Flags and indicators
        for var in variables:
            if var not in ordered:
                if var.get('name', '').endswith('FL'):
                    ordered.append(var)
        
        # Fourth: Everything else
        for var in variables:
            if var not in ordered:
                ordered.append(var)
        
        logger.info(f"Ordered {len(ordered)} variables by dependency")
        return ordered
    
    def assemble_derivation_code(
        self,
        language: str,
        variables: List[Dict[str, Any]],
        code_snippets: Dict[str, str]
    ) -> str:
        """
        Assemble all variable derivation code
        
        Args:
            language: Programming language
            variables: List of variables (ordered)
            code_snippets: Dictionary mapping variable names to code
            
        Returns:
            Combined derivation code
        """
        if language.upper() == "SAS":
            derivation_code = "\n/* Derive ADAM variables */\ndata adam_data;\n"
            derivation_code += "    set sdtm_data;\n\n"
            
            for var in variables:
                var_name = var.get('name', '')
                code = code_snippets.get(var_name, '')
                
                if code:
                    derivation_code += f"    /* {var_name}: {var.get('label', '')} */\n"
                    derivation_code += f"    {code}\n\n"
            
            derivation_code += "run;\n"
        else:  # R
            derivation_code = "\n# Derive ADAM variables\nadam_data <- sdtm_data %>%\n"
            
            for i, var in enumerate(variables):
                var_name = var.get('name', '')
                code = code_snippets.get(var_name, '')
                
                if code:
                    derivation_code += f"  # {var_name}: {var.get('label', '')}\n"
                    derivation_code += f"  {code}"
                    if i < len(variables) - 1:
                        derivation_code += " %>%\n"
                    else:
                        derivation_code += "\n"
        
        return derivation_code
    
    def generate_output_section(
        self,
        language: str,
        dataset: str,
        output_path: str = ""
    ) -> str:
        """
        Generate output section to save the dataset
        
        Args:
            language: Programming language
            dataset: Dataset name
            output_path: Output path variable
            
        Returns:
            Output code
        """
        if language.upper() == "SAS":
            output_code = f"""
/* Save output dataset */
libname adam '&adampath';
data adam.{dataset.lower()};
    set adam_data;
run;

/* Print summary statistics */
proc contents data=adam.{dataset.lower()};
run;

proc means data=adam.{dataset.lower()} n nmiss mean std min max;
run;
"""
        else:  # R
            output_code = f"""
# Save output dataset
write_sas(adam_data, file.path(adam_path, "{dataset.lower()}.sas7bdat"))

# Print summary statistics
cat("\n=== Dataset Summary ===\n")
print(dim(adam_data))
print(str(adam_data))
print(summary(adam_data))
"""
        
        return output_code
    
    def generate_complete_program(
        self,
        study_id: str,
        dataset: str,
        language: str,
        categorized_variables: Dict[str, Any],
        code_snippets: Dict[str, str],
        standards: Optional[Dict[str, str]] = None,
        sdtm_domains: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate complete ADAM program
        
        Args:
            study_id: Study identifier
            dataset: ADAM dataset name
            language: Programming language
            categorized_variables: Categorized variables structure
            code_snippets: Generated code for each variable
            standards: Standards versions
            sdtm_domains: List of SDTM domains used
            
        Returns:
            Dictionary with program code and metadata
        """
        logger.info(f"Generating complete {language} program for {dataset}")
        
        try:
            # Extract all variables from categories
            all_variables = []
            for category_data in categorized_variables.values():
                if isinstance(category_data, list):
                    all_variables.extend(category_data)
            
            # Order variables by dependency
            ordered_variables = self.order_variables_by_dependency(all_variables)
            
            # Get SDTM domains if not provided
            if not sdtm_domains:
                sdtm_domains = ['DM', 'EX', 'AE', 'VS', 'LB']  # Default common domains
            
            # Assemble program sections
            program_parts = []
            
            # 1. Header
            program_parts.append(self.generate_program_header(
                language=language,
                dataset=dataset,
                study_id=study_id,
                standards=standards
            ))
            
            # 2. Data Input
            program_parts.append(self.generate_data_input_section(
                language=language,
                sdtm_domains=sdtm_domains
            ))
            
            # 3. Derivations
            program_parts.append(self.assemble_derivation_code(
                language=language,
                variables=ordered_variables,
                code_snippets=code_snippets
            ))
            
            # 4. Output
            program_parts.append(self.generate_output_section(
                language=language,
                dataset=dataset
            ))
            
            # Combine all parts
            complete_program = "\n".join(program_parts)
            
            # Generate metadata
            metadata = {
                'study_id': study_id,
                'dataset': dataset,
                'language': language,
                'variable_count': len(ordered_variables),
                'code_snippet_count': len(code_snippets),
                'sdtm_domains': sdtm_domains,
                'generated_at': datetime.now().isoformat(),
                'standards': standards or {}
            }
            
            logger.info(f"Successfully generated program with {len(ordered_variables)} variables")
            
            return {
                'program_code': complete_program,
                'metadata': metadata,
                'variables': [v.get('name') for v in ordered_variables],
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"Error generating program: {str(e)}")
            return {
                'program_code': '',
                'metadata': {},
                'variables': [],
                'status': 'error',
                'error': str(e)
            }
    
    def integrate_user_notes(
        self,
        variable_name: str,
        code_snippet: str,
        user_note: Optional[str],
        language: str
    ) -> str:
        """
        Integrate user notes into code snippet as comments
        
        Args:
            variable_name: Variable name
            code_snippet: Original code snippet
            user_note: User's custom instructions
            language: Programming language (R or SAS)
            
        Returns:
            Enhanced code snippet with user notes
        """
        if not user_note or not user_note.strip():
            return code_snippet
        
        # Format user note as comment
        if language.upper() == "SAS":
            note_comment = f"/* USER NOTE ({variable_name}): {user_note.strip()} */\n    "
        else:  # R
            note_comment = f"  # USER NOTE ({variable_name}): {user_note.strip()}\n  "
        
        # Prepend note to code snippet
        return note_comment + code_snippet
    
    def generate_preferences_comment(
        self,
        language: str,
        preferences: Dict[str, Any]
    ) -> str:
        """
        Generate comment section with user preferences
        
        Args:
            language: Programming language
            preferences: User preferences dictionary
            
        Returns:
            Formatted comment with preferences
        """
        if language.upper() == "SAS":
            comment = "\n/*\n* USER PREFERENCES:\n"
            if preferences.get('sasProcs'):
                comment += f"*   SAS Procedures: {', '.join(preferences['sasProcs'])}\n"
            if preferences.get('customOptions'):
                comment += f"*   Custom Options: {preferences['customOptions']}\n"
            comment += "*/\n\n"
        else:  # R
            comment = "\n#\n# USER PREFERENCES:\n"
            if preferences.get('rPackages'):
                comment += f"#   R Packages: {', '.join(preferences['rPackages'])}\n"
            if preferences.get('customOptions'):
                comment += f"#   Custom Options: {preferences['customOptions']}\n"
            comment += "#\n\n"
        
        return comment
    
    def generate_program_with_notes(
        self,
        study_id: str,
        dataset: str,
        language: str,
        categorized_variables: Dict[str, Any],
        approved_variables: List[str],
        code_snippets: Dict[str, str],
        user_notes: Optional[Dict[str, str]] = None,
        user_preferences: Optional[Dict[str, Any]] = None,
        standards: Optional[Dict[str, str]] = None,
        sdtm_domains: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generate complete ADAM program with user notes and preferences
        
        This is an enhanced version that:
        - Filters to only approved variables
        - Integrates user notes into code comments
        - Applies user preferences
        
        Args:
            study_id: Study identifier
            dataset: ADAM dataset name
            language: Programming language (R or SAS)
            categorized_variables: Categorized variables from specification
            approved_variables: List of approved variable names
            code_snippets: Dictionary mapping variable names to code
            user_notes: Dictionary mapping variable names to user notes
            user_preferences: User programming preferences
            standards: Standards versions
            sdtm_domains: List of SDTM domains to read
            
        Returns:
            Dictionary containing program code and metadata
        """
        try:
            logger.info(f"Generating program with notes for {dataset} in {language}")
            logger.info(f"Approved variables: {len(approved_variables)}")
            logger.info(f"Variables with notes: {len(user_notes) if user_notes else 0}")
            
            user_notes = user_notes or {}
            user_preferences = user_preferences or {}
            
            # Filter categorized variables to only approved ones
            filtered_categories = {}
            all_approved_vars = []
            
            if 'categories' in categorized_variables:
                for category in categorized_variables['categories']:
                    filtered_vars = [
                        v for v in category.get('variables', [])
                        if v.get('name') in approved_variables
                    ]
                    if filtered_vars:
                        all_approved_vars.extend(filtered_vars)
            
            # Order variables by dependency
            ordered_variables = self.order_variables_by_dependency(all_approved_vars)
            
            # Start building program
            program_parts = []
            
            # 1. Header with user preferences
            header = self.generate_program_header(
                language=language,
                dataset=dataset,
                study_id=study_id,
                standards=standards
            )
            
            # Add user preferences to header if provided
            if user_preferences:
                header += self.generate_preferences_comment(language, user_preferences)
            
            program_parts.append(header)
            
            # 2. Input section
            program_parts.append(self.generate_input_section(
                language=language,
                sdtm_domains=sdtm_domains or ['dm', 'ex', 'ae']
            ))
            
            # 3. Derivation code with user notes
            if language.upper() == "SAS":
                derivation_code = "\n/* Derive ADAM variables (approved only) */\ndata adam_data;\n"
                derivation_code += "    set sdtm_data;\n\n"
                
                for var in ordered_variables:
                    var_name = var.get('name', '')
                    code = code_snippets.get(var_name, '')
                    
                    if code:
                        # Add user notes if present
                        enhanced_code = self.integrate_user_notes(
                            variable_name=var_name,
                            code_snippet=code,
                            user_note=user_notes.get(var_name),
                            language=language
                        )
                        
                        derivation_code += f"    /* {var_name}: {var.get('label', '')} */\n"
                        derivation_code += f"    {enhanced_code}\n\n"
                
                derivation_code += "run;\n"
            else:  # R
                derivation_code = "\n# Derive ADAM variables (approved only)\nadam_data <- sdtm_data %>%\n"
                
                for i, var in enumerate(ordered_variables):
                    var_name = var.get('name', '')
                    code = code_snippets.get(var_name, '')
                    
                    if code:
                        # Add user notes if present
                        enhanced_code = self.integrate_user_notes(
                            variable_name=var_name,
                            code_snippet=code,
                            user_note=user_notes.get(var_name),
                            language=language
                        )
                        
                        derivation_code += f"  # {var_name}: {var.get('label', '')}\n"
                        derivation_code += f"  {enhanced_code}"
                        if i < len(ordered_variables) - 1:
                            derivation_code += " %>%\n"
                        else:
                            derivation_code += "\n"
            
            program_parts.append(derivation_code)
            
            # 4. Output
            program_parts.append(self.generate_output_section(
                language=language,
                dataset=dataset
            ))
            
            # Combine all parts
            complete_program = "\n".join(program_parts)
            
            # Generate enhanced metadata
            metadata = {
                'study_id': study_id,
                'dataset': dataset,
                'language': language,
                'approved_variables_count': len(approved_variables),
                'user_notes_count': len(user_notes),
                'variable_count': len(ordered_variables),
                'code_snippet_count': len(code_snippets),
                'sdtm_domains': sdtm_domains,
                'generated_at': datetime.now().isoformat(),
                'standards': standards or {},
                'preferences': user_preferences
            }
            
            logger.info(f"Successfully generated program with {len(ordered_variables)} approved variables")
            
            return {
                'program_code': complete_program,
                'metadata': metadata,
                'variables': [v.get('name') for v in ordered_variables],
                'status': 'success'
            }
            
        except Exception as e:
            logger.error(f"Error generating program with notes: {str(e)}")
            return {
                'program_code': '',
                'metadata': {},
                'variables': [],
                'status': 'error',
                'error': str(e)
            }

