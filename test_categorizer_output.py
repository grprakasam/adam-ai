import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

from app.modules.variable_categorizer.service import VariableCategorizerService

spec_path = Path(__file__).parent / 'Content' / 'UserInputs' / 'ADAMSpecifications' / 'ADSLSpec.xlsx'

service = VariableCategorizerService()
result = service.categorize_specification(str(spec_path), dataset_type="ADSL")

print("Checking ARM-related variables in categorized result:")
print("-" * 100)

for category in result.categories:
    for var in category.variables:
        if 'ARM' in var.name:
            print(f"Variable: {var.name}")
            print(f"  Type: {var.type}")
            print(f"  Length: {var.length}")
            print(f"  Format: {var.format}")
            print(f"  Category: {var.category}")
            print()
