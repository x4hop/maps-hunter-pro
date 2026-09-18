# Maps Hunter Pro — Current Production Truth

Last updated: 2026-09-18

## Source of truth

- Repository: `x4hop/maps-hunter-pro`
- Production branch: `main`
- `main` is the source of truth for the landing site, admin console, backend, Cloudflare worker and extension release source.
- Do not restore old D1-hosted landing/admin HTML or the retired split frontend/API/admin architecture.
- Historical migrations stay immutable. New database changes must be additive migrations.

## Commercial model

- Monthly: **$20 / 30 days**.
- Monthly usage limit: **1,500 accepted/saved leads per UTC day**.
- Lifetime: **$100 one-time**.
- Lifetime has **no expiry** and no commercial daily platform limit.
- Every customer activation code supports **exactly one trusted device**.
- Owner access is a separate permanent owner-only code.
- Legacy annual rows may remain in D1 for compatibility/history; they are not a public plan.

### Lifetime storage compatibility

The legacy `manual_licenses.plan_id` constraint accepts `monthly|annual` and `duration_days` accepts `30|365`. To avoid rebuilding the production table, the public `lifetime` plan is stored internally as:

- `plan_id = 'annual'`
- `duration_days = 365` (compatibility placeholder only)
- `is_lifetime = 1`
- `expires_at = NULL`
- `daily_lead_limit = NULL`

Runtime behavior is controlled by `is_lifetime`, not by the legacy `annual` storage value. Do not convert historical migrations in place.

## Manual payment model

Payment credentials are intentionally frontend-owned manual data. Supported methods are Binance ID, USDT on TRC20 and RedotPay, with payment verification/support handled through WhatsApp.

Rules:

- The customer chooses Monthly or Lifetime on the public page.
- Copy buttons must work with the Clipboard API **and** a legacy browser fallback.
- Payment methods do not come from `/api/payment-methods`; `backend/src/entry.js` rejects that endpoint.
- The customer sends a screenshot plus transaction reference/address on WhatsApp.
- The operator verifies payment manually, then generates an activation code in `/admin/`.
- Payment proof never auto-activates access.
- Admin settings do not own payment credentials.

## Public language routes

- English: `/en`
- Arabic: `/ar`
- Russian: `/ru`
- German: `/de`
- Spanish: `/es`

Rules:

- `/` redirects permanently to `/en`.
- `www.mapshunterpro.com/*` redirects permanently to the apex domain.
- Arabic is RTL; the other languages are LTR.
- Each route has a self-canonical, reciprocal `hreflang`, and `x-default`.
- Localized HTML is generated at build time so important copy exists without client JavaScript.
- Base locale files and override files must agree on Monthly/Lifetime wording.

## Unified Cloudflare production architecture

Production worker:

- Worker: `maps-hunter-pro-api`
- Custom domains: `mapshunterpro.com`, `www.mapshunterpro.com`
- `workers.dev` and preview URLs are disabled for production; extension/API traffic uses `https://mapshunterpro.com`.
- Entry: `deploy/unified-worker.js`
- Wrangler: `wrangler.jsonc`
- Static assets: `dist/frontend`
- D1 binding: `DB`
- D1 database: `maps-hunter-pro`
- Cron maintenance: `17 3 * * *`

The same worker serves the site, localized pages, blog, admin, API, robots and sitemap. Landing/admin HTML is served from Static Assets, not D1.

## Cloudflare ↔ GitHub deployment

Cloudflare Workers Builds is connected to GitHub:

- repository: `x4hop/maps-hunter-pro`
- branch: `main`
- build: `node scripts/build-frontend-cloudflare.mjs`
- deploy: `npx --yes wrangler@4 deploy --config wrangler.jsonc`

GitHub Actions performs validation/release packaging; production deployment is performed by Cloudflare's GitHub integration.

## Frontend responsibilities

- `index.html`: canonical landing markup, structured data, pricing/payment placeholders and sections.
- `assets/locales/*.js`: base translated copy.
- `assets/manual-i18n.js`: manual-payment/activation and pricing presentation overrides.
- `assets/seo-i18n.js`: SEO-oriented localized copy.
- `assets/i18n.js`: route/language switching and metadata behavior.
- `assets/app.js`: plan API, payment cards, robust copy actions, USDT QR modal, WhatsApp handoff and plan selection.
- `assets/*.css`: responsive visual system.

## Extension workflow

The extension is Manifest V3 and uses a side panel. The user adds one or more business keywords and one or more cities, starts a Maps scan, optionally stops after link collection, then extracts place details and contacts. Results are stored locally and exported on demand.

High-level pipeline:

