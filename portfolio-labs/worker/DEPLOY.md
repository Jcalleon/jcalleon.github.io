# Deploying the labs

Two parts: (1) the Cloudflare Worker (your AI proxy), (2) the three static apps on GitHub Pages.
Total cost: $0. Do part 1 first — the apps won't work without it.

---

## Part 1 — Deploy the Cloudflare Worker

You'll need: the free Cloudflare account you already created, Node.js installed locally, and
your Anthropic API key (from console.anthropic.com).

### 1. Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
```

### 2. Log in

```bash
wrangler login
```

This opens a browser tab — authorize it against your Cloudflare account.

### 3. Create the KV namespace (used for rate-limit counters)

```bash
cd worker
wrangler kv namespace create RATE_LIMIT_KV
```

This prints something like:

```
{ binding = "RATE_LIMIT_KV", id = "abcd1234..." }
```

Copy that `id` value and paste it into `worker/wrangler.toml`, replacing
`REPLACE_WITH_YOUR_KV_NAMESPACE_ID`.

### 4. Add your Anthropic API key as a secret

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste your key when prompted. This stores it encrypted in Cloudflare — it never goes in your
code or git history.

### 5. Deploy

```bash
wrangler deploy
```

This prints your live Worker URL, something like:

```
https://portfolio-ai-proxy.your-subdomain.workers.dev
```

**Copy this URL** — you need it for Part 2.

### 6. Sanity-check it

```bash
curl -X POST https://portfolio-ai-proxy.your-subdomain.workers.dev \
  -H "Content-Type: application/json" \
  -H "Origin: https://jcalleon.github.io" \
  -d '{"app":"test","system":"Reply with one word.","prompt":"Say hello."}'
```

You should get back `{"text":"Hello"}` or similar. If you get a 403, double check the `Origin`
header matches what's in `ALLOWED_ORIGINS` in `worker.js`.

---

## Part 2 — Wire up the three apps

### 1. Set the Worker URL

Open `shared/ai-client.js` and replace:

```js
const WORKER_URL = "https://portfolio-ai-proxy.YOUR-SUBDOMAIN.workers.dev";
```

with the real URL from step 5 above. This one file is shared by all three apps — only one
place to edit.

### 2. Test locally before deploying

From the `portfolio-labs` folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Click into each app, open a record, and
click the AI trigger button — confirm you get a real response from Claude.

(`http://localhost:8000` is already in the Worker's `ALLOWED_ORIGINS` list for this reason —
you can test without deploying anything first.)

### 3. Push to GitHub Pages

If `jcalleon.github.io` is already your Pages repo, copy this whole `portfolio-labs` folder
into it as a subfolder, e.g. `lab-apps/`, then commit and push:

```bash
cp -r portfolio-labs /path/to/jcalleon.github.io/lab-apps
cd /path/to/jcalleon.github.io
git add lab-apps
git commit -m "Add SOC/ITSM/CRM AI lab apps"
git push
```

Your apps will be live at:
- `https://jcalleon.github.io/lab-apps/` (landing page)
- `https://jcalleon.github.io/lab-apps/soc-dashboard/`
- `https://jcalleon.github.io/lab-apps/itsm-helpdesk/`
- `https://jcalleon.github.io/lab-apps/crm/`

### 4. Update the main site's Lab & Projects section

Replace the two "add project" placeholder cards with links to `lab-apps/` (see
`PORTFOLIO_SNIPPET.md` for ready-to-paste HTML).

---

## Tuning the rate limits

In `worker/worker.js`:

```js
const GLOBAL_DAILY_CAP = 300;      // total AI calls/day, all apps, all visitors
const PER_VISITOR_DAILY_CAP = 15;  // AI calls/day per visitor IP
```

300 calls/day on Claude Sonnet with short prompts and a 400-token cap costs a small fraction
of a cent each — realistically under $1–2/month even at the cap, but it's a hard ceiling either
way. Lower these further if you want extra peace of mind; redeploy with `wrangler deploy` after
any change to `worker.js`.

## If something breaks

- **"Origin not allowed" / 403**: the app's URL doesn't match `ALLOWED_ORIGINS` in `worker.js`.
  Add it and redeploy.
- **CORS error in browser console**: same cause as above — check the exact origin (including
  `https://` vs `http://`).
- **"demo_limit_reached" immediately**: check Cloudflare dashboard → Workers → your Worker →
  KV bindings, confirm the namespace ID in `wrangler.toml` matches what you created.
- **AI button does nothing**: open browser dev tools → Network tab → check the request to your
  Worker URL for the actual error message.
