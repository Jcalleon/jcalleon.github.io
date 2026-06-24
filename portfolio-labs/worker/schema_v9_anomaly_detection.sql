-- v9 schema addition: AI anomaly analysis results on ad_users, mirroring
-- the triage_* columns already added to alerts in schema_v5. Persisted so
-- a result isn't lost the moment the drawer closes — same lesson already
-- learned and fixed once for SOC's per-alert triage.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v9_anomaly_detection.sql

ALTER TABLE ad_users ADD COLUMN anomaly_verdict TEXT;       -- e.g. 'Likely Compromised', 'Normal Activity', 'Needs Review'
ALTER TABLE ad_users ADD COLUMN anomaly_confidence TEXT;    -- 'Low' | 'Medium' | 'High'
ALTER TABLE ad_users ADD COLUMN anomaly_analysis TEXT;
ALTER TABLE ad_users ADD COLUMN anomaly_next_step TEXT;
ALTER TABLE ad_users ADD COLUMN anomaly_analyzed_at TEXT;
