// Resume Builder — private, job-description-tailored resume generator.
// Pulls from the real, fact-checked CV content (ALL_CV_CONTENT, loaded
// from cv-content-data.js) — the AI reframes and selects from real bullets,
// it does not invent new ones. Output assembled into a real .docx
// client-side via the docx library, downloaded via FileSaver.js.

const REAL_FACTS = {
  name: "Jacob Calleon",
  email: "jcalleon@outlook.com",
  phone: "(707) 800-8135",
  linkedin: "linkedin.com/in/reycubcalleon",
  github: "github.com/jcalleon",
  education: [
    {
      degree: "Doctor of Technology (in progress)",
      detail: "Major: Technology, Purdue University, GPA 4.0/4.0, Spring 2024 - present, currently working on doctoral dissertation",
    },
    {
      degree: "M.S. Cybersecurity Management",
      detail: "Concentration: Infrastructure & Systems Security, Purdue University Global, GPA 3.82/4.0, Aug 2022 - Apr 2023 (8 months)",
    },
    {
      degree: "B.S. Cybersecurity",
      detail: "Purdue University Global, GPA 3.84/4.0, Jul 2021 - Jul 2022, Dean's List multiple terms, Chancellor's List",
    },
  ],
  certifications: [
    "CISSP (Active) — ISC², Certification #1002311, Aug 2025 - Jul 2028",
    "Qualys Certified Specialist",
    "CompTIA Network+ (Expired)",
    "PMP (in progress)",
    "CISM (in progress)",
  ],
};

let currentResumeData = null;

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : str;
  return div.innerHTML;
}

