// Seed data — simulated SOC alert feed. Realistic shapes, fictional content.
const ALERTS = [
  {
    id: "ALR-10481",
    timestamp: "2026-06-23T03:14:02Z",
    severity: "critical",
    title: "Multiple failed admin logins followed by success",
    source: "Splunk — WinEventLog:Security",
    host: "DC01-PROD.corp.internal",
    user: "svc-backup",
    mitre: "T1110 — Brute Force",
    status: "new",
    details:
      "12 failed authentication attempts against svc-backup within 90 seconds, originating from 10.44.2.18, followed by a successful login at 03:13:58Z. Account does not normally authenticate interactively. Source IP is not in the known admin workstation range.",
  },
  {
    id: "ALR-10480",
    timestamp: "2026-06-23T02:51:11Z",
    severity: "high",
    title: "PowerShell encoded command execution",
    source: "CrowdStrike Falcon",
    host: "WKS-FIN-0073",
    user: "j.alvarez",
    mitre: "T1059.001 — PowerShell",
    status: "investigating",
    details:
      "powershell.exe launched with -EncodedCommand flag from a parent process of outlook.exe. Decoded payload references a remote .ps1 download from a non-corporate domain. Endpoint is in the Finance OU.",
  },
  {
    id: "ALR-10479",
    timestamp: "2026-06-23T02:30:47Z",
    severity: "medium",
    title: "New scheduled task created on domain controller",
    source: "Graylog — Sysmon",
    host: "DC02-PROD.corp.internal",
    user: "SYSTEM",
    mitre: "T1053.005 — Scheduled Task",
    status: "new",
    details:
      "Scheduled task 'WinUpdateCacheSync' registered to run a binary from C:\\Windows\\Temp\\ at 4-hour intervals. Task name mimics a legitimate Windows process but does not match known baseline tasks for this host.",
  },
  {
    id: "ALR-10478",
    timestamp: "2026-06-23T01:58:33Z",
    severity: "low",
    title: "Outbound connection to newly registered domain",
    source: "ESET PROTECT",
    host: "WKS-MKT-0210",
    user: "r.chen",
    mitre: "T1568 — Dynamic Resolution",
    status: "resolved",
    details:
      "Outbound HTTPS connection to a domain registered 6 days ago. Domain has low reputation score but no confirmed malicious classification yet. Single connection, no follow-on traffic observed.",
  },
  {
    id: "ALR-10477",
    timestamp: "2026-06-23T01:22:09Z",
    severity: "high",
    title: "Mass file rename activity detected",
    source: "SentinelOne",
    host: "FS01-SHARED.corp.internal",
    user: "m.osei",
    mitre: "T1486 — Data Encrypted for Impact",
    status: "investigating",
    details:
      "214 files renamed with a new extension within a 40-second window in \\\\FS01\\Shared\\Projects\\. Pattern is consistent with ransomware staging behavior. User session was active and remote (RDP from 10.44.9.201).",
  },
  {
    id: "ALR-10476",
    timestamp: "2026-06-23T00:47:55Z",
    severity: "medium",
    title: "Unusual data volume to external storage API",
    source: "Cortex XDR",
    host: "WKS-ENG-0042",
    user: "d.patel",
    mitre: "T1567.002 — Exfiltration to Cloud Storage",
    status: "new",
    details:
      "2.3GB uploaded to a personal cloud storage endpoint over 11 minutes, outside the corporate-approved storage allowlist. User has no prior history of large external uploads.",
  },
  {
    id: "ALR-10475",
    timestamp: "2026-06-22T23:59:14Z",
    severity: "low",
    title: "Expired certificate on internal service",
    source: "Splunk — Infra Monitoring",
    host: "API-GW-02.corp.internal",
    user: "n/a",
    mitre: "n/a — Operational",
    status: "resolved",
    details:
      "TLS certificate for internal API gateway expired 14 minutes ago. Not a security event but flagged for visibility; renewal automation appears to have failed silently.",
  },
  {
    id: "ALR-10474",
    timestamp: "2026-06-22T23:10:02Z",
    severity: "critical",
    title: "EDR tamper attempt — service stop request",
    source: "CrowdStrike Falcon",
    host: "WKS-HR-0019",
    user: "SYSTEM",
    mitre: "T1562.001 — Disable or Modify Tools",
    status: "new",
    details:
      "A command attempting to stop the CrowdStrike Falcon sensor service was blocked by tamper protection. Originating process was a renamed copy of sc.exe executed from a user-writable temp directory.",
  },
];

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
