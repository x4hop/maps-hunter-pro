# Maps Hunter Pro — Current Production Truth

Last updated: 2026-09-17

## Source of truth

- Repository: `x4hop/maps-hunter-pro`
- Branch: `main`
- `main` is the only source of truth for frontend, backend, admin and extension.
- Do not restore older D1-hosted landing/admin HTML.
- Do not restore the old split frontend/API/admin deployment architecture.

## Product and plans

- Monthly: **$20 / 30 days**.
- Monthly limit: **1,500 accepted results/day**.
- Annual: **$100 / 365 days**.
- Annual: no commercial daily platform limit.
- Customer extension access uses an activation code only; no customer website login.
- Every Monthly or Annual activation code supports **exactly 1 device**.
- Owner code remains a separate owner-only mechanism.

## Manual payment model

All payment methods are manual and published directly on the landing page:

- Binance ID: `752783284`
- USDT: manual TRC20 wallet shown on the public page
- RedotPay ID: `1831390337`

Rules:

- Payment methods do **not** come from the API.
- Customer sends a payment screenshot plus transaction reference/address through WhatsApp.
- Admin verifies payment manually before issuing or renewing an activation code.
- Payment proof never auto-activates access.
- Admin settings are not the source of payment credentials.

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
- Build localized HTML for every route so important translated content exists before client-side JavaScript runs.
- Every language route has a self-referencing canonical plus reciprocal `hreflang` and `x-default`.
- All five routes appear in the sitemap.

## Unified Cloudflare production architecture

Cloudflare remains the hosting platform for the complete product.

Production Worker:

- Worker name: `maps-hunter-pro-api`
- Workers.dev host: `https://maps-hunter-pro-api.anas98gha.workers.dev`
- Entry point: `deploy/unified-worker.js`
- Wrangler source of truth: `wrangler.jsonc`
- Static Assets: `dist/frontend`
- D1 binding: `DB`
- D1 database: `maps-hunter-pro`

The same Worker serves:

- landing page and language routes
- static assets
- `/admin/`
- `/api/*`
- `/robots.txt`
- `/sitemap.xml`

There is no Service Binding between separate frontend and API Workers in the new architecture. Landing/admin HTML is not read from D1.

Legacy Cloudflare resources to remove after successful unified deployment:

- `maps-hunter-pro-preview`
- `maps-hunter-pro-admin`
- any old Maps Hunter Pages/build resources that are confirmed unused

Never delete the production D1 until a verified backup/export exists.

## Cloudflare ↔ GitHub deployment

Use Cloudflare Workers Builds native GitHub integration.

- Repository: `x4hop/maps-hunter-pro`
- Production branch: `main`
- Root directory: `/`
- Build command: `node scripts/build-frontend-cloudflare.mjs`
- Deploy command: `npx --yes wrangler@4 deploy --config wrangler.jsonc`

Do not use GitHub Actions with `CLOUDFLARE_API_TOKEN` for production deployment. The old token-based deployment workflows were removed.

## Frontend

- Framework-free HTML/CSS/vanilla JS.
- `index.html`: canonical landing markup/design.
- `assets/locales/*`: translated copy.
- `assets/manual-i18n.js`: localized copy overrides and presentation polish.
- `assets/i18n.js`: language routing/switching only; it must not own payment credentials.
- `assets/app.js`: manual payment rendering, plan display, WhatsApp handoff and interaction behavior.
- Preserve the approved design and responsive layout.

## Backend

Backend code:

- `backend/src/index.js`
- `backend/src/entry.js`

Production responsibilities:

- `GET /api/health`
- `GET /api/plans`
- `POST /api/license/validate`
- `POST /api/usage/consume`
- protected `/api/admin/*`

Payment-method data is not a backend responsibility.

## Licensing

- Monthly code duration: 30 days.
- Annual code duration: 365 days.
- Customer code `device_limit` is always 1.
- Backend, not frontend, enforces the one-device limit.
- Existing multi-device customer licenses are normalized to one trusted device when the licensing/admin backend runs; additional trusted device bindings are blocked.
- Admin can reset the single device binding when legitimate support requires it.

## Admin

Admin URL in the unified Worker:

- `/admin/`

Admin responsibilities:

- Generate Monthly or Annual activation codes.
- Show status, expiry, usage and the one-device binding.
- Extend, revoke and reset a customer's single device binding.
- Manage plan prices/limits, support details and extension release settings.
- Manage owner code separately.
- Review audit logs.

Admin does not manage payment-method credentials.

## Extension compatibility

The extension continues to call:

`https://maps-hunter-pro-api.anas98gha.workers.dev`

Keeping the unified Worker name as `maps-hunter-pro-api` preserves compatibility with installed extension builds while moving the landing page and admin into the same production Worker.

## CI

GitHub Actions is validation/release packaging only. It does not deploy Cloudflare.

Release checks validate:

- JavaScript syntax
- manual-payment architecture
- one-device licensing policy
- migration chain
- localized EN/AR/RU/DE/ES HTML generation
- Arabic RTL output
- admin static asset generation
- extension release packaging

## Production verification

Before considering a deployment complete, verify:

- `/en`, `/ar`, `/ru`, `/de`, `/es`
- `/robots.txt`
- `/sitemap.xml`
- `/admin/`
- `/api/health`
- `/api/plans`
- Binance, USDT and RedotPay display directly from frontend manual data
- WhatsApp payment-proof flow
- new Monthly and Annual codes bind to one device only
- second different device is rejected until admin resets the binding
- landing/admin HTML is served from Static Assets and not D1

## Safe Cloudflare cleanup order

1. Export/backup the current D1 database.
2. Deploy and verify the unified `maps-hunter-pro-api` Worker from `main`.
3. Confirm extension/API compatibility.
4. Delete legacy `maps-hunter-pro-preview` and `maps-hunter-pro-admin` Workers.
5. Delete only other Maps Hunter Cloudflare resources confirmed unused.
6. Keep the unified Worker and the required D1 database as the production system.
