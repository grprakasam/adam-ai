import pandas as pd
from pathlib import Path

spec_path = Path(__file__).resolve().parents[2] / 'Content' / 'UserInputs' / 'ADAMSpecifications' / 'ADSLSpec.xlsx'
df = pd.read_excel(spec_path, sheet_name=0)

print("Checking ARM-related variables - RAW cell values:")
print("=" * 100)

arm_vars = df[df['Variable'].str.contains('ARM', case=False, na=False)]

for idx, row in arm_vars.iterrows():
    var_name = row['Variable']
    length_format = row['SAS Length/Display Format']
    print(f"\nVariable: {var_name}")
    print(f"  Raw value: {repr(length_format)}")
    print(f"  Type: {type(length_format)}")
    print(f"  String value: '{str(length_format)}'")
    
    # Check if there's a "/" in the value
    if isinstance(length_format, str) and '/' in length_format:
        parts = length_format.split('/')
        print(f"  Split by '/': {parts}")
