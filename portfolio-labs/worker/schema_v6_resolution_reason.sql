-- v6 schema addition: distinguish AI-bulk-dismissed alerts from manually
-- resolved ones. Both end up with status = 'resolved', but resolution_reason
-- tells you *why* — analyst judgment vs. an AI batch pass — which matters
-- for trusting the queue (an analyst should be able to tell at a glance
-- which resolved alerts a human actually looked at).
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v6_resolution_reason.sql

ALTER TABLE alerts ADD COLUMN resolution_reason TEXT;  -- NULL | 'manual' | 'ai_bulk_dismissed'
