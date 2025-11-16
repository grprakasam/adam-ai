"""
Unit tests for ProgramGeneratorService
Tests header generation, data input sections, variable ordering, and program assembly
"""

import pytest
from datetime import datetime
from unittest.mock import Mock, patch
from app.modules.program_generation.service import ProgramGeneratorService


class TestProgramGeneratorService:
    """Test suite for ProgramGeneratorService"""

    @pytest.fixture
    def service(self):
        """Fixture providing initialized ProgramGeneratorService"""
        return ProgramGeneratorService()

    @pytest.fixture
    def sample_standards(self):
        """Fixture providing sample standards"""
        return {
            'sdtm_version': '3.4',
            'adam_ig_version': '1.1',
            'meddra_version': '27.0'
        }

    @pytest.fixture
    def sample_variables(self):
        """Fixture providing sample variables for testing"""
        return [
            {
                'name': 'STUDYID',
                'label': 'Study Identifier',
                'derivation': 'Direct from SDTM'
            },
            {
                'name': 'AGE',
                'label': 'Age at Baseline',
                'derivation': 'Calculate from DOB'
            },
            {
                'name': 'AGEFL',
                'label': 'Age Flag',
                'derivation': 'Flag variable'
            }
        ]

    @pytest.fixture
    def sample_code_snippets(self):
        """Fixture providing sample code snippets"""
        return {
            'STUDYID': 'STUDYID = input_studyid;',
            'AGE': 'AGE = year(today()) - year(DOB);',
            'AGEFL': 'AGEFL = (AGE >= 18);'
        }

    # Test header generation
    def test_generate_sas_header(self, service, sample_standards):
        """Test SAS program header generation"""
        header = service.generate_program_header(
            language='SAS',
            dataset='ADSL',
            study_id='STUDY001',
            author='Test Author',
            standards=sample_standards
        )

        assert '* Program: ADSL.sas' in header
        assert '* Study: STUDY001' in header
        assert '* Author: Test Author' in header
        assert 'CDISC SDTM Version: 3.4' in header
        assert 'CDISC ADAM IG Version: 1.1' in header
        assert 'options mprint mlogic symbolgen;' in header

    def test_generate_r_header(self, service, sample_standards):
        """Test R program header generation"""
        header = service.generate_program_header(
            language='R',
            dataset='ADAE',
            study_id='STUDY002',
            standards=sample_standards
        )

        assert '# Program: ADAE.R' in header
        assert '# Study: STUDY002' in header
        assert 'CDISC SDTM Version: 3.4' in header
        assert 'library(tidyverse)' in header
        assert 'library(haven)' in header

    def test_header_includes_current_date(self, service, sample_standards):
        """Test that header includes current date"""
        with patch('app.modules.program_generation.service.datetime') as mock_datetime:
            mock_datetime.now.return_value.strftime.return_value = '2024-01-15'

            header = service.generate_program_header(
                language='R',
                dataset='ADSL',
                study_id='STUDY001',
                standards=sample_standards
            )

            assert '2024-01-15' in header

    def test_header_handles_missing_standards(self, service):
        """Test header generation without standards"""
        header = service.generate_program_header(
            language='SAS',
            dataset='ADSL',
            study_id='STUDY001'
        )

        assert 'Unknown' in header
        assert '* Program: ADSL.sas' in header

    # Test data input section generation
    def test_generate_sas_data_input_section(self, service):
        """Test SAS data input section"""
        sdtm_domains = ['DM', 'AE', 'LB']
        input_code = service.generate_data_input_section('SAS', sdtm_domains)

        assert 'Read input SDTM datasets' in input_code
        assert 'dm' in input_code.lower()
        assert 'ae' in input_code.lower()
        assert 'lb' in input_code.lower()
        assert 'set sdtm.' in input_code

    def test_generate_r_data_input_section(self, service):
        """Test R data input section"""
        sdtm_domains = ['DM', 'AE']
        input_code = service.generate_data_input_section('R', sdtm_domains)

        assert 'Read input SDTM datasets' in input_code
        assert 'read_sas' in input_code
        assert 'dm' in input_code.lower()
        assert 'ae' in input_code.lower()

    def test_data_input_section_empty_domains(self, service):
        """Test data input section with empty domains"""
        input_code = service.generate_data_input_section('SAS', [])
        assert 'Read input SDTM datasets' in input_code

    # Test variable ordering
    def test_order_variables_by_dependency(self, service, sample_variables):
        """Test variable ordering by dependency"""
        ordered = service.order_variables_by_dependency(sample_variables)

        # Direct mappings should come first
        assert ordered[0]['name'] == 'STUDYID'
        # Flag variables should be after
        assert ordered[-1]['name'] == 'AGEFL'
        # Should have all variables
        assert len(ordered) == 3

    def test_order_preserves_all_variables(self, service, sample_variables):
        """Test that ordering preserves all variables"""
        ordered = service.order_variables_by_dependency(sample_variables)

        original_names = {v['name'] for v in sample_variables}
        ordered_names = {v['name'] for v in ordered}

        assert original_names == ordered_names

    def test_order_with_complex_dependencies(self, service):
        """Test ordering with complex dependency patterns"""
        variables = [
            {'name': 'VAR1', 'derivation': 'Calculate from VAR2'},
            {'name': 'VAR2', 'derivation': 'Direct from SDTM'},
            {'name': 'VAR3FL', 'derivation': 'Flag for VAR3'},
            {'name': 'VAR3', 'derivation': 'Derived calculation'}
        ]

        ordered = service.order_variables_by_dependency(variables)

        # Direct mappings first
        assert ordered[0]['name'] == 'VAR2'
        # Flags last
        assert ordered[-1]['name'] == 'VAR3FL'

    # Test derivation code assembly
    def test_assemble_sas_derivation_code(self, service, sample_variables, sample_code_snippets):
        """Test SAS derivation code assembly"""
        code = service.assemble_derivation_code('SAS', sample_variables, sample_code_snippets)

        assert 'Derive ADAM variables' in code
        assert 'data adam_data;' in code
        assert 'set sdtm_data;' in code
        assert 'STUDYID:' in code
        assert 'run;' in code

    def test_assemble_r_derivation_code(self, service, sample_variables, sample_code_snippets):
        """Test R derivation code assembly"""
        code = service.assemble_derivation_code('R', sample_variables, sample_code_snippets)

        assert 'Derive ADAM variables' in code
        assert 'adam_data <- sdtm_data %>%' in code
        assert 'AGE:' in code

    def test_derivation_code_includes_all_snippets(self, service, sample_variables, sample_code_snippets):
        """Test that all code snippets are included"""
        code = service.assemble_derivation_code('SAS', sample_variables, sample_code_snippets)

        for snippet in sample_code_snippets.values():
            assert snippet in code

    def test_derivation_code_with_missing_snippets(self, service):
        """Test derivation code assembly when some snippets are missing"""
        variables = [
            {'name': 'VAR1', 'label': 'Variable 1'},
            {'name': 'VAR2', 'label': 'Variable 2'}
        ]
        snippets = {'VAR1': 'VAR1 = input_value;'}  # VAR2 is missing

        code = service.assemble_derivation_code('SAS', variables, snippets)

        assert 'VAR1:' in code
        assert code.count('/*') >= 1  # At least one comment

    # Test output section generation
    def test_generate_sas_output_section(self, service):
        """Test SAS output section generation"""
        output_code = service.generate_output_section('SAS', 'ADSL')

        assert 'Save output dataset' in output_code
        assert 'libname adam' in output_code
        assert 'data adam.adsl;' in output_code
        assert 'proc contents' in output_code
        assert 'proc means' in output_code

    def test_generate_r_output_section(self, service):
        """Test R output section generation"""
        output_code = service.generate_output_section('R', 'ADAE')

        assert 'Save output dataset' in output_code
        assert 'write_sas' in output_code
        assert 'adae.sas7bdat' in output_code
        assert 'summary' in output_code

    def test_output_section_dataset_name_formatting(self, service):
        """Test that dataset names are properly formatted"""
        output_code = service.generate_output_section('SAS', 'ADSL')

        # Should use lowercase in some places
        assert 'adsl' in output_code.lower()

    # Test complete program generation
    def test_generate_complete_sas_program(self, service, sample_standards, sample_variables, sample_code_snippets):
        """Test complete SAS program generation"""
        categorized_vars = {
            'variables': sample_variables
        }

        result = service.generate_complete_program(
            study_id='STUDY001',
            dataset='ADSL',
            language='SAS',
            categorized_variables=categorized_vars,
            code_snippets=sample_code_snippets,
            standards=sample_standards,
            sdtm_domains=['DM', 'AE']
        )

        assert 'code' in result
        assert 'metadata' in result
        assert 'ADSL' in result['code']
        assert 'STUDY001' in result['code']

    def test_generate_complete_r_program(self, service, sample_standards, sample_variables, sample_code_snippets):
        """Test complete R program generation"""
        categorized_vars = {
            'variables': sample_variables
        }

        result = service.generate_complete_program(
            study_id='STUDY002',
            dataset='ADAE',
            language='R',
            categorized_variables=categorized_vars,
            code_snippets=sample_code_snippets,
            standards=sample_standards
        )

        assert 'code' in result
        assert result['code'] is not None
        assert len(result['code']) > 0

    def test_complete_program_includes_all_sections(self, service, sample_standards, sample_variables, sample_code_snippets):
        """Test that complete program includes header, input, derivation, and output sections"""
        categorized_vars = {
            'variables': sample_variables
        }

        result = service.generate_complete_program(
            study_id='STUDY001',
            dataset='ADSL',
            language='R',
            categorized_variables=categorized_vars,
            code_snippets=sample_code_snippets,
            standards=sample_standards,
            sdtm_domains=['DM']
        )

        code = result['code']
        assert 'Program:' in code
        assert 'STUDY001' in code

    def test_complete_program_handles_empty_snippets(self, service, sample_standards, sample_variables):
        """Test complete program generation with empty code snippets"""
        categorized_vars = {
            'variables': sample_variables
        }

        result = service.generate_complete_program(
            study_id='STUDY001',
            dataset='ADSL',
            language='SAS',
            categorized_variables=categorized_vars,
            code_snippets={},  # Empty snippets
            standards=sample_standards
        )

        assert 'code' in result
        assert result['code'] is not None

    def test_complete_program_language_case_insensitive(self, service, sample_standards, sample_variables, sample_code_snippets):
        """Test that language parameter is case-insensitive"""
        categorized_vars = {
            'variables': sample_variables
        }

        result_upper = service.generate_complete_program(
            study_id='STUDY001',
            dataset='ADSL',
            language='SAS',
            categorized_variables=categorized_vars,
            code_snippets=sample_code_snippets,
            standards=sample_standards
        )

        result_lower = service.generate_complete_program(
            study_id='STUDY001',
            dataset='ADSL',
            language='sas',
            categorized_variables=categorized_vars,
            code_snippets=sample_code_snippets,
            standards=sample_standards
        )

        # Both should produce SAS code
        assert 'ADSL' in result_upper['code']
        assert 'ADSL' in result_lower['code']
