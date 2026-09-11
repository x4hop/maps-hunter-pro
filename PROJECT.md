# Maps Hunter Pro — Project Map & Change Log

Last updated: 2026-09-11

## 2026-09-11 — Owner access and platform continuation
- Owner requested a permanent activation code that works in the extension without customer registration.
- API 5.3.0-owner-platform adds a separate singleton owner_access table. Only a SHA-256 digest is stored; the actual code is never committed, bundled, logged, or returned by status endpoints.
- Owner access has no subscription expiration or daily lead cap. It still requires API connectivity. It does not confer admin permissions.
- Existing extension 8.1.4 accepts the owner code through Settings > License > Activate; no extraction-engine changes are required.
- Admin > Owner access can rotate or revoke the code. Rotation shows the new code once and invalidates the old code.
- Added admin Activation requests view and customer My orders and payments history scoped to the signed-in customer.
- Deployed frontend blobs landing-v8-owner and admin-v8-owner; earlier blobs retained for rollback.
- Preserve the registration fix: PBKDF2 iterations 100000 for new credentials, stored iteration count for verification, auth schema repair. Never deploy the stale local 5.1 backend over this version.
- Automated tests: owner validation/unlimited usage/wrong and revoked codes/admin isolation; SQL entitlement, renewal, device, daily limits; migration chain.
- Browser UI test could not run because the Chromium download timed out. Do not report a successful browser or live extraction test for this change.

### Remaining roadmap, in execution order
1. Complete account onboarding: consent recording, verified email delivery, verification and password reset. Email provider setup is required.
2. Complete manual-payment evidence workflow and customer-facing rejection reasons; reconcile receipts before approval. Current paid activation still uses WhatsApp and admin confirmation.
3. Validate the complete monthly/annual purchase, renewal and affiliate lifecycle in a real browser, including duplicate requests and failed payments.
4. Finalize affiliate attribution window, withdrawal threshold and refund rules with the owner before marketing the program.
5. Redesign extension UI using existing cream/orange palette and Tajawal, centered live counter, no Search Country, no Start permission prompt, no main-screen scroll. Preserve extraction behavior and compare before/after performance.
6. Configure final domain, email delivery and admin additional protection; verify backups and rollback; then limited paid pilot.
7. Store submission and public launch after real-device verification. A roadmap item is not complete merely because an API or mockup exists.

## 1. Purpose
Maps Hunter Pro is a Chrome extension and web system for discovering, organizing, and exporting business leads from Google Maps. The website is the commercial entry point for pricing, renewals, affiliate onboarding, and license/account management.

## 2. Current commercial rules
- Monthly plan: **$20 / month**.
- Monthly daily limit: **1,500 leads/day**.
- Annual plan: **$100 / year**.
- Annual daily extraction: **Unlimited**.
- There is **no website checkout and no payment gateway**.
- Customer flow: account registration → activation request → WhatsApp → manual payment verification → license issue.
- Activation WhatsApp: **+218931650822**.
- Affiliate commission: **50% on first purchase** and **20% on renewals**.
- Renewals use the customer's existing Maps Hunter Pro account/email.

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
7. Manual activation / WhatsApp explanation.
8. FAQ.
9. Footer policies.

### Feature section compacting
The section headed **“Everything you need to collect leads faster”** was intentionally reduced in vertical size on 2026-09-05. Cards, icons, gaps, and heading sizes were reduced so this section does not dominate the landing page.

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
- `backend/migrations/0002_auth_activation_codes.sql`
- `backend/migrations/0003_atomic_entitlements.sql`
- `backend/migrations/0004_operations_privacy.sql`