async function generateResume() {
  const jdInput = document.getElementById("jd-input");
  const generateBtn = document.getElementById("generate-btn");
  const regenerateBtn = document.getElementById("regenerate-btn");
  const errorEl = document.getElementById("rb-error");
  const outputPanel = document.getElementById("rb-output-panel");

  const jobDescription = jdInput.value.trim();
  errorEl.innerHTML = "";

  if (!jobDescription) {
    errorEl.innerHTML = `<div class="copilot-error">Paste a job description first.</div>`;
    return;
  }
  if (jobDescription.length < 50) {
    errorEl.innerHTML = `<div class="copilot-error">That looks too short to be a real job description — paste the full posting for a meaningful match.</div>`;
    return;
  }

  const activeBtn = document.activeElement === regenerateBtn ? regenerateBtn : generateBtn;
  const originalLabel = activeBtn.textContent;
  activeBtn.disabled = true;
  activeBtn.textContent = "Generating...";

  const system = `You are helping build a real resume for a real job application — this person will actually submit what you produce, so accuracy matters more than creativity. You will be given (1) a job description and (2) a complete bank of this person's real, fact-checked career history across 6 different framings (Cybersecurity, Network Engineering, Infrastructure & Systems, Help Desk & Support, Project Management, Cloud & Automation). Every bullet in that bank is something they actually did — you are SELECTING and REWORDING from it to match the job description's language and priorities, never inventing a new achievement, number, or responsibility that doesn't appear in the source material.

Read the job description carefully. Identify its real priorities — required skills, the seniority level implied, the specific technologies named. Then build a tailored resume:

- Pick the 1-2 most relevant CV framings as your primary lens, but you may pull a strong, specific bullet from a different framing if it's a better match for something the JD asks for.
- For each of the 5 real jobs (RRMS, Self-Employed, The Smart Circle, InSync, Apple/Keeco/SilverVentures/Apogee), select 3-5 of the existing real bullets that best match the JD, lightly reworded for flow and to mirror the JD's own terminology where that's honestly accurate — never changing a number, a tool name, or what actually happened.
- Write a 3-4 sentence professional summary at the top that directly speaks to this specific job's stated requirements, grounded in the real career history.
- Select which of the 5 real certifications and 2 real degrees are worth including (usually all of them, but use judgment if the JD is clearly unrelated to one).
- List 8-12 relevant technical skills/keywords pulled from the matched bullets — this matters for ATS keyword matching, so mirror the JD's exact terminology where the person's real experience genuinely supports it.

Respond with ONLY valid JSON, no markdown formatting, no code fences, no preamble. Exact shape:
{
  "summary": "string",
  "jobs": [
    { "company": "string (exact real company name)", "title": "string (a real or lightly-reframed-but-defensible title)", "dateRange": "string (exact real dates)", "bullets": ["string", ...] },
    ...all 5 jobs, most recent first...
  ],
  "skills": ["string", ...],
  "certifications": ["string", ...],
  "education": ["string", ...]
}`;

  const prompt = `JOB DESCRIPTION:
${jobDescription}

---

REAL CAREER HISTORY (select and reword from this — do not invent):
${ALL_CV_CONTENT}

---

REAL CONTACT/EDUCATION/CERTIFICATION FACTS (use exactly as given, do not alter):
${JSON.stringify(REAL_FACTS, null, 2)}`;

  // The default Worker-wide limit (400 tokens) is sized for short
  // SOC/Directory analyses — nowhere near enough for a full 5-job
  // structured resume as JSON, which realistically needs ~1,100 tokens at
  // worst case. Requesting 2000 leaves real margin without approaching
  // the Worker's hard per-request ceiling.
  const res = await callAI({ app: "resumebuilder", system, prompt, maxTokens: 2000 });

  activeBtn.disabled = false;
  activeBtn.textContent = originalLabel;

  if (!res.ok) {
    errorEl.innerHTML = `<div class="copilot-error">${escapeHtml(res.message || "Demo limit reached — try again later.")}</div>`;
    return;
  }

  const parsed = parseResumeJson(res.text);
  if (!parsed) {
    errorEl.innerHTML = `<div class="copilot-error">Couldn't parse the generated resume. Try regenerating.</div>`;
    return;
  }

  currentResumeData = parsed;
  outputPanel.style.display = "block";
  renderEditablePreview(parsed);
  outputPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// The system prompt fixes a strict JSON-only response, but models
// occasionally wrap output in code fences anyway — strip those defensively
// before parsing rather than fail on an otherwise-valid response.
function parseResumeJson(text) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  try {
    const data = JSON.parse(cleaned);
    if (!data.summary || !Array.isArray(data.jobs)) {
      console.error("Parsed JSON but missing required fields. Parsed object:", data);
      return null;
    }
    return data;
  } catch (err) {
    // Swallowing this silently is exactly how a real parsing bug becomes
    // undebuggable — log both the actual error and the raw text so a
    // failure can be diagnosed from the browser console instead of just
    // re-tried blindly.
    console.error("Resume JSON parse failed:", err.message);
    console.error("Raw response text was:", text);
    return null;
  }
}

// ---- Editable on-screen preview ----
// Built as real, editable DOM fields (not just a read-only render) so the
// person can correct a job title's wording or trim a bullet before
// download, per the "editable preview" requirement — nothing is saved
// anywhere until the actual download happens.

