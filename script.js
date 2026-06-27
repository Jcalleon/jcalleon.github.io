// ===========================================================================
// ABOUT SECTION — LENS RANDOMIZATION
// One of 6 discipline lenses is picked at random on each page load. All 3
// Q&A pairs swap together (never independently) so the section reads as
// one coherent version of the person, not a mismatched mix. Every word
// below is pulled directly from the corresponding real, fact-checked CV —
// nothing here is AI-generated or invented at runtime; this is a fixed,
// pre-written content bank, randomly selected from, not generated.
// ===========================================================================
const ABOUT_LENSES = {
  cybersecurity: {
    label: "Cybersecurity",
    q1: "Why security, specifically?",
    a1: "Because I started in help desk, where you only ever see the aftermath of something going wrong. Security is the part of IT where you get to work upstream of that, finding the gap before someone else finds it for you. I like that it rewards paranoia with actual data: a vulnerability scan, a detection rule, a hardening baseline either holds up or it doesn't. There's no ambiguity in whether the work succeeded.",
    q2: "What's a problem you're proud of solving?",
    a2: "At RRMS, our exploitable vulnerability count across the Windows and Linux fleet was high enough that the backlog itself had become the risk. There was too much noise to know what actually mattered. I led a CIS & NIST-aligned hardening initiative across the environment, prioritized by actual exploitability rather than raw CVSS score, and paired it with PowerShell and Qualys API automation so remediation validation didn't depend on someone manually re-checking 5,000+ systems. That combination, better prioritization plus automated verification, took exploitable vulnerabilities down 82%. The part I'm proudest of isn't the number, it's that the process kept working after I built it, because it didn't depend on me running it by hand.",
    q3: "What kind of team are you looking for?",
    a3: "A team that treats security as an engineering discipline, not a checklist, where I'm building and improving controls instead of just generating compliance reports. I do my best work with ownership over a real piece of the environment, room to automate the repetitive parts of the job, and colleagues who'll push back on my approach when they have a better one. Given my background, I'm equally comfortable being the security specialist on an infrastructure-heavy team or the infrastructure-literate voice on a security team. I'd rather solve the actual problem than stay inside a narrow lane.",
  },
  networking: {
    label: "Network Engineering",
    q1: "Why networking, specifically?",
    a1: "Because almost everything else in IT sits on top of it and inherits its problems. A misconfigured VLAN or a bad firewall rule doesn't announce itself, it just makes something else look broken instead. I like that networking rewards actually understanding how traffic moves rather than guessing, and that a well-built network is invisible: nobody notices it, because it just works. That's the version of the job I want, the one where things don't break.",
    q2: "What's a problem you're proud of solving?",
    a2: "At The Smart Circle, I designed and deployed a full Meraki WAN setup for a satellite office in Ontario, including a mesh of IPSec Phase 1/2 tunnels, SMTP relay for printing, and VLAN segmentation for a multi-tenant office, all in one build. The part I'm proudest of is the same site later needed a perimeter firewall swap, Sophos to pfSense, and the segmentation and tunnel design held up through the migration without needing to be re-architected, because it was built right the first time, not just made to work for the day.",
    q3: "What kind of team are you looking for?",
    a3: "A team where network design is treated as real engineering, not just \"plug it in and hope,\" and where I have room to build things that hold up under a future change instead of just the change in front of me. I do my best work owning real infrastructure end to end, from WAN design down to the firewall migration two years later, and I want colleagues who care about that same kind of durability. I'm equally comfortable as the network specialist on a broader infrastructure team or the infrastructure-literate voice on a security team that needs someone who actually understands what the traffic is doing.",
  },
  infrastructure: {
    label: "Infrastructure & Systems",
    q1: "Why infrastructure, specifically?",
    a1: "Because it's the part of IT where \"it works\" has to mean it works for years, not just today. I like building the thing other systems depend on, whether that's a patch-compliance pipeline, a DR plan, or a server build standard, and then watching it keep holding up long after I've moved on to the next problem. There's a particular kind of satisfaction in a system that's boring because it's reliable.",
    q2: "What's a problem you're proud of solving?",
    a2: "At The Smart Circle, patch compliance across the environment was sitting at 18% when I started, a real, immediate risk. I designed and rolled out an enterprise vulnerability management program using Tenable and KACE, got compliance to 90% within about 6-8 weeks, and built scripted package deployment so future patching didn't depend on manual work. I'm proudest that the 90% wasn't a one-time push; the pipeline I built kept compliance there afterward, because the process itself was the fix, not a single cleanup effort.",
    q3: "What kind of team are you looking for?",
    a3: "A team that wants infrastructure built to last, not patched together to survive the next audit. I do my best work owning a real piece of the environment, from servers and DR planning down to the deployment pipelines that keep it all running, and I want the room to build things properly the first time. I'm comfortable being the systems specialist on a security-focused team or the infrastructure backbone for a team that's mostly focused elsewhere, since most other disciplines end up depending on this one working.",
  },
  helpdesk: {
    label: "Help Desk & Support",
    q1: "Why support, specifically?",
    a1: "Because it's where I learned that almost every recurring problem has a root cause that's fixable, if you bother to look for it instead of just closing the ticket. I started here, supporting 1,000+ users, and the thing I'm still proud of is realizing that documentation and a good FAQ could cut repeat issues dramatically instead of just answering the same question forever. That instinct, find the actual cause, never left.",
    q2: "What's a problem you're proud of solving?",
    a2: "At Apple, Keeco, SilverVentures, and Apogee, I was handling 30-40 tickets a day at peak across a 1,000+ user base, and a lot of that volume was the same handful of issues showing up over and over. I built out standardized documentation and FAQ procedures specifically targeting those repeat categories, and it improved technical support efficiency by 500%. I'm proudest that it wasn't a trick, it was just taking the time to actually fix the underlying confusion instead of resolving the same ticket for the hundredth time.",
    q3: "What kind of team are you looking for?",
    a3: "A team that sees support as the first line of actually understanding what's broken in the environment, not just a queue to clear. I do my best work when I'm trusted to fix root causes, not just symptoms, and when there's room to build the documentation or automation that prevents the next ticket instead of just answering it. I'm comfortable being the support specialist who escalates the right things at the right time, or the technical voice on a team that needs someone who's actually sat in the seat fielding the real-world fallout of a bad rollout.",
  },
  projectmanagement: {
    label: "Project Management",
    q1: "Why project ownership, specifically?",
    a1: "Because the work I care about most, hardening an environment, migrating a firewall, rolling out MDM across thousands of devices, only succeeds if someone actually owns it end to end: scope, timeline, the people involved, and the follow-through after launch. I like being that person. A good technical solution that never gets delivered isn't actually a solution.",
    q2: "What's a problem you're proud of solving?",
    a2: "At RRMS, I owned the Intune deployment project end to end, configuration, domain join, MDM enrollment, policy push, and package deployment, as a self-contained initiative inside a much larger role. Around the same time I was leading the enterprise CIS hardening initiative across 6 teams and 60+ people. I'm proudest of running both well at once: knowing when a project needed me hands-on versus when it just needed clear scope and the right people coordinating, without either one stalling the other.",
    q3: "What kind of team are you looking for?",
    a3: "A team that wants someone who can scope a real project and actually deliver it, not just track tickets in a board. I do my best work owning something concrete, a migration, a rollout, a hardening initiative, from the first conversation through the after-action review, and I want the latitude to coordinate across teams when a project needs it. I'm comfortable being the project owner on a technical team that needs someone who can both plan and actually do the hands-on work, not just one or the other.",
  },
  cloud: {
    label: "Cloud & Automation",
    q1: "Why automation, specifically?",
    a1: "Because manual work doesn't scale and it doesn't stay correct, someone eventually skips a step or does it slightly differently the tenth time. I like building the thing that does the repetitive part reliably, every time, so the humans involved can focus on the parts that actually need judgment. The best automation is the kind that's still quietly working months after you stopped thinking about it.",
    q2: "What's a problem you're proud of solving?",
    a2: "At RRMS, I automated vulnerability remediation validation across 5,000+ systems using PowerShell and the Qualys API, which eliminated about 30 hours a week of someone manually re-checking whether fixes actually held. I paired that with Terraform-managed Azure infrastructure, covering tagging, conditional access, and security extensions, with state secured in storage blobs, and an Ansible layer pushing configuration across the broader environment. I'm proudest that all three pieces, the validation pipeline, the Terraform-managed cloud resources, and the Ansible rollout, kept running correctly without needing me to babysit them.",
    q3: "What kind of team are you looking for?",
    a3: "A team that wants infrastructure as code and automation treated as the default, not a nice-to-have bolted on later. I do my best work building the pipeline that replaces a recurring manual task, whether that's validation, deployment, or configuration management, and I want room to actually own that automation rather than just request it from someone else. I'm comfortable being the automation specialist on a cloud-focused team or the infrastructure-as-code voice on a security team that needs its manual processes turned into something repeatable.",
  },
};