Public API direction:
- `GET /api/health`
- `GET /api/plans`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/account/me`
- `POST /api/activation/request`
- `POST /api/affiliate/register`
- `POST /api/license/validate`

Admin API endpoints under `/api/admin/*` require a temporary admin session obtained using the Cloudflare `ADMIN_TOKEN` secret. Customer affiliate statistics, payout requests, data requests, refunds and device support controls are implemented.

## 8. Current architecture
- Frontend: static HTML/CSS/vanilla JS.
- Backend: Cloudflare Worker.
- Database: Cloudflare D1.
- Admin dashboard: `admin/index.html` + `admin/admin.js`.
- Admin authentication: temporary secret token stored only in browser `sessionStorage`; never commit it to GitHub.
- Payment confirmation: manual via WhatsApp. No online checkout.

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

### 2026-09-06 — Cloudflare ownership migration
Maps Hunter Pro Cloudflare infrastructure is now assigned **exclusively** to Anas's Cloudflare account.

- Cloudflare account: `Anas98gha@gmail.com's Account`
- Account ID: `90d77a67b5686c9a9eec64a2d3749e0b`
- Workers subdomain: `anas98gha.workers.dev`
- D1 database name: `maps-hunter-pro`
- D1 database ID: `21beb48b-da1d-4828-9a69-001fd6c798de`
- D1 primary region: `WEUR`
- API Worker: `https://maps-hunter-pro-api.anas98gha.workers.dev`
- Admin Worker: `https://maps-hunter-pro-admin.anas98gha.workers.dev`
- Frontend preview Worker: `https://maps-hunter-pro-preview.anas98gha.workers.dev`
- GitHub remains: `x4hop/maps-hunter-pro`.
- **Do not deploy, read, or modify Maps Hunter Pro resources in the previous Cloudflare account.**

### D1 tables
- `users`
- `subscriptions`
- `licenses`
- `devices`
- `payments`
- `affiliates`
- `referrals`
- `commissions`
- `payouts`
- `usage_daily`
- `audit_logs`
- `settings`
- `auth_sessions`
- `activation_requests`

### Manual activation flow
1. Customer creates a Maps Hunter Pro account with email/password.
2. Customer selects Monthly or Annual.
3. Backend creates an activation request with an `ACT-*` reference and a pending manual payment record.
4. Customer is redirected to WhatsApp **+218931650822** with request ID, email, plan, and price.
5. Admin verifies payment manually in WhatsApp.
6. Admin confirms the request/payment.
7. Backend activates the subscription and generates a license code.
8. Extension validates the license against the API and binds devices according to plan rules.

### Security baseline
- D1 administration endpoints require `ADMIN_TOKEN`.
- The Admin Token is stored only as a Cloudflare Worker secret and must never be committed to GitHub.
- Passwords must be stored as salted PBKDF2 hashes; never store plaintext passwords.
- Session tokens are stored server-side as hashes and expire.
- Audit logs should cover account, activation, payment confirmation, license validation, and admin actions.

### Remaining launch gates
1. Configure verified email delivery before enabling password reset/email verification.
2. Add MFA/Cloudflare Access in front of admin and verify the direct API protection.
3. Obtain a documented decision on Google Maps content collection/export rights; store-policy work does not grant source rights.
4. Complete live Chrome, payment, reviewer and rollback tests before public paid launch.

### 2026-09-06 — Professional admin console
- Replaced the minimal admin UI with the professional Maps Hunter Pro admin console.
- Admin navigation now includes Dashboard, Activation Requests, Users, Licenses, and Payments.
- Dashboard shows live totals for users, pending activations, active licenses, and confirmed manual payments.
- Activation requests can be approved from the admin panel and issue/extend licenses through the existing API.
- Licenses and payments are read live from the same D1 database after validating the admin session against the API.
- Admin Worker bindings: service binding `API` -> `maps-hunter-pro-api`, D1 binding `DB` -> `21beb48b-da1d-4828-9a69-001fd6c798de`.
- The customer frontend and API flow are unchanged by this redesign.

### 2026-09-08 — Audit remediation 8.1.0
- Completed deterministic migrations 0001→0004 for new databases and an additive production upgrade.
- Fixed activation-plan cancellation compatibility and blocked monthly downgrade over an active annual entitlement.
- Saved unique external payment references; added idempotent refund, commission reversal, payout transitions and audit events.
- Added customer affiliate stats/payout API, data-request workflow, device block/unblock/release controls, and server-side admin pagination/search.
- Made arbitrary HTTPS access optional and tied it to the explicit website-enrichment toggle.
- Persisted usage request IDs before charging and pause/resume state on access/network failures.
- Added public-URL/redirect checks and bounded website response streaming.
- Added accurate privacy/data-flow/store-submission documents and a reproducible extension-only ZIP release with SHA-256.
- Unknown frontend/admin routes now return 404.
