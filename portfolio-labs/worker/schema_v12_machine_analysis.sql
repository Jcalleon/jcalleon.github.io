-- v12 schema addition: AI anomaly analysis results on machines, mirroring
-- the anomaly_* columns already added to ad_users in schema_v9 exactly.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v12_machine_analysis.sql

ALTER TABLE machines ADD COLUMN anomaly_verdict TEXT;
ALTER TABLE machines ADD COLUMN anomaly_confidence TEXT;
ALTER TABLE machines ADD COLUMN anomaly_analysis TEXT;
ALTER TABLE machines ADD COLUMN anomaly_next_step TEXT;
ALTER TABLE machines ADD COLUMN anomaly_analyzed_at TEXT;
