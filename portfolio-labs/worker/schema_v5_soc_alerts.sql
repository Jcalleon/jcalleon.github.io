-- v5 schema addition: real persistent SOC alerts (replaces static data.js)
-- Mirrors the tickets/audit_log pattern already in use for ITSM.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v5_soc_alerts.sql

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',   -- 'critical' | 'high' | 'medium' | 'low'
  source TEXT NOT NULL,
  host TEXT NOT NULL,
  user_context TEXT NOT NULL DEFAULT 'n/a',  -- named user_context, not "user", to avoid clashing with the auth users table
  mitre TEXT NOT NULL DEFAULT 'n/a',
  status TEXT NOT NULL DEFAULT 'new',        -- 'new' | 'investigating' | 'resolved'
  details TEXT NOT NULL,
  assigned_to TEXT,                          -- references users.id, NULL = unassigned
  triage_verdict TEXT,                       -- saved AI triage result, so it isn't lost on drawer close
  triage_confidence TEXT,
  triage_analysis TEXT,
  triage_next_step TEXT,
  triaged_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_audit_log (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  field TEXT NOT NULL,        -- 'status' | 'assigned_to' | 'triage'
  old_value TEXT,
  new_value TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (alert_id) REFERENCES alerts(id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alert_audit_alert ON alert_audit_log(alert_id);

-- Seed data: the original 8 static alerts from data.js, now as real persisted
-- rows, so the dashboard isn't empty on first deploy and existing demo
-- content carries over exactly as it was.
INSERT OR IGNORE INTO alerts (id, title, severity, source, host, user_context, mitre, status, details, created_at) VALUES
('ALR-10481', 'Multiple failed admin logins followed by success', 'critical', 'Splunk — WinEventLog:Security', 'DC01-PROD.corp.internal', 'svc-backup', 'T1110 — Brute Force', 'new', '12 failed authentication attempts against svc-backup within 90 seconds, originating from 10.44.2.18, followed by a successful login at 03:13:58Z. Account does not normally authenticate interactively. Source IP is not in the known admin workstation range.', '2026-06-23T03:14:02Z'),
('ALR-10480', 'PowerShell encoded command execution', 'high', 'CrowdStrike Falcon', 'WKS-FIN-0073', 'j.alvarez', 'T1059.001 — PowerShell', 'investigating', 'powershell.exe launched with -EncodedCommand flag from a parent process of outlook.exe. Decoded payload references a remote .ps1 download from a non-corporate domain. Endpoint is in the Finance OU.', '2026-06-23T02:51:11Z'),
('ALR-10479', 'New scheduled task created on domain controller', 'medium', 'Graylog — Sysmon', 'DC02-PROD.corp.internal', 'SYSTEM', 'T1053.005 — Scheduled Task', 'new', 'Scheduled task ''WinUpdateCacheSync'' registered to run a binary from C:\Windows\Temp\ at 4-hour intervals. Task name mimics a legitimate Windows process but does not match known baseline tasks for this host.', '2026-06-23T02:30:47Z'),
('ALR-10478', 'Outbound connection to newly registered domain', 'low', 'ESET PROTECT', 'WKS-MKT-0210', 'r.chen', 'T1568 — Dynamic Resolution', 'resolved', 'Outbound HTTPS connection to a domain registered 6 days ago. Domain has low reputation score but no confirmed malicious classification yet. Single connection, no follow-on traffic observed.', '2026-06-23T01:58:33Z'),
('ALR-10477', 'Mass file rename activity detected', 'high', 'SentinelOne', 'FS01-SHARED.corp.internal', 'm.osei', 'T1486 — Data Encrypted for Impact', 'investigating', '214 files renamed with a new extension within a 40-second window in \\FS01\Shared\Projects\. Pattern is consistent with ransomware staging behavior. User session was active and remote (RDP from 10.44.9.201).', '2026-06-23T01:22:09Z'),
('ALR-10476', 'Unusual data volume to external storage API', 'medium', 'Cortex XDR', 'WKS-ENG-0042', 'd.patel', 'T1567.002 — Exfiltration to Cloud Storage', 'new', '2.3GB uploaded to a personal cloud storage endpoint over 11 minutes, outside the corporate-approved storage allowlist. User has no prior history of large external uploads.', '2026-06-23T00:47:55Z'),
('ALR-10475', 'Expired certificate on internal service', 'low', 'Splunk — Infra Monitoring', 'API-GW-02.corp.internal', 'n/a', 'n/a — Operational', 'resolved', 'TLS certificate for internal API gateway expired 14 minutes ago. Not a security event but flagged for visibility; renewal automation appears to have failed silently.', '2026-06-22T23:59:14Z'),
('ALR-10474', 'EDR tamper attempt — service stop request', 'critical', 'CrowdStrike Falcon', 'WKS-HR-0019', 'SYSTEM', 'T1562.001 — Disable or Modify Tools', 'new', 'A command attempting to stop the CrowdStrike Falcon sensor service was blocked by tamper protection. Originating process was a renamed copy of sc.exe executed from a user-writable temp directory.', '2026-06-22T23:10:02Z');
