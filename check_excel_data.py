import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / 'backend'))

import pandas as pd

spec_path = Path(__file__).parent / 'Content' / 'UserInputs' / 'ADAMSpecifications' / 'ADSLSpec.xlsx'
df = pd.read_excel(spec_path, sheet_name=0)

print("First 10 rows - focusing on SAS Length/Display Format column:")
print("-" * 100)
print(df[['Variable', 'SAS Type', 'SAS Length/Display Format']].head(10).to_string(index=False))

print("\n\nChecking ARM-related variables:")
arm_vars = df[df['Variable'].str.contains('ARM', case=False, na=False)]
print(arm_vars[['Variable', 'SAS Type', 'SAS Length/Display Format']].to_string(index=False))
