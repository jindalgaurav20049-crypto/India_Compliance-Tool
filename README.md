# NFRA Compliance Intelligence Platform — Production Architecture Submission

## Executive Summary
This submission defines a production-grade regulatory compliance intelligence platform for NFRA-aligned supervision and investigation workflows. The design explicitly prioritizes clause-level regulatory correctness, evidence traceability, explainability, and audit defensibility over UI concerns.

Key objectives achieved by this architecture:
- Extract only factual evidence from scanned and digital filings (no synthetic financial data generation).
- Perform clause-level compliance reasoning across IndAS, Schedule III, SEBI, RBI, and ESG/BRSR obligations.
- Provide deterministic, human-auditable compliance decisions with evidence-level traceability down to page coordinates.
- Support regulator workflows: triage, deep-dive investigation, cross-case linkage, and enforcement preparation.
- Enforce confidentiality-by-design: encryption, RBAC/ABAC, query audit logging, tenant/entity isolation, and on-prem deployment compatibility.

---

## Full System Architecture

### Layer 1 — Document Intelligence Engine
**Purpose:** Convert heterogeneous filings into normalized, evidence-addressable structured outputs.

**Capabilities**
1. **Document Ingestion**
   - Inputs: PDF (digital/scanned), XBRL, XLSX, CSV, image attachments.
   - Ingestion metadata: `document_id`, `entity_id`, `filing_type`, `financial_year`, `submission_channel`, `checksum_sha256`.
2. **OCR and Layout Pipeline**
   - OCR for scanned pages (language pack: English + domain dictionary).
   - Layout detection: header/footer/body/table/footnote/figure.
   - Reading-order reconstruction for multi-column statements.
3. **Table Extraction**
   - Structure capture: row/column boundaries, merged cells, numeric parsing, units normalization.
   - Cell-level coordinates persisted for downstream evidence navigation.
4. **Section Segmentation**
   - Segment into logical sections: balance sheet, P&L, cash flow, notes, contingent liabilities, related-party disclosures, auditor report, ESG annexures.
   - Hybrid method: layout anchors + heading classifier + rule-based boundary resolver.
5. **Footnote Linkage Detection**
   - Link statements to notes using identifiers (e.g., note numbers, superscripts, references).
   - Build `statement_line_item -> note_section` adjacency map.
6. **Metadata Extraction**
   - Extract and validate: company name, CIN, FY, standalone/consolidated, auditor, report date, filing class.
7. **Bounding Box Persistence**
   - Every text span and table cell persisted with coordinates (`page`, `x1,y1,x2,y2`) and extraction confidence.

**Structured Output (Document Intelligence JSON)**
```json
{
  "document_id": "DOC-2026-00012",
  "entity_id": "ENTITY-0192",
  "file_name": "annual_report_fy25.pdf",
  "metadata": {
    "company_name": "ABC Finance Ltd",
    "financial_year": "2024-25",
    "consolidation": "Consolidated",
    "auditor": "Audit Firm X",
    "filing_type": "Annual Financial Statements"
  },
  "pages": [
    {
      "page_number": 73,
      "text_blocks": [
        {
          "block_id": "TB-73-11",
          "text": "Revenue from contracts with customers...",
          "bbox": [72, 118, 516, 156],
          "ocr_confidence": 0.97
        }
      ],
      "tables": [
        {
          "table_id": "T-73-2",
          "bbox": [60, 210, 542, 624],
          "cells": [
            {
              "cell_id": "T-73-2-R4-C3",
              "text": "12,450",
              "bbox": [401, 308, 481, 326],
              "type": "numeric"
            }
          ]
        }
      ]
    }
  ],
  "sections": [
    {
      "section_id": "SEC-NOTES-REVREC",
      "title": "Note 3: Revenue Recognition",
      "page_start": 73,
      "page_end": 75,
      "linked_line_items": ["BS-REV-001"],
      "text_block_ids": ["TB-73-11"]
    }
  ]
}
```

### Layer 2 — Regulatory Knowledge Graph
**Purpose:** Model regulations, clauses, dependencies, expected evidence locations, and validation logic.

**Core graph entities**
- `Regulation` (IndAS, Schedule III, SEBI, RBI, BRSR)
- `Clause`
- `DisclosureRequirement`
- `ExpectedDocumentSection`
- `ValidationRule`
- `SeverityProfile`
- `CrossRegulationDependency`
- `GuidanceReference` (education material/interpretation)

**Edge examples**
- `Clause REQUIRES DisclosureRequirement`
- `DisclosureRequirement EXPECTED_IN ExpectedDocumentSection`
- `Clause VALIDATED_BY ValidationRule`
- `Clause CONFLICTS_WITH Clause`
- `Clause DEPENDS_ON Clause`

