"""End-to-end: golden program through the full graph against pharmaverse (needs R)."""

import importlib.util
import json


from .conftest import BENCH, requires_r


def load_runner():
    spec = importlib.util.spec_from_file_location("run_benchmark", BENCH / "run_benchmark.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_benchmark_data_matches_manifest():
    spec = importlib.util.spec_from_file_location("fetch_data", BENCH / "fetch_data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    assert module.verify()


def test_benchmark_spec_loads(bench_spec):
    assert bench_spec.dataset == "ADSL" and bench_spec.output_object == "adsl"
    assert len(bench_spec.variables) == 28 and bench_spec.sdtm_domains == ["dm", "ex", "ds"]
    assert "TRTSDT [Date]" in bench_spec.to_prompt_block()


def test_faulty_variant_differs_from_golden(golden_program):
    assert load_runner().faulty_variant(golden_program) != golden_program


@requires_r
def test_replay_benchmark_repairs_and_matches_reference(tmp_path):
    runner = load_runner()
    code = runner.main(["--mode", "replay", "--replay-fault", "--min-match", "1.0", "--out", str(tmp_path)])
    assert code == 0
    result = json.loads(next(tmp_path.glob("*_replay.json")).read_text())
    assert result["status"] == "approved" and result["attempts"] == 2 and result["repair_loops"] == 1
    assert result["evaluation"]["overall_match_rate"] == 1.0
    assert result["evaluation"]["fully_matched_variables"] == 28
    assert result["audit_chain_intact"] is True
