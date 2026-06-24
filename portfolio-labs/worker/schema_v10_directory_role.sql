-- v10 schema addition: directory_role column, completing the per-app role
-- model started with crm_role/soc_role. Same semantics: 'none' | 'agent' |
-- 'admin', defaults to 'agent' on approval (auto-agent-on-approval, same
-- policy already in effect for the other three apps), settable only by
-- the superadmin via the centralized admin panel.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v10_directory_role.sql

ALTER TABLE users ADD COLUMN directory_role TEXT NOT NULL DEFAULT 'agent';

-- Backfill: give every already-approved user the same standing in
-- Directory that they already have in the other three apps, so nobody
-- loses access when this ships — same backfill logic used when crm_role/
-- soc_role were first introduced.
UPDATE users SET directory_role = role WHERE approved = 1;
