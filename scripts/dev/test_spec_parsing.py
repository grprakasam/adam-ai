import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'backend'))

from app.modules.variable_categorizer.parser import SpecificationParser

spec_path = Path(__file__).resolve().parents[2] / 'Content' / 'UserInputs' / 'ADAMSpecifications' / 'ADSLSpec.xlsx'
p = SpecificationParser(str(spec_path))
p.load_specification()

vars = p.get_variables()

print("Sample variables with length/format:")
print("-" * 80)
for v in vars[:10]:
    name = v.get('name', 'N/A')
    length = v.get('length', 'N/A')
    format_val = v.get('format', 'N/A')
    type_val = v.get('type', 'N/A')
    print(f"{name:15} | Type: {type_val:8} | Length: {length:10} | Format: {format_val}")
