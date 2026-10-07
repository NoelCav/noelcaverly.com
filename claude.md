# noelcaverly.com — agent build spec

## Repo structure

```
noelcaverly.com/
├── CNAME                          # "www.noelcaverly.com" (www is canonical)
├── index.html                     # datasheet-style homepage
├── assets/
│   ├── style.css                  # shared by homepage, dashboard, mods
│   ├── resume.pdf
│   └── Noel_Caverly_Resume_2026.docx
├── mods/                          # template pages, intentionally unlinked
│   ├── index.html
│   └── example-game/index.html
├── dashboard/
│   ├── index.html
│   └── dashboard.js
├── scripts/
│   ├── package.json               # firebase-admin only
│   └── rollup.js
├── .github/workflows/
│   └── rollup.yml
├── firebase/
│   └── firestore.rules
└── README.md
```

Root `.gitignore`: `node_modules/`, `.env`, `serviceAccount*.json`  
No build step, no bundler, no root-level `package.json`. Site deploys as static files.

**Current state:** all phases are built and live. Treat the phases below as the original spec; where they differ from the code, the code wins.

---

## Phase 1 — repo scaffold + deploy

GitHub Pages deploys directly from `main` (Settings → Pages → Deploy from a branch, via the built-in `pages-build-deployment`). There is no `deploy.yml`; don't add one. Every file in the repo is publicly served, so never commit secrets.

---

## Phase 2 — landing page

### `index.html` requirements

- Static HTML/CSS only — zero JavaScript
- Mobile-responsive, `prefers-color-scheme` dark/light
- Content: name, one-line bio, three links (LinkedIn, GitHub, `/assets/resume.pdf` download), low-key link to `/dashboard/`
- Current design is a component datasheet (pinout, specs table, revision history). Pin 5 "MODS" is a plain label on purpose — don't link it until the user asks.

### `assets/style.css`

Shared styles used by both pages. Use CSS variables for theming.

---

## Phase 3 — Firebase rules

### `firebase/firestore.rules`

See the file for the current rules. Summary:
- `raw`: create only by the ESP32's Email/Password account (`sign_in_provider == 'password'`) with a string `device_id`; read by any signed-in user; no update/delete.
- `agg_30m`, `agg_1h`: read by any signed-in user; no client writes.
- Everything else denied.

Rollup writes use the Admin SDK (service account), which bypasses these rules. The dashboard signs in anonymously, which satisfies read rules but can't write.

### README Firebase checklist

Add a checklist to `README.md` for manual Firebase setup steps the agent cannot automate:

```
## Firebase setup (manual)
- [ ] Create Firebase project
- [ ] Enable Firestore in production mode
- [ ] Enable Anonymous Authentication
- [ ] Enable Email/Password Authentication → create the ESP32 device user
- [ ] Copy web API key → paste into dashboard.js (FIREBASE_CONFIG)
- [ ] Deploy firestore.rules: `firebase deploy --only firestore:rules`
- [ ] Create service account → download JSON → add to GitHub Secret: FIREBASE_SERVICE_ACCOUNT
```

---

## Phase 4 — dashboard password gate

### Sensor data schema (referenced throughout)

```json
{
  "device_id": "ambient-01",
  "timestamp": 1700000000,
  "expireAt": "2025-05-30T00:00:00Z",
  "temperature": 22.4,
  "humidity": 58.1,
  "pressure": 1013.25,
  "bme_valid": true,
  "pm1_0": 5,
  "pm2_5": 12,
  "pm10": 18,
  "pms_valid": true,
  "sound_avg": 47,
  "sound_peak": 63,
  "light": 320
}
```

`timestamp` is Unix epoch seconds (integer). `expireAt` is a Firestore timestampValue for TTL auto-deletion (6 months).
BME fields (`temperature`, `humidity`, `pressure`) are only present when `bme_valid` is true.
PMS fields (`pm1_0`, `pm2_5`, `pm10`) are only present when `pms_valid` is true.
`sound_avg`, `sound_peak`, `light`, `device_id`, `bme_valid`, `pms_valid` are always present.

### `dashboard/index.html` — password gate

On load:
1. Check `sessionStorage` for key `dash_authed` with value `"1"`
2. If missing: render only a centered password form, nothing else
3. On submit: hash input via `crypto.subtle.digest('SHA-256', ...)`, compare hex string to `EXPECTED_HASH` constant in `dashboard.js`
4. Match → set `sessionStorage.setItem('dash_authed', '1')`, render dashboard
5. No match → show error, clear input

To generate the hash constant: `echo -n "yourpassword" | shasum -a 256`

Use `sessionStorage` (not `localStorage`) — gate must re-appear on every new browser session (tab close).

Verify the gate works with a hardcoded hash before writing any chart code.

---

## Phase 5 — dashboard charts

### Firestore collection → time range mapping

| Button | Collection | Approx docs |
|--------|-----------|-------------|
| `6h`   | `raw`     | ~36         |
| `24h`  | `raw`     | ~144        |
| `7d`   | `raw`     | ~1,008      |
| `30d`  | `raw`     | ~4,320      |
| `3m`   | `agg_30m` | ~1,440      |
| `1y`   | `agg_1h`  | ~8,760      |
| `all`  | `agg_1h`  | unbounded   |

Default on load: `24h` / `raw`. Every query **must** include a timestamp range bound — never fetch-all-then-filter.

