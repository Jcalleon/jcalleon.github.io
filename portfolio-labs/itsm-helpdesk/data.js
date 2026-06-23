// Seed data — simulated ITSM ticket queue. Realistic shapes, fictional content.
const TICKETS = [
  {
    id: "TKT-2291",
    created: "2026-06-23T08:02:00Z",
    requester: "M. Thornton",
    department: "Finance",
    subject: "Can't access shared drive after VPN reconnect",
    body:
      "Since reconnecting to VPN this morning I can't reach \\\\FS01\\Shared\\Finance\\. Other drives work fine. I'm on a deadline for the month-end close, this is urgent.",
    category: "Network",
    priority: "high",
    status: "new",
    sla: "2026-06-23T12:02:00Z",
  },
  {
    id: "TKT-2290",
    created: "2026-06-23T07:41:00Z",
    requester: "D. Ferreira",
    department: "Engineering",
    subject: "Request: install Docker Desktop on dev laptop",
    body:
      "Need Docker Desktop installed for the new microservice work starting this sprint. Laptop is WKS-ENG-0088. Not urgent, whenever convenient this week.",
    category: "Software Request",
    priority: "low",
    status: "new",
    sla: "2026-06-26T07:41:00Z",
  },
  {
    id: "TKT-2289",
    created: "2026-06-23T06:55:00Z",
    requester: "S. Okafor",
    department: "HR",
    subject: "New hire laptop not received, starts Monday",
    body:
      "We have a new hire starting Monday and their laptop hasn't arrived from procurement. Need this resolved before their start date or they'll have nothing to work on day one.",
    category: "Hardware",
    priority: "high",
    status: "investigating",
    sla: "2026-06-23T18:55:00Z",
  },
  {
    id: "TKT-2288",
    created: "2026-06-23T05:30:00Z",
    requester: "T. Nakamura",
    department: "Marketing",
    subject: "Printer on 3rd floor jamming repeatedly",
    body:
      "The HP printer near the marketing pod has jammed three times today. Cleared the tray each time but it keeps happening on double-sided prints specifically.",
    category: "Hardware",
    priority: "medium",
    status: "new",
    sla: "2026-06-24T05:30:00Z",
  },
  {
    id: "TKT-2287",
    created: "2026-06-22T22:14:00Z",
    requester: "A. Whitfield",
    department: "Sales",
    subject: "Locked out of CRM after password reset",
    body:
      "Reset my password through the self-service portal but now the CRM login says my account is locked. I have a client call in an hour and need access to pull up their account history.",
    category: "Access / Account",
    priority: "high",
    status: "investigating",
    sla: "2026-06-23T02:14:00Z",
  },
  {
    id: "TKT-2286",
    created: "2026-06-22T20:05:00Z",
    requester: "R. Klein",
    department: "Legal",
    subject: "Outlook keeps asking for password every few minutes",
    body:
      "Outlook on my desktop is repeatedly prompting for credentials, even right after entering them correctly. Started this afternoon, no changes made on my end.",
    category: "Software",
    priority: "medium",
    status: "resolved",
    sla: "2026-06-23T04:05:00Z",
  },
  {
    id: "TKT-2285",
    created: "2026-06-22T17:48:00Z",
    requester: "C. Mbeki",
    department: "Operations",
    subject: "Need access to the Tableau reporting workspace",
    body:
      "Starting a new role on the ops analytics team and need access granted to the Tableau workspace my manager already has. Manager is P. Anand.",
    category: "Access / Account",
    priority: "low",
    status: "new",
    sla: "2026-06-25T17:48:00Z",
  },
  {
    id: "TKT-2284",
    created: "2026-06-22T14:20:00Z",
    requester: "L. Park",
    department: "Finance",
    subject: "Laptop fan extremely loud, possible overheating",
    body:
      "My laptop fan has been running at full speed constantly for two days, even when idle. Worried it might be a hardware issue before it fails completely during quarter close.",
    category: "Hardware",
    priority: "medium",
    status: "resolved",
    sla: "2026-06-23T14:20:00Z",
  },
];

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };
