# Maps Hunter Pro — Current Production Truth

Last updated: 2026-09-16

## Source of truth

- Repository: `x4hop/maps-hunter-pro`
- Branch: `main`
- `main` is the only source of truth for frontend, backend, admin and extension.
- Do not restore older D1-hosted landing HTML or older payment architecture.

## Product and plans

- Monthly: **$20 / 30 days**.
- Monthly limit: **1,500 accepted results/day**.
- Annual: **$100 / 365 days**.
- Annual: no commercial daily platform limit.
- Customer extension access uses an activation code only; no customer website login.
- Every Monthly or Annual activation code supports **exactly 1 device**.
- Owner code remains a separate owner-only mechanism.

## Manual payment model

All payment methods are manual and are published directly on the landing page:

- Binance ID: `752783284`
- USDT: TRC20 manual wallet shown on the public page
- RedotPay ID: `1831390337`

Rules:

- Payment methods do **not** come from the API.
- `/api/payment-methods` is not part of the production customer flow.
- Customer sends a payment screenshot plus transaction reference/address through WhatsApp.
- Admin verifies payment manually before issuing/renewing an activation code.
- Payment proof never auto-activates access.
- Admin settings must not be used to change payment credentials.

## Public language routes

Every language has its own indexable URL:

- English: `/en`
- Arabic: `/ar`
- Russian: `/ru`
- German: `/de`
- Spanish: `/es`

Rules:

- `/` permanently redirects to `/en`.
- Arabic uses `dir="rtl"`; all others use LTR.
- Language selection navigates to the matching URL; do not use `?lang=` as the canonical language architecture.
- Build localized HTML for every route so important translated content exists before client-side JS runs.
- Every language route has a self-referencing canonical plus reciprocal `hreflang` and `x-default`.
- All five routes appear in the sitemap.

## Frontend

- Framework-free HTML/CSS/vanilla JS.
- `index.html`: canonical landing markup/design.
- `assets/locales/*`: translated copy.
- `assets/manual-i18n.js`: localized copy overrides and presentation polish.
- `assets/i18n.js`: language routing/switching only; it must not own payment credentials.
- `assets/app.js`: manual payment rendering, plan display, WhatsApp handoff and interaction behavior.
- Preserve the current approved design and responsive layout.

## Backend

Cloudflare Worker: `maps-hunter-pro-api`

Production responsibilities:

- `GET /api/health`
- `GET /api/plans`
- `POST /api/license/validate`
- `POST /api/usage/consume`
- protected `/api/admin/*`

Payment-method data is not a backend responsibility in the current architecture.

## Licensing

- Monthly code duration: 30 days.
- Annual code duration: 365 days.
- Customer code `device_limit` is always 1.
- Backend, not frontend, enforces the one-device limit.
- Existing multi-device customer licenses are normalized to one trusted device when the licensing/admin backend runs; additional trusted device bindings are blocked.
- Admin can reset the single device binding when legitimate support requires it.

## Admin

Admin dashboard responsibilities:

- Generate Monthly or Annual activation codes.
- Show status, expiry, usage and the one-device binding.
- Extend, revoke and reset a customer's single device binding.
- Manage plan prices/limits, support details and extension release settings.
- Manage owner code separately.
- Review audit logs.

Admin does not manage payment-method credentials in the current manual-payment architecture.

## Cloudflare ownership

- Account: Anas
- Account ID: `90d77a67b5686c9a9eec64a2d3749e0b`
- Workers subdomain: `anas98gha.workers.dev`
- D1: `maps-hunter-pro`
- D1 ID: `21beb48b-da1d-4828-9a69-001fd6c798de`
- API Worker: `maps-hunter-pro-api`
- Admin Worker: `maps-hunter-pro-admin`
- Frontend Worker: `maps-hunter-pro-preview`

Frontend Worker requirements:

- Static Assets source: `dist/frontend`
- Service binding: `API -> maps-hunter-pro-api`
- No D1 binding for landing-page HTML.
- Do not use an old HTML copy stored in D1.

## CI/CD

Frontend deployment:

1. Build `dist/frontend` from `main`.
2. Generate localized `/en /ar /ru /de /es` HTML.
3. Validate Worker syntax.
4. Deploy `deploy/wrangler.frontend.jsonc`.

Backend deployment:

1. Validate backend and licensing tests.
2. Deploy `backend/wrangler.toml`.

GitHub Wrangler workflows require repository secret:

- `CLOUDFLARE_API_TOKEN`

## Launch verification

Before treating a deployment as production-ready, verify:

- `/en`, `/ar`, `/ru`, `/de`, `/es` all return their own localized HTML.
- Arabic is RTL.
- Canonical/hreflang and `/sitemap.xml` are correct.
- `/api/health` and `/api/plans` succeed.
- Frontend does not request `/api/payment-methods`.
- Binance, USDT and RedotPay values display from the frontend manual configuration.
- WhatsApp payment-proof link works.
- New Monthly/Annual codes bind to one device only.
- A second different device is rejected until admin resets the binding.
- Frontend Worker uses Static Assets and the API service binding, not D1 landing HTML.
