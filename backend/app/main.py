from fastapi import FastAPI
from uuid import uuid4

from .document_intelligence import extract_evidence, extract_sections
from .evidence_navigation import build_navigation_payload
from .intelligence import audit_firm_risk_score
from .models import AuditFirmRiskInput, ClauseEvaluationInput, ComplianceDecision, ExtractRequest
from .rule_engine import evaluate_rule

app = FastAPI(title="NFRA Compliance Intelligence API", version="0.1.0")
VIOLATIONS = {}


@app.post("/v1/documents/ingest")
def ingest_document(file_name: str, entity_id: str, filing_type: str):
    document_id = f"DOC-{uuid4().hex[:10]}"
    return {
        "document_id": document_id,
        "file_name": file_name,
        "entity_id": entity_id,
        "filing_type": filing_type,
        "status": "INGESTED",
    }


@app.post("/v1/documents/{document_id}/extract")
def extract_document(document_id: str, req: ExtractRequest):
    sections = extract_sections(req.raw_text)
    evidence = extract_evidence(req.raw_text)
    return {"document_id": document_id, "sections": sections, "evidence": evidence}


@app.post("/v1/compliance/evaluate", response_model=ComplianceDecision)
def evaluate_clause(inp: ClauseEvaluationInput):
    ok, reasoning, confidence = evaluate_rule(inp.clause_logic["type"], inp.clause_logic)
    decision = ComplianceDecision(
        violation_id=f"VIO-{uuid4().hex[:8]}",
        regulation=inp.regulation,
        clause=inp.clause,
        document_reference={"file_id": inp.document_id, "page": inp.page, "bounding_box": inp.bbox},
        evidence_text=inp.evidence_text,
        reasoning=reasoning,
        severity="LOW" if ok else "HIGH",
        confidence=confidence,
    )
    VIOLATIONS[decision.violation_id] = decision.model_dump()
    return decision


@app.get("/v1/violations/{violation_id}/evidence")
def get_violation_evidence(violation_id: str):
    violation = VIOLATIONS[violation_id]
    return build_navigation_payload(violation, neighboring=[])


@app.post("/v1/intelligence/audit-firm-risk")
def audit_firm_risk(inp: AuditFirmRiskInput):
    score = audit_firm_risk_score(inp.recent_violations, inp.repeat_high_severity, len(inp.entity_ids))
    return {"audit_firm": inp.audit_firm, "risk_score": score}