### Layer 3 — Clause Matching Engine
**Purpose:** Match extracted evidence segments against candidate regulatory clauses.

**Input**
- Section text
- Table cells
- Metadata context (industry/entity type, filing type)

**Output**
- Top-N clause candidates with calibrated probability and retrieval features.

**Matching strategy**
1. Embedding retrieval over clause corpus and commentary.
2. Rule pre-filters (e.g., RBI clauses only for regulated FIs).
3. Keyword/phrase heuristics for high-precision anchors.
4. Re-ranker model (cross-encoder) for final candidate ordering.
5. Thresholding with abstain path for uncertain matches.

### Layer 4 — Rule Execution Engine
**Purpose:** Execute deterministic compliance checks at clause level.

**Rule families**
1. **Disclosure Presence Validation**
2. **Numerical Threshold Validation**
3. **Cross-Statement Reconciliation**
4. **Time-Series Consistency Validation**

**Pseudocode**
```python
def validate_clause(clause, evidence_bundle, context):
    if clause.rule_type == "DISCLOSURE_PRESENCE":
        return has_required_fields(evidence_bundle, clause.required_fields)

    if clause.rule_type == "NUMERICAL_THRESHOLD":
        value = extract_numeric(evidence_bundle, clause.metric_path)
        return compare(value, clause.operator, clause.threshold)

    if clause.rule_type == "CROSS_STATEMENT_RECON":
        lhs = compute_statement_total(context, clause.left_expression)
        rhs = compute_statement_total(context, clause.right_expression)
        return abs(lhs - rhs) <= clause.allowed_tolerance

    if clause.rule_type == "TIME_SERIES_CONSISTENCY":
        series = fetch_series(context, clause.metric_path, years=clause.lookback_years)
        return detect_unexplained_break(series, clause.break_threshold) == False

    raise UnsupportedRuleType(clause.rule_type)
```

### Layer 5 — Explainability Engine
**Purpose:** Produce regulator-auditable reasoning records for every decision.

**Mandatory explainability fields**
- Clause ID
- Regulation source
- Evidence text snippet
- Page number and bbox
- Rule applied
- Reasoning narrative
- Confidence score
- Severity
- Suggested remediation

**Explainability JSON Schema (logical)**
```json
{
  "decision_id": "DEC-77421",
  "clause_id": "INDAS115-CL-23",
  "regulation_source": "IndAS Vol 1",
  "rule_applied": "DISCLOSURE_PRESENCE",
  "decision": "NON_COMPLIANT",
  "confidence": 0.92,
  "severity": "HIGH",
  "reasoning_narrative": "Required performance obligation disaggregation missing in note disclosures.",
  "evidence": {
    "document_id": "DOC-2026-00012",
    "page_number": 73,
    "bbox": [72, 118, 516, 156],
    "snippet": "Revenue from contracts with customers..."
  },
  "remediation": "Disclose disaggregated revenue by timing and category as per clause requirements."
}
```

### Layer 6 — NFRA Intelligence Layer
**Purpose:** Multi-entity intelligence and investigation acceleration.

**Modules**
- Cross-company anomaly detection (peer normalized metrics)
- Audit firm risk signal graph
- Restatement and qualification trajectory tracker
- Enforcement case linkage (historical order matching)
- Whistleblower signal ingestion and correlation
- Real-time regulatory update impact mapper (new circular -> impacted clauses)

### Layer 7 — Security & Confidentiality Architecture
**Purpose:** Ensure legal-grade confidentiality and controlled model operations.

**Controls**
- Encryption at rest (AES-256) and transit (TLS 1.3, mTLS for service mesh)
- RBAC + ABAC (role + case scope + entity scope)
- Model query audit logs (prompt hash, user, purpose, output hash)
- Entity-level data isolation (tenant namespaces, row-level policies)
- On-prem / sovereign cloud compatibility
- Inference sandboxing (network egress control, policy guardrails, prompt firewall)

---

## Regulatory Knowledge Graph Design

### Relational + Graph Hybrid Schema
1. **`regulations`**: regulation master (IndAS/Schedule III/SEBI/RBI/BRSR)
2. **`clauses`**: unique clause records with versions and effective dates
3. **`disclosure_requirements`**: atomic requirement statements
4. **`clause_section_expectations`**: expected section anchors
5. **`validation_rules`**: executable rule expressions
6. **`clause_dependencies`**: inter-clause edges (depends/conflicts/overrides)
7. **`guidance_citations`**: interpretive references

### Versioning
- Clause versioning with `effective_from`, `effective_to`, and deprecation lineage.
- Decision reproducibility uses regulation snapshot ID at run time.

---

