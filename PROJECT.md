# Maps Hunter Pro — Project Map & Change Log

## Current implementation status — read first
The repository is the source of truth for the landing page, admin dashboard, backend Worker, D1 schema/migrations, and Chrome extension.

## 1. Purpose
Maps Hunter Pro is a Chrome extension and web system for discovering, organizing, and exporting business leads from Google Maps. The website is the commercial entry point for pricing, payment instructions, support and manual activation-code delivery. Customer website accounts are not part of the current commercial flow.

## 2. Current commercial rules
- Monthly plan: **$20 / month**.
- Monthly daily limit: **1,500 leads/day**.
- Annual plan: **$100 / year**.
- Annual daily extraction: **Unlimited**.
- Customer payment methods: **USDT** and **RedotPay** with manual admin review.
- Affiliate commission target: **50% on first purchase** and **20% on renewals**; affiliate automation is not a launch dependency for the manual-only release.
- Renewals are handled manually using the existing activation code/customer payment record; no customer website account is required.
- The Chrome extension does **not** require customer login. It uses an activation/license code only.

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
- Font: **Tajawal** for Arabic.

Do not replace this visual system with a generic SaaS theme without an explicit decision.

## 4. Landing page decisions
The approved landing-page structure is:
1. Sticky header.
2. Chrome-extension hero with a Maps + extension mockup/screenshot.
3. How it works: install extension → activate code → search/export.
4. Feature section using only capabilities that actually exist.
5. Professional Excel preview.
6. Pricing.
7. Referral / affiliate section.
8. Manual USDT / RedotPay payment explanation.
9. FAQ.
10. Footer policies.

## 5. Language system
Supported languages:
- English (`en`)
- Arabic (`ar`)
- Russian (`ru`)
- German (`de`)
- Spanish (`es`)

Rules:
- Use the standard **globe SVG icon** in the header.
- Language choices open in a dropdown.
- Arabic uses `dir="rtl"`; all other languages use `ltr`.
- The selected language is stored in `localStorage` under `mhp_lang`.
- On first visit, browser language is used when it matches a supported language; otherwise English is the fallback.
- All visible landing-page UI strings should use `data-i18n` keys.
- Locale content lives in `assets/locales/` and switcher logic lives in `assets/i18n.js`.
- Language selection must navigate to the matching indexable route (`/en`, `/ar`, `/ru`, `/de`, `/es`).
- Each indexable language route has its own canonical, `hreflang`, Open Graph locale/title/description, and appears in the sitemap.

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
- `backend/migrations/*`

Current public API direction:
- `GET /api/health`
- `GET /api/plans`
- `GET /api/payment-methods`
- `POST /api/license/validate`
- `POST /api/usage/consume`

Legacy account/payment endpoints may remain in the Worker for compatibility, but they are not part of the current manual-only customer journey unless explicitly re-enabled later.

Admin API endpoints under `/api/admin/*` require a temporary admin session obtained using the Cloudflare `ADMIN_TOKEN` secret.

## 8. Current architecture
- Frontend: static HTML/CSS/vanilla JS.
- Backend: Cloudflare Worker.
- Database: Cloudflare D1.
- Admin dashboard: `admin/index.html` + `admin/admin.js`.
- Admin authentication: temporary secret token stored only in browser `sessionStorage`; never commit it to GitHub.
- Payment confirmation: manual USDT / RedotPay verification by admin. Uploading proof alone never activates a subscription.

## 9. Working rule for future agents
Before changing the site or backend, read this file first. After any material decision or architecture/design change, update this file in the same work session. Keep implementation and documentation synchronized.

## 10. Ownership and deployment
Maps Hunter Pro infrastructure belongs exclusively to Anas.

- GitHub: `x4hop/maps-hunter-pro`
- Cloudflare account: `Anas98gha@gmail.com's Account`
- Account ID: `90d77a67b5686c9a9eec64a2d3749e0b`
- Workers subdomain: `anas98gha.workers.dev`
- D1 database name: `maps-hunter-pro`
- D1 database ID: `21beb48b-da1d-4828-9a69-001fd6c798de`
- API Worker: `https://maps-hunter-pro-api.anas98gha.workers.dev`
- Admin Worker: `https://maps-hunter-pro-admin.anas98gha.workers.dev`
- Frontend preview Worker: `https://maps-hunter-pro-preview.anas98gha.workers.dev`

Do not deploy, read, or modify Maps Hunter Pro resources in any previous Cloudflare account.

## 11. Owner access
Anas must always be able to test the extension without a customer account.

- Owner access uses a special server-validated `MHP-OWNER-*` code.
- Owner code unlocks all extension capabilities with no daily commercial limit and no customer subscription expiry.
- The raw owner code must never be committed to GitHub or embedded in the Chrome extension.
- Only a hash is stored server-side.
- The code can be rotated from the protected admin API; rotation invalidates the previous owner code.
- Owner access does not grant admin dashboard access.

## 12. Commercial activation flow
1. Customer chooses Monthly or Annual on the landing page.
2. Customer pays manually using the published USDT or RedotPay details.
3. Customer sends the payment screenshot plus transaction reference/address through the published WhatsApp support channel.
4. Anas/admin verifies that the payment actually arrived.
5. Admin generates a Monthly or Annual activation code from the protected admin dashboard and sends it to the customer.
6. The customer pastes **only the activation code** into the extension.
7. The code starts its customer entitlement on first valid activation and the extension shows the expiry state.
8. Renewal is handled manually by extending/replacing the existing entitlement after payment verification.

