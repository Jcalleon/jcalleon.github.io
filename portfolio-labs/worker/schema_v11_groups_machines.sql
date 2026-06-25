-- v11 schema addition: groups and machines become real, independently
-- manageable entities instead of free text. Backfills from data that
-- already exists (ad_users.groups JSON column, and every distinct
-- hostname referenced in radius_events/tacacs_events) so nothing already
-- on screen changes — these rows just become first-class instead of text.
-- Run via: wrangler d1 execute itsm-db --remote --file=schema_v11_groups_machines.sql

CREATE TABLE IF NOT EXISTS directory_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS directory_group_members (
  group_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id),
  FOREIGN KEY (group_id) REFERENCES directory_groups(id),
  FOREIGN KEY (user_id) REFERENCES ad_users(id)
);

CREATE TABLE IF NOT EXISTS machines (
  id TEXT PRIMARY KEY,
  hostname TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,          -- 'workstation' | 'server' | 'network_device' | 'auth_infrastructure'
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON directory_group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON directory_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_machines_type ON machines(type);

-- ---- Backfill groups from the existing JSON column ----
-- (ad_users.groups is left in place, unchanged — the JSON column and these
-- new rows coexist; Phase E3 decides whether the JSON column eventually
-- gets retired in favor of reading purely from the join table.)

INSERT OR IGNORE INTO directory_groups (id, name, description, created_at) VALUES
('GRP-0001', 'Domain Users', 'Default group for every domain account.', '2017-01-01T00:00:00Z'),
('GRP-0002', 'Domain Admins', 'Full administrative rights across the domain.', '2017-01-01T00:00:00Z'),
('GRP-0003', 'VPN-Users', 'Permitted to authenticate via the corporate VPN gateways.', '2017-06-01T00:00:00Z'),
('GRP-0004', 'Engineering-Users', 'Engineering department staff.', '2018-01-01T00:00:00Z'),
('GRP-0005', 'Finance-Users', 'Finance department staff.', '2018-01-01T00:00:00Z'),
('GRP-0006', 'Marketing-Users', 'Marketing department staff.', '2018-01-01T00:00:00Z'),
('GRP-0007', 'HR-Users', 'Human Resources department staff.', '2018-01-01T00:00:00Z'),
('GRP-0008', 'Sales-Users', 'Sales department staff.', '2018-01-01T00:00:00Z'),
('GRP-0009', 'Network-Admins', 'Privileged access to network infrastructure (TACACS+ device admin).', '2017-01-01T00:00:00Z'),
('GRP-0010', 'Service-Accounts', 'Non-interactive accounts used by scheduled jobs and monitoring agents.', '2017-01-01T00:00:00Z');

-- ---- Backfill group membership by reading each user's existing JSON groups column ----
-- D1/SQLite's json_each() lets us explode the JSON array into rows directly
-- in SQL, so this membership mirrors exactly what's already on screen today.

INSERT OR IGNORE INTO directory_group_members (group_id, user_id, added_at)
SELECT g.id, u.id, u.created_at
FROM ad_users u
JOIN json_each(u.groups) je ON 1=1
JOIN directory_groups g ON g.name = je.value;

-- ---- Backfill machines from every distinct hostname already referenced ----

INSERT OR IGNORE INTO machines (id, hostname, type, description, created_at) VALUES
('MCH-0001', 'VPN-GW-01', 'auth_infrastructure', 'Primary VPN gateway, RADIUS NAS.', '2026-01-01T00:00:00Z'),
('MCH-0002', 'VPN-GW-02', 'auth_infrastructure', 'Secondary VPN gateway, RADIUS NAS.', '2026-01-01T00:00:00Z'),
('MCH-0003', 'WIFI-CTRL-EAST', 'auth_infrastructure', 'Wireless controller, east campus, RADIUS NAS.', '2026-01-01T00:00:00Z'),
('MCH-0004', 'WIFI-CTRL-WEST', 'auth_infrastructure', 'Wireless controller, west campus, RADIUS NAS.', '2026-01-01T00:00:00Z'),
('MCH-0005', 'INTERNAL-AAA-01', 'auth_infrastructure', 'Internal AAA server for service-account authentication.', '2026-01-01T00:00:00Z'),
('MCH-0006', 'CORE-SW-01.corp.internal', 'network_device', 'Core switch 01.', '2026-01-01T00:00:00Z'),
('MCH-0007', 'CORE-SW-02.corp.internal', 'network_device', 'Core switch 02.', '2026-01-01T00:00:00Z'),
('MCH-0008', 'EDGE-FW-01.corp.internal', 'network_device', 'Edge firewall 01.', '2026-01-01T00:00:00Z'),
('MCH-0009', 'EDGE-FW-02.corp.internal', 'network_device', 'Edge firewall 02.', '2026-01-01T00:00:00Z'),
('MCH-0010', 'DIST-SW-FIN-01.corp.internal', 'network_device', 'Distribution switch, Finance VLAN.', '2026-01-01T00:00:00Z');