const EXPERIENCE_LENSES = {
  "cybersecurity": {
    "1": {
      "title": "Cybersecurity Engineer",
      "bullets": [
        "Led enterprise-wide CIS hardening across Windows and Linux systems, reducing exploitable vulnerabilities by <strong>82%</strong>",
        "Built and implemented SIEM-integrated detection pipelines across Splunk, ELK, and Graylog",
        "Integrated Cortex XDR, CrowdStrike, SentinelOne, and ESET into a centralized detection and response architecture",
        "Automated vulnerability remediation validation using PowerShell and Qualys APIs across <strong>5,000+</strong> systems",
        "Built and deployed phishing simulation, email security, and DLP programs aligned to enterprise compliance requirements"
      ],
      "stack": [
        "Splunk",
        "ELK",
        "Graylog",
        "CrowdStrike",
        "SentinelOne",
        "Cortex XDR",
        "PowerShell",
        "Qualys"
      ]
    },
    "2": {
      "title": "IT Infrastructure Consultant &amp; Independent Practice",
      "bullets": [
        "Maintain an active detection-engineering lab integrating ELK and Splunk-based SIEM tooling",
        "Run Intune MDM across a lab environment modeling enterprise endpoint policy",
        "Provide freelance cybersecurity advisory to <strong>4+</strong> small-business clients"
      ],
      "stack": [
        "ELK",
        "Splunk",
        "Intune"
      ]
    },
    "3": {
      "title": "System Administrator <span class=\"dim\">(Security-Focused)</span>",
      "bullets": [
        "Designed an enterprise vulnerability management program using Tenable and KACE, raising patch compliance from <strong>18%</strong> to <strong>90%</strong>",
        "Led migration of <strong>1,500+</strong> endpoints to CrowdStrike Falcon in one month, improving detection from weekly to real-time",
        "Implemented IAM and credential management across <strong>500+</strong> users and <strong>1,000+</strong> accounts (Okta, Atlassian, 1Password)",
        "Designed disaster recovery and business continuity plans covering <strong>150</strong> critical devices, with an RTO under 1 day"
      ],
      "stack": [
        "Tenable",
        "KACE",
        "CrowdStrike Falcon",
        "Okta",
        "1Password"
      ]
    },
    "4": {
      "title": "Network Engineer <span class=\"dim\">(MSP)</span>",
      "bullets": [
        "Secured <strong>10,000+</strong> endpoints across a mix of client environments, implementing layered firewall and VLAN/VPN segmentation controls",
        "Delivered vulnerability remediation across the full MSP client portfolio",
        "Standardized security configuration baselines across the client base, reducing configuration-drift incidents",
        "Brought new MSP clients to security baseline compliance via a standardized 3-day onboarding process"
      ],
      "stack": [
        "Firewall policy",
        "VLAN/VPN",
        "BitLocker",
        "Jamf",
        "Intune"
      ]
    },
    "5": {
      "title": "IT &amp; Security Support",
      "bullets": [
        "Managed secure identity lifecycle for <strong>700+</strong> users with no significant access-control incidents across the tenure",
        "Enforced endpoint security baseline via Active Directory across the supported device fleet",
        "Identified and escalated security-relevant issues to appropriate teams during day-to-day help-desk triage"
      ],
      "stack": [
        "Active Directory",
        "Identity lifecycle"
      ]
    }
  },
  "networking": {
    "1": {
      "title": "Network &amp; Infrastructure Engineer",
      "bullets": [
        "Led a full Cisco infrastructure refresh, cutting unplanned downtime from multiple hours to minutes per incident",
        "Implemented PXE boot with Samba to automate server and workstation rollout and imaging at scale",
        "Built and configured network devices and private network segments for internal demo and lab environments",
        "Worked with RouterOS (MikroTik) to support an externally-facing network segment",
        "Coordinated with network teams to deploy SIEM log collection across <strong>5,000+</strong> endpoints, requiring full network-level visibility"
      ],
      "stack": [
        "Cisco",
        "RouterOS",
        "PXE",
        "Samba",
        "Cortex XDR",
        "CrowdStrike",
        "SentinelOne"
      ]
    },
    "2": {
      "title": "IT Infrastructure Consultant &amp; Independent Practice",
      "bullets": [
        "Maintain network infrastructure for a lab environment supporting <strong>20-50</strong> simulated endpoints, used for ongoing skills development and scenario testing"
      ],
      "stack": [
        "Lab networking",
        "Simulated topologies"
      ]
    },
    "3": {
      "title": "Network &amp; Systems Administrator",
      "bullets": [
        "Led the design and deployment of a full Meraki WAN setup for a satellite office in Ontario, Canada, including IPSec Phase 1/2 tunnel mesh, SMTP relay, and multi-tenant VLAN segmentation",
        "Migrated that same office\u2019s perimeter firewall from Sophos to pfSense, with the original design holding up through the migration unchanged",
        "Administered network-adjacent infrastructure across <strong>100-200</strong> critical devices, including Cisco stacks and domain controllers",
        "Worked extensively with Azure Network Security Groups and Load Balancers"
      ],
      "stack": [
        "Meraki",
        "pfSense",
        "Cisco",
        "Azure NSGs",
        "IPSec"
      ]
    },
    "4": {
      "title": "Network Engineer <span class=\"dim\">(MSP)</span>",
      "bullets": [
        "Secured <strong>10,000+</strong> endpoints across a mix of client environments \u2014 from 2-device sites to a single <strong>1,000+</strong> device enterprise contract",
        "Maintained <strong>99.999%</strong> network uptime across managed client environments, with average incident resolution time of 2-4 hours",
        "Reduced new-client network-onboarding time to 3 days via a standardized process",
        "Standardized firewall, router, and switch configuration baselines across the client base"
      ],
      "stack": [
        "Firewall",
        "Routing",
        "Switching",
        "BitLocker",
        "Jamf",
        "Intune"
      ]
    },
    "5": {
      "title": "IT Support",
      "bullets": [
        "Supported network connectivity troubleshooting as part of frontline IT support for <strong>1,000+</strong> users",
        "At Apogee, an ISP, troubleshot end-user device connectivity to the network as a core part of the role"
      ],
      "stack": [
        "Network troubleshooting",
        "Connectivity support"
      ]
    }
  },
  "infrastructure": {
    "1": {
      "title": "Infrastructure &amp; Systems Engineer",
      "bullets": [
        "Automated remediation validation across <strong>5,000+</strong> systems via PowerShell and Qualys APIs, cutting manual work by ~30 hours per week",
        "Hardened the Windows and Linux fleet enterprise-wide, reducing exploitable vulnerabilities by <strong>82%</strong>",
        "Built and maintained SIEM infrastructure (Splunk, ELK, Graylog) ingesting <strong>100,000+</strong> events per day",
        "Implemented the full Intune stack end to end \u2014 device configuration, domain join, MDM enrollment, policy push, and package deployment",
        "Orchestrated an Ansible environment to push updates and configuration changes across the broader infrastructure footprint"
      ],
      "stack": [
        "PowerShell",
        "Qualys",
        "Splunk",
        "ELK",
        "Graylog",
        "Intune",
        "Ansible"
      ]
    },
    "2": {
      "title": "IT Infrastructure Consultant &amp; Independent Practice",
      "bullets": [
        "Maintain lab infrastructure running detection pipelines and Intune MDM across <strong>10-50</strong> lab devices, separate from a <strong>3,000+</strong> device production Intune migration delivered for a client"
      ],
      "stack": [
        "Intune",
        "Detection pipelines"
      ]
    },
    "3": {
      "title": "System Administrator <span class=\"dim\">(Security-Focused)</span>",
      "bullets": [
        "Designed an enterprise vulnerability management program (Tenable + KACE), raising patch compliance from <strong>18%</strong> to <strong>90%</strong>",
        "Administered <strong>35</strong> Windows and Linux servers within a broader <strong>100-200</strong> device infrastructure footprint",
        "Designed disaster recovery and business continuity plans covering <strong>100-200</strong> critical devices, with an RTO under 1 day",
        "Led the <strong>1,500+</strong> endpoint CrowdStrike Falcon migration in one month, improving detection from weekly to real-time"
      ],
      "stack": [
        "Tenable",
        "KACE",
        "CrowdStrike Falcon",
        "Windows Server",
        "Linux"
      ]
    },
    "4": {
      "title": "Network Engineer <span class=\"dim\">(MSP)</span>",
      "bullets": [
        "Delivered infrastructure hardening across a client base ranging from 2-device sites to a single <strong>1,000+</strong> device enterprise contract",
        "Secured <strong>10,000+</strong> endpoints total, maintaining infrastructure reliability across a mixed-scale client portfolio",
        "Standardized infrastructure configuration baselines across the client base to reduce drift-related incidents"
      ],
      "stack": [
        "Infrastructure hardening",
        "Configuration management"
      ]
    },
    "5": {
      "title": "IT Support",
      "bullets": [
        "Maintained endpoint infrastructure (<strong>700+</strong> identity records) across Active Directory for a <strong>1,000+</strong> user base",
        "Supported infrastructure-adjacent projects including office moves and server rack decommissions"
      ],
      "stack": [
        "Active Directory",
        "Endpoint infrastructure"
      ]
    }
  },
  "helpdesk": {
    "1": {
      "title": "Security Incident Support Lead",
      "bullets": [
        "Provided security-incident guidance to internal teams as part of the incident-response process, across <strong>6+</strong> coordinating teams",
        "Built SIEM-integrated detection pipelines that frontline teams relied on to triage and escalate correctly"
      ],
      "stack": [
        "Splunk",
        "ELK",
        "Graylog",
        "Cortex XDR"
      ]
    },
    "2": {
      "title": "IT Infrastructure Consultant &amp; Independent Practice",
      "bullets": [
        "Provide freelance IT and infrastructure advisory to <strong>4+</strong> small-business clients, including a full <strong>3,000+</strong> device Intune migration for one client"
      ],
      "stack": [
        "Intune",
        "Client support"
      ]
    },
    "3": {
      "title": "Systems Administrator",
      "bullets": [
        "Provided escalation support tied to the IAM rollout (Okta, Atlassian, 1Password) across <strong>500+</strong> users during the transition"
      ],
      "stack": [
        "Okta",
        "Atlassian",
        "1Password"
      ]
    },
    "4": {
      "title": "Network Engineer <span class=\"dim\">(MSP)</span>",
      "bullets": [
        "Resolved client support incidents across a 10-30 client MSP portfolio, with average incident resolution time of 2-4 hours",
        "Delivered a standardized 3-day client onboarding process (BitLocker, Jamf/Intune enrollment)",
        "Supported clients ranging from 2-device small offices to a single <strong>1,000+</strong> device enterprise contract"
      ],
      "stack": [
        "BitLocker",
        "Jamf",
        "Intune",
        "Client support"
      ]
    },
    "5": {
      "title": "IT &amp; Security Support",
      "bullets": [
        "Supported a <strong>1,000+</strong> user base, handling 30-40 tickets per day at peak with a <strong>25%</strong> first-call resolution rate",
        "Improved technical support efficiency by <strong>500%</strong> through standardized documentation and FAQ procedures",
        "Managed identity lifecycle for <strong>700+</strong> users, processing ~5 changes per month",
        "Maintained a customer satisfaction score of <strong>95%</strong> based on post-resolution feedback",
        "At Apogee, an ISP, supported end-user connectivity troubleshooting where the network itself was the product"
      ],
      "stack": [
        "Active Directory",
        "Documentation",
        "Ticketing"
      ]
    }
  },
  "projectmanagement": {
    "1": {
      "title": "Cybersecurity Program Lead",
      "bullets": [
        "Led the enterprise CIS hardening initiative as a discrete project, coordinating across <strong>6</strong> teams and <strong>60+</strong> people, delivering an <strong>82%</strong> reduction in exploitable vulnerabilities",
        "Managed the SIEM pipeline build (Splunk, ELK, Graylog) as a multi-stakeholder infrastructure project, ingesting <strong>100,000+</strong> events per day at completion",
        "Owned the Intune deployment project end to end \u2014 configuration, domain join, MDM enrollment, policy push, and package deployment",
        "Led the project connecting on-prem identity to Entra ID and Intune, including scoping and executing the underlying migration"
      ],
      "stack": [
        "Splunk",
        "ELK",
        "Graylog",
        "Intune",
        "Entra ID",
        "Ansible",
        "Terraform"
      ]
    },
    "2": {
      "title": "Independent IT Consultant",
      "bullets": [
        "Led a <strong>3,000+</strong> device Intune migration for a freelance client end to end \u2014 scoping, package deployment automation, configuration, and user-profile/data migration \u2014 as a fully self-owned engagement from kickoff through completion",
        "Manage freelance client engagements end to end for <strong>4+</strong> clients, each independently scoped and delivered"
      ],
      "stack": [
        "Intune",
        "Project delivery"
      ]
    },
    "3": {
      "title": "Infrastructure Program Lead",
      "bullets": [
        "Led the design and deployment of a full Meraki WAN setup for a satellite office in Ontario, Canada, as a self-contained project",
        "Managed the firewall migration project (Sophos to pfSense) for that same office once operational",
        "Led the <strong>1,500+</strong> endpoint CrowdStrike Falcon migration as a project, delivered within a 1-month timeline",
        "Ran the vulnerability-management-program rollout (Tenable + KACE), taking patch compliance from <strong>18%</strong> to <strong>90%</strong> within 6-8 weeks"
      ],
      "stack": [
        "Meraki",
        "pfSense",
        "CrowdStrike",
        "Tenable",
        "KACE"
      ]
    },
    "4": {
      "title": "Network Engineer <span class=\"dim\">(MSP)</span>",
      "bullets": [
        "Coordinated onboarding projects for new MSP clients, each delivered within a standardized 3-day timeline",
        "Coordinated multi-client rollout projects including mergers and a database-administration migration"
      ],
      "stack": [
        "Client onboarding",
        "Multi-client coordination"
      ]
    },
    "5": {
      "title": "IT &amp; Security Support",
      "bullets": [
        "Coordinated office moves and server rack decommissions as discrete projects affecting the broader <strong>1,000+</strong> user base"
      ],
      "stack": [
        "Project coordination"
      ]
    }
  },
  "cloud": {
    "1": {
      "title": "Cloud Security &amp; Automation Engineer",
      "bullets": [
        "Automated vulnerability remediation validation via PowerShell and Qualys APIs across <strong>5,000+</strong> systems, eliminating ~30 hours per week of manual work",
        "Administered Azure managed identities, conditional access policies, and enterprise application SSO",
        "Built Terraform automation covering resource tagging, conditional access parameters, access control, and security extensions, with state secured in storage blobs",
        "Led integration work connecting on-prem identity to Entra ID and Intune, including the underlying migration",
        "Orchestrated an Ansible environment to push configuration and updates across the broader infrastructure"
      ],
      "stack": [
        "Azure",
        "Terraform",
        "Ansible",
        "Entra ID",
        "Intune",
        "PowerShell",
        "Qualys"
      ]
    },
    "2": {
      "title": "Cloud &amp; Automation Consultant",
      "bullets": [
        "Led a <strong>3,000+</strong> device Intune migration for a freelance client, including full automation of package deployment, configuration, and user-profile/data migration",
        "Run Intune MDM across a separate <strong>10-50</strong> device lab environment for ongoing skills development"
      ],
      "stack": [
        "Intune",
        "MDM",
        "Automation"
      ]
    },
    "3": {
      "title": "System Administrator <span class=\"dim\">(Security-Focused)</span>",
      "bullets": [
        "Implemented cloud-based IAM (Okta) as part of the credential-management rollout across <strong>500+</strong> users and <strong>1,000+</strong> accounts",
        "Worked with Azure Network Security Groups, Azure CLI, and Azure Load Balancing"
      ],
      "stack": [
        "Okta",
        "Azure NSGs",
        "Azure CLI",
        "Azure Load Balancer"
      ]
    },
    "4": {
      "title": "Network Engineer <span class=\"dim\">(MSP)</span>",
      "bullets": [
        "Supported Citrix environments hosted in Azure as part of client infrastructure management",
        "Built basic automation around Azure CLI and scripted backups for client environments"
      ],
      "stack": [
        "Citrix",
        "Azure",
        "Azure CLI"
      ]
    },
    "5": {
      "title": "IT Support",
      "bullets": [
        "Supported Azure-hosted business applications (e.g., Adobe Creative Cloud and similar SaaS tools) as part of standard end-user support"
      ],
      "stack": [
        "Azure-hosted SaaS support"
      ]
    }
  }
};