No customer website account is required in this release. Payment proof alone must never auto-activate access. Admin actions and renewals must remain idempotent and auditable.

## 13. Usage accounting
- Monthly: 1,500 counted results/day.
- Annual: no platform daily commercial limit.
- Usage must count accepted unique results only.
- Duplicate rows, failed attempts, retries, and failed requests must not consume the customer allowance.
- Exact comparison tests must be run on the same search before and after licensing integration to confirm extraction speed/results are not degraded.

## 14. Customer-facing release surface
- Landing page with pricing, feature proof, payment instructions and FAQ.
- Manual USDT / RedotPay payment instructions loaded from backend settings.
- WhatsApp handoff for payment proof and support.
- Chrome extension activation-code screen showing active/expired/owner state.
- Privacy Policy, Terms, Refund and Acceptable Use pages.
- No registration/login UI for customers in the current release.

## 15. Admin target sections
- Dashboard metrics.
- Activation codes/licenses.
- Owner code management.
- Sales/product settings.
- Audit log.
- Manual payment verification remains an operational step outside automatic customer activation.

Code generation, renewals/extensions, revocation and device resets must be safe against double click/retry.

## 16. Extension UI target
- Keep Maps Hunter Pro colors and identity.
- Unified modern typography.
- Minimal search fields.
- No `Search Country` field.
- No confirmation prompt after pressing Start.
- Centered activity animation + real accepted-result counter.
- Clear Start / Stop / Resume / Export state controls.
- Main popup must fit without page scroll; long results scroll inside their own results surface.
- Sections: Search, Results, Account/License, Settings.
- License screen accepts activation code only.
- Expired subscription blocks new extraction but keeps already-saved results exportable.
- Temporary network loss must not destroy results.

## 17. Security baseline
- D1 administration endpoints require protected admin authentication.
- `ADMIN_TOKEN` is a Cloudflare Worker secret and must never be committed.
- Any legacy account passwords remain salted PBKDF2 hashes; never plaintext.
- Admin session tokens are stored server-side as hashes and expire; the browser stores the temporary admin token in `sessionStorage` only.
- Owner code is hashed server-side and is not committed.
- Audit logs cover authentication, activation, payment confirmation, entitlement/license actions and critical admin actions.
- If legacy customer-account endpoints are ever re-enabled, authorization must prevent horizontal access to other customer data.
- Backups and restoration must be tested before paid launch.

## 18. Launch gates
1. Landing page, pricing, policies and five-language SEO are production-ready.
2. Protected admin dashboard can generate, extend, revoke and inspect activation codes.
3. Owner code works with permanent test access and is never embedded in source.
4. Extension activation and usage accounting pass regression tests without changing the extraction algorithm.
5. Release ZIP builds reproducibly and passes secret/remote-code checks.
6. Chrome Web Store privacy/policy declarations match actual permissions and data behavior.
7. Live smoke test: one Monthly code, one Annual code, one Owner code, export to XLSX/CSV/JSON/Table.
8. Limited paid pilot.
9. Public launch only after pilot issues are closed.

## 19. Change log
### 2026-09-05
- Adopted the supplied landing page as the canonical design base.
- Preserved warm cream/orange Maps Hunter Pro design identity.
- Added globe language dropdown and EN/AR/RU/DE/ES localization structure.
- Split frontend into `index.html`, styles, i18n, locales, and app logic.
- Added Cloudflare Worker backend scaffold and this project map.

### 2026-09-06 — Cloudflare ownership migration
- Moved Maps Hunter Pro Cloudflare infrastructure exclusively to Anas's account.
- Established API, admin, preview Workers and D1 ownership under Anas.

### 2026-09-08 — Audit remediation
- Added deterministic migrations and additive production upgrade path.
- Added entitlement idempotency, refund/commission/payout safeguards, device controls, privacy/data-flow/store docs, extension release checks and owner access support.

### 2026-09-11 — Commercial flow locked / activation-code-only extension
- Confirmed that the Chrome extension does **not** use customer login; it accepts a license/activation code only.
- Confirmed server-side owner code for Anas with unlimited test access and no customer account requirement.
- Changed new activation requests from legacy WhatsApp/manual method to **USDT / RedotPay**.
- Added `GET /api/payment-methods` so wallet/network/account values are configured from backend settings rather than hard-coded or invented.
- Added `POST /api/payments/:paymentRef/submit` for transaction reference/proof submission; this never auto-activates a subscription.
- Preserved admin-only payment approval and duplicate external-reference protection.
- Locked launch order for the manual-only release: landing/pricing → admin codes/settings → extension activation → release checks → pilot → public launch.
- Device allowance remains intentionally undecided until Anas approves a number; do not create a new commercial device promise before that decision.

### 2026-09-12 — 8.3.1 completion
- Corrected project documentation to the current manual-only commercial flow with no customer website account requirement.
- Moved admin session tokens from persistent `localStorage` to `sessionStorage` and removed the prefilled admin username from the login page.
- Polished the admin dashboard without changing licensing behavior.
- Bumped the extension release to **8.3.1**.
- Fixed the extension release packager to use the current `panel-v2.html` / `panel-v2.js` files.
- Added CI release checks that validate JavaScript, build static pages, generate the ZIP and upload the 8.3.1 package artifact.
- Added server-side localized SEO metadata for `/en`, `/ar`, `/ru`, `/de`, `/es`, with canonical, `hreflang`, Open Graph URL and a complete sitemap.
- Root `/` now permanently redirects to `/en`; extraction logic remains unchanged.
