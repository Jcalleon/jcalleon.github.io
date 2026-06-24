-- v8 schema addition: real persistent Directory data (AD users, RADIUS
-- auth events, TACACS+ device-admin events) — replaces the static data.js
-- used in Phase A. Mirrors the tickets/alerts pattern already established:
-- a primary entity table (ad_users) with an audit log, plus two read-mostly
-- event tables (radius_events, tacacs_events) that are fundamentally
-- historical logs, not editable records.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v8_directory.sql

CREATE TABLE IF NOT EXISTS ad_users (
  id TEXT PRIMARY KEY,              -- username, e.g. 'jalvarez', 'svc-backup'
  display_name TEXT NOT NULL,
  email TEXT,                       -- NULL for service accounts
  department TEXT NOT NULL,
  ou TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enabled',  -- 'enabled' | 'disabled' | 'locked'
  groups TEXT NOT NULL,              -- JSON array, stored as text (D1/SQLite has no native array type)
  last_logon TEXT,
  created_at TEXT NOT NULL,
  mfa_enrolled INTEGER NOT NULL DEFAULT 0  -- 0/1, SQLite has no native boolean
);

CREATE TABLE IF NOT EXISTS directory_audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  field TEXT NOT NULL,              -- 'status' (the only editable field for now)
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES ad_users(id)
);

CREATE TABLE IF NOT EXISTS radius_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  nas TEXT NOT NULL,
  result TEXT NOT NULL,              -- 'accept' | 'reject'
  auth_type TEXT NOT NULL,
  source_ip TEXT NOT NULL,
  reject_reason TEXT,                -- NULL when result = 'accept'
  FOREIGN KEY (user_id) REFERENCES ad_users(id)
);

CREATE TABLE IF NOT EXISTS tacacs_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  device TEXT NOT NULL,
  privilege_level INTEGER NOT NULL,
  result TEXT NOT NULL,              -- 'accept' | 'reject'
  command TEXT,                      -- NULL for plain login events (no command accounting)
  reject_reason TEXT,
  FOREIGN KEY (user_id) REFERENCES ad_users(id)
);

CREATE INDEX IF NOT EXISTS idx_ad_users_status ON ad_users(status);
CREATE INDEX IF NOT EXISTS idx_ad_users_department ON ad_users(department);
CREATE INDEX IF NOT EXISTS idx_directory_audit_user ON directory_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_radius_user ON radius_events(user_id);
CREATE INDEX IF NOT EXISTS idx_tacacs_user ON tacacs_events(user_id);

-- Seed data: the exact 10 AD users, 15 RADIUS events, and 13 TACACS+ events
-- from Phase A's data.js, now as real persisted rows. The fadeyemi
-- brute-force-then-compromise narrative (3 failed MFA, 1 success, 1 rejected
-- device-admin attempt, all ~90 seconds apart) carries over exactly, since
-- it's the scenario the eventual AI anomaly detection phase is built around.

