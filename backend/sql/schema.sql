CREATE TABLE documents (
  document_id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  filing_type TEXT NOT NULL,
  financial_year TEXT,
  checksum_sha256 TEXT NOT NULL,
  storage_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE extracted_sections (
  section_id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  section_title TEXT NOT NULL,
  section_type TEXT NOT NULL,
  page_start INT NOT NULL,
  page_end INT NOT NULL,
  text_content TEXT NOT NULL,
  extraction_confidence NUMERIC(5,4) NOT NULL
);

CREATE TABLE section_evidence (
  evidence_id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES extracted_sections(section_id),
  page_number INT NOT NULL,
  bbox JSONB NOT NULL,
  evidence_text TEXT NOT NULL,
  ocr_confidence NUMERIC(5,4)
);

CREATE TABLE regulations (
  regulation_id TEXT PRIMARY KEY,
  regulation_name TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE
);

CREATE TABLE regulatory_clauses (
  clause_id TEXT PRIMARY KEY,
  regulation_id TEXT NOT NULL REFERENCES regulations(regulation_id),
  clause_text TEXT NOT NULL,
  expected_section TEXT NOT NULL,
  severity_default TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE validation_rules (
  rule_id TEXT PRIMARY KEY,
  clause_id TEXT NOT NULL REFERENCES regulatory_clauses(clause_id),
  rule_type TEXT NOT NULL,
  rule_expression JSONB NOT NULL,
  version TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE compliance_decisions (
  decision_id TEXT PRIMARY KEY,
  violation_id TEXT UNIQUE NOT NULL,
  clause_id TEXT NOT NULL REFERENCES regulatory_clauses(clause_id),
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL,
  reasoning TEXT NOT NULL,
  rule_id TEXT NOT NULL REFERENCES validation_rules(rule_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evidence_mappings (
  violation_id TEXT PRIMARY KEY REFERENCES compliance_decisions(violation_id),
  document_id TEXT NOT NULL REFERENCES documents(document_id),
  page_number INT NOT NULL,
  bounding_box_coordinates JSONB NOT NULL,
  clause_id TEXT NOT NULL REFERENCES regulatory_clauses(clause_id),
  evidence_text TEXT NOT NULL,
  confidence_score NUMERIC(5,4) NOT NULL,
  severity TEXT NOT NULL
);

CREATE TABLE roles (
  role_id TEXT PRIMARY KEY,
  role_name TEXT UNIQUE NOT NULL
);

CREATE TABLE users (
  user_id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(user_id),
  role_id TEXT NOT NULL REFERENCES roles(role_id),
  entity_scope TEXT,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE audit_logs (
  event_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  purpose TEXT,
  source_ip INET,
  event_ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  prev_hash TEXT,
  event_hash TEXT NOT NULL
);