function renderEditablePreview(data) {
  const container = document.getElementById("resume-editor");

  container.innerHTML = `
    <div class="rb-field-group">
      <label class="rb-field-label">Professional summary</label>
      <textarea class="form-textarea rb-summary-input" id="edit-summary">${escapeHtml(data.summary)}</textarea>
    </div>

    <div class="rb-field-group">
      <label class="rb-field-label">Skills (comma-separated)</label>
      <input class="form-input" id="edit-skills" value="${escapeHtml(data.skills.join(", "))}" />
    </div>

    ${data.jobs
      .map(
        (job, jobIdx) => `
      <div class="rb-job-block" data-job-idx="${jobIdx}">
        <div class="rb-job-header">
          <input class="form-input rb-job-title-input" data-field="title" value="${escapeHtml(job.title)}" />
          <span class="rb-job-meta">${escapeHtml(job.company)} · ${escapeHtml(job.dateRange)}</span>
        </div>
        <div class="rb-bullets" data-job-idx="${jobIdx}">
          ${job.bullets
            .map(
              (b, bulletIdx) => `
            <div class="rb-bullet-row">
              <textarea class="form-textarea rb-bullet-input" data-job-idx="${jobIdx}" data-bullet-idx="${bulletIdx}">${escapeHtml(b)}</textarea>
              <button class="rb-bullet-remove" data-job-idx="${jobIdx}" data-bullet-idx="${bulletIdx}" title="Remove this bullet">✕</button>
            </div>`
            )
            .join("")}
        </div>
        <button class="btn-secondary rb-add-bullet" data-job-idx="${jobIdx}" style="margin-top:6px; padding:4px 10px; font-size:11px;">+ Add bullet</button>
      </div>`
      )
      .join("")}

    <div class="rb-field-group">
      <label class="rb-field-label">Certifications (comma-separated)</label>
      <input class="form-input" id="edit-certs" value="${escapeHtml(data.certifications.join(", "))}" />
    </div>
    <div class="rb-field-group">
      <label class="rb-field-label">Education (one per line)</label>
      <textarea class="form-textarea" id="edit-education" style="min-height:60px;">${escapeHtml(data.education.join("\n"))}</textarea>
    </div>
  `;

  attachEditorHandlers();
}

function attachEditorHandlers() {
  document.querySelectorAll(".rb-bullet-remove").forEach((btn) => {
    btn.addEventListener("click", () => {
      const jobIdx = parseInt(btn.dataset.jobIdx, 10);
      const bulletIdx = parseInt(btn.dataset.bulletIdx, 10);
      currentResumeData.jobs[jobIdx].bullets.splice(bulletIdx, 1);
      renderEditablePreview(currentResumeData); // re-sync edited text fields into the data model, then re-render with the bullet removed
    });
  });

  document.querySelectorAll(".rb-add-bullet").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncEditedFieldsIntoData();
      const jobIdx = parseInt(btn.dataset.jobIdx, 10);
      currentResumeData.jobs[jobIdx].bullets.push("");
      renderEditablePreview(currentResumeData);
    });
  });
}

// Reads every editable field currently on screen back into
// currentResumeData, so an edit isn't lost when something else
// (add/remove bullet) triggers a re-render.
function syncEditedFieldsIntoData() {
  if (!currentResumeData) return;

  const summaryEl = document.getElementById("edit-summary");
  if (summaryEl) currentResumeData.summary = summaryEl.value;

  const skillsEl = document.getElementById("edit-skills");
  if (skillsEl) currentResumeData.skills = skillsEl.value.split(",").map((s) => s.trim()).filter(Boolean);

  const certsEl = document.getElementById("edit-certs");
  if (certsEl) currentResumeData.certifications = certsEl.value.split(",").map((s) => s.trim()).filter(Boolean);

  const eduEl = document.getElementById("edit-education");
  if (eduEl) currentResumeData.education = eduEl.value.split("\n").map((s) => s.trim()).filter(Boolean);

  document.querySelectorAll(".rb-job-block").forEach((block) => {
    const jobIdx = parseInt(block.dataset.jobIdx, 10);
    const titleInput = block.querySelector(".rb-job-title-input");
    if (titleInput) currentResumeData.jobs[jobIdx].title = titleInput.value;

    block.querySelectorAll(".rb-bullet-input").forEach((textarea) => {
      const bulletIdx = parseInt(textarea.dataset.bulletIdx, 10);
      currentResumeData.jobs[jobIdx].bullets[bulletIdx] = textarea.value;
    });
  });
}

// ---- .docx generation ----
// Uses the docx library (loaded globally as `docx` via the UMD build) to
// assemble a real, ATS-friendly Word document: standard section headers,
// no tables/columns/text-boxes that confuse parsers, plain bullet lists.

