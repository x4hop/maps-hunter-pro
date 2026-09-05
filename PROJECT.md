# Maps Hunter Pro — Project Map & Change Log

Last updated: 2026-09-05

## 1. Purpose
Maps Hunter Pro is a Chrome extension and web system for discovering, organizing, and exporting business leads from Google Maps. The website is the commercial entry point for pricing, renewals, affiliate onboarding, and future license/account management.

## 2. Current commercial rules
- Monthly plan: **$20 / month**.
- Monthly daily limit: **1,500 leads/day**.
- Annual plan: **$100 / year**.
- Annual daily extraction: **Unlimited**.
- Payment methods currently planned: **USDT** and **REDOTPAY**.
- Affiliate commission: **50% on first purchase** and **20% on renewals**.
- Renewals are intended to use the customer's existing Maps Hunter Pro email.

## 3. Design system
The landing page and admin dashboard share the same warm visual identity:
- Background: `#fbf6ee`
- Surface: `#fffdfa`
- Primary text: `#2f2a23`
- Primary orange: `#d97745`
- Dark orange: `#b85f38`
- Accent: `#efb170`
- Soft cream: `#f6eadb`
- Border: `#eadfce`
- Font: **Tajawal**

Do not replace this visual system with a generic SaaS theme without an explicit decision.

## 4. Landing page decisions
The approved landing-page structure is:
1. Sticky header.
2. Chrome-extension hero with a Maps + extension mockup.
3. Feature section.
4. Professional Excel preview.
5. Pricing.
6. Success Partner / affiliate section.
7. Payment methods.
8. FAQ.
9. Footer policies.

### Feature section compacting
The section headed **“Everything you need to collect leads faster”** was intentionally reduced in vertical size on 2026-09-05. Cards, icons, gaps, and heading sizes were reduced so this section does not dominate the landing page. This is currently the best interpretation of the user's phrase “قسم الاغري ثينك”. If a different section was intended, update this note when corrected.

## 5. Language system
Supported languages:
- English (`en`)
- Arabic (`ar`)
- Russian (`ru`)
- German (`de`)
- Spanish (`es`)

Rules:
- Use the standard **globe SVG icon** in the header; do not show `AR`/`EN` as the main language button.
- Language choices open in a dropdown.
- Arabic uses `dir="rtl"`; all other languages use `ltr`.
- The selected language is stored in `localStorage` under `mhp_lang`.
- On first visit, browser language is used when it matches a supported language; otherwise English is the fallback.
- All visible landing-page UI strings should use `data-i18n` keys.
- Locale content lives in `assets/locales/` and switcher logic lives in `assets/i18n.js`.

## 6. Frontend structure
- `index.html` — landing-page markup and SEO/schema.
- `assets/styles.css` — visual styling and responsive behavior.
- `assets/i18n.js` — language switching logic.
- `assets/locales/en.js`, `ar.js`, `ru.js`, `de.js`, `es.js` — translation dictionaries.
- `assets/app.js` — frontend behavior and API integration.
- `privacy.html` — privacy page.
- `terms.html` — terms page.

The frontend remains framework-free for now: HTML/CSS/vanilla JS.

## 7. Backend structure
Cloudflare Worker backend:
- `backend/src/index.js`
- `backend/wrangler.toml`
- `backend/package.json`
- `backend/migrations/0001_initial.sql`

Public API endpoints:
- `GET /api/health`
- `GET /api/plans`
- `POST /api/checkout`
- `POST /api/affiliate/register`
- `POST /api/license/validate`

Admin API endpoints under `/api/admin/*` require `ADMIN_TOKEN`.

## 8. Current architecture
- Frontend: static HTML/CSS/vanilla JS.
- Backend: Cloudflare Worker.
- Database: Cloudflare D1.
- Admin dashboard: `admin/index.html` + `admin/admin.js`.
- Admin authentication: temporary secret token stored only in browser `sessionStorage`; never commit it to GitHub.
- Payments: USDT/REDOTPAY records persist, but provider-side verification is not automated yet.

## 9. Working rule for future agents
Before changing the site or backend, read this file first. After any material decision or architecture/design change, update this file in the same commit. Keep implementation and documentation synchronized.

## 10. Change log
### 2026-09-05
- Adopted the user's supplied landing page as the canonical design base.
- Preserved warm cream/orange Maps Hunter Pro design identity.
- Replaced text language button with a standard globe SVG dropdown.
- Added/fixed English, Arabic, Russian, German, and Spanish language switching.
- Added browser-language detection and persisted selection.
- Added translation coverage for hero mockup, feature section, pricing, affiliate section, FAQ, footer, Excel labels, and other visible UI labels.
- Compacted the “Everything you need to collect leads faster” feature section.
- Split frontend into `index.html`, `assets/styles.css`, `assets/i18n.js`, locale files, and `assets/app.js`.
- Added initial Cloudflare Worker backend scaffold and API routes.
- Added this project map/change log as the source of truth for future work.

## 11. Backend activation — 2026-09-05
The backend moved from scaffold status to a persistent Cloudflare system.

### Cloudflare D1
- Database name: `maps-hunter-pro`
- D1 binding name: `DB`
- Primary region: `WEUR`
- Schema migration: `backend/migrations/0001_initial.sql`
- Tables: `users`, `subscriptions`, `licenses`, `devices`, `payments`, `affiliates`, `referrals`, `commissions`, `payouts`, `usage_daily`, `audit_logs`, `settings`.

### API Worker
- Worker name: `maps-hunter-pro-api`
- Source: `backend/src/index.js`
- Public endpoints:
  - `GET /api/health`
  - `GET /api/plans`
  - `POST /api/checkout`
  - `POST /api/affiliate/register`
  - `POST /api/license/validate`
- Admin endpoints are under `/api/admin/*` and require a secret `ADMIN_TOKEN` supplied as `Authorization: Bearer <token>` or `X-Admin-Token`.
- The Admin Token must never be committed to GitHub.

### Current real behavior
- Checkout now creates a persistent pending payment and a user when required.
- Affiliate registration persists affiliates and generates referral codes.
- License validation reads persistent licenses and can bind extension devices up to the configured device limit.
- Admin can create an active subscription + license manually.
- Admin can confirm a pending payment manually; this activates a subscription and creates the affiliate commission ledger entry when a referral exists.
- USDT/REDOTPAY provider-side verification is still not automated. Until provider integrations are added, payment confirmation is an explicit admin action.

### Admin dashboard
- `admin/index.html` — live admin console based on the approved warm Maps Hunter Pro dashboard design.
- `admin/admin.js` — authenticated calls to the real API.
- The admin page never contains the Admin Token in source code. The token is entered at login and kept only in `sessionStorage`.

### Security baseline
- D1 data endpoints for administration require `ADMIN_TOKEN`.
- Audit logs are written for checkout, license validation, license creation/revocation, payment confirmation, affiliate creation, and settings changes.
- Payment confirmation and real money settlement must remain separate until provider verification is implemented.

### Next backend priorities
1. Automatic USDT / REDOTPAY payment verification or a controlled proof-review flow.
2. Customer email login / renewal page.
3. Extension usage reporting endpoint with daily-limit enforcement.
4. Affiliate dashboard and payout request creation.
5. Cloudflare rate limiting / abuse protection.
6. Replace temporary Admin Token login with Cloudflare Access or another stronger admin identity layer before production launch.