## Compliance Reasoning Flow
1. Ingest filing and compute immutable checksum.
2. Extract page-level text/table evidence with bbox coordinates.
3. Segment into domain sections and link notes to statements.
4. Retrieve candidate clauses using hybrid clause matcher.
5. Execute deterministic rules for each clause.
6. Persist clause-level decision object with evidence pointers.
7. Generate explainability payload and audit trail entry.
8. Route high-severity outcomes to investigation queue.

**Mandatory compliance decision object**
```json
{
  "violation_id": "VIO-11928",
  "regulation": "SEBI BRSR Core",
  "clause": "BRSR-ENV-1.2",
  "document_reference": {
    "file_id": "DOC-2026-00012",
    "page": 134,
    "bounding_box": [84, 242, 498, 284]
  },
  "evidence_text": "No Scope 2 emission values reported for FY2024-25.",
  "reasoning": "Mandatory emission metric absent in ESG section where disclosure is expected.",
  "severity": "HIGH",
  "confidence": 0.95
}
```

---

## Explainability Framework

### Explainability completeness checklist
A decision is considered complete only if all are present:
- Clause reference
- Regulatory source and version
- Rule expression ID
- Evidence snippet + provenance coordinates
- Confidence + uncertainty rationale
- Severity policy basis
- Remediation instruction
- Reviewer override state (if any)

### Human-in-the-loop controls
- Regulator can mark evidence as accepted/rejected.
- Overrides require comment, reviewer identity, and timestamp.
- System stores model output and reviewer final decision separately.

---

## Evidence Navigation Architecture

### Evidence Traceability Navigation System (Core)
When user clicks a violation:
1. Fetch `violation_id` from compliance store.
2. Resolve evidence mapping rows.
3. Open source document in secure viewer.
4. Jump to `page_number`.
5. Overlay highlight at `bounding_box_coordinates`.
6. Render adjacent context and associated clause/rule narrative.

### Evidence Mapping Data Model
**Table: `evidence_mappings`**
- `violation_id` (PK component)
- `document_id`
- `page_number`
- `bounding_box_coordinates` (JSONB)
- `clause_id`
- `evidence_text`
- `confidence_score`
- `severity`

### Document Viewer Requirements
- PDF rendering with canvas overlay layer
- Multi-evidence highlighting
- Zoom + scroll synchronization
- Evidence sidebar with next/previous navigation
- Clause panel showing legal text + applied rule + reasoning

### Evidence trace navigation example
- Violation `VIO-11928` selected.
- Viewer opens `DOC-2026-00012`, page 134.
- ESG table cell missing Scope 2 value highlighted.
- Clause `BRSR-ENV-1.2` and reasoning shown in side panel.
- Analyst can append annotation and escalate.

---

## Security Architecture

### Identity and Access
- IdP integration (SAML/OIDC) with MFA.
- RBAC roles: Ingestion Analyst, Compliance Reviewer, Investigation Lead, Supervisory Admin.
- ABAC constraints: entity, case, regulator jurisdiction, data classification.

### Data Protection
- Encryption keys managed by HSM/KMS.
- Field-level encryption for sensitive identifiers.
- Immutable storage tier for audit artifacts.

### Audit Logging
- Logs for: document upload, extraction run, clause execution, model query, user view, override, export.
- WORM retention for regulatory retention windows.
- Tamper-evident hashing chain across log batches.

---

## NFRA Intelligence Module

### Required intelligence outputs
1. **Cross-company anomaly detection**
   - Detect outlier disclosures versus sector peers.
2. **Audit firm risk signal detection**
   - Cluster repeated qualifications and high-risk clients by audit firm.
3. **Restatement pattern tracking**
   - Sequence model over restatement frequency/severity.
4. **Enforcement case linking**
   - Similarity linkage between current filing issues and historical orders.
5. **Whistleblower signal ingestion**
   - Confidential tip signals mapped to entities and clauses.
6. **Real-time regulatory signal correlation**
   - Map circular updates to impacted clauses and reopen prior decisions if needed.

### Sample NFRA investigation search output
```json
{
  "query": "entities with repeated revenue recognition exceptions and audit qualifications in 3 years",
  "results": [
    {
      "entity_id": "ENTITY-0192",
      "risk_score": 0.88,
      "matched_patterns": ["INDAS115 exceptions", "qualified opinion", "restatement in FY24"],
      "linked_cases": ["ENF-2024-771", "ENF-2025-114"]
    }
  ]
}
```

---

## Data Model

### 1) Documents
- `documents(document_id, entity_id, filing_type, fy, checksum, storage_uri, ingest_ts)`

### 2) Extracted Sections
- `extracted_sections(section_id, document_id, title, page_start, page_end, section_type, text, confidence)`

