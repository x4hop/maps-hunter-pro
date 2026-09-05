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
Initial Cloudflare Worker scaffold:
- `backend/src/index.js`
- `backend/wrangler.toml`
- `backend/package.json`

Initial API endpoints:
- `GET /api/health` — health check.
- `GET /api/plans` — canonical plan/payment/affiliate configuration.
- `POST /api/checkout` — validates email + plan and returns an integration-pending checkout response.
- `POST /api/affiliate/register` — validates affiliate registration; persistence is not connected yet.
- `POST /api/license/validate` — endpoint scaffold; persistent license database is not connected yet.

Important: the backend does **not** pretend that payments, accounts, affiliates, or licenses are fully operational. Responses explicitly say `integration_required` until storage and payment verification are added.

## 8. Next backend integrations
Priority order:
1. Cloudflare D1 schema for users, subscriptions, licenses, devices, payments, affiliates, commissions, payouts, and audit logs.
2. Email/account lookup and renewal flow.
3. USDT and REDOTPAY payment verification workflow.
4. License generation/validation and device binding.
5. Affiliate referral attribution and commission ledger.
6. Admin dashboard connected to real API data.
7. Rate limiting, anti-abuse checks, and audit logging.

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
