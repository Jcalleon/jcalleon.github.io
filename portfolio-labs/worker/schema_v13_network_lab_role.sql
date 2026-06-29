-- v13 schema addition: network_lab_role column. worker.js already reads
-- and writes this column (signup INSERT, /auth/me, /auth/pending,
-- /auth/users, and the Network Labs authoring checks all reference it),
-- but no migration ever actually added it to the live users table — this
-- is that missing migration. Until this runs, /auth/pending and
-- /auth/users fail outright (they name network_lab_role explicitly in
-- their SELECT list, so "no such column" errors the whole query), which
-- is why the admin panel shows "Couldn't load pending signups" /
-- "Couldn't load users" even though /auth/me still works (it does
-- SELECT *rather than naming columns, so a missing column is silently
-- undefined instead of a hard error).
-- Same semantics as every other per-app role column: 'none' | 'agent' |
-- 'admin', defaults to 'agent' on approval, settable only by the
-- superadmin via the centralized admin panel.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v13_network_lab_role.sql

ALTER TABLE users ADD COLUMN network_lab_role TEXT NOT NULL DEFAULT 'agent';

-- Backfill: give every already-approved user the same standing in
-- Network Labs authoring that they already have in the other apps, so
-- nobody loses (or unexpectedly gains) access when this ships — same
-- backfill logic used when crm_role/soc_role/directory_role were first
-- introduced.
UPDATE users SET network_lab_role = role WHERE approved = 1;
