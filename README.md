# noelcaverly.com

Personal site + ambient sensor dashboard.

Live at https://www.noelcaverly.com. GitHub Pages deploys straight from `main` (Settings → Pages → Deploy from a branch); there is no deploy workflow. `mods/` is a template for future game-mod pages and is not linked from the homepage yet.

## Firebase setup (manual)
- [ ] Create Firebase project
- [ ] Enable Firestore in production mode
- [ ] Enable Anonymous Authentication (dashboard reads)
- [ ] Enable Email/Password Authentication → create the ESP32 device user (raw writes)
- [ ] Copy web API key → paste into `dashboard/dashboard.js` (`FIREBASE_CONFIG`)
- [ ] Deploy firestore.rules: `firebase deploy --only firestore:rules`
- [ ] Create service account → download JSON → add to GitHub Secret: `FIREBASE_SERVICE_ACCOUNT`

## Dashboard password

Generate the SHA-256 hash of your chosen password and set `EXPECTED_HASH` in `dashboard/dashboard.js`:

```sh
echo -n "yourpassword" | shasum -a 256
```

## Cloudflare setup (manual)
- [ ] DNS A records for noelcaverly.com → GitHub Pages IPs (proxied):
        185.199.108.153 / .109.153 / .110.153 / .111.153
- [ ] DNS CNAME www → noelcav.github.io (proxied)
- [ ] SSL/TLS mode: Full (strict)
- [ ] Redirect rule "Redirect Apex to WWW" template: noelcaverly.com → https://www.noelcaverly.com
      (GitHub only issues a cert for www, so the apex returns 526 without it)
- [ ] Firewall rule "block dashboard non-home":
        Expression: `(http.request.uri.path contains "/dashboard") and (ip.src ne YOUR_HOME_IP)`
        Action: Block
      To access from other IPs: disable rule or add IP exception temporarily

## Nightly rollup

`.github/workflows/rollup.yml` runs at 04:00 UTC. GitHub disables scheduled workflows after 60 days without commits; the workflow re-enables itself on every run to prevent that. If it ever shows "disabled", re-enable it from the Actions tab and trigger it with "Run workflow".
