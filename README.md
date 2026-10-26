# FormCraft

A premium, production-ready alternative to Google Forms — built with plain HTML, Tailwind CSS and vanilla JavaScript on the frontend, and Google Apps Script + Sheets + Drive on the backend. No build step, no framework, no server to host: it runs entirely on GitHub Pages and Google's free infrastructure.

![status](https://img.shields.io/badge/status-production--ready-0F766E) ![license](https://img.shields.io/badge/license-MIT-14B8A6)

---

## ✨ Features

**Design**
- Glassmorphism cards, ambient gradients, dark & light mode (persisted + system-aware)
- Custom "passport / ticket" motif: ink-fill circular step progress, perforated dividers, stamp micro-interaction on completed steps
- Fraunces (display) + Inter (body) + JetBrains Mono (data) type system
- Smooth step transitions, success checkmark draw-in, shake-on-error, skeleton loaders
- Fully responsive, mobile-first, keyboard accessible (ARIA roles, visible focus states, `prefers-reduced-motion` respected)

**21 field types**
Short text, long text, number, email, phone, date, time, dropdown, radio, checkbox, multi-select, password, URL, color picker, range slider, star rating, toggle switch, signature pad, image upload, PDF upload, multi-file upload.

**Form engine**
- Multi-step form with animated progress
- Conditional logic (show/hide fields based on other answers)
- Live + on-submit validation with custom error messages
- Character counters, phone input mask, honeypot spam field
- Auto-saved drafts (localStorage) with a "restore draft" banner
- Success screen + standalone confirmation page + reset-with-confirmation

**Backend (Google Apps Script)**
- Every submission is written to Google Sheets with dynamic columns (base columns + every custom field, auto-created on first use)
- Topic links are recorded with submissions, so topic counts and filters use exact attribution
- Files & signatures uploaded to Google Drive; shareable view links written back into the Sheet
- Honeypot + optional server-side rate limiting when a trusted caller IP is available (`CacheService`)
- Input sanitization against stored XSS
- Admin token authentication for all read/write admin actions

**Admin dashboard**
- Total / today / this-week / pending-review stat cards
- Full-text search across all fields
- Filter submissions by topic and review status; older submissions without topic metadata appear as unassigned
- Import FormCraft CSV exports (up to 500 rows; existing submission IDs are skipped) and export to CSV / Excel (`.xls`)
- Print a report containing only the filtered submission information
- Per-row detail modal, mark-as-reviewed, delete

---

## 📁 Project structure

```
/
├── index.html              # Main multi-step form
├── success.html             # Standalone confirmation page
├── admin.html                # Admin dashboard (token-gated)
├── css/
│   └── style.css             # Design tokens, glassmorphism, animations
├── js/
│   ├── utils.js               # Sanitization, validators, toast, helpers
│   ├── theme.js                # Dark/light mode controller
│   ├── schema.js                # ⚙️ Declarative form field configuration
│   ├── fields.js                 # Field renderer + widget behavior
│   ├── form.js                    # Multi-step engine, validation, submit logic
│   └── admin.js                    # Admin dashboard logic
├── assets/
│   └── logo.svg
├── icons/                    # Custom icon drop-in folder (optional)
├── images/                   # Screenshots for this README
├── apps-script/
│   ├── Code.gs                # Router (doGet/doPost), Sheet I/O, admin API
│   ├── upload.gs               # Drive file/signature upload handling
│   └── validation.gs            # Sanitization, honeypot, rate limit, auth
└── README.md
```

---

## 🖼️ Screenshots

> Replace these with real captures — see `images/README.md`.

| Light mode | Dark mode |
|---|---|
| `images/form-light.png` | `images/form-dark.png` |

| Admin dashboard | Success screen |
|---|---|
| `images/admin-dashboard.png` | `images/success-screen.png` |

---

## 🚀 Setup guide

### 1. Google Sheets setup
1. Create a new [Google Sheet](https://sheets.google.com) — this will store submissions.
2. Note its name isn't important; the backend auto-creates a `Submissions` tab with headers on first run.
3. Keep this sheet open in a tab — you'll attach the script to it next.

### 2. Google Apps Script deployment
1. In your Sheet, open **Extensions → Apps Script**.
2. Delete the default `Code.gs` boilerplate. Create three files matching this repo's `apps-script/` folder — `Code.gs`, `upload.gs`, `validation.gs` — and paste in the matching contents.
3. Go to **Project Settings → Script Properties** and add:
   | Property | Value |
   |---|---|
   | `ADMIN_TOKEN` | any long random string, e.g. `f8b2-your-secret-token` |
   | `DRIVE_FOLDER_ID` | *(optional)* a Drive folder ID to store uploads in; if omitted, a "FormCraft Uploads" folder is created automatically |
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, authorize the requested permissions, and copy the **Web app URL** (ends in `/exec`).

### 3. Google Drive setup
No manual setup required — the script creates/reuses a folder automatically. If you'd rather control the destination, create a folder in Drive, open it, copy the ID from the URL (`.../folders/<THIS_PART>`), and set it as `DRIVE_FOLDER_ID` above.

### 4. Connect the frontend to your backend
Open `js/schema.js` and set:
```js
endpoint: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
```
Both `index.html` (submissions) and `admin.html` (dashboard) read this same value.

### 5. GitHub Pages deployment
1. Push this project to a GitHub repository.
2. Go to **Settings → Pages**.
3. Source: **Deploy from a branch** → select `main` (or your default branch) and `/ (root)`.
4. Save. Your form will be live at `https://<username>.github.io/<repo>/`.
5. Visit `/admin.html` on the same domain to access the dashboard (enter your `ADMIN_TOKEN`).

That's it — no build step, no npm install, no server.

The backend adds a `Topic` column to an existing submissions sheet the next time a form is submitted. Submissions created before topic attribution was added remain unassigned; new topic links record their exact topic slug.

---

## 🔐 Admin access

Navigate to `admin.html` and enter the `ADMIN_TOKEN` value you set in Script Properties. The token is kept only in `sessionStorage` (cleared when the tab closes) and is sent with every admin API call for verification server-side.

---

## 🛠 Customizing the form

All fields live in `js/schema.js` as a plain JS object — no engine code needs to change:

```js
{ id: 'company', type: 'text', label: 'Company name', required: true, maxLength: 100 }
```

Supported `type` values: `text`, `textarea`, `email`, `phone`, `url`, `password`, `number`, `date`, `time`, `dropdown`, `radio`, `checkbox`, `multiselect`, `color`, `range`, `rating`, `toggle`, `image`, `pdf`, `files`, `signature`.

**Conditional logic** — show a field only when another field matches a condition:
```js
{ id: 'team_size', type: 'number', label: 'Team size', required: true,
  conditional: { field: 'plan', operator: 'equals', value: 'Team engagement' } }
```
Supported operators: `equals`, `notEquals`, `includes` (for arrays), `exists`.

---

## 🐛 Troubleshooting

**"Invalid admin token" in the dashboard**
Confirm `ADMIN_TOKEN` in Script Properties exactly matches what you type in — it's case-sensitive, and there's no default value (the backend refuses admin requests if it's unset).

**Submissions aren't appearing in the Sheet**
- Confirm `endpoint` in `js/schema.js` points to your `/exec` URL, not `/dev`.
- Re-deploy after any `.gs` code change: **Deploy → Manage deployments → ✏️ → New version**. Apps Script does not hot-reload existing deployments.
- Open the Apps Script **Executions** log (left sidebar) to see the actual server-side error.

**CORS / fetch errors in the browser console**
The frontend posts with `Content-Type: text/plain` specifically to avoid a CORS preflight request, which Apps Script web apps don't handle. Don't change this header when customizing `form.js`/`admin.js`.

**File uploads fail or return empty URLs**
Apps Script has a ~50MB total payload limit per request and Drive quota depends on your Google account. Reduce `maxSizeMB` in `js/schema.js` if you hit limits, and check the Executions log for the specific error.

**Rate limit false positives**
The demo limit is 5 submissions per 10 minutes when a caller IP is available (`validation.gs → RATE_LIMIT_MAX/WINDOW`). Apps Script's `doPost` doesn't receive the caller's IP directly from a browser `fetch`, so direct browser submissions cannot be reliably limited per IP. For that, front the endpoint with a trusted proxy such as Cloudflare Workers.

**Dark mode doesn't persist**
Check that `localStorage` isn't blocked (private/incognito windows with strict tracking protection can block it) — `js/theme.js` falls back to the OS-level `prefers-color-scheme` in that case.

---

## ❓ FAQ

**Do I need a build tool (Webpack/Vite/npm)?**
No. Everything is plain `<script>` tags and CDN-hosted Tailwind. Open `index.html` directly or serve statically.

**Can I use a different spreadsheet per form?**
Yes — deploy a separate Apps Script project (bound to a different Sheet) per form, and point each form's `js/schema.js → endpoint` at its own deployment URL.

**Is this free to run?**
Yes, within Google's standard Apps Script/Drive/Sheets quotas for personal accounts. High-volume production use should review [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).

**How is CSRF handled?**
Since the endpoint is a public, unauthenticated Apps Script web app (by design, so anonymous visitors can submit), traditional CSRF tokens don't apply the way they would to an authenticated session — the real risk surface here is spam/abuse, which is why the honeypot + rate limiting + input sanitization exist. Admin write actions (`markReviewed`, `delete`) require the `ADMIN_TOKEN`, which acts as the authentication boundary for anything destructive.

**Can I add more field types?**
Yes — add a renderer function in `js/fields.js` under `renderers`, wire up any custom behavior in `attachBehavior`, and reference the new `type` from `js/schema.js`.

---

## License

MIT — use it, fork it, ship it.
