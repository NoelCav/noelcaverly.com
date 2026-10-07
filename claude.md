# noelcaverly.com — agent notes

Static personal site served by GitHub Pages at https://www.noelcaverly.com.

## Repo structure

```
noelcaverly.com/
├── CNAME                          # "www.noelcaverly.com" (www is canonical)
├── index.html                     # datasheet-style homepage
├── assets/
│   ├── style.css                  # shared by homepage and mods pages
│   ├── resume.pdf
│   └── Noel_Caverly_Resume_2026.docx
├── mods/                          # template pages, intentionally unlinked
│   ├── index.html
│   └── example-game/index.html
├── .claude/launch.json            # local preview: python -m http.server 3000
└── README.md
```

## Deploy

GitHub Pages deploys directly from `main` (Settings → Pages → Deploy from a branch, via the built-in `pages-build-deployment`). There is no `deploy.yml`; don't add one. Every file in the repo is publicly served, so never commit secrets.

## Homepage

- Static HTML/CSS only — zero JavaScript
- Mobile-responsive, `prefers-color-scheme` dark/light, theme via CSS variables in `assets/style.css`
- Designed as a component datasheet: pinout, specifications table, revision history. Pin 5 "MODS" is a plain label on purpose — don't link it until the user asks.
- Links: LinkedIn, GitHub, `/assets/resume.pdf` download

## Ambient monitor (separate repo)

The ambient monitor — ESP32 firmware, web dashboard, Firestore rules, rollup script and workflow — lives in `NoelCav/Ambient-Monitor` (`cloud/` holds the off-device pieces). The project is on hold. Don't add dashboard, Firebase or rollup code here; the homepage only describes the project.

## Cloudflare

See the checklist in `README.md`. Apex `noelcaverly.com` redirects to `www` via a Cloudflare redirect rule; without it the apex returns 526 because GitHub only issues a cert for www.

Other records in the zone (e.g. `jellyfin`) are DNS-only on purpose: proxying video streaming violates Cloudflare's ToS. Don't proxy them.

## Hard constraints

| Constraint | Detail |
|---|---|
| No root package.json | No build step, bundler or dependencies |
| No secrets | The whole repo is published |