function buildResumeDocx(data) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat } = docx;

  const children = [];

  // Header: name + contact line. Plain paragraphs, not a table — tables
  // are a common ATS-parsing failure point per the docx skill's own
  // guidance, and contact info inside one is a frequent real-world cause
  // of a resume silently failing to parse.
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: REAL_FACTS.name, bold: true, size: 32 })],
      spacing: { after: 80 },
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${REAL_FACTS.email} | ${REAL_FACTS.phone} | ${REAL_FACTS.linkedin} | ${REAL_FACTS.github}`,
          size: 20,
        }),
      ],
      spacing: { after: 240 },
    })
  );

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Professional Summary")],
    })
  );
  children.push(new Paragraph({ children: [new TextRun(data.summary)], spacing: { after: 200 } }));

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Experience")],
    })
  );

  for (const job of data.jobs) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: job.title, bold: true, size: 24 })],
        spacing: { before: 160, after: 20 },
      })
    );
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `${job.company} — ${job.dateRange}`, italics: true, size: 22 })],
        spacing: { after: 80 },
      })
    );
    for (const bullet of job.bullets) {
      if (!bullet.trim()) continue;
      children.push(
        new Paragraph({
          numbering: { reference: "resume-bullets", level: 0 },
          children: [new TextRun(bullet)],
          spacing: { after: 40 },
        })
      );
    }
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Skills")],
      spacing: { before: 200 },
    })
  );
  children.push(new Paragraph({ children: [new TextRun(data.skills.join(" · "))], spacing: { after: 200 } }));

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Certifications")],
    })
  );
  for (const cert of data.certifications) {
    children.push(
      new Paragraph({ numbering: { reference: "resume-bullets", level: 0 }, children: [new TextRun(cert)] })
    );
  }

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun("Education")],
      spacing: { before: 200 },
    })
  );
  for (const edu of data.education) {
    children.push(
      new Paragraph({ numbering: { reference: "resume-bullets", level: 0 }, children: [new TextRun(edu)] })
    );
  }

  const document = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: "1F3864" },
          paragraph: { spacing: { before: 240, after: 80 }, outlineLevel: 0 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "resume-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 180 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, right: 1080, bottom: 720, left: 1080 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}

async function downloadResume() {
  if (!currentResumeData) return;
  syncEditedFieldsIntoData();

  const downloadBtn = document.getElementById("download-btn");
  downloadBtn.disabled = true;
  downloadBtn.textContent = "Building .docx...";

  try {
    const blob = await buildResumeDocx(currentResumeData);
    const filenameSafe = "Jacob_Calleon_Resume.docx";
    saveAs(blob, filenameSafe);
  } catch (err) {
    document.getElementById("rb-error").innerHTML = `<div class="copilot-error">Couldn't build the document: ${escapeHtml(err.message || String(err))}</div>`;
  } finally {
    downloadBtn.disabled = false;
    downloadBtn.textContent = "Download .docx";
  }
}

// ---- Init ----
// Buttons start disabled and only enable once the superadmin check
// completes — closes the brief window where any valid session (not just
// the superadmin's) could otherwise trigger a generation before the page
// finishes checking and blanking itself for unauthorized users.
document.getElementById("generate-btn").disabled = true;
document.getElementById("regenerate-btn").disabled = true;

document.getElementById("generate-btn").addEventListener("click", generateResume);
document.getElementById("regenerate-btn").addEventListener("click", generateResume);
document.getElementById("download-btn").addEventListener("click", downloadResume);

(async () => {
  const user = await requireValidSessionOrRedirect();
  if (!user) return;
  if (!user.is_superadmin) {
    document.body.innerHTML = `<div style="padding:48px; text-align:center; color:var(--text-dim);">This tool is private.</div>`;
    return;
  }
  document.getElementById("generate-btn").disabled = false;
  document.getElementById("regenerate-btn").disabled = false;

  const topbarUser = document.getElementById("topbar-user");
  topbarUser.innerHTML = `<span class="topbar-user-email">${escapeHtml(user.email)}</span><button class="topbar-logout-btn" id="logout-btn">Log out</button>`;
  document.getElementById("logout-btn").onclick = doLogout;
})();
