from __future__ import annotations
from typing import Dict, Tuple


def evaluate_presence(evidence_text: str, required_keywords: str) -> Tuple[bool, str, float]:
    keywords = [k.strip().lower() for k in required_keywords.split(",") if k.strip()]
    haystack = evidence_text.lower()
    present = all(k in haystack for k in keywords)
    reasoning = "All mandatory keywords found." if present else "One or more mandatory keywords missing."
    confidence = 0.92 if present else 0.78
    return present, reasoning, confidence


def evaluate_numeric_consistency(lhs: str, rhs: str, tolerance: str = "0") -> Tuple[bool, str, float]:
    left_val = float(lhs)
    right_val = float(rhs)
    tol = float(tolerance)
    ok = abs(left_val - right_val) <= tol
    reasoning = f"|{left_val} - {right_val}| <= {tol}" if ok else f"Difference exceeds tolerance ({tol})."
    confidence = 0.95 if ok else 0.85
    return ok, reasoning, confidence


def evaluate_cross_statement(mapping_ok: str) -> Tuple[bool, str, float]:
    ok = mapping_ok.lower() == "true"
    reasoning = "Cross-statement linkage validated." if ok else "Cross-statement linkage failed."
    confidence = 0.9 if ok else 0.72
    return ok, reasoning, confidence


def evaluate_rule(rule_type: str, payload: Dict[str, str]) -> Tuple[bool, str, float]:
    if rule_type == "presence":
        return evaluate_presence(payload.get("evidence_text", ""), payload.get("required_keywords", ""))
    if rule_type == "numeric_consistency":
        return evaluate_numeric_consistency(payload["lhs"], payload["rhs"], payload.get("tolerance", "0"))
    if rule_type == "cross_statement":
        return evaluate_cross_statement(payload.get("mapping_ok", "false"))
    raise ValueError(f"Unsupported rule type: {rule_type}")
