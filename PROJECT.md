# Maps Hunter Pro — Project Map

## Purpose
Maps Hunter Pro is a Chrome extension + web platform for extracting, organizing, and exporting business leads from Google Maps.

## Product direction
- Chrome extension focused on local business lead extraction.
- Website handles marketing, plans, renewals, affiliate/referral flow, account/license operations, and future checkout.
- Admin dashboard manages users, subscriptions, licenses, devices, payments, affiliates, payouts, usage, logs, and settings.

## Brand / UI
- Primary background: `#fbf6ee`
- Surface: `#fffdfa`
- Soft surface: `#f6eadb`
- Main text: `#2f2a23`
- Muted: `#776f66`
- Brand orange: `#d97745`
- Brand dark: `#b85f38`
- Accent: `#efb170`
- Line: `#eadfce`
- Success: `#2f9d65`
- Font: Tajawal
- UI style: warm cream + dark brown + orange accents, rounded cards, subtle shadows, clean SaaS layout.

## Landing page baseline
The official landing-page baseline is the user-provided HTML page (`صفحة هبوط.html`). Do not replace the visual language with a generic SaaS template.

Current landing sections:
1. Sticky header
2. Hero with Chrome extension visual
3. Features / “Everything you need…”
4. Excel output preview
5. Pricing
6. Success Partner / referral
7. Payment methods
8. FAQ
9. Footer policies

### Current copy direction
Primary positioning:
- Turn Google Maps searches into clean, export-ready business data.
- Export: Excel / CSV / JSON / Google Sheets.
- International phone formatting by search country.
- One phone number per business result.
- Facebook / Instagram columns at the end of exported datasets.

## Pricing rules
### Monthly
- Price: `$20 / month`
- Limit: up to `1,500 leads per day`

### Annual
- Price: `$100 / year`
- Limit: unlimited daily lead extraction

## Payment methods
Current planned methods:
- USDT
- REDOTPAY

## Affiliate / Success Partner Program
Current commercial rules:
- First purchase commission: `50%`
- Renewal commission: `20%`
- Future partner dashboard should show:
  - referral link/code
  - clicks
  - conversions
  - commissions
  - pending balance
  - paid balance
  - payout history

## Languages
Supported website languages:
- English (`en`) — default/fallback
- Arabic (`ar`) — RTL
- Russian (`ru`)
- German (`de`)
- Spanish (`es`)

### Language implementation
- Language UI uses the conventional globe icon.
- Locale files are separated under `assets/locales/`.
- `assets/i18n.js` is the single translation controller.
- Do not keep multiple competing translation scripts in `index.html`.
- Selected language is persisted locally in the browser.
- On the first visit, the site may use the browser language when supported.
- Only Arabic uses RTL; all other current languages use LTR.

## Frontend file structure
```text
/
├── index.html
├── privacy.html
├── terms.html
├── PROJECT.md
├── README.md
├── assets/
│   ├── styles.css
│   ├── app.js
│   ├── i18n.js
│   └── locales/
│       ├── en.js
│       ├── ar.js
│       ├── ru.js
│       ├── de.js
│       └── es.js
└── backend/
    ├── package.json
    ├── wrangler.toml
    └── src/
        └── index.js
```

## Frontend behavior
- Header navigation scrolls to sections.
- Globe button opens the language menu.
- Language choice updates all elements using `data-i18n`.
- External-style controls and placeholder links that are not yet connected must not pretend to complete checkout.
- Pricing cards and feature cards should remain visually compact; avoid excessively tall sections.

## Features-section visual decision (2026-09-05)
The user asked to make the “Everything…” section smaller and cleaner.
Current interpretation: this refers to `Everything you need to collect leads faster`.
Changes:
- reduced section vertical padding
- smaller heading
- smaller cards
- smaller feature icons
- tighter gaps and descriptions
If a future conversation confirms another section was intended, update this note instead of losing this decision history.

## Backend baseline
Backend is currently a Cloudflare Worker starter under `/backend`.

Initial routes:
- `GET /api/health`
- `GET /api/plans`
- `POST /api/checkout`
- `POST /api/affiliate/register`
- `POST /api/license/validate`

Current backend status:
- health and plans are usable starter JSON endpoints
- checkout / affiliate registration / license validation are placeholders only
- no real payment processing yet
- no real database yet
- no secrets should be committed to GitHub

## Planned backend architecture
Recommended next phase:
1. Cloudflare Worker API
2. Cloudflare D1 database
3. Users table
4. Subscriptions table
5. Payments table
6. Licenses table
7. Devices table
8. Affiliates table
9. Referral events / commissions table
10. Payouts table
11. Audit logs table
12. Admin authentication

## Account / renewal direction
Current intended flow:
- customer uses the email registered on the Maps Hunter Pro website
- renewal returns through the website
- backend identifies the customer by account/email and active subscription/license records
- do not rely on email alone for sensitive authorization once the real account system is implemented

## Security rules
- Never commit API tokens, payment secrets, admin passwords, or private keys.
- Payment confirmation must be verified server-side.
- License validation must be server-side.
- Device reset/revoke operations must require authenticated admin/user authorization.
- Add rate limiting before production.
- Add audit logs for sensitive admin operations.

## Repository rule for future agents
Whenever a meaningful product decision, system architecture change, pricing rule, affiliate rule, language change, deployment decision, or folder-structure change is made, update this `PROJECT.md` in the same work session.

## 2026-09-05 — Preview hosting fix
- The first Cloudflare preview deployment was broken because the Worker script existed but frontend static assets were not actually attached/served.
- Symptom: HTML endpoint responded, but the page appeared without the intended frontend styling and interactive JavaScript; language controls did not work.
- Preview architecture changed: `maps-hunter-pro-preview` now proxies the public GitHub `main` branch files from `raw.githubusercontent.com/x4hop/maps-hunter-pro/main`.
- `/` maps to `/index.html` and `/assets/*` maps directly to the repository assets.
- Worker forces correct MIME types for `.html`, `.css`, `.js`, and `.json`, and disables caching for development preview.
- Do not claim preview is working merely because the Worker upload API returns 200; verify that HTML, CSS, JS and locale asset URLs are all served before calling a deployment healthy.
- Production deployment should later use proper Cloudflare static assets / Pages or a Worker Assets binding rather than the GitHub proxy preview approach.
