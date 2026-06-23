-- v3 schema addition: ticket assignment + audit trail
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v3.sql

ALTER TABLE tickets ADD COLUMN assigned_to TEXT; -- references users.id, NULL = unassigned

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  field TEXT NOT NULL,        -- 'status' | 'priority' | 'category' | 'assigned_to'
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_ticket ON audit_log(ticket_id);

-- For the "unread reply" indicator: track when the agent last viewed each
-- ticket's conversation, so we can tell if a requester reply is newer.
ALTER TABLE tickets ADD COLUMN agent_last_viewed_at TEXT;
