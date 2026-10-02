# Maps Hunter Pro

Production source for the Maps Hunter Pro Chrome extension, multilingual marketing site, manual activation admin console, Cloudflare Worker and D1 licensing backend.

## Commercial rules

- Monthly: USD 20 / 30 days, up to 1,500 accepted leads per UTC day.
- Lifetime: USD 100 one-time, no expiry and no commercial daily platform limit.
- Customer activation code: exactly 1 trusted device.
- Payment: Binance ID / USDT TRC20 / RedotPay, verified manually through WhatsApp.
- There is no customer website account/login flow in the current production model.

## Admin Intelligence v1 — implementation log (2026-10-02)

This section is the running change log for the professional Admin/Operations rebuild. Every implementation step must be recorded here before the branch is merged to `main`.

1. **Created isolated development branch** `admin-intelligence-v1` from production `main`; production was not modified while the redesign was being built.
2. **Reviewed the existing admin/backend data flow** and confirmed that `manual_usage_daily` already provides per-license daily accepted-lead counts, so customer usage analytics can be built without uploading business lead records.
3. **Designed additive migration `0011_admin_intelligence.sql`** with `admin_customers`, `admin_sales`, and `admin_support_events`, plus nullable `manual_licenses.customer_id` linkage. Historical migrations remain untouched.
4. **Recorded the three owner-provided historical sales as real transactions** under neutral customer labels rather than inferring revenue from current plan prices: Customer 001 · Algeria · USD 50, Customer 002 · Palestine · USD 20, Customer 003 · Oman · USD 20. Exact sale dates and license links are intentionally left unset. Baseline recorded revenue is USD 90 across 3 sales/customers; average sale is USD 30. Customer lead counters start from the new Admin baseline unless a license is explicitly linked later.
5. **Added customer/revenue/usage Admin API foundations**: total revenue, customer count, country count, sales count, average sale, all-time leads, leads today, seven-day usage, attention count, revenue by country, customer list/search, Customer 360 detail, sales list/create/update, customer create/update, and customer-license link/unlink actions.
6. **Enhanced license reporting** so Admin queries can show linked customer, today usage, all-time accepted leads, last usage, device activity, and derived health state without receiving the customer's actual lead list.
7. **Rebuilt the Admin UI as an Operations console** with Overview, Customers, Sales & Revenue, Licenses, Support Center, Owner Access, Settings, Audit Logs, and a Customer 360 drawer. The approved Maps Hunter Pro Paper/Stone/Coral/Black identity is retained.
8. **Added support-health foundations**: `admin_support_events` stores only sanitized operational metadata when telemetry is enabled later; it is explicitly not designed to store business names, lead phones, lead emails, or extracted lead rows.
9. **Added regression coverage** in `tests/test_admin_intelligence.py` to verify the new schema, the USD 90 historical revenue baseline, three seeded customers/sales, customer-license linking, and aggregate Today/All-time lead calculations.
10. **Updated migration-chain coverage** through `0011` and added the Admin Intelligence regression test to GitHub release checks.
11. **Local validation completed before commit**: JavaScript syntax checks for backend/admin passed; migration chain `0001..0011` passed; Admin Intelligence revenue/usage regression passed.
12. **Corrected the stale README extension/data-model description** so documentation matches the current runtime: official public business websites may be fetched transiently in the service worker for public email/social enrichment, while lead rows remain local and are not uploaded to licensing/Admin.
13. **Adjusted the launch baseline before production** so the three existing buyers are stored as Customer 001/002/003 with country + paid amount, without requiring license linkage. Their customer-level lead counters start at zero until future usage is explicitly associated with them; existing license-level usage remains available separately in the Licenses view.
14. **Prepared production publication** after the owner confirmed that this Operations console is private/internal. The launch baseline therefore keeps customer identities neutral, preserves the USD 90 historical revenue total, and does not require historical license mapping before the first production trial.

### Privacy invariant for Admin Intelligence

The Operations console may store customer/admin metadata, license/device state, aggregate usage counts, sales transactions, and sanitized technical support events. The actual Google Maps/business lead dataset remains in `chrome.storage.local` and must not be uploaded merely to power Admin analytics.

### Next Admin Intelligence steps

- Add sanitized extension telemetry for scan/extraction/version/error events, with strict field allowlisting.
- Add renewal/expiry workflows, acquisition-source tracking, release/version health and deeper support diagnostics after the Customer/Sales foundation is verified in production.

