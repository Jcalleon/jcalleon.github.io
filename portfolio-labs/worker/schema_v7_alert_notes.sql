-- v7 schema addition: analyst notes on alerts. Unlike ITSM's messages table
-- (which has two sides — agent and requester), alert investigation notes
-- have only one kind of author: an analyst. So this tracks actor_email
-- directly, matching the alert_audit_log convention already in use, rather
-- than copying ITSM's sender='agent'|'requester' distinction, which doesn't
-- apply here.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v7_alert_notes.sql

CREATE TABLE IF NOT EXISTS alert_notes (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (alert_id) REFERENCES alerts(id)
);

CREATE INDEX IF NOT EXISTS idx_alert_notes_alert ON alert_notes(alert_id);
