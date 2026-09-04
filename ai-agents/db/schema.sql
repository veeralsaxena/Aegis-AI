-- Run against PostgreSQL (ai_agents database)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS agent_alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_uuid        TEXT NOT NULL,
    encounter_uuid      TEXT,
    agent_name          TEXT NOT NULL,
    severity            TEXT NOT NULL CHECK (severity IN ('CRITICAL','WARN','INFO')),
    title               TEXT NOT NULL,
    body                TEXT NOT NULL,
    rule_fired          TEXT,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','acknowledged','overridden','resolved')),
    override_reason     TEXT,
    doctor_uuid         TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    resolved_at         TIMESTAMPTZ,
    detailed_reasoning  TEXT,
    specific_concerns   TEXT,
    recommended_alternatives TEXT,
    monitoring_required TEXT,
    safe_dose           TEXT,
    decision            TEXT,
    reasoning_trace     TEXT
);

CREATE TABLE IF NOT EXISTS soap_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_uuid        TEXT NOT NULL,
    encounter_uuid      TEXT,
    doctor_uuid         TEXT,
    raw_transcript      TEXT,
    soap_json           JSONB,
    status              TEXT DEFAULT 'draft' CHECK (status IN ('draft','accepted','discarded')),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    accepted_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS differential_suggestions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_uuid        TEXT NOT NULL,
    encounter_uuid      TEXT,
    input_snapshot      JSONB,
    suggestions         JSONB,
    selected_diagnosis  TEXT,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending','accepted','dismissed')),
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_patient ON agent_alerts(patient_uuid, status);
CREATE INDEX IF NOT EXISTS idx_soap_patient ON soap_drafts(patient_uuid);
CREATE INDEX IF NOT EXISTS idx_diff_patient ON differential_suggestions(patient_uuid);