INSERT OR IGNORE INTO ad_users (id, display_name, email, department, ou, title, status, groups, last_logon, created_at, mfa_enrolled) VALUES
('jalvarez', 'J. Alvarez', 'j.alvarez@corp.internal', 'Finance', 'OU=Finance,OU=Users,DC=corp,DC=internal', 'Senior Accountant', 'enabled', '["Finance-Users","VPN-Users","Domain Users"]', '2026-06-23T08:41:00Z', '2021-03-15T00:00:00Z', 1),
('mosei', 'M. Osei', 'm.osei@corp.internal', 'Engineering', 'OU=Engineering,OU=Users,DC=corp,DC=internal', 'Infrastructure Engineer', 'enabled', '["Engineering-Users","VPN-Users","Network-Admins","Domain Users"]', '2026-06-23T09:15:00Z', '2019-08-02T00:00:00Z', 1),
('rchen', 'R. Chen', 'r.chen@corp.internal', 'Marketing', 'OU=Marketing,OU=Users,DC=corp,DC=internal', 'Marketing Coordinator', 'enabled', '["Marketing-Users","VPN-Users","Domain Users"]', '2026-06-22T17:30:00Z', '2023-01-10T00:00:00Z', 0),
('dpatel', 'D. Patel', 'd.patel@corp.internal', 'Engineering', 'OU=Engineering,OU=Users,DC=corp,DC=internal', 'DevOps Engineer', 'enabled', '["Engineering-Users","VPN-Users","Network-Admins","Domain Users"]', '2026-06-23T07:55:00Z', '2020-11-20T00:00:00Z', 1),
('svc-backup', 'svc-backup (Service Account)', NULL, 'IT Operations', 'OU=Service Accounts,DC=corp,DC=internal', 'Service Account — Backup Jobs', 'enabled', '["Service-Accounts","Domain Users"]', '2026-06-23T03:13:58Z', '2018-05-01T00:00:00Z', 0),
('kwilliams', 'K. Williams', 'k.williams@corp.internal', 'Human Resources', 'OU=HR,OU=Users,DC=corp,DC=internal', 'HR Generalist', 'enabled', '["HR-Users","VPN-Users","Domain Users"]', '2026-06-23T08:02:00Z', '2022-06-14T00:00:00Z', 1),
('tnguyen', 'T. Nguyen', 't.nguyen@corp.internal', 'Engineering', 'OU=Engineering,OU=Users,DC=corp,DC=internal', 'Network Administrator', 'enabled', '["Engineering-Users","Network-Admins","Domain Admins","VPN-Users","Domain Users"]', '2026-06-23T09:02:00Z', '2017-09-10T00:00:00Z', 1),
('bsolis', 'B. Solis', 'b.solis@corp.internal', 'Sales', 'OU=Sales,OU=Users,DC=corp,DC=internal', 'Account Executive', 'disabled', '["Sales-Users","Domain Users"]', '2026-05-02T14:22:00Z', '2021-07-01T00:00:00Z', 0),
('fadeyemi', 'F. Adeyemi', 'f.adeyemi@corp.internal', 'Finance', 'OU=Finance,OU=Users,DC=corp,DC=internal', 'Financial Analyst', 'locked', '["Finance-Users","VPN-Users","Domain Users"]', '2026-06-23T03:14:05Z', '2023-09-05T00:00:00Z', 1),
('svc-monitoring', 'svc-monitoring (Service Account)', NULL, 'IT Operations', 'OU=Service Accounts,DC=corp,DC=internal', 'Service Account — Monitoring Agent', 'enabled', '["Service-Accounts","Domain Users"]', '2026-06-23T09:00:00Z', '2019-02-18T00:00:00Z', 0);

