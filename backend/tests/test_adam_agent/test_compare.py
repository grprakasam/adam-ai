import pandas as pd
import pytest

from app.modules.adam_agent.compare import compare_datasets, normalise


def frame(rows):
    return pd.DataFrame(rows)


def test_normalise_handles_missing_numbers_and_dates():
    assert normalise(None) is None
    assert normalise(float("nan")) is None
    assert normalise("  ") is None
    assert normalise("NA") is None
    assert normalise("63.0") == "63"
    assert normalise(63) == "63"
    assert normalise("2014-01-02") == "2014-01-02"
    assert normalise(pd.Timestamp("2014-01-02")) == "2014-01-02"
    assert normalise("Placebo") == "Placebo"


def test_identical_datasets_match_fully():
    ref = frame([{"USUBJID": "1", "AGE": "63", "SAFFL": "Y"}, {"USUBJID": "2", "AGE": "70", "SAFFL": "N"}])
    report = compare_datasets(ref.copy(), ref, ["USUBJID"], ["USUBJID", "AGE", "SAFFL"], "ADSL")
    assert report.overall_match_rate == 1.0
    assert report.missing_variables == []
    assert len(report.fully_matched) == 3


def test_numeric_formatting_and_missing_values_are_equivalent():
    gen = frame([{"USUBJID": "1", "AGE": 63.0, "DTHDT": None}])
    ref = frame([{"USUBJID": "1", "AGE": "63", "DTHDT": ""}])
    report = compare_datasets(gen, ref, ["USUBJID"], ["AGE", "DTHDT"])
    assert report.overall_match_rate == 1.0


def test_mismatches_report_examples_and_feedback():
    gen = frame([{"USUBJID": "1", "AGEGR1": "18-64"}, {"USUBJID": "2", "AGEGR1": "18-64"}])
    ref = frame([{"USUBJID": "1", "AGEGR1": "18-64"}, {"USUBJID": "2", "AGEGR1": ">64"}])
    report = compare_datasets(gen, ref, ["USUBJID"], ["AGEGR1"])
    var = report.variables[0]
    assert var.status == "mismatch" and var.match_rate == 0.5
    assert var.examples[0] == {"key": "2", "generated": "18-64", "reference": ">64"}
    assert "AGEGR1: 50.0% match" in report.feedback()


def test_missing_variable_and_missing_rows_lower_the_score():
    gen = frame([{"USUBJID": "1", "AGE": "63"}])
    ref = frame([{"USUBJID": "1", "AGE": "63", "SAFFL": "Y"}, {"USUBJID": "2", "AGE": "70", "SAFFL": "N"}])
    report = compare_datasets(gen, ref, ["USUBJID"], ["AGE", "SAFFL"])
    assert report.missing_variables == ["SAFFL"]
    assert report.rows_matched_on_keys == 1
    assert report.variables[0].match_rate == 0.5  # AGE: 1 of 2 reference rows
    assert report.variables[1].match_rate == 0.0


def test_duplicate_keys_are_counted():
    gen = frame([{"USUBJID": "1", "AGE": "63"}, {"USUBJID": "1", "AGE": "63"}])
    ref = frame([{"USUBJID": "1", "AGE": "63"}])
    report = compare_datasets(gen, ref, ["USUBJID"], ["AGE"])
    assert report.duplicate_keys_generated == 1
    assert report.overall_match_rate == 1.0


def test_missing_key_column_raises():
    with pytest.raises(ValueError):
        compare_datasets(frame([{"ID": "1"}]), frame([{"USUBJID": "1"}]), ["USUBJID"])
