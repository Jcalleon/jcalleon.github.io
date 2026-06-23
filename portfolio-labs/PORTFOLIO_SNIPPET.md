# Updating your Lab & Projects section

Your current section has two placeholder cards:

- "CCDC / Hivestorm: Competition Writeup" (`#` link)
- "Home SOC Lab: Detection Pipeline" (`#` link)

You can keep both of those as-is and **add** the three new app cards alongside them, or replace
the "Home SOC Lab" placeholder with the real SOC Console link below since it now exists for real.

Paste these into the Lab & Projects section, in whatever order you'd like them to appear:

```html
<a class="project-card" href="lab-apps/soc-dashboard/index.html">
  <span class="project-tag">live demo</span>
  SOC Detection &amp; Triage Console
  Simulated SIEM alert queue with a live Claude integration: click any alert for an AI-generated
  severity verdict and recommended next step. Built with Claude Code.
</a>

<a class="project-card" href="lab-apps/itsm-helpdesk/index.html">
  <span class="project-tag">live demo</span>
  ITSM Ticket Queue
  Helpdesk ticket queue with SLA tracking. AI triage auto-categorizes tickets, sets priority,
  and drafts a first-response reply. Built with Claude Code.
</a>

<a class="project-card" href="lab-apps/crm/index.html">
  <span class="project-tag">live demo</span>
  Sales Pipeline CRM
  Kanban deal pipeline with activity-note history. AI summarizes where a deal stands and
  recommends a concrete next action. Built with Claude Code.
</a>
```

Adjust the class names (`project-card`, `project-tag`) to match whatever classes your existing
cards actually use — I don't have your CSS/component source, just the rendered HTML, so these
are placeholders for you to align with your real markup.

If you'd rather link to one page that lists all three, just point a single card at
`lab-apps/index.html` instead (the landing page already built for you).