INSERT OR IGNORE INTO radius_events (id, user_id, timestamp, nas, result, auth_type, source_ip, reject_reason) VALUES
('RAD-50231', 'jalvarez', '2026-06-23T08:41:00Z', 'VPN-GW-01', 'accept', 'PAP+MFA', '73.158.22.4', NULL),
('RAD-50230', 'mosei', '2026-06-23T09:15:00Z', 'WIFI-CTRL-EAST', 'accept', 'EAP-PEAP', '10.44.8.12', NULL),
('RAD-50229', 'fadeyemi', '2026-06-23T03:14:05Z', 'VPN-GW-02', 'accept', 'PAP+MFA', '10.44.2.18', NULL),
('RAD-50228', 'fadeyemi', '2026-06-23T03:13:40Z', 'VPN-GW-02', 'reject', 'PAP+MFA', '10.44.2.18', 'invalid_mfa_code'),
('RAD-50227', 'fadeyemi', '2026-06-23T03:12:55Z', 'VPN-GW-02', 'reject', 'PAP+MFA', '10.44.2.18', 'invalid_mfa_code'),
('RAD-50226', 'fadeyemi', '2026-06-23T03:12:10Z', 'VPN-GW-02', 'reject', 'PAP+MFA', '10.44.2.18', 'invalid_mfa_code'),
('RAD-50225', 'dpatel', '2026-06-23T07:55:00Z', 'VPN-GW-01', 'accept', 'PAP+MFA', '98.42.11.200', NULL),
('RAD-50224', 'kwilliams', '2026-06-23T08:02:00Z', 'WIFI-CTRL-WEST', 'accept', 'EAP-PEAP', '10.44.6.40', NULL),
('RAD-50223', 'tnguyen', '2026-06-23T09:02:00Z', 'VPN-GW-01', 'accept', 'PAP+MFA', '71.198.33.9', NULL),
('RAD-50222', 'rchen', '2026-06-22T17:30:00Z', 'WIFI-CTRL-EAST', 'accept', 'EAP-PEAP', '10.44.9.201', NULL),
('RAD-50221', 'bsolis', '2026-05-02T14:22:00Z', 'VPN-GW-02', 'accept', 'PAP', '24.13.88.5', NULL),
('RAD-50220', 'bsolis', '2026-06-10T11:00:00Z', 'VPN-GW-02', 'reject', 'PAP', '185.220.101.42', 'account_disabled'),
('RAD-50219', 'svc-backup', '2026-06-23T03:13:58Z', 'INTERNAL-AAA-01', 'accept', 'PAP', '10.44.1.5', NULL),
('RAD-50218', 'mosei', '2026-06-22T13:10:00Z', 'WIFI-CTRL-EAST', 'accept', 'EAP-PEAP', '10.44.8.12', NULL),
('RAD-50217', 'dpatel', '2026-06-21T19:45:00Z', 'VPN-GW-01', 'accept', 'PAP+MFA', '172.58.99.140', NULL);

INSERT OR IGNORE INTO tacacs_events (id, user_id, timestamp, device, privilege_level, result, command, reject_reason) VALUES
('TAC-9081', 'tnguyen', '2026-06-23T09:05:00Z', 'CORE-SW-01.corp.internal', 15, 'accept', NULL, NULL),
('TAC-9080', 'tnguyen', '2026-06-23T09:06:12Z', 'CORE-SW-01.corp.internal', 15, 'accept', 'show running-config', NULL),
('TAC-9079', 'tnguyen', '2026-06-23T09:08:45Z', 'CORE-SW-01.corp.internal', 15, 'accept', 'interface gi1/0/24 / shutdown', NULL),
('TAC-9078', 'mosei', '2026-06-23T08:50:00Z', 'EDGE-FW-02.corp.internal', 7, 'accept', NULL, NULL),
('TAC-9077', 'mosei', '2026-06-23T08:52:30Z', 'EDGE-FW-02.corp.internal', 7, 'reject', 'configure terminal', 'insufficient_privilege'),
('TAC-9076', 'dpatel', '2026-06-23T07:58:00Z', 'CORE-SW-02.corp.internal', 15, 'accept', NULL, NULL),
('TAC-9075', 'dpatel', '2026-06-23T08:01:15Z', 'CORE-SW-02.corp.internal', 15, 'accept', 'write memory', NULL),
('TAC-9074', 'jalvarez', '2026-06-22T16:00:00Z', 'EDGE-FW-01.corp.internal', 1, 'reject', NULL, 'no_device_admin_role'),
('TAC-9073', 'tnguyen', '2026-06-22T14:30:00Z', 'DIST-SW-FIN-01.corp.internal', 15, 'accept', NULL, NULL),
('TAC-9072', 'tnguyen', '2026-06-22T14:32:00Z', 'DIST-SW-FIN-01.corp.internal', 15, 'accept', 'vlan 40 / name Finance-Restricted', NULL),
('TAC-9071', 'svc-monitoring', '2026-06-23T09:00:00Z', 'CORE-SW-01.corp.internal', 1, 'accept', 'show interfaces status', NULL),
('TAC-9070', 'svc-monitoring', '2026-06-23T08:00:00Z', 'CORE-SW-02.corp.internal', 1, 'accept', 'show interfaces status', NULL),
('TAC-9069', 'fadeyemi', '2026-06-23T03:15:10Z', 'EDGE-FW-02.corp.internal', 15, 'reject', NULL, 'no_device_admin_role');