## Production build/deploy

Cloudflare Workers Builds watches `main`.

```bash
node scripts/build-frontend-cloudflare.mjs
npx --yes wrangler@4 deploy --config wrangler.jsonc
```

GitHub Actions validates the source and packages the extension; Cloudflare's native GitHub integration performs the production deploy.

## Local release checks

```bash
node --check assets/app.js
node --check assets/i18n.js
node --check assets/manual-i18n.js
node --check assets/seo-i18n.js
node tests/test_payment_safety.mjs
node tests/test_frontend_regressions.mjs
node tests/test_icon_system.mjs
node tests/test_language_switcher.mjs
node tests/test_layout_stability.mjs
node tests/test_single_device_policy.mjs
python3 tests/test_current_migration_chain.py
python3 tests/test_manifest.py
node scripts/build-frontend-cloudflare.mjs
npx --yes wrangler@4 deploy --dry-run --outdir dist/wrangler-dry-run --config wrangler.jsonc
node scripts/release-extension.mjs
```

## Completed UI milestones

### Branded SVG icon system — completed 2026-09-18

- Public-site placeholder symbols, emoji-like glyphs, and text-number pseudo-icons were replaced with the shared `/assets/mhp-icons.svg` sprite.
- The icon system uses the Maps Hunter Pro identity: Paper `#F6F4F1`, Stone `#E4DED2`, Coral `#F95C4B`, and Black `#000000`.
- Current icon coverage includes the hero trust row, Google Maps workflow, extracted data fields, feature cards, Excel preview, use cases, pricing semantics, and payment-related UI where applicable.
- Do not revert to Unicode/emoji placeholders. Extend the SVG sprite when a new semantic icon is needed.
- Regression guard: `node tests/test_icon_system.mjs`.

### Language switcher stability — completed 2026-09-18

- Language switching must work consistently from every localized route, including `/en` and `/ar`.
- Keep the popup inside `#languageSwitcher`; the existing CSS already mirrors its absolute alignment for RTL. Do not move it to `document.body` and do not force viewport-fixed coordinates.
- Every language item owns a direct click handler and navigates to the corresponding language path while preserving query string and hash.
- Language fixes are behavior-only and must not rewrite card, payment, navigation, or responsive layout rules.
- Regression guard: `node tests/test_language_switcher.mjs`.

### Public-site visual baseline — restored 2026-09-18

- The approved visual baseline is the polished layout that existed immediately after the branded SVG icon release. Do not add a global "stability" CSS layer that rewrites cards, payment grids, headings, or responsive breakpoints across the whole site.
- Language-switcher fixes must be behavior-only: keep the popup inside `#languageSwitcher`, use direct click handlers, and rely on the existing LTR/RTL CSS. Do not reparent the menu to `body`, force it to `position:fixed`, or hide RTL navigation as a workaround.
- The public page must load `styles.css`, `manual.css`, `ui-polish.css`, `layout-polish.css`, and `payment-icon-clean.css` explicitly and in that order. The same order is used for critical CSS at build time.
- Payment methods must have static fallback markup with Binance, USDT TRC20, and RedotPay values/icons. `assets/app.js` may enhance/re-render them, but the methods must remain visible if JavaScript is delayed.
- The product/extension icon is `/assets/maps-hunter-pro-icon.png`; use it in the public header and footer brand positions. Do not replace it with Unicode symbols.
- Before merging public-site visual changes run `node tests/test_public_site_visual_contract.mjs`, `node tests/test_icon_system.mjs`, and `node tests/test_language_switcher.mjs`.

## UI identity rule

- Public-site interface icons must use the shared `/assets/mhp-icons.svg` SVG sprite or another reviewed SVG asset that follows the Maps Hunter Pro identity.
- Do not use emoji, decorative Unicode symbols, placeholder letters/numbers, or symbol-font glyphs as interface icons.
- Icon styling must stay within the Paper `#F6F4F1`, Stone `#E4DED2`, Coral `#F95C4B`, and Black `#000000` identity unless a real third-party payment/service mark requires otherwise.
- Run `node tests/test_icon_system.mjs` before merging public-site icon changes.

## Database

Production upgrades are additive migrations under `backend/migrations/`; never rewrite historical migrations after deployment. `schema.sql` is a legacy reference/test fixture and is not the source of the current production schema; do not use it as a production migration command. Lifetime compatibility keeps the legacy storage `plan_id='annual'` only internally and distinguishes real Lifetime access using `is_lifetime=1` with `expires_at=NULL`.

