from pydantic import BaseModel, Field
from typing import Dict, List, Optional


class BBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float


class DocumentReference(BaseModel):
    file_id: str
    page: int
    bounding_box: BBox


class ComplianceDecision(BaseModel):
    violation_id: str
    regulation: str
    clause: str
    document_reference: DocumentReference
    evidence_text: str
    reasoning: str
    severity: str
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractRequest(BaseModel):
    document_id: str
    raw_text: str


class ClauseEvaluationInput(BaseModel):
    document_id: str
    regulation: str
    clause: str
    clause_logic: Dict[str, str]
    evidence_text: str
    page: int
    bbox: BBox


class AuditFirmRiskInput(BaseModel):
    audit_firm: str
    entity_ids: List[str]
    recent_violations: int
    repeat_high_severity: int


class AuditEvent(BaseModel):
    actor_id: str
    action: str
    object_type: str
    object_id: str
    purpose: Optional[str] = None