(function applyRandomLens() {
  const keys = Object.keys(ABOUT_LENSES);
  const chosenKey = keys[Math.floor(Math.random() * keys.length)];
  const chosen = ABOUT_LENSES[chosenKey];

  const labelEl = document.getElementById("lens-label");
  if (labelEl) labelEl.textContent = chosen.label;

  for (const n of [1, 2, 3]) {
    const qEl = document.getElementById(`qa-q-${n}`);
    const aEl = document.getElementById(`qa-a-${n}`);
    if (qEl) qEl.textContent = chosen[`q${n}`];
    if (aEl) aEl.textContent = chosen[`a${n}`];
  }

  // Experience section uses the SAME chosen lens key, never picked
  // independently — per the "whole page reads as one coherent version of
  // the person" decision. Bullets/titles contain real <strong> tags
  // around numbers, so this uses innerHTML, not textContent — every
  // string in EXPERIENCE_LENSES was authored directly (not built from
  // unescaped user input), so this is safe here the way it would NOT be
  // for arbitrary external data.
  const expLensData = (typeof EXPERIENCE_LENSES !== "undefined") ? EXPERIENCE_LENSES[chosenKey] : null;
  if (expLensData) {
    for (const jobNum of [1, 2, 3, 4, 5]) {
      const job = expLensData[jobNum];
      if (!job) continue;

      const titleEl = document.getElementById(`exp-title-${jobNum}`);
      const listEl = document.getElementById(`exp-list-${jobNum}`);
      const stackEl = document.getElementById(`exp-stack-${jobNum}`);

      if (titleEl) titleEl.innerHTML = job.title;
      if (listEl) listEl.innerHTML = job.bullets.map((b) => `<li>${b}</li>`).join("");
      if (stackEl) stackEl.innerHTML = job.stack.map((s) => `<span>${s}</span>`).join("");
    }
  }
})();

