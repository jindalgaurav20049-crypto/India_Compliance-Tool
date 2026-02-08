from typing import Dict, List


def audit_firm_risk_score(recent_violations: int, repeat_high_severity: int, entities: int) -> float:
    base = min(recent_violations / 30.0, 1.0)
    severity_boost = min(repeat_high_severity / 10.0, 1.0)
    spread = min(entities / 20.0, 1.0)
    return round(min(1.0, 0.5 * base + 0.35 * severity_boost + 0.15 * spread), 4)


def repeat_violation_detector(clause_history: List[str]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for clause in clause_history:
        counts[clause] = counts.get(clause, 0) + 1
    return {k: v for k, v in counts.items() if v > 1}
