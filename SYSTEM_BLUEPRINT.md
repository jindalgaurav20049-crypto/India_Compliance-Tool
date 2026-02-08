# Final System Architecture

## 1) Microservices and Data Flow
1. **ingestion-service**: accepts filings, computes checksum, stores object, emits `DocumentIngested` event.
2. **document-intelligence-service**: OCR + layout + table extraction + section segmentation + bbox extraction.
3. **knowledge-graph-service**: stores regulation/clause/rule graph with versioning and dependencies.
4. **clause-matching-service**: hybrid retrieval (embedding + heuristics + metadata filters).
5. **rule-execution-service**: deterministic clause checks (presence, numeric consistency, cross-statement).
6. **explainability-service**: builds clause-level explanation bundles.
7. **evidence-navigation-service**: provides page/coordinates payloads for document viewer highlight.
8. **nfra-intelligence-service**: cross-company anomaly and audit-firm risk modules.
9. **security-audit-service**: RBAC, ABAC, key management integration, immutable audit event stream.

**Flow:** Ingestion -> Intelligence -> Clause Match -> Rule Execute -> Explainability -> Evidence Navigation -> Investigator Review.

## 2) Service Boundaries
- Stateless compute services (matching/rules/explainability).
- Stateful systems: Postgres (transactional), object store (PDF/images), graph store (regulatory graph), search index (evidence retrieval).
- Queue bus for orchestration and retry (idempotent job keys).

---

# Data Model

See executable DDL: `backend/sql/schema.sql`.

Core tables:
- `documents`
- `extracted_sections`
- `section_evidence`
- `regulations`
- `regulatory_clauses`
- `validation_rules`
- `compliance_decisions`
- `evidence_mappings`
- `audit_logs`
- `users`, `roles`, `user_roles`

Decision traceability chain is enforced by FK path:
`compliance_decisions -> evidence_mappings -> section_evidence -> documents`.

---

# Knowledge Graph Starter Dataset

Starter clause pack is provided in: `backend/data/kg_starter.json`.

Coverage:
- IndAS Vol 1/2
- IndAS conceptual clauses
- Schedule III
- SEBI disclosure
- RBI FI disclosure
- SEBI ESG/BRSR core

Fields per clause:
- `clause_id`
- `regulation`
- `disclosure_requirement`
- `expected_section`
- `rule_expression`
- `severity`

---

# Backend Code Skeleton

Reference implementation (FastAPI):
- `backend/app/main.py`
- `backend/app/models.py`
- `backend/app/document_intelligence.py`
- `backend/app/rule_engine.py`
- `backend/app/evidence_navigation.py`
- `backend/app/intelligence.py`
- `backend/app/security.py`

APIs:
- `POST /v1/documents/ingest`
- `POST /v1/documents/{document_id}/extract`
- `POST /v1/compliance/evaluate`
- `GET /v1/violations/{violation_id}/evidence`
- `POST /v1/intelligence/audit-firm-risk`

---

# Rule Engine Implementation

Implemented deterministic rules:
- Presence validation (`presence`)
- Numeric equality/tolerance (`numeric_consistency`)
- Cross-statement reconciliation (`cross_statement`)

Each decision object includes:
- `violation_id`
- `regulation`
- `clause`
- `document_reference {file_id,page,bounding_box}`
- `evidence_text`
- `reasoning`
- `severity`
- `confidence`

---

# Evidence Navigation Implementation

`backend/app/evidence_navigation.py` provides `build_navigation_payload()` which returns:
- source document id
- target page
- bbox overlay coordinates
- clause and reasoning context
- neighboring evidence list for next/previous navigation

Client viewer contract:
- render PDF page
- draw bbox overlays
- synchronize evidence sidebar index with viewport

---

# Security Implementation

Security baseline in `backend/app/security.py`:
- role check helper (RBAC)
- field-level redaction helper for restricted roles
- immutable audit event constructor with hash chaining anchor

Architecture controls:
- AES-256 at rest, TLS/mTLS in transit
- per-entity row-level filtering
- all model/rule invocations logged with actor and purpose

---

# Evaluation Framework

Dataset + metrics artifacts:
- `backend/data/test_dataset.json`
- `backend/tests/test_rule_engine.py`

Metrics:
- clause precision/recall
- explainability completeness
- evidence localization presence (page + bbox mandatory)
- critical false-negative rate

---

# Self Critique + Improvement Iterations

## Iteration 1 (Gap: weak layout extraction fidelity)
- Weakness: baseline extraction is placeholder heuristic.
- Improvement: integrate DocTR/LayoutLMv3 + table transformer and persist polygon coordinates.

## Iteration 2 (Gap: rule language too rigid)
- Weakness: fixed Python rule types slow policy changes.
- Improvement: add DSL-backed rule registry with versioned rollout and shadow evaluation.

## Iteration 3 (Gap: investigation intelligence depth)
- Weakness: anomaly models not sector-calibrated.
- Improvement: add sector-specific baselines, drift monitors, and supervised feedback loops from NFRA reviewers.
