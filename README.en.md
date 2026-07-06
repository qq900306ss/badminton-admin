# badminton-admin — Host / Super-admin Back-office

[中文](README.md) · **English** · [日本語](README.ja.md)

Back-office for the badminton court management system: Google login → create a session (set name / time / password / courts / roster) → QR code → in-session management (swap courts, remove players, add players, change levels) → stats. Super-admins can manage hosts and impersonate them.

🔗 **Live**: https://d1r9u0ja59y4rv.cloudfront.net

## Related

| | URL |
|--|------|
| Player front-end (booking) | https://d2mg2bpjvlg672.cloudfront.net |
| Backend API | https://pp2p4ln2cogxt4mi5f2wl3rqi40vskvs.lambda-url.ap-northeast-1.on.aws |

## Local development

```bash
npm install
npm run dev   # http://localhost:5173 (must be 5173, matching the Google OAuth redirect)
```

## Languages (i18n)

The UI ships in **Traditional Chinese / English / Japanese**. Switch with the 🌐 picker in the top-right corner; the choice is saved to `localStorage`. Translations live in `src/i18n/locales/*.json` (one `<Namespace>.<lang>.json` fragment per component).

## Deployment

Push to `main` → GitHub Actions automatically builds and uploads to S3 + invalidates CloudFront.
See `../DEPLOY.md` for the full deployment guide.