1. Validate activation code/device.
2. Build `keyword × city` search targets.
3. Open Google Maps search.
4. Collect/deduplicate place URLs by scrolling Maps results.
5. Extract each place detail in background Maps tabs with configurable concurrency (1–8; default 6).
6. Extract public email/social data only when Google Maps itself exposes it in the listing/detail content; do not open or fetch the business website.
7. Consume one licensed usage unit with an idempotent request ID.
8. Save the lead to `chrome.storage.local`.
9. Persist queue/runtime state so interrupted jobs can resume.
10. Export to Excel, CSV, JSON, or the Results table.

## Maps-only contact extraction

`extension/maps-page-overrides.js` extracts public contact fields directly from the selected Google Maps listing/detail page.

- Business websites are never opened or fetched for email/social enrichment.
- Email candidates are read from visible Maps text, HTML and relevant Maps-page attributes/links.
- When multiple emails are exposed by Maps, same-domain/common business-contact addresses are preferred.
- Website URL is still exported when Google Maps provides it, but it is not crawled.
- Host permissions are limited to Google Maps/Google plus `mapshunterpro.com` for licensing.
- Business result data stays in local extension storage; the licensing API does not receive the lead list.

## Export

The custom XLSX exporter runs locally. Current workbook columns are:

`Business Name, Phone, Email, Category, Website, Google Maps, Rating, Reviews, Address, Hours, Other Emails, Facebook, Instagram, LinkedIn, X / Twitter, YouTube, TikTok, Image, Status`.

Excel includes styled headers/KPIs, frozen headers and clickable URL/email cells. CSV and JSON are also generated locally.

## Backend API

Implementation: `backend/src/index.js` wrapped by `backend/src/entry.js`.

Public/extension endpoints:

- `GET /api/health`
- `GET /api/plans` → public Monthly + Lifetime only
- `POST /api/license/validate`
- `POST /api/usage/consume`
- `GET /api/payment-methods` → intentionally rejected as `PAYMENTS_MANUAL_ONLY`

Protected admin routes include login/logout, summary, settings, manual licenses, device reset/revoke/plan update, owner access and audit logs.

## Licensing invariants

- Monthly activation starts a 30-day term on first successful activation.
- Lifetime activation sets `expires_at = NULL`.
- `is_lifetime=1` licenses must never be expired by the maintenance job.
- Customer `device_limit` is normalized to 1 by `backend/src/entry.js`.
- A second trusted device is rejected until the operator resets the binding.
- Usage consumption is idempotent by request ID.
- Monthly daily-limit accounting is UTC/D1 date based.

## Admin

Admin URL: `/admin/`.

Admin functions:

- generate Monthly or Lifetime codes;
- view status, activation date, expiry/Lifetime, daily use and device count;
- convert an eligible code to Lifetime;
- extend/switch to Monthly when explicitly chosen;
- reset the single device binding;
- revoke a code;
- change Monthly/Lifetime prices and Monthly daily limit;
- maintain support/release metadata;
- rotate/revoke owner code;
- inspect audit logs;
- copy generated/owner codes with Clipboard API + fallback.

Admin does not manage payment credentials.

## SEO/content architecture

- Localized landing routes are server-rendered/static-build localized.
- The worker injects canonical, `hreflang`, OG locale and language-specific title/description.
- `robots.txt` points to `/sitemap.xml`.
- Sitemap includes language routes, published blog hubs/articles and low-priority policy pages.
- Blog articles use canonical URLs and structured data such as `BlogPosting`/`BreadcrumbList` where present.
- Current content strategy targets Google Maps lead generation use cases, agencies, web design, local SEO, SaaS/outbound and comparison intent.

## CI / release gates

A production change is not complete until these pass:

- JavaScript syntax checks;
- payment architecture + robust copy regression checks;
- Monthly/Lifetime public-source consistency checks;
- one-device licensing checks;
- current migration-chain checks;
- Manifest/permissions checks matching Maps-only extraction behavior;
- localized Cloudflare build (EN/AR/RU/DE/ES + RTL Arabic);
- Wrangler dry run;
- extension release packaging.

## Required production smoke test

After every deploy verify:

- `/en`, `/ar`, `/ru`, `/de`, `/es` return 200;
- Monthly = $20; Lifetime = $100 one-time;
- payment values display correctly;
- every payment copy button actually copies the intended value;
- USDT QR modal opens/closes;
- WhatsApp message reflects the selected plan;
- `/api/plans` exposes Monthly + Lifetime, never public Annual;
- `/admin/` works and copy buttons work;
- a new Monthly code activates/expires normally;
- a new Lifetime code activates with no expiry;
- second device is rejected until reset;
- `/robots.txt` and `/sitemap.xml` include all current published content;
- `www` redirects 301 to apex.

## Change-control rule

Do not make broad production edits directly on `main` without verification. Use a short-lived repair/feature branch, run regression checks, review the diff, merge only after checks pass, then verify the Cloudflare build and live smoke tests. For D1 schema changes, back up first and use additive migrations.