## Extension/data model

Google Maps result/detail data stays in `chrome.storage.local`. Maps data is saved first; when Google Maps provides an official public business website, the current extension may fetch that site's public HTML transiently in the service worker to discover public business email/social links without opening visible website tabs. Raw website pages are not intentionally persisted. Lead data is not uploaded to the licensing/Admin API; those services receive activation/device/aggregate-usage fields and sanitized operational metadata required to enforce access, analytics and support.

Read `PROJECT.md`, `DATA_FLOW.md`, `CHROME_WEB_STORE.md`, `privacy.html`, `terms.html`, and `docs/MAPS_HUNTER_PRO_MASTER_ROADMAP_AR.md` before changing production behavior.

## Western Markets SEO v1 — research log (2026-10-02)

1. Created isolated branch `seo-western-markets-v1` from production `main`; no production SEO behavior was changed during the research phase.
2. Audited the existing SEO architecture: localized build output, canonical/hreflang injection, sitemap/robots, structured data, current blog cluster and existing comparison pages.
3. Used the requested Aseel GitHub connectors in **read-only mode**. No repository exposed by those connectors is literally named `worthandwhy`; direct lookup of `aseel90/worthandwhy` returned 404. No Aseel file or repository was modified.
4. Used the requested browser connector **only for Noxtool / Semrush**. Noxtool login was recovered through the browser's saved sign-in state; Semrush servers 1–3 failed, while **Server 4** was verified working. Live Volume/KD/CPC/Intent metrics were then collected across US, UK, Canada, Australia, Germany, France, Spain, Netherlands and Italy. No metrics were fabricated.
5. Reviewed current Google/SERP competitor patterns and identified the main architecture used by visible competitors: core product pages, email-extractor pages, Chrome-extension pages, export guides, use-case pages, comparison pages and substantive country pages.
6. Re-ranked target markets using live Semrush data. The United States remains the largest commercial market; Germany (320 volume / KD 18) and Spain (320 / KD 23) became immediate European quick wins; UK and Canada remain high-priority English markets; Australia is harder (110 / KD 59); Italy (170 / KD 17) became a strong future locale candidate. India and Bangladesh remain explicitly outside the campaign target set.
7. Added `SEO_WESTERN_MARKETS_ROADMAP_2026-10-02.md` with the keyword architecture, international URL/hreflang model, technical SEO work, content clusters, original-data strategy, link strategy, 90-day rollout, Semrush scoring model, KPIs and implementation guardrails.
8. No production changes, Aseel-repository changes, or fabricated keyword metrics were made in this research stage.
9. Established the current US Semrush domain baseline for `mapshunterpro.com`: Authority Score 0, Organic Traffic n/a, Organic Keywords n/a, 16 referring domains, 106 backlinks and zero AI mentions/cited pages. This confirms the site is still effectively pre-rank and needs authority/content growth, not metadata-only optimization.
10. Validated the US core query `google maps scraper` at 1,600 volume / KD 47 / $4.06 CPC / Commercial intent. Validated quick wins including `google maps email extractor` (40 / KD 23 / $5.17), `google maps scraper api` (50 / KD 24), `best google maps scraper` (70 / KD 32 / $7.03), and `google maps scraping` (320 / KD 36).
11. Validated comparison opportunities: `outscraper google maps scraper` at 170 / KD 15 / $5.91, `apify google maps scraper` at 260 / KD 29 / $4.43, and `octoparse google maps scraper` at 50 / KD 8 in the main dataset. These comparison pages now outrank the other existing competitor pages in refresh priority.
12. Corrected the export-page assumption: exact seeds such as `google maps to excel` and `google maps data export` did not return independent US keyword data. Export remains a real product benefit/support cluster, but it is no longer treated as a top-priority exact-match money page without additional SERP/GSC evidence.
13. Updated `SEO_WESTERN_MARKETS_ROADMAP_2026-10-02.md` with the validated market table, US keyword dataset, competitor quick wins, revised locale order and revised 90-day execution priority. Production `main` remains untouched by this research phase.
14. Investigated the GitHub Actions failure reported for commit `af11b96`. Root cause was a literal `\n` embedded in the `Payment and licensing regression checks` shell block, which merged two Node commands into one malformed command. Replaced it with a real newline so `tests/test_frontend_regressions.mjs` and `tests/test_seo_western_markets.mjs` run as separate CI commands.
