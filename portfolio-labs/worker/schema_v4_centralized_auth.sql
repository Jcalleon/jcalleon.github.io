-- v4 schema addition: centralized auth across ITSM / CRM / SOC.
-- One user account, one login, one admin-approval gate — but each app
-- reads its own role column so access levels can diverge per app later.
--
-- Existing `role` column (on the users table, from schema_auth.sql) is kept
-- as-is and now represents the ITSM role specifically, to avoid touching
-- any code that already reads `role`. crm_role and soc_role are new.
--
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v4_centralized_auth.sql

ALTER TABLE users ADD COLUMN crm_role TEXT NOT NULL DEFAULT 'agent';
ALTER TABLE users ADD COLUMN soc_role TEXT NOT NULL DEFAULT 'agent';

-- Backfill: give every already-approved user the same admin/agent standing
-- in CRM and SOC that they currently have in ITSM (so nobody who already
-- had access loses anything when this ships).
UPDATE users SET crm_role = role, soc_role = role WHERE approved = 1;
