"""
Unit tests for variable_categorizer module
"""

import pytest
from pathlib import Path
import sys

# Add backend to path
backend_root = Path(__file__).parent.parent
sys.path.insert(0, str(backend_root))

from app.modules.variable_categorizer.parser import (
    VariablesMappingParser,
    SpecificationParser,
)
from app.modules.variable_categorizer.service import VariableCategorizerService


class TestVariablesMappingParser:
    """Tests for VariablesMappingParser"""

    def test_parser_initialization(self):
        """Test parser can be initialized"""
        parser = VariablesMappingParser()
        assert parser is not None
        assert parser.mapping_file_path.name == "VariablesMapping.xlsx"

    def test_load_mapping(self):
        """Test loading VariablesMapping.xlsx"""
        parser = VariablesMappingParser()
        
        try:
            parser.load_mapping()
            assert parser._mapping_data is not None
            assert parser._category_map is not None
            assert len(parser._category_map) > 0
            print(f"✓ Loaded {len(parser._category_map)} variables from mapping")
        except FileNotFoundError:
            pytest.skip("VariablesMapping.xlsx not found")

    def test_get_category_for_variable(self):
        """Test getting category for a known variable"""
        parser = VariablesMappingParser()
        
        try:
            parser.load_mapping()
            
            # Test with common ADSL variables
            test_variables = ["USUBJID", "STUDYID", "SITEID", "AGE", "SEX"]
            
            for var in test_variables:
                category = parser.get_category_for_variable(var)
                print(f"  {var} → {category}")
                # Should return a category or None, but not raise error
                assert category is None or isinstance(category, str)
                
        except FileNotFoundError:
            pytest.skip("VariablesMapping.xlsx not found")

    def test_get_all_categories(self):
        """Test getting all unique categories"""
        parser = VariablesMappingParser()
        
        try:
            parser.load_mapping()
            categories = parser.get_all_categories()
            
            assert isinstance(categories, list)
            assert len(categories) > 0
            print(f"✓ Found {len(categories)} categories:")
            for cat in categories:
                print(f"  - {cat}")
                
        except FileNotFoundError:
            pytest.skip("VariablesMapping.xlsx not found")


class TestSpecificationParser:
    """Tests for SpecificationParser"""

    def test_parser_initialization(self):
        """Test parser can be initialized"""
        spec_path = "Content/UserInputs/ADAMSpecifications/ADSL_Specification.xlsx"
        parser = SpecificationParser(spec_path)
        assert parser is not None

    def test_load_specification(self):
        """Test loading specification file"""
        backend_root = Path(__file__).parent.parent
        spec_path = (
            backend_root.parent
            / "Content"
            / "UserInputs"
            / "ADAMSpecifications"
            / "ADSL_Specification.xlsx"
        )
        
        if not spec_path.exists():
            pytest.skip(f"Specification file not found: {spec_path}")
        
        parser = SpecificationParser(str(spec_path))
        parser.load_specification()
        
        assert parser._spec_data is not None
        print(f"✓ Loaded specification with {len(parser._spec_data)} rows")
        print(f"  Columns: {', '.join(parser._spec_data.columns)}")

    def test_get_variables(self):
        """Test extracting variables from specification"""
        backend_root = Path(__file__).parent.parent
        spec_path = (
            backend_root.parent
            / "Content"
            / "UserInputs"
            / "ADAMSpecifications"
            / "ADSL_Specification.xlsx"
        )
        
        if not spec_path.exists():
            pytest.skip(f"Specification file not found: {spec_path}")
        
        parser = SpecificationParser(str(spec_path))
        parser.load_specification()
        variables = parser.get_variables()
        
        assert isinstance(variables, list)
        assert len(variables) > 0
        
        print(f"✓ Extracted {len(variables)} variables")
        print(f"  First 5 variables:")
        for var in variables[:5]:
            print(f"    - {var.get('name')}: {var.get('label', 'N/A')}")


class TestVariableCategorizerService:
    """Tests for VariableCategorizerService"""

    def test_service_initialization(self):
        """Test service can be initialized"""
        service = VariableCategorizerService()
        assert service is not None
        assert not service._is_loaded

    def test_service_initialize(self):
        """Test service initialization loads mapping"""
        service = VariableCategorizerService()
        
        try:
            service.initialize()
            assert service._is_loaded
            print("✓ Service initialized successfully")
        except FileNotFoundError:
            pytest.skip("VariablesMapping.xlsx not found")

    def test_categorize_specification(self):
        """Test full specification categorization"""
        backend_root = Path(__file__).parent.parent
        spec_path = (
            backend_root.parent
            / "Content"
            / "UserInputs"
            / "ADAMSpecifications"
            / "ADSL_Specification.xlsx"
        )
        
        if not spec_path.exists():
            pytest.skip(f"Specification file not found: {spec_path}")
        
        service = VariableCategorizerService()
        
        try:
            result = service.categorize_specification(str(spec_path), "ADSL")
            
            assert result is not None
            assert result.total_variables > 0
            assert len(result.categories) > 0
            
            print(f"\n✓ Categorization Results:")
            print(f"  Total variables: {result.total_variables}")
            print(f"  Categorized: {result.categorized_count}")
            print(f"  Other Category: {result.uncategorized_count}")
            print(f"  Number of categories: {len(result.categories)}")
            print(f"\n  Categories:")
            
            for category in result.categories:
                print(f"    - {category.name}: {category.count} variables")
                if category.count > 0:
                    print(f"      Examples: {', '.join([v.name for v in category.variables[:3]])}")
            
        except FileNotFoundError as e:
            pytest.skip(f"Required file not found: {e}")


if __name__ == "__main__":
    print("Running Variable Categorizer Tests\n")
    print("=" * 60)
    
    # Test VariablesMappingParser
    print("\n1. Testing VariablesMappingParser")
    print("-" * 60)
    test_parser = TestVariablesMappingParser()
    try:
        test_parser.test_parser_initialization()
        print("✓ Parser initialization")
    except Exception as e:
        print(f"✗ Parser initialization: {e}")
    
    try:
        test_parser.test_load_mapping()
    except Exception as e:
        print(f"✗ Load mapping: {e}")
    
    try:
        test_parser.test_get_category_for_variable()
    except Exception as e:
        print(f"✗ Get category: {e}")
    
    try:
        test_parser.test_get_all_categories()
    except Exception as e:
        print(f"✗ Get all categories: {e}")
    
    # Test SpecificationParser
    print("\n2. Testing SpecificationParser")
    print("-" * 60)
    test_spec = TestSpecificationParser()
    try:
        test_spec.test_parser_initialization()
        print("✓ Spec parser initialization")
    except Exception as e:
        print(f"✗ Spec parser initialization: {e}")
    
    try:
        test_spec.test_load_specification()
    except Exception as e:
        print(f"✗ Load specification: {e}")
    
    try:
        test_spec.test_get_variables()
    except Exception as e:
        print(f"✗ Get variables: {e}")
    
    # Test VariableCategorizerService
    print("\n3. Testing VariableCategorizerService")
    print("-" * 60)
    test_service = TestVariableCategorizerService()
    try:
        test_service.test_service_initialization()
        print("✓ Service initialization")
    except Exception as e:
        print(f"✗ Service initialization: {e}")
    
    try:
        test_service.test_service_initialize()
    except Exception as e:
        print(f"✗ Service initialize: {e}")
    
    try:
        test_service.test_categorize_specification()
    except Exception as e:
        print(f"✗ Categorize specification: {e}")
    
    print("\n" + "=" * 60)
    print("Tests Complete")
