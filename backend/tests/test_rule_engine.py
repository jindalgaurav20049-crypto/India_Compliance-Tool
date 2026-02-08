import pathlib
import sys

sys.path.append(str(pathlib.Path(__file__).resolve().parents[2]))

from backend.app.rule_engine import evaluate_rule


def test_presence_rule_passes():
    ok, reasoning, confidence = evaluate_rule(
        "presence",
        {"evidence_text": "Revenue performance obligation disclosure", "required_keywords": "revenue,performance obligation"},
    )
    assert ok is True
    assert confidence >= 0.9
    assert "mandatory" in reasoning.lower()


def test_presence_rule_fails_when_missing_keyword():
    ok, reasoning, confidence = evaluate_rule(
        "presence",
        {"evidence_text": "Revenue disclosure", "required_keywords": "revenue,performance obligation"},
    )
    assert ok is False
    assert confidence < 0.9
    assert "missing" in reasoning.lower()


def test_numeric_consistency():
    ok, _, _ = evaluate_rule("numeric_consistency", {"lhs": "100", "rhs": "100.4", "tolerance": "0.5"})
    assert ok is True
