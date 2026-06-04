# noelcaverly.com

Personal site + ambient sensor dashboard.

## Firebase setup (manual)
- [ ] Create Firebase project
- [ ] Enable Firestore in production mode
- [ ] Enable Anonymous Authentication
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
- [ ] DNS CNAME www → noelcaverly.com (proxied)
- [ ] SSL/TLS mode: Full (strict)
- [ ] Firewall rule "block dashboard non-home":
        Expression: `(http.request.uri.path contains "/dashboard") and (ip.src ne YOUR_HOME_IP)`
        Action: Block
      To access from other IPs: disable rule or add IP exception temporarily
