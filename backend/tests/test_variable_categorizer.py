import pandas as pd

from app.modules.variable_categorizer.service import VariableCategorizerService


def test_categorizer_keeps_spec_metadata(tmp_path):
    """Spec-derived metadata (extra columns + required flag) should flow into VariableInfo."""
    mapping_path = tmp_path / "VariablesMapping.xlsx"
    mapping_df = pd.DataFrame(
        {
            "Variable Name": ["HEIGHTBL"],
            "Category": ["03_Baseline Characteristic Variables"],
            "Description": ["Baseline Height"],
            "Type": ["Num"],
            "Length": ["4"],
            "Format": ["BEST."],
        }
    )
    mapping_df.to_excel(mapping_path, index=False)

    spec_path = tmp_path / "ADSLSpec.xlsx"
    spec_df = pd.DataFrame(
        {
            "Dataset": ["ADSL"],
            "Variable": ["HEIGHTBL"],
            "Label": ["Baseline Height"],
            "SAS Type": ["Num"],
            "SAS Length/Display Format": ["8"],
            "Origin": ["Derived"],
            "Source/Derivation": ["DM.HEIGHT"],
            "CDISC Core": ["Req"],
        }
    )
    spec_df.to_excel(spec_path, index=False)

    service = VariableCategorizerService(mapping_file_path=str(mapping_path))
    result = service.categorize_specification(str(spec_path), dataset_type="ADSL")

    height_var = None
    for category in result.categories:
        for var in category.variables:
            if var.name == "HEIGHTBL":
                height_var = var
                break
        if height_var:
            break

    assert height_var is not None, "Expected HEIGHTBL in categorized variables"
    assert height_var.is_required is True, "Explicit spec requirement should win"
    assert height_var.extra is not None and height_var.extra["Origin"] == "Derived"
    # Ensure extra keeps other unmapped columns as well (e.g., dataset)
    assert height_var.extra["Dataset"] == "ADSL"
    assert height_var.length == "8"
    assert height_var.format is None


def test_categorizer_splits_length_format(tmp_path):
    """Combined length/format values (e.g., '8 / BEST.') should split cleanly."""
    mapping_path = tmp_path / "VariablesMapping.xlsx"
    pd.DataFrame(
        {"Variable Name": ["WEIGHTBL"], "Category": ["Baseline"], "Description": ["Weight"]}
    ).to_excel(mapping_path, index=False)

    spec_path = tmp_path / "ADSLSpec.xlsx"
    pd.DataFrame(
        {
            "Variable": ["WEIGHTBL"],
            "SAS Length/Display Format": ["8 / BEST."],
            "Label": ["Baseline Weight"],
        }
    ).to_excel(spec_path, index=False)

    service = VariableCategorizerService(mapping_file_path=str(mapping_path))
    result = service.categorize_specification(str(spec_path), dataset_type="ADSL")

    weight_var = next(
        (var for cat in result.categories for var in cat.variables if var.name == "WEIGHTBL"),
        None,
    )
    assert weight_var is not None
    assert weight_var.length == "8"
    assert weight_var.format == "BEST."
