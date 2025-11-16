"""
Unit tests for test data generation and code generation utilities
Tests synthetic data generation, code cleaning, and prompt building
"""

import pytest
from unittest.mock import Mock, patch
from typing import Dict, Any
from app.modules.code_generator.service import clean_generated_code
from app.modules.code_generator.prompt_builder import PromptBuilder
from app.modules.code_generator.cache_manager import CacheManager


class TestCodeCleaning:
    """Test code cleaning and normalization"""

    def test_clean_r_code_removes_library_statements(self):
        """Test that R library() statements are removed"""
        raw_code = """
# Load libraries
library(tidyverse)
library(haven)

# Derive variable
AGE <- year(today()) - year(DOB)
"""
        cleaned = clean_generated_code(raw_code, 'R')

        assert 'library(tidyverse)' not in cleaned
        assert 'library(haven)' not in cleaned
        assert 'AGE' in cleaned
        assert 'year(today())' in cleaned

    def test_clean_sas_code_removes_example_sections(self):
        """Test that example sections are removed"""
        raw_code = """
/* Derive Age */
AGE = year(today()) - year(DOB);

/* Example usage:
data test;
  set input;
  AGE = year(today()) - year(DOB);
run;
*/
"""
        cleaned = clean_generated_code(raw_code, 'SAS')

        assert 'AGE = year(today())' in cleaned
        assert 'Example usage' not in cleaned
        assert 'data test;' not in cleaned

    def test_clean_code_removes_test_data_comments(self):
        """Test that test data comments are removed"""
        raw_code = """
# Test data:
# AGE = 25
# DOB = '1999-01-01'

AGE <- year(today()) - year(DOB)
"""
        cleaned = clean_generated_code(raw_code, 'R')

        assert 'AGE <- year(today())' in cleaned
        assert 'Test data:' not in cleaned

    def test_clean_code_removes_introductory_comments(self):
        """Test that introductory comments are removed"""
        raw_code = """
/* Based on ADAM Implementation Guide */
/* Derivation of Age variable */

AGE = yrdif(DOB, RFSTDTC);
"""
        cleaned = clean_generated_code(raw_code, 'SAS')

        assert 'Based on ADAM' not in cleaned
        assert 'Derivation of' not in cleaned
        assert 'AGE = yrdif' in cleaned

    def test_clean_code_preserves_essential_derivations(self):
        """Test that essential derivation logic is preserved"""
        raw_code = """
# Calculate derived variable
BMI <- WEIGHT / (HEIGHT ** 2)

# For reference
# This calculates body mass index
"""
        cleaned = clean_generated_code(raw_code, 'R')

        assert 'BMI <-' in cleaned
        assert 'WEIGHT / (HEIGHT ** 2)' in cleaned

    def test_clean_code_removes_leading_trailing_blank_lines(self):
        """Test that leading and trailing blank lines are removed"""
        raw_code = """


AGE <- year(today()) - year(DOB)


"""
        cleaned = clean_generated_code(raw_code, 'R')

        # Should not start or end with blank lines
        assert not cleaned.startswith('\n')
        assert not cleaned.endswith('\n')

    def test_clean_r_code_language_case_insensitive(self):
        """Test that language parameter is case-insensitive"""
        raw_code = """
library(tidyverse)
AGE <- 25
"""
        cleaned_upper = clean_generated_code(raw_code, 'R')
        cleaned_lower = clean_generated_code(raw_code, 'r')

        # Both should produce same result
        assert 'library' not in cleaned_upper
        assert 'library' not in cleaned_lower


class TestPromptBuilder:
    """Test prompt building for code generation"""

    @pytest.fixture
    def prompt_builder(self):
        """Fixture providing PromptBuilder instance"""
        return PromptBuilder()

    @pytest.fixture
    def sample_variable(self):
        """Sample variable specification"""
        return {
            'name': 'AGE',
            'label': 'Age at Baseline',
            'category': 'Demographic',
            'derivation': 'Calculate from birth date'
        }

    @pytest.fixture
    def sample_context(self):
        """Sample context for code generation"""
        return {
            'study_id': 'STUDY001',
            'dataset': 'ADSL',
            'sdtm_version': '3.4',
            'adam_version': '1.1',
            'language': 'R'
        }

    def test_prompt_builder_initialization(self, prompt_builder):
        """Test PromptBuilder initializes correctly"""
        assert prompt_builder is not None

    def test_build_basic_prompt(self, prompt_builder, sample_variable, sample_context):
        """Test building a basic code generation prompt"""
        prompt = prompt_builder.build_prompt(sample_variable, sample_context)

        assert prompt is not None
        assert isinstance(prompt, str)
        assert len(prompt) > 0
        assert sample_variable['name'] in prompt or 'AGE' in prompt

    def test_prompt_includes_context_information(self, prompt_builder, sample_variable, sample_context):
        """Test that prompt includes necessary context"""
        prompt = prompt_builder.build_prompt(sample_variable, sample_context)

        # Prompt should include key context information
        assert 'STUDY001' in prompt or 'study' in prompt.lower()
        assert 'ADSL' in prompt or 'adsl' in prompt.lower()
        assert 'R' in prompt or 'language' in prompt.lower()

    def test_prompt_includes_variable_details(self, prompt_builder, sample_variable, sample_context):
        """Test that prompt includes variable details"""
        prompt = prompt_builder.build_prompt(sample_variable, sample_context)

        # Should include variable name and label
        assert sample_variable['name'] in prompt or sample_variable['label'] in prompt

    def test_build_prompt_with_dependencies(self, prompt_builder, sample_context):
        """Test building prompt with variable dependencies"""
        variable = {
            'name': 'AGE',
            'label': 'Age at Baseline',
            'category': 'Demographic',
            'derivation': 'Calculate from birth date',
            'dependencies': ['DOB', 'RFSTDTC']
        }

        prompt = prompt_builder.build_prompt(variable, sample_context)

        assert prompt is not None
        # Should acknowledge dependencies
        assert 'DOB' in prompt or 'dependency' in prompt.lower() or 'depend' in prompt.lower()

    def test_build_prompt_respects_language(self, prompt_builder, sample_variable):
        """Test that prompt respects specified language"""
        sas_context = {
            'study_id': 'STUDY001',
            'dataset': 'ADSL',
            'language': 'SAS'
        }
        r_context = {
            'study_id': 'STUDY001',
            'dataset': 'ADSL',
            'language': 'R'
        }

        sas_prompt = prompt_builder.build_prompt(sample_variable, sas_context)
        r_prompt = prompt_builder.build_prompt(sample_variable, r_context)

        # Prompts should be different for different languages
        assert sas_prompt != r_prompt


