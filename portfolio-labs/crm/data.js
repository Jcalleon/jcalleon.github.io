// Seed data — simulated CRM pipeline. Realistic shapes, fictional content.
const STAGES = ["Lead", "Qualified", "Proposal", "Negotiation", "Closed Won"];

const DEALS = [
  {
    id: "DL-3041",
    company: "Northbridge Logistics",
    contact: "Elena Marsh, VP Operations",
    value: 84000,
    stage: "Negotiation",
    lastActivity: "2026-06-22T16:30:00Z",
    notes: [
      "2026-06-10: Initial discovery call. Pain point is manual dispatch scheduling across 40 trucks, costing ~12 hrs/week in coordinator time.",
      "2026-06-14: Demo'd the routing module. Elena liked the live ETA recalculation feature. Asked for pricing for 40 seats.",
      "2026-06-18: Sent proposal at $84k/year (40 seats, annual). Elena said budget needs VP Finance sign-off, expects answer this week.",
      "2026-06-22: Elena followed up asking if we can do a 90-day pilot on 10 trucks before full commit. Has not mentioned a competitor.",
    ],
  },
  {
    id: "DL-3040",
    company: "Verdant Health Partners",
    contact: "Dr. Omar Reyes, CTO",
    value: 156000,
    stage: "Proposal",
    lastActivity: "2026-06-21T11:00:00Z",
    notes: [
      "2026-06-05: Inbound lead from webinar. Looking to replace legacy patient intake system across 6 clinics.",
      "2026-06-12: Technical deep-dive with Omar's team. Their main blocker is HIPAA compliance documentation, not price.",
      "2026-06-21: Sent security/compliance packet plus proposal. Omar said he needs to route it through their compliance officer before any next step.",
    ],
  },
  {
    id: "DL-3039",
    company: "Castle & Pine Realty",
    contact: "Brianna Solis, Owner",
    value: 9600,
    stage: "Qualified",
    lastActivity: "2026-06-20T09:15:00Z",
    notes: [
      "2026-06-18: Brianna inquired about the small-team plan for her 6-agent brokerage. Currently using spreadsheets.",
      "2026-06-20: Quick call. Confirmed budget exists (~$10k/yr), main ask is simple listing-to-close tracking with mobile access. Wants a demo next week.",
    ],
  },
  {
    id: "DL-3038",
    company: "Foundry Metalworks",
    contact: "Tom Kessler, Plant Manager",
    value: 42000,
    stage: "Lead",
    lastActivity: "2026-06-17T14:00:00Z",
    notes: [
      "2026-06-17: Cold outreach response. Tom said they're 'maybe interested' in better maintenance scheduling but didn't commit to a call yet. Hasn't responded to two follow-up emails.",
    ],
  },
  {
    id: "DL-3037",
    company: "Halsted & Cobb LLP",
    contact: "Priya Nair, Office Manager",
    value: 27000,
    stage: "Closed Won",
    lastActivity: "2026-06-15T10:00:00Z",
    notes: [
      "2026-06-01: Referral from an existing client. Needed document workflow for a 30-attorney firm.",
      "2026-06-08: Smooth demo and proposal cycle, no major objections.",
      "2026-06-15: Signed annual contract at $27k. Onboarding kickoff scheduled for next month.",
    ],
  },
  {
    id: "DL-3036",
    company: "Tidewater Analytics",
    contact: "Marcus Lee, Head of Data",
    value: 63000,
    stage: "Negotiation",
    lastActivity: "2026-06-22T13:45:00Z",
    notes: [
      "2026-06-09: Marcus evaluating us against one competitor for a data pipeline monitoring tool. Team of 15 engineers.",
      "2026-06-16: Sent proposal at $63k/year. Marcus said pricing is roughly in line with the competitor.",
      "2026-06-22: Marcus flagged that the competitor offers a dedicated Slack support channel, which we don't currently have. Otherwise feature parity is close. Decision expected by end of month.",
    ],
  },
  {
    id: "DL-3035",
    company: "Riverton School District",
    contact: "Dana Whitcomb, IT Director",
    value: 118000,
    stage: "Qualified",
    lastActivity: "2026-06-19T15:20:00Z",
    notes: [
      "2026-06-12: Dana reached out about device management across 14 schools, ~6,000 devices total. Procurement cycle is tied to district board approval timeline.",
      "2026-06-19: Confirmed budget line exists for next fiscal year (starts in 2 months). Dana wants a formal RFP response, not just a proposal.",
    ],
  },
  {
    id: "DL-3034",
    company: "Bramwell & Co. Consulting",
    contact: "Felix Adeyemi, Partner",
    value: 15400,
    stage: "Lead",
    lastActivity: "2026-06-13T08:30:00Z",
    notes: [
      "2026-06-13: Felix downloaded a whitepaper and requested a callback. No call has happened yet. Small consulting firm, ~12 employees.",
    ],
  },
];