// ===========================================================================
// RESUME DOWNLOAD DROPDOWN
// ===========================================================================
(function () {
  const dropdown = document.getElementById("resume-dropdown");
  const trigger = document.getElementById("resume-dropdown-trigger");
  if (!dropdown || !trigger) return;

  function closeDropdown() {
    dropdown.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
  }

  function toggleDropdown() {
    const isOpen = dropdown.classList.toggle("open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) closeDropdown();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDropdown();
  });
})();

// Placeholder click feedback — flash the element so it's obvious what's a stand-in
document.querySelectorAll('[data-placeholder]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    el.classList.add('placeholder-flash');
    setTimeout(() => el.classList.remove('placeholder-flash'), 900);
  });
});

// Credly-pending cred-cards — same stand-in treatment until real
// verification URLs are added (see TODO comments in index.html).
document.querySelectorAll('[data-credly-pending]').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    el.classList.add('placeholder-flash');
    setTimeout(() => el.classList.remove('placeholder-flash'), 900);
  });
});

// ===========================================================================
// NETWORK TOPOLOGY ANIMATION — nodes + edges + traveling "packets"
// Grounded in the subject: this is what a network/SOC diagram actually looks
// like, not generic floating particles.
// ===========================================================================
(function () {
  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let nodes = [];
  let edges = [];
  let packets = [];
  let rafId = null;

  const COLORS = {
    node: 'rgba(91, 143, 176, 0.85)',     // steel blue
    nodeCore: 'rgba(230, 232, 235, 1)', // text
    edge: 'rgba(91, 143, 176, 0.3)',
    edgeActive: 'rgba(240, 169, 60, 0.6)', // amber
    packet: 'rgba(240, 169, 60, 1)',
    packetGlow: 'rgba(240, 169, 60, 0.5)'
  };

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildGraph() {
    const isMobile = width < 640;
    const nodeCount = isMobile ? 9 : 28;
    const textColEdge = isMobile ? 0 : width * 0.46; // keep main text column lighter
    const yBound = isMobile ? height * 0.16 : height; // mobile: keep activity in top strip only
    nodes = [];
    for (let i = 0; i < nodeCount; i++) {
      let x = Math.random() * width;
      // bias: push ~70% of nodes to the right of the text column on desktop
      if (!isMobile && Math.random() < 0.7) {
        x = textColEdge + Math.random() * (width - textColEdge);
      }
      nodes.push({
        x,
        y: Math.random() * yBound,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        r: 2.6 + Math.random() * 2.4,
        pulse: Math.random() * Math.PI * 2,
        yBound
      });
    }

    // Connect each node to its 2-3 nearest neighbors (real topology feel,
    // not a fully connected mess)
    edges = [];
    const maxDist = Math.max(width, height) * 0.32;
    for (let i = 0; i < nodes.length; i++) {
      const dists = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < maxDist) dists.push({ j, d });
      }
      dists.sort((a, b) => a.d - b.d);
      const connections = dists.slice(0, 2 + Math.floor(Math.random() * 2));
      connections.forEach(c => {
        const key = i < c.j ? `${i}-${c.j}` : `${c.j}-${i}`;
        if (!edges.find(e => e.key === key)) {
          edges.push({ key, a: i, b: c.j });
        }
      });
    }

    packets = [];
    spawnPackets();
  }

  function spawnPackets() {
    const isMobile = width < 640;
    const packetCount = isMobile ? 5 : 10;
    for (let i = 0; i < packetCount; i++) {
      addPacket();
    }
  }

  function addPacket() {
    if (edges.length === 0) return;
    const edge = edges[Math.floor(Math.random() * edges.length)];
    packets.push({
      edge,
      t: 0,
      speed: 0.0035 + Math.random() * 0.004,
      reverse: Math.random() > 0.5
    });
  }

  function step() {
    // drift nodes gently
    nodes.forEach(n => {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += 0.02;
      if (n.x < 0 || n.x > width) n.vx *= -1;
      if (n.y < 0 || n.y > (n.yBound || height)) n.vy *= -1;
    });

    ctx.clearRect(0, 0, width, height);

    // edges
    const activeEdgeKeys = new Set(packets.map(p => p.edge.key));
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = activeEdgeKeys.has(e.key) ? COLORS.edgeActive : COLORS.edge;
      ctx.lineWidth = activeEdgeKeys.has(e.key) ? 1.4 : 1;
      ctx.stroke();
    });

    // packets traveling along edges
    packets.forEach(p => {
      p.t += p.speed;
      if (p.t >= 1) {
        p.t = 0;
        p.edge = edges[Math.floor(Math.random() * edges.length)];
        p.reverse = Math.random() > 0.5;
      }
      const a = nodes[p.edge.a], b = nodes[p.edge.b];
      const t = p.reverse ? 1 - p.t : p.t;
      const x = a.x + (b.x - a.x) * t;
      const y = a.y + (b.y - a.y) * t;

      // glow
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 13);
      grad.addColorStop(0, COLORS.packetGlow);
      grad.addColorStop(1, 'rgba(240, 169, 60, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.packet;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // nodes
    nodes.forEach(n => {
      const pulseR = n.r + Math.sin(n.pulse) * 0.6;
      ctx.beginPath();
      ctx.arc(n.x, n.y, pulseR, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.node;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(n.x, n.y, pulseR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.nodeCore;
      ctx.fill();
    });

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    buildGraph();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      // static single frame for reduced-motion users
      ctx.clearRect(0, 0, width, height);
      edges.forEach(e => {
        const a = nodes[e.a], b = nodes[e.b];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = COLORS.edge;
        ctx.lineWidth = 1;
        ctx.stroke();
      });
      nodes.forEach(n => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.node;
        ctx.fill();
      });
    }
  }

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// EXPOSURE MAP ANIMATION — devices, shields, locks, scanning sweep
// Shodan/Censys-style global device map. Distinct from the hero's network
// topology: this one reads as "scanning the perimeter", not "live traffic".
// ===========================================================================
(function () {
  const canvas = document.getElementById('exposure-canvas');
  const labelsContainer = document.getElementById('exposure-labels');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let devices = [];
  let sweepAngle = 0;
  let rafId = null;
  let t = 0;

  const ICE = 'rgba(200, 228, 248, 1)';
  const ICE_DIM = 'rgba(140, 185, 218, 0.75)';
  const ICE_FAINT = 'rgba(91, 143, 176, 0.35)';
  const FLAG = 'rgba(240, 169, 60, 1)';
  const SWEEP = 'rgba(160, 205, 235, 0.22)';

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function randomIP() {
    const seg = () => Math.floor(Math.random() * 255);
    return `${seg()}.${seg()}.${seg()}.${seg()}`;
  }

  function buildDevices() {
    const isMobile = width < 640;
    devices = [];

    if (isMobile) {
      // Mobile: heading spans y=64-109, card grid starts y=157 (measured).
      // Use the ~35px gap between them for a thin device band.
      const bandTop = 118;
      const bandBottom = 148;
      const count = 6;
      for (let i = 0; i < count; i++) {
        const flagged = Math.random() < 0.22;
        devices.push({
          x: 20 + Math.random() * (width - 40),
          y: bandTop + Math.random() * (bandBottom - bandTop),
          type: ['shield', 'lock', 'node'][Math.floor(Math.random() * 3)],
          flagged,
          ip: randomIP(),
          showLabel: flagged && Math.random() < 0.5,
          blink: Math.random() * Math.PI * 2,
          blinkSpeed: 0.015 + Math.random() * 0.02
        });
      }
      // thin out labels that would collide, and clip-suppress near right edge
      const labeled = [];
      devices.forEach(d => {
        if (!d.showLabel) return;
        if (d.x > width - 90) { d.showLabel = false; return; }
        const tooClose = labeled.some(o => Math.abs(o.x - d.x) < 100 && Math.abs(o.y - d.y) < 16);
        if (tooClose) d.showLabel = false; else labeled.push(d);
      });
      createLabelElements();
      return;
    }

    const count = 30;
    const topBand = 170; // hard cap, well above where cred cards begin
    const minY = 15; // keep clear of the very top edge / sticky nav seam
    const headingZone = { top: 45, bottom: 155, left: 0, right: Math.min(width, 680) };
    let attempts = 0;
    while (devices.length < count && attempts < count * 6) {
      attempts++;
      const x = Math.random() * width;
      const y = minY + Math.random() * (topBand - minY);
      const inHeadingZone = y > headingZone.top && y < headingZone.bottom && x > headingZone.left && x < headingZone.right;
      if (inHeadingZone) continue;
      const flagged = Math.random() < 0.22;
      devices.push({
        x, y,
        type: ['shield', 'lock', 'node'][Math.floor(Math.random() * 3)],
        flagged,
        ip: randomIP(),
        showLabel: flagged ? Math.random() < 0.7 : Math.random() < 0.12,
        blink: Math.random() * Math.PI * 2,
        blinkSpeed: 0.015 + Math.random() * 0.02
      });
    }

    // suppress labels that would visually collide with an already-labeled
    // device (labels render to the right of the icon, ~90px wide), and
    // suppress labels that would clip past the right edge of the canvas
    const labeled = [];
    devices.forEach(d => {
      if (!d.showLabel) return;
      if (d.x > width - 100) {
        d.showLabel = false;
        return;
      }
      const tooClose = labeled.some(o => Math.abs(o.x - d.x) < 130 && Math.abs(o.y - d.y) < 18);
      if (tooClose) {
        d.showLabel = false;
      } else {
        labeled.push(d);
      }
    });
    createLabelElements();
  }

  function createLabelElements() {
    if (!labelsContainer) return;
    labelsContainer.innerHTML = '';
    devices.forEach(d => {
      if (!d.showLabel) {
        d.labelEl = null;
        return;
      }
      const el = document.createElement('span');
      el.className = 'exposure-label' + (d.flagged ? ' flagged' : '');
      el.textContent = d.ip;
      el.style.display = 'none';
      labelsContainer.appendChild(el);
      d.labelEl = el;
    });
  }

  function drawShield(x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.bezierCurveTo(size * 0.7, -size * 0.7, size * 0.7, size * 0.2, 0, size);
    ctx.bezierCurveTo(-size * 0.7, size * 0.2, -size * 0.7, -size * 0.7, 0, -size);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, 0);
    ctx.lineTo(-size * 0.1, size * 0.3);
    ctx.lineTo(size * 0.4, -size * 0.3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawLock(x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -size * 0.15, size * 0.55, Math.PI, 0, false);
    ctx.stroke();
    ctx.strokeRect(-size * 0.6, -size * 0.15, size * 1.2, size * 0.9);
    ctx.restore();
  }

  function drawNode(x, y, size, color) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }

  function step() {
    t += 1;
    ctx.clearRect(0, 0, width, height);

    const cx = width * 0.5;
    const cy = height * 0.18;
    const sweepR = Math.max(width, height) * 0.95;

    // faint concentric scan rings
    for (let r = 1; r <= 4; r++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (sweepR / 4) * r, 0, Math.PI * 2);
      ctx.strokeStyle = ICE_FAINT;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // rotating sweep wedge
    if (!reduceMotion) sweepAngle += 0.006;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, sweepR, sweepAngle, sweepAngle + 0.5);
    ctx.closePath();
    ctx.fillStyle = SWEEP;
    ctx.fill();
    ctx.restore();

    // devices
    devices.forEach(d => {
      d.blink += d.blinkSpeed;
      const pulse = 0.7 + Math.sin(d.blink) * 0.3;
      const angleToDevice = Math.atan2(d.y - cy, d.x - cx);
      let normalizedSweep = sweepAngle % (Math.PI * 2);
      let normalizedAngle = angleToDevice % (Math.PI * 2);
      if (normalizedAngle < 0) normalizedAngle += Math.PI * 2;
      if (normalizedSweep < 0) normalizedSweep += Math.PI * 2;
      const diff = Math.abs(normalizedAngle - normalizedSweep);
      const justSwept = diff < 0.5 || diff > Math.PI * 2 - 0.5;

      const baseColor = d.flagged ? FLAG : ICE_DIM;
      const color = justSwept ? (d.flagged ? FLAG : ICE) : baseColor;
      const size = justSwept ? 11 * pulse : 8.5;

      if (d.type === 'shield') drawShield(d.x, d.y, size, color);
      else if (d.type === 'lock') drawLock(d.x, d.y, size, color);
      else drawNode(d.x, d.y, size, color);

      if (d.showLabel && (justSwept || d.flagged) && d.labelEl) {
        d.labelEl.style.display = 'block';
        d.labelEl.style.left = (d.x + 12) + 'px';
        d.labelEl.style.top = d.y + 'px';
      } else if (d.labelEl) {
        d.labelEl.style.display = 'none';
      }
    });

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    buildDevices();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      devices.forEach(d => {
        const color = d.flagged ? FLAG : ICE_DIM;
        if (d.type === 'shield') drawShield(d.x, d.y, 7, color);
        else if (d.type === 'lock') drawLock(d.x, d.y, 7, color);
        else drawNode(d.x, d.y, 7, color);
      });
    }
  }

  let exposureResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(exposureResizeTimeout);
    exposureResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// CIRCUIT TRACE ANIMATION — orthogonal PCB-style traces converging into the