class TestCacheManager:
    """Test code generation caching"""

    @pytest.fixture
    def cache_manager(self):
        """Fixture providing CacheManager instance"""
        return CacheManager()

    def test_cache_manager_initialization(self, cache_manager):
        """Test CacheManager initializes correctly"""
        assert cache_manager is not None

    def test_cache_set_and_get(self, cache_manager):
        """Test caching and retrieving values"""
        cache_key = 'test_variable:AGE'
        cache_value = {
            'code': 'AGE = year(today()) - year(DOB);',
            'timestamp': 'now'
        }

        cache_manager.set(cache_key, cache_value)
        retrieved = cache_manager.get(cache_key)

        assert retrieved == cache_value

    def test_cache_miss(self, cache_manager):
        """Test behavior on cache miss"""
        retrieved = cache_manager.get('nonexistent_key')

        assert retrieved is None

    def test_cache_invalidation(self, cache_manager):
        """Test cache invalidation"""
        cache_key = 'test_variable:AGE'
        cache_manager.set(cache_key, {'code': 'test'})

        # Verify it's cached
        assert cache_manager.get(cache_key) is not None

        # Invalidate
        cache_manager.invalidate(cache_key)

        # Verify it's gone
        assert cache_manager.get(cache_key) is None

    def test_cache_clear_all(self, cache_manager):
        """Test clearing entire cache"""
        cache_manager.set('key1', {'data': 'value1'})
        cache_manager.set('key2', {'data': 'value2'})

        # Verify both are cached
        assert cache_manager.get('key1') is not None
        assert cache_manager.get('key2') is not None

        # Clear all
        cache_manager.clear()

        # Verify both are gone
        assert cache_manager.get('key1') is None
        assert cache_manager.get('key2') is None

    def test_cache_ttl(self, cache_manager):
        """Test cache TTL (time-to-live)"""
        cache_key = 'temporary_data'
        cache_manager.set(cache_key, {'data': 'test'}, ttl=1)  # 1 second TTL

        # Should be immediately available
        assert cache_manager.get(cache_key) is not None

        # After TTL expires, should be gone
        import time
        time.sleep(1.1)
        assert cache_manager.get(cache_key) is None


class TestSyntheticDataGeneration:
    """Test synthetic test data generation"""

    @pytest.fixture
    def data_generator(self):
        """Fixture providing synthetic data generator"""
        from faker import Faker
        return Faker()

    def test_generate_study_participants(self, data_generator):
        """Test generating synthetic study participants"""
        # Using faker for realistic test data
        participants = []
        for _ in range(10):
            participant = {
                'SUBJID': f"001{_:03d}",
                'AGE': data_generator.random_int(min=18, max=75),
                'SEX': data_generator.random_element(['M', 'F']),
                'RACE': data_generator.random_element(['CAUCASIAN', 'BLACK', 'ASIAN'])
            }
            participants.append(participant)

        assert len(participants) == 10
        assert all('SUBJID' in p for p in participants)
        assert all(18 <= p['AGE'] <= 75 for p in participants)

    def test_generate_lab_data(self, data_generator):
        """Test generating synthetic lab data"""
        lab_records = []
        for subject_id in range(1, 11):
            for visit in range(1, 4):  # 3 visits
                record = {
                    'USUBJID': f"001{subject_id:03d}",
                    'VISITNUM': visit,
                    'LBTESTCD': 'ALB',
                    'LBVAL': data_generator.random_int(min=30, max=50),
                    'LBUNIT': 'g/L'
                }
                lab_records.append(record)

        assert len(lab_records) == 30  # 10 subjects × 3 visits
        assert all('USUBJID' in r for r in lab_records)

    def test_generate_ae_data(self, data_generator):
        """Test generating synthetic adverse event data"""
        ae_records = []
        adverse_events = ['Headache', 'Nausea', 'Dizziness', 'Fatigue']

        for subject_id in range(1, 6):
            num_events = data_generator.random_int(min=0, max=3)
            for _ in range(num_events):
                record = {
                    'USUBJID': f"001{subject_id:03d}",
                    'AETERM': data_generator.random_element(adverse_events),
                    'AESEV': data_generator.random_element(['MILD', 'MODERATE', 'SEVERE']),
                    'AEREL': data_generator.random_element(['RELATED', 'NOT RELATED'])
                }
                ae_records.append(record)

        assert all('USUBJID' in r for r in ae_records)
        assert all('AETERM' in r for r in ae_records)