### 3) Regulatory Clauses
- `regulatory_clauses(clause_id, regulation_id, clause_text, version, severity_default, effective_from, effective_to)`

### 4) Compliance Decisions
- `compliance_decisions(decision_id, violation_id, clause_id, document_id, status, confidence, severity, reasoning, rule_id, created_ts)`

### 5) Evidence Mapping
- `evidence_mappings(violation_id, document_id, page_number, bounding_box_coordinates, clause_id, evidence_text, confidence_score, severity)`

### 6) Audit Logs
- `audit_logs(event_id, actor_id, role, action, object_type, object_id, ts, source_ip, hash_prev, hash_curr)`

### 7) User Access
- `user_access(user_id, role, entity_scope, case_scope, clearance_level, last_login_ts)`

### Cross-regulation conflict detection example
```json
{
  "conflict_id": "CFG-2201",
  "clause_a": "SCHEDULEIII-PS-4",
  "clause_b": "RBI-DISC-2.1",
  "issue": "Classification mismatch between current liabilities and regulatory liquidity bucket",
  "affected_documents": ["DOC-2026-00012"],
  "recommended_resolution": "Apply RBI-specific classification in regulated entity annexure and reconcile in notes."
}
```

### Clause-level compliance report example
```json
{
  "document_id": "DOC-2026-00012",
  "entity_id": "ENTITY-0192",
  "clause_results": [
    {
      "clause_id": "INDAS115-CL-23",
      "status": "NON_COMPLIANT",
      "severity": "HIGH",
      "confidence": 0.92,
      "evidence_refs": ["VIO-11928"],
      "remediation": "Add disaggregated revenue disclosure by category and timing."
    },
    {
      "clause_id": "SCHEDULEIII-BS-7",
      "status": "COMPLIANT",
      "severity": "LOW",
      "confidence": 0.97,
      "evidence_refs": ["EV-9007"]
    }
  ]
}
```

---

## Deployment Architecture

### Microservices topology
- `ingestion-service`
- `document-intelligence-service`
- `knowledge-graph-service`
- `clause-matching-service`
- `rule-execution-service`
- `explainability-service`
- `evidence-navigation-service`
- `intelligence-correlation-service`
- `audit-log-service`
- `access-control-service`

### Processing queue and scaling
- Queue: Kafka/RabbitMQ for document jobs.
- Worker pools by workload class (OCR-heavy, table-heavy, rule-heavy).
- Autoscaling on queue depth + CPU/GPU utilization.
- Idempotent job keys to prevent duplicate execution.

### Monitoring and alerting
- Metrics: throughput, extraction confidence drift, clause abstain rate, high-severity spikes.
- Alerts: SLA breach, extraction failure burst, model drift threshold, audit log write failures.
- Dashboards: regulator operations, model quality, security posture.

### Incident response
- Severity matrix (SEV1-SEV4).
- Playbooks for data breach, model corruption, clause misconfiguration, queue backlog.
- Forensic snapshots for post-incident audit.

---

## Evaluation Strategy

### Dataset composition
- Multi-year annual reports and quarterly filings.
- Mix of digital PDFs, scanned PDFs, mixed-language notes, and varied table layouts.
- Label sets at clause level with evidence coordinates.

### Metrics
1. **Clause-level precision/recall/F1**
2. **Evidence localization accuracy** (IoU/overlap for bbox)
3. **Explainability completeness score** (% decisions with all required fields)
4. **Regulator usability metrics**
   - Time to evidence
   - Time to final review
   - Override rate and reasons
5. **Robustness metrics**
   - OCR degradation tolerance
   - Rule stability under regulation version updates

### Acceptance thresholds (example)
- Clause F1 >= 0.90 on high-priority clauses.
- Evidence localization >= 0.85 IoU median.
- Explainability completeness = 100%.
- Critical false-negative rate < 2% for high-severity clauses.

---

## 90 Day Implementation Roadmap

### Days 1-30: Foundation and Controls
- Finalize clause taxonomy and versioned knowledge graph schema.
- Implement ingestion + OCR/layout/table pipeline with bbox output.
- Establish security baseline: IAM, encryption, audit log chain.
- Deliver first deterministic rules for top-priority clauses.

### Days 31-60: Reasoning and Explainability
- Deploy clause matcher (embedding + heuristics + reranker).
- Implement rule-execution framework across all rule families.
- Build explainability payload service and reviewer override flow.
- Introduce evidence navigation API + viewer overlay contracts.

### Days 61-90: Intelligence and Operationalization
- Launch NFRA intelligence correlation modules.
- Add regulatory update ingestion and clause-impact reprocessing.
- Run benchmark evaluation and remediation loops.
- Complete production readiness: observability, DR drills, incident playbooks, security hardening.

