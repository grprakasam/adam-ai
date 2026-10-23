import pytest

from app.modules.adam_agent.components import StaticValidator
from app.modules.adam_agent.prompts import extract_code

GOOD = """
adsl <- dm %>%
  mutate(AGE = as.numeric(AGE), SAFFL = "Y") %>%  # flag every subject
  select(USUBJID, AGE, SAFFL)
"""


@pytest.mark.asyncio
async def test_clean_program_passes(small_spec):
    report = await StaticValidator(check_syntax=False).validate(GOOD, small_spec)
    assert report.passed, report.errors
    assert report.checks["safety"] == "pass" and report.checks["output_assigned"] == "pass"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "snippet,expected",
    [
        ('x <- read.csv("dm.csv")', "reading files"),
        ('write.csv(adsl, "out.csv")', "writing files"),
        ('system("rm -rf /")', "system calls"),
        ('install.packages("admiral")', "install.packages"),
        ("library(httr)", "not in the allowed list"),
        ('eval(parse(text = "1"))', "eval()"),
    ],
)
async def test_sandbox_rules_block_unsafe_calls(small_spec, snippet, expected):
    report = await StaticValidator(check_syntax=False).validate(GOOD + "\n" + snippet, small_spec)
    assert not report.passed
    assert any(expected in e for e in report.errors), report.errors


@pytest.mark.asyncio
async def test_comments_do_not_trigger_sandbox_rules(small_spec):
    code = GOOD + '\n# we deliberately do not call read.csv( or system( here\nmsg <- "# not a comment system("\n'
    report = await StaticValidator(check_syntax=False).validate(code, small_spec)
    assert not any("Sandbox" in e for e in report.errors), report.errors


@pytest.mark.asyncio
async def test_contract_and_coverage_errors(small_spec):
    report = await StaticValidator(check_syntax=False).validate("out <- dm %>% select(USUBJID, AGE)", small_spec)
    assert any("never assigns the output data frame `adsl`" in e for e in report.errors)
    assert any("SAFFL" in e for e in report.errors if e.startswith("Coverage"))


@pytest.mark.asyncio
async def test_empty_code_fails_fast(small_spec):
    report = await StaticValidator(check_syntax=False).validate("   ", small_spec)
    assert not report.passed and report.checks == {"non_empty": "fail"}


def test_extract_code_prefers_largest_fenced_block():
    text = "Here you go:\n```r\nx <- 1\n```\nand\n```r\nadsl <- dm\nadsl$A <- 1\n```"
    assert extract_code(text) == "adsl <- dm\nadsl$A <- 1"
    assert extract_code("adsl <- dm") == "adsl <- dm"