### `dashboard.js` implementation spec

**Firebase init:**
```js
// Firebase loaded via CDN in index.html
const app = initializeApp(FIREBASE_CONFIG); // FIREBASE_CONFIG hardcoded here — safe to commit
const db = getFirestore(app);
const auth = getAuth(app);
await signInAnonymously(auth); // silent, no UI
```

CDN imports (in `dashboard/index.html`):
```html
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
<script type="module" src="dashboard.js"></script>
```
Firebase modules: load from `https://www.gstatic.com/firebasejs/10.x.x/firebase-*.js` (use latest stable 10.x).

**SessionStorage cache:**
```
key:   "sensor_cache_${range}"      // e.g. "sensor_cache_24h"
value: { data: [...], fetchedAt: Date.now() }
TTL:   5 min  for range ≤ 24h
       30 min for range > 24h
```
On range change: check cache first; fetch Firestore only on miss or expiry.

**Debounce:** 500ms after the last range button click before issuing any Firestore query.

**Layout:**
```
[header: "ambient monitor"  |  last updated: <timestamp>]
[pill buttons: 6h | 24h | 7d | 30d | 3m | 1y | all]
[Chart 1: Temperature °C (left Y) + Humidity % (right Y) — dual-axis line]
[Chart 2: Pressure hPa — single line]
[Chart 3: PM2.5 + PM10 + PM1.0 µg/m³ — three lines, shared Y]
[Chart 4: Sound avg + Sound peak + Light lux — three lines, shared Y]
[muted small label: "loaded 144 documents from raw"]
[footer: link → noelcaverly.com]
```

**Plotly config (apply to both charts):**
```js
{
  responsive: true,
  displayModeBar: false,
  connectgaps: false    // gaps render as breaks (ESP32 offline periods)
}
layout: { paper_bgcolor: 'transparent', plot_bgcolor: 'transparent' }
```

---

## Phase 6 — rollup script

### `scripts/package.json`

```json
{
  "name": "rollup",
  "private": true,
  "dependencies": {
    "firebase-admin": "^12.0.0"
  }
}
```

### `scripts/rollup.js` logic

```
1. Cutoffs:
   raw_cutoff   = now - 3 months (Unix seconds)
   agg30_cutoff = now - 12 months

2. raw → agg_30m:
   - Query raw/ where timestamp < raw_cutoff
   - Group into 30-min windows (floor timestamp to nearest 30 min)
   - Per window: avg all sensor fields (only fields present in source docs) + count
   - Upsert to agg_30m/{windowStart} (set with merge — idempotent)
   - Batch-delete source raw docs (max 500 per batch)

3. agg_30m → agg_1h:
   - Query agg_30m/ where timestamp < agg30_cutoff
   - Group into 1-hr windows
   - Group into 1-hr windows, weighting each agg_30m doc by its `count`
   - Upsert to agg_1h/{windowStart}, batch-delete source

4. stdout: "rolled up X raw → Y agg_30m, Z agg_30m → W agg_1h"
```

Rules:
- All writes before any deletes in each tier (crash-safe — duplicates are cleaned next run)
- Exit with code `1` on unhandled error (so GitHub Actions marks run failed)
- Service account loaded from env: `JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)`

---

## Phase 7 — rollup workflow

### `.github/workflows/rollup.yml`

```yaml
name: nightly rollup
on:
  schedule:
    - cron: '0 4 * * *'
  workflow_dispatch:
jobs:
  rollup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
        working-directory: scripts
      - run: node rollup.js
        working-directory: scripts
        env:
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
```

The live workflow also has a final step that re-enables itself through the GitHub API (needs `permissions: actions: write`), because GitHub disables scheduled workflows after 60 days without commits.

Verify with a manual `workflow_dispatch` trigger before relying on cron.

---

## Cloudflare (manual — document in README)

Add a `## Cloudflare setup (manual)` checklist to `README.md`:

```
- [ ] DNS A records for noelcaverly.com → GitHub Pages IPs (proxied):
        185.199.108.153 / .109.153 / .110.153 / .111.153
- [ ] DNS CNAME www → noelcav.github.io (proxied)
- [ ] SSL/TLS mode: Full (strict)
- [ ] Redirect rule (template "Redirect Apex to WWW"): noelcaverly.com → https://www.noelcaverly.com
- [ ] Firewall rule "block dashboard non-home":
        Expression: (http.request.uri.path contains "/dashboard") and (ip.src ne YOUR_HOME_IP)
        Action: Block
      To access from other IPs: disable rule or add IP exception temporarily
```

---

## Hard constraints (enforce throughout)

| Constraint | Detail |
|---|---|
| No firmware | ESP32 is a separate repo — create no firmware files |
| No root package.json | `scripts/` has its own; repo root must stay package-free |
| No bundler/build step | All browser JS runs directly from CDN or as ES modules |
| No service account in repo | Loaded from `FIREBASE_SERVICE_ACCOUNT` Actions secret only |
| No localStorage | Use `sessionStorage` for both auth token and data cache |
| No unbounded queries | Every Firestore query must have a timestamp range filter |
| No client-side filter-after-fetch | Query only the collection + range the user selected |

Other records in the zone (e.g. `jellyfin`) are DNS-only on purpose: proxying video streaming violates Cloudflare's ToS. Don't proxy them.