// competencies grid, with pulses traveling along them. Lives in the header
// area above the cards (the cards themselves are opaque).
// ===========================================================================
(function () {
  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let traces = [];
  let pulses = [];
  let rafId = null;

  const LINE = 'rgba(91, 143, 176, 0.35)';
  const LINE_DIM = 'rgba(91, 143, 176, 0.18)';
  const PULSE = 'rgba(240, 169, 60, 0.95)';
  const PULSE_GLOW = 'rgba(240, 169, 60, 0.4)';
  const NODE = 'rgba(140, 185, 218, 0.6)';

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildTraces() {
    // Measure the actual gap between section-head text and comp-grid live,
    // rather than guessing fixed pixel values that break at different
    // text-wrap widths.
    const sectionEl = canvas.parentElement;
    const headEl = sectionEl.querySelector('.section-head');
    const gridEl = sectionEl.querySelector('.comp-grid');
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const headBottom = headEl ? headEl.getBoundingClientRect().bottom - sectionTop : 200;
    const gridTop = gridEl ? gridEl.getBoundingClientRect().top - sectionTop : 260;

    const topY = headBottom + 6;
    const bandHeight = Math.max(20, gridTop - topY - 6);
    const isMobile = width < 640;
    traces = [];

    const laneCount = isMobile ? 4 : 6;
    for (let i = 0; i < laneCount; i++) {
      const startX = (width / (laneCount + 1)) * (i + 1) + (Math.random() - 0.5) * 30;
      const midY = topY + bandHeight * (0.4 + Math.random() * 0.2);
      const endX = startX + (Math.random() - 0.5) * 60;
      const endY = topY + bandHeight;
      // orthogonal path: down, then horizontal jog, then down again
      const points = [
        { x: startX, y: topY },
        { x: startX, y: midY },
        { x: endX, y: midY },
        { x: endX, y: endY }
      ];
      traces.push({ points, hasNode: Math.random() < 0.6 });
    }

    pulses = traces.map((trace, i) => ({
      traceIndex: i,
      t: Math.random(),
      speed: 0.0025 + Math.random() * 0.0025,
      active: Math.random() < 0.7
    }));
  }

  function pathLength(points) {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
  }

  function pointAtT(points, t) {
    const total = pathLength(points);
    let dist = t * total;
    for (let i = 1; i < points.length; i++) {
      const segLen = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      if (dist <= segLen) {
        const segT = segLen === 0 ? 0 : dist / segLen;
        return {
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * segT,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * segT
        };
      }
      dist -= segLen;
    }
    return points[points.length - 1];
  }

  function drawTracePath(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    traces.forEach((trace, i) => {
      ctx.strokeStyle = LINE_DIM;
      ctx.lineWidth = 1;
      drawTracePath(trace.points);

      // corner nodes (small connection dots at bends)
      if (trace.hasNode) {
        const corner = trace.points[2];
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = NODE;
        ctx.fill();
      }

      // endpoint dot (where trace meets the grid)
      const end = trace.points[trace.points.length - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = LINE;
      ctx.fill();
    });

    pulses.forEach(p => {
      if (!p.active) return;
      if (!reduceMotion) p.t += p.speed;
      if (p.t > 1) {
        p.t = 0;
        p.active = Math.random() < 0.7;
      }
      const trace = traces[p.traceIndex];
      const pos = pointAtT(trace.points, p.t);

      const grad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 7);
      grad.addColorStop(0, PULSE_GLOW);
      grad.addColorStop(1, 'rgba(240, 169, 60, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = PULSE;
      ctx.fill();
    });

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    buildTraces();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      traces.forEach(trace => {
        ctx.strokeStyle = LINE_DIM;
        ctx.lineWidth = 1;
        drawTracePath(trace.points);
      });
    }
  }

  let circuitResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(circuitResizeTimeout);
    circuitResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// BUILD PIPELINE ANIMATION — small blocks moving through CI/CD stages
// (build -> test -> deploy), flashing on completion. Lives in the gap
// between the section subtitle and the lab-grid cards. Text labels are
// real HTML (not canvas fillText) to stay clear of fingerprinting blocks.
// ===========================================================================
(function () {
  const canvas = document.getElementById('pipeline-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let stages = [];
  let blocks = [];
  let rafId = null;
  let bandTop = 0, bandHeight = 60;

  const LINE = 'rgba(91, 143, 176, 0.35)';
  const STAGE_FILL = 'rgba(28, 35, 48, 0.9)';
  const STAGE_STROKE = 'rgba(91, 143, 176, 0.4)';
  const BLOCK = 'rgba(140, 185, 218, 0.9)';
  const BLOCK_DONE = 'rgba(63, 182, 140, 0.95)';
  const BLOCK_GLOW = 'rgba(63, 182, 140, 0.4)';

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function measureBand() {
    const sectionEl = canvas.parentElement;
    const headEl = sectionEl.querySelector('.section-head');
    const gridEl = sectionEl.querySelector('.lab-grid');
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const headBottom = headEl ? headEl.getBoundingClientRect().bottom - sectionTop : 200;
    const gridTop = gridEl ? gridEl.getBoundingClientRect().top - sectionTop : 280;
    const margin = 10;
    bandTop = headBottom + margin;
    // Never let the band exceed the actual available gap, even if that
    // means a thinner-than-ideal strip.
    bandHeight = Math.max(16, gridTop - bandTop - margin);
  }

  function buildStages() {
    measureBand();
    const isMobile = width < 640;
    const labels = isMobile ? ['build', 'test', 'ship'] : ['build', 'test', 'scan', 'deploy'];
    const margin = isMobile ? 24 : 60;
    const usable = width - margin * 2;
    const stageW = usable / labels.length;
    stages = labels.map((label, i) => ({
      label,
      x: margin + stageW * i,
      width: stageW,
      y: bandTop,
      height: bandHeight
    }));

    blocks = [];
    const blockCount = isMobile ? 3 : 5;
    for (let i = 0; i < blockCount; i++) {
      blocks.push({
        progress: Math.random(),
        speed: 0.0009 + Math.random() * 0.0007,
        lane: Math.random() * 0.6 + 0.2
      });
    }
  }

  function drawStageBox(stage) {
    ctx.fillStyle = STAGE_FILL;
    ctx.strokeStyle = STAGE_STROKE;
    ctx.lineWidth = 0.5;
    const pad = 6;
    const x = stage.x + pad;
    const w = stage.width - pad * 2;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, stage.y, w, stage.height, 6) : ctx.rect(x, stage.y, w, stage.height);
    ctx.fill();
    ctx.stroke();
  }

  let stageLabelEls = [];

  function step() {
    ctx.clearRect(0, 0, width, height);

    // connecting line through stage centers
    ctx.beginPath();
    ctx.moveTo(stages[0].x + 6, bandTop + bandHeight / 2);
    ctx.lineTo(stages[stages.length - 1].x + stages[stages.length - 1].width - 6, bandTop + bandHeight / 2);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.stroke();

    stages.forEach(drawStageBox);

    blocks.forEach(b => {
      if (!reduceMotion) b.progress += b.speed;
      if (b.progress > 1.08) {
        b.progress = -0.08;
        b.lane = Math.random() * 0.6 + 0.2;
      }
      const totalX = stages[0].x + 6 + (b.progress) * (stages[stages.length - 1].x + stages[stages.length - 1].width - 6 - (stages[0].x + 6));
      const y = bandTop + bandHeight * b.lane;
      const inFinalStage = b.progress > (stages.length - 1) / stages.length;
      const color = inFinalStage ? BLOCK_DONE : BLOCK;

      if (inFinalStage) {
        const grad = ctx.createRadialGradient(totalX, y, 0, totalX, y, 9);
        grad.addColorStop(0, BLOCK_GLOW);
        grad.addColorStop(1, 'rgba(63, 182, 140, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(totalX, y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(totalX, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    rafId = requestAnimationFrame(step);
  }

  function createStageLabels() {
    let container = document.getElementById('pipeline-labels');
    if (!container) {
      container = document.createElement('div');
      container.id = 'pipeline-labels';
      container.className = 'pipeline-labels';
      canvas.parentElement.insertBefore(container, canvas.nextSibling);
    }
    container.innerHTML = '';
    stageLabelEls = stages.map(stage => {
      const el = document.createElement('span');
      el.className = 'pipeline-label';
      el.textContent = stage.label;
      container.appendChild(el);
      return el;
    });
  }

  function positionStageLabels() {
    stages.forEach((stage, i) => {
      const el = stageLabelEls[i];
      if (!el) return;
      el.style.left = (stage.x + stage.width / 2) + 'px';
      el.style.top = (stage.y - 14) + 'px';
    });
  }

  function init() {
    resize();
    buildStages();
    createStageLabels();
    positionStageLabels();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      stages.forEach(drawStageBox);
    }
  }

  let pipelineResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(pipelineResizeTimeout);
    pipelineResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// EXPERIENCE FIELD — a full-bleed sticky canvas behind the case-file column.
// A scattered field of small security glyphs (locks, shields, IPs,
// terminals, hooded operators) drifts slowly with gentle physics. The whole
// field parallaxes a little with the cursor. One node per scroll-active job
// is promoted to a brighter "hero" glyph that pulses while its case file is
// in view, then hands off to the next as the visitor scrolls — a radar
// sweep across the field rather than two shapes merging into one.
// No scroll-jacking: native scroll, just observed.
// ===========================================================================
(function () {
  const scroller = document.getElementById('exp-scroller');
  const stage     = document.querySelector('.exp-field-stage');
  const canvas    = document.getElementById('exp-canvas');
  if (!scroller || !stage || !canvas) return;

  const cases  = Array.from(scroller.querySelectorAll('.exp-case'));
  if (!cases.length) return;

  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLOR_STEEL = '91, 143, 176';
  const COLOR_GREEN = '63, 182, 140';
  const COLOR_TEXT  = '230, 232, 235';

  let width = 0, height = 0, dpr = 1;
  let mouseX = 0, mouseY = 0;        // normalized -1..1 relative to stage
  let targetMouseX = 0, targetMouseY = 0;
  let activeCase = cases[0];
  let rafId = null;
  let t = 0;
  let lastTime = performance.now();

  const ICON_TYPES = ['terminal', 'hacker', 'lock', 'ip', 'shield'];
  const MATRIX_CHARS = '01アイウエオカキクケコサシスセソ$#@&%';
  function randChar() { return MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]; }

  // -------------------------------------------------------------------
  // Field of nodes — ambient ones drift everywhere; hero nodes (one per
  // case) sit at semi-fixed "slots" and light up when their case is active.
  // Nodes avoid a horizontal exclusion band where the text column sits,
  // so glyphs never render directly behind readable copy.
  // -------------------------------------------------------------------
  let nodes = [];
  let exclX0 = 0, exclX1 = 0; // text column's left/right edge, in stage-local coords

  function computeExclusionZone() {
    const casesEl = scroller.querySelector('.exp-cases');
    if (!casesEl) { exclX0 = 0; exclX1 = 0; return; }
    const stageRect = stage.getBoundingClientRect();
    const casesRect = casesEl.getBoundingClientRect();
    exclX0 = Math.max(0, casesRect.left - stageRect.left - 24);
    exclX1 = Math.min(width, casesRect.right - stageRect.left + 24);
  }

  function pushOutsideExclusion(x, y) {
    // Soft clamp: if x has drifted into the text band, push it to the
    // nearest edge with a small fixed margin. Deterministic (no Math.random)
    // because this runs every frame for hero nodes — a random offset here
    // would make them visibly jitter/teleport each tick.
    const bandWidth = exclX1 - exclX0;
    if (bandWidth <= 0 || bandWidth > width * 0.86) return x;
    if (x > exclX0 && x < exclX1) {
      const distLeft = x - exclX0;
      const distRight = exclX1 - x;
      return distLeft < distRight ? exclX0 - 22 : exclX1 + 22;
    }
    return x;
  }

  // One-time variant (build-time only) that adds a small random spread so
  // hero/ambient starting slots aren't all pinned to the exact same margin.
  function pushOutsideExclusionSeeded(x, y) {
    const bandWidth = exclX1 - exclX0;
    if (bandWidth <= 0 || bandWidth > width * 0.86) return x;
    if (x > exclX0 && x < exclX1) {
      const distLeft = x - exclX0;
      const distRight = exclX1 - x;
      return distLeft < distRight ? exclX0 - 18 - Math.random() * 30 : exclX1 + 18 + Math.random() * 30;
    }
    return x;
  }

  function buildField() {
    nodes = [];
    computeExclusionZone();
    const narrowViewport = (exclX1 - exclX0) > width * 0.86;

    // Hero nodes: one per case. On wide viewports they live in the open
    // right-hand area; on narrow ones (where text fills the width) they
    // fall back to a slim top strip above the first card.
    const heroCount = cases.length;
    for (let i = 0; i < heroCount; i++) {
      let bx, by;
      if (narrowViewport) {
        bx = width * (0.12 + (i / Math.max(1, heroCount - 1)) * 0.76);
        by = height * 0.12 + (Math.random() - 0.5) * 14;
      } else {
        const col = i % 2;
        const row = Math.floor(i / 2);
        bx = pushOutsideExclusionSeeded(exclX1 + width * 0.08 + col * (width - exclX1) * 0.4, 0);
        by = height * (0.22 + row * 0.26) + (Math.random() - 0.5) * 30;
      }
      nodes.push({
        kind: 'hero',
        caseIndex: i,
        icon: cases[i].dataset.scene || ICON_TYPES[i % ICON_TYPES.length],
        baseX: bx,
        baseY: by,
        x: 0, y: 0,
        r: Math.min(width, height) * (narrowViewport ? 0.034 : 0.05),
        phase: Math.random() * Math.PI * 2,
        orbitRadius: (narrowViewport ? 10 : 26) + Math.random() * (narrowViewport ? 8 : 20),
        orbitSpeed: (0.00018 + Math.random() * 0.00014) * (Math.random() < 0.5 ? 1 : -1),
        orbitRatio: 0.55 + Math.random() * 0.5, // elliptical, not circular
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.0009 + Math.random() * 0.0006
      });
    }

    // Ambient nodes: smaller, plain dots/icons with no text, just texture.
    // Kept out of the exclusion band too (or heavily dimmed if narrow).
    const ambientCount = Math.max(8, Math.min(20, Math.floor((width * height) / 30000)));
    for (let i = 0; i < ambientCount; i++) {
      let bx = Math.random() * width;
      const by = Math.random() * height;
      if (!narrowViewport) bx = pushOutsideExclusionSeeded(bx, by);
      nodes.push({
        kind: 'ambient',
        icon: ICON_TYPES[Math.floor(Math.random() * ICON_TYPES.length)],
        baseX: bx,
        baseY: by,
        x: 0, y: 0,
        r: Math.min(width, height) * (0.012 + Math.random() * 0.012),
        phase: Math.random() * Math.PI * 2,
        orbitRadius: 14 + Math.random() * 26,
        orbitSpeed: (0.00022 + Math.random() * 0.00018) * (Math.random() < 0.5 ? 1 : -1),
        orbitRatio: 0.5 + Math.random() * 0.6,
        bobPhase: Math.random() * Math.PI * 2,
        bobSpeed: 0.0007 + Math.random() * 0.0008,
        alpha: narrowViewport ? 0.1 + Math.random() * 0.12 : 0.22 + Math.random() * 0.26
      });
    }

    for (const n of nodes) { n.x = n.baseX; n.y = n.baseY; }
  }

  // -------------------------------------------------------------------
  // Resize
  // -------------------------------------------------------------------
  function resize() {
    const rect = stage.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildField();
  }

  // -------------------------------------------------------------------
  // Pointer tracking — whole-field parallax, not per-node chasing
  // -------------------------------------------------------------------
  function onPointerMove(e) {
    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    targetMouseX = Math.max(-1, Math.min(1, (x - width / 2) / (width / 2)));
    targetMouseY = Math.max(-1, Math.min(1, (y - height / 2) / (height / 2)));
  }
  function onPointerLeave() { targetMouseX = 0; targetMouseY = 0; }
  stage.addEventListener('mousemove', onPointerMove);
  stage.addEventListener('mouseleave', onPointerLeave);
  stage.addEventListener('touchmove', (e) => {
    if (!e.touches || !e.touches.length) return;
    const touch = e.touches[0];
    onPointerMove({ clientX: touch.clientX, clientY: touch.clientY });
  }, { passive: true });

  // -------------------------------------------------------------------
  // Scroll velocity — feeds the "dance": the field speeds up and drifts
  // in the scroll direction while the visitor is actively scrolling, then
  // eases back down to its idle orbit speed once they stop. This is what
  // makes the nodes feel like they're responding to the page rather than
  // just looping in place.
  // -------------------------------------------------------------------
  let lastScrollY = window.scrollY;
  let scrollKick = 0;       // current intensity, eased toward target each frame
  let scrollKickTarget = 0;
  let scrollDir = 0;        // -1 up, 1 down, persists briefly after scroll stops
  let scrollIdleTimer = null;

  function onScroll() {
    const sy = window.scrollY;
    const delta = sy - lastScrollY;
    lastScrollY = sy;
    if (Math.abs(delta) > 0.5) {
      scrollDir = delta > 0 ? 1 : -1;
      scrollKickTarget = Math.min(1, Math.abs(delta) / 38);
      clearTimeout(scrollIdleTimer);
      scrollIdleTimer = setTimeout(() => { scrollKickTarget = 0; }, 140);
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // -------------------------------------------------------------------
  // Active case tracking
  // -------------------------------------------------------------------
  function setActive(caseEl) {
    if (caseEl === activeCase) return;
    activeCase = caseEl;
    cases.forEach(c => c.classList.toggle('is-active', c === caseEl));
  }

  const observer = new IntersectionObserver((entries) => {
    let best = null, bestDist = Infinity;
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const rect = entry.target.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - window.innerHeight / 2);
      if (dist < bestDist) { bestDist = dist; best = entry.target; }
    });
    if (best) setActive(best);
  }, { root: null, rootMargin: '-20% 0px -20% 0px', threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  cases.forEach(c => observer.observe(c));

  // -------------------------------------------------------------------
  // Icon renderers — local space centered on (0,0)
  // -------------------------------------------------------------------
  function roundRectPath(x, y, w, h, rad) {
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function drawTerminal(r, bright) {
    const w = r * 1.5, h = r * 1.1;
    ctx.fillStyle = '#0D1117';
    ctx.strokeStyle = `rgba(${COLOR_GREEN}, ${bright ? 0.6 : 0.35})`;
    ctx.lineWidth = 1.4;
    roundRectPath(-w / 2, -h / 2, w, h, r * 0.12);
    ctx.fill(); ctx.stroke();
    if (!bright) return;
    ctx.save();
    roundRectPath(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r * 0.08);
    ctx.clip();
    ctx.font = `${Math.max(7, r * 0.22)}px "JetBrains Mono", monospace`;
    ctx.textBaseline = 'top';
    const rowH = Math.max(7, r * 0.24);
    const rows = Math.floor(h / rowH);
    for (let row = 0; row < rows; row++) {
      const yy = -h / 2 + row * rowH + ((t * 0.04 + row * 13) % rowH) - rowH;
      const fade = 0.85 - row * 0.12;
      if (fade <= 0) continue;
      ctx.fillStyle = `rgba(${COLOR_GREEN}, ${Math.max(0, fade)})`;
      ctx.fillText(randChar() + randChar(), -w / 2 + 3, yy);
    }
    ctx.restore();
  }

  function drawHacker(r, bright) {
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = `rgba(255,255,255,${bright ? 0.12 : 0.06})`;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.55);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.5, -r * 0.42, r * 0.05);
    ctx.quadraticCurveTo(-r * 0.55, r * 0.35, -r * 0.62, r * 0.62);
    ctx.lineTo(r * 0.62, r * 0.62);
    ctx.quadraticCurveTo(r * 0.55, r * 0.35, r * 0.42, r * 0.05);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.5, 0, -r * 0.55);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#05070a';
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.26, r * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!bright) return;
    const glowPulse = 0.35 + Math.sin(t * 0.0022) * 0.18;
    ctx.fillStyle = `rgba(${COLOR_GREEN}, ${glowPulse})`;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 0.16, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawLock(r, bright) {
    const lift = bright ? Math.max(0, Math.sin(t * 0.0014)) * 2 : 0;
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, ${bright ? 0.85 : 0.4})`;
    ctx.lineWidth = r * 0.16;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -r * 0.18 - lift, r * 0.34, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = `rgba(255,255,255,${bright ? 0.1 : 0.05})`;
    ctx.lineWidth = 1;
    roundRectPath(-r * 0.46, -r * 0.1, r * 0.92, r * 0.62, r * 0.1);
    ctx.fill(); ctx.stroke();
    if (!bright) return;
    ctx.fillStyle = `rgba(${COLOR_GREEN}, 0.9)`;
    ctx.beginPath();
    ctx.arc(0, r * 0.16, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-r * 0.03, r * 0.16, r * 0.06, r * 0.16);
  }

  function drawIP(r, bright) {
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, ${bright ? 0.8 : 0.4})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    const spokes = 4;
    ctx.strokeStyle = `rgba(255,255,255,${bright ? 0.14 : 0.06})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < spokes; i++) {
      const ang = (Math.PI * 2 * i) / spokes + Math.PI / 4;
      const ex = Math.cos(ang) * r * 0.55;
      const ey = Math.sin(ang) * r * 0.55;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = '#161B22';
      ctx.beginPath(); ctx.arc(ex, ey, r * 0.07, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${bright ? 0.12 : 0.05})`;
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${bright ? 0.14 : 0.06})`;
    }
    if (!bright) return;
    ctx.font = `${r * 0.24}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(${COLOR_TEXT}, 0.55)`;
    ctx.fillText('10.0.4.18', 0, r * 0.82);
  }

  function drawShield(r, bright) {
    ctx.fillStyle = '#161B22';
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, ${bright ? 0.8 : 0.4})`;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.6);
    ctx.quadraticCurveTo(r * 0.5, -r * 0.42, r * 0.5, -r * 0.05);
    ctx.quadraticCurveTo(r * 0.5, r * 0.42, 0, r * 0.62);
    ctx.quadraticCurveTo(-r * 0.5, r * 0.42, -r * 0.5, -r * 0.05);
    ctx.quadraticCurveTo(-r * 0.5, -r * 0.42, 0, -r * 0.6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    if (!bright) return;
    const pulse = 0.7 + Math.sin(t * 0.003) * 0.3;
    ctx.strokeStyle = `rgba(${COLOR_GREEN}, ${pulse})`;
    ctx.lineWidth = r * 0.1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, 0);
    ctx.lineTo(-r * 0.05, r * 0.18);
    ctx.lineTo(r * 0.26, -r * 0.18);
    ctx.stroke();
  }

  const ICON_DRAW = { terminal: drawTerminal, hacker: drawHacker, lock: drawLock, ip: drawIP, shield: drawShield };

  // -------------------------------------------------------------------
  // Per-node composite: glow + base disc + icon
  // -------------------------------------------------------------------
  function drawNode(n, x, y, bright, glowAlpha) {
    const r = n.r;
    if (bright || n.kind === 'hero') {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.1);
      grad.addColorStop(0, `rgba(${COLOR_STEEL}, ${0.5 * glowAlpha})`);
      grad.addColorStop(0.55, `rgba(${COLOR_STEEL}, ${0.18 * glowAlpha})`);
      grad.addColorStop(1, `rgba(${COLOR_STEEL}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.globalAlpha = n.kind === 'ambient' ? n.alpha : 1;
    ctx.translate(x, y);

    ctx.fillStyle = `rgba(22, 27, 34, ${bright ? 0.92 : 0.7})`;
    ctx.strokeStyle = `rgba(${COLOR_STEEL}, ${(bright ? 0.55 : 0.25) * glowAlpha})`;
    ctx.lineWidth = bright ? 1.4 : 1;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();

    if (bright) {
      ctx.save();
      ctx.rotate((t * 0.00012) % (Math.PI * 2));
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const draw = ICON_DRAW[n.icon] || drawTerminal;
    draw(r * 0.78, bright);
    ctx.restore();
  }

  // -------------------------------------------------------------------
  // Physics step — each node traces a real elliptical orbit around its
  // anchor point. Orbit speed gets a temporary boost from scroll velocity
  // (the "dance"), plus a slow independent bob so even at rest nothing
  // sits perfectly still. No per-node cursor-chasing — only a shared
  // field-wide parallax offset is applied later in frame().
  // -------------------------------------------------------------------
  function stepNode(n, dt, kick) {
    const speedMul = 1 + kick * 3.2;
    n.phase += n.orbitSpeed * dt * speedMul;
    n.bobPhase += n.bobSpeed * dt * speedMul;

    const orbitX = Math.cos(n.phase) * n.orbitRadius;
    const orbitY = Math.sin(n.phase) * n.orbitRadius * n.orbitRatio;
    const bob = Math.sin(n.bobPhase) * (n.orbitRadius * 0.18);

    // scroll-direction drift: nodes lean the way the page is moving,
    // strongest right when scrollKick is high, fading out with it
    const scrollLean = scrollDir * kick * 16;

    n.x = n.baseX + orbitX;
    n.y = n.baseY + orbitY + bob + scrollLean;
  }

  function frame(dt) {
    t += dt;
    const ease = reduceMotion ? 1 : 0.05;
    mouseX += (targetMouseX - mouseX) * ease;
    mouseY += (targetMouseY - mouseY) * ease;
    scrollKick += (scrollKickTarget - scrollKick) * (reduceMotion ? 1 : 0.08);

    ctx.clearRect(0, 0, width, height);

    const parallax = 22;
    const activeIdx = cases.indexOf(activeCase);

    for (const n of nodes) {
      if (!reduceMotion) stepNode(n, dt, scrollKick);
      const px = mouseX * parallax * (n.kind === 'hero' ? 0.6 : 1);
      const py = mouseY * parallax * (n.kind === 'hero' ? 0.6 : 1);
      let drawX = n.x + px;
      let drawY = n.y + py;

      // Hero nodes get a live exclusion check since their orbit can swing
      // wide enough to approach the text column — ambient nodes are small
      // and numerous enough that this isn't worth the per-frame cost.
      if (n.kind === 'hero') {
        drawX = pushOutsideExclusion(drawX, drawY);
      }

      if (n.kind === 'hero') {
        const isActive = n.caseIndex === activeIdx;
        const pulse = isActive ? 0.85 + Math.sin(t * 0.0026) * 0.15 : 1;
        drawNode(n, drawX, drawY, isActive, isActive ? pulse : 0.3);
      } else {
        drawNode(n, drawX, drawY, false, 1);
      }
    }

    if (!reduceMotion) rafId = requestAnimationFrame(step);
  }

  function step(now) {
    const dt = Math.min(48, now - lastTime);
    lastTime = now;
    frame(dt);
  }

  function init() {
    resize();
    lastTime = performance.now();
    if (reduceMotion) {
      frame(16);
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(step);
    }
  }

  let expResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(expResizeTimeout);
    expResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// PING ANIMATION — expanding rings from the contact heading, like a network
// ping or completed handshake. Quiet closing beat, no text needed.
// ===========================================================================
(function () {
  const canvas = document.getElementById('ping-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let pings = [];
  let rafId = null;
  let spawnTimer = 0;
  let centerY = 0;

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sectionEl = canvas.parentElement;
    const heading = sectionEl.querySelector('h2');
    if (heading) {
      const sectionTop = sectionEl.getBoundingClientRect().top;
      const hRect = heading.getBoundingClientRect();
      centerY = (hRect.top + hRect.bottom) / 2 - sectionTop;
    } else {
      centerY = height * 0.25;
    }
  }

  function spawnPing() {
    pings.push({ r: 4, opacity: 0.55 });
  }

  function step() {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;

    if (!reduceMotion) {
      spawnTimer++;
      if (spawnTimer > 130) {
        spawnTimer = 0;
        spawnPing();
      }
    }

    pings.forEach(p => {
      if (!reduceMotion) {
        p.r += 0.9;
        p.opacity *= 0.985;
      }
      ctx.beginPath();
      ctx.arc(cx, centerY, p.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(91, 143, 176, ${p.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    pings = pings.filter(p => p.opacity > 0.02 && p.r < Math.max(width, height));

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    pings = [{ r: 4, opacity: 0.55 }];
    spawnTimer = 0;
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  }

  let pingResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(pingResizeTimeout);
    pingResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// WAVEFORM ANIMATION — thin animated signal line in the gap between the
// "About" heading and the photo/video + bio grid. Suggests "signal" /
// monitoring without competing with the placeholders or dense bio text.
// ===========================================================================
(function () {
  const canvas = document.getElementById('waveform-canvas');
  if (!canvas) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let rafId = null;
  let phase = 0;
  let bandTop = 0, bandHeight = 40;

  const LINE = 'rgba(91, 143, 176, 0.45)';
  const LINE_DIM = 'rgba(91, 143, 176, 0.18)';

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function measureBand() {
    const sectionEl = canvas.parentElement;
    const headEl = sectionEl.querySelector('.section-head');
    const gridEl = sectionEl.querySelector('.about-grid');
    const sectionTop = sectionEl.getBoundingClientRect().top;
    const headBottom = headEl ? headEl.getBoundingClientRect().bottom - sectionTop : 80;
    const gridTop = gridEl ? gridEl.getBoundingClientRect().top - sectionTop : 140;
    const margin = 10;
    bandTop = headBottom + margin;
    bandHeight = Math.max(16, gridTop - bandTop - margin);
  }

  function drawWave(yOffset, amplitude, color, lineWidth, freq, phaseShift) {
    const midY = bandTop + bandHeight / 2 + yOffset;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 4) {
      const y = midY + Math.sin((x * freq) + phase + phaseShift) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    const amp = Math.min(bandHeight * 0.32, 10);
    drawWave(0, amp, LINE_DIM, 1, 0.012, 0);
    drawWave(0, amp * 0.7, LINE, 1.2, 0.012, Math.PI / 3);

    if (!reduceMotion) phase += 0.025;

    rafId = requestAnimationFrame(step);
  }

  function init() {
    resize();
    measureBand();
    if (rafId) cancelAnimationFrame(rafId);
    if (!reduceMotion) {
      step();
    } else {
      ctx.clearRect(0, 0, width, height);
      const amp = Math.min(bandHeight * 0.32, 10);
      drawWave(0, amp, LINE_DIM, 1, 0.012, 0);
    }
  }

  let waveformResizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(waveformResizeTimeout);
    waveformResizeTimeout = setTimeout(init, 200);
  });

  init();
})();

// ===========================================================================
// NAV SCROLL-SPY — highlights whichever section is currently in view.
// Uses IntersectionObserver rather than a manual scroll-position calculation:
// cheaper, and naturally handles sections of very different heights (About
// is short, Experience is tall) without any per-section tuning.
// ===========================================================================
(function () {
  const navLinks = document.querySelectorAll('.nav-links a[data-nav-target]');
  if (navLinks.length === 0) return;

  const linkByTarget = {};
  navLinks.forEach((link) => { linkByTarget[link.dataset.navTarget] = link; });

  const sections = Array.from(navLinks)
    .map((link) => document.getElementById(link.dataset.navTarget))
    .filter(Boolean);

  function setActive(targetId) {
    navLinks.forEach((link) => link.classList.remove('nav-active'));
    if (targetId && linkByTarget[targetId]) {
      linkByTarget[targetId].classList.add('nav-active');
    }
  }

  // A section counts as "current" once its top has crossed roughly the
  // upper third of the viewport — feels right for sections of any height,
  // rather than requiring the whole section to be on screen at once.
  const observer = new IntersectionObserver(
    (entries) => {
      // Among all currently-intersecting sections, the one with the
      // smallest distance from the trigger line is "most current" — this
      // matters when a short section (About) and the next one are both
      // partially visible at once.
      const visible = entries.filter((e) => e.isIntersecting);
      if (visible.length === 0) return;
      visible.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
      setActive(visible[0].target.id);
    },
    { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
  );

  sections.forEach((section) => observer.observe(section));
})();
