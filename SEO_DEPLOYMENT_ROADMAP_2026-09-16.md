# Maps Hunter Pro — SEO, Deployment & Production Roadmap

Date: 2026-09-16

## Source of truth

- `main` in `x4hop/maps-hunter-pro` is the only source of truth.
- Do not serve an old landing-page HTML blob from D1.
- Frontend production Worker: `maps-hunter-pro-preview`.
- Frontend assets: `dist/frontend` through Cloudflare Workers Static Assets.
- Backend service binding: `API -> maps-hunter-pro-api`.
- Backend Worker: `maps-hunter-pro-api`.

## Payment architecture

- Payment verification remains manual through WhatsApp.
- Binance ID and RedotPay may be managed by the backend/admin settings API.
- USDT TRC20 is a manual frontend payment method and is not published by `/api/payment-methods`.
- The public frontend contains the current manual USDT TRC20 address and QR/copy UX.
- Do not reintroduce USDT into the payment API unless the product architecture is intentionally changed later.

## Licensing architecture

- Customer plans: Monthly (30 days) and Annual (365 days).
- Every customer activation code supports exactly one device.
- The backend enforces the one-device rule; the admin UI cannot raise it.
- Existing customer licenses are normalized to `device_limit = 1` when licensing/admin routes run.
- If an older license already has multiple trusted devices, the oldest trusted binding remains and additional trusted bindings are blocked.
- Owner access remains a separate non-customer owner mechanism.

## Multilingual SEO

Target routes:

- `/en`
- `/ar`
- `/ru`
- `/de`
- `/es`

Implementation rules:

1. Build localized HTML for every supported language from the same `index.html` and the existing locale dictionaries.
2. Serve localized HTML directly from Cloudflare Static Assets so important page copy exists before client-side JavaScript runs.
3. Keep self-referencing canonical URLs per language.
4. Add reciprocal `hreflang` for all languages and `x-default -> /en`.
5. Keep `/` as a permanent redirect to `/en`.
6. Generate `robots.txt` and `sitemap.xml` from the frontend Worker.
7. Keep titles, descriptions, Open Graph metadata and Twitter metadata localized.
8. Keep one responsive HTML implementation for desktop/mobile; do not create separate mobile URLs.
9. Keep structured data focused on accurate product/software information. FAQ content can remain useful to users, but should not be treated as a Google FAQ rich-result growth tactic.
10. Avoid hidden keyword blocks, doorway pages, duplicated city pages, or search-engine-only content.

## Content growth after technical SEO

- Publish useful English-first content around Google Maps lead research, exporting Google Maps data, international phone formatting, Excel lead workflows, sales prospecting workflows, agency research and local-business research.
- Localize only pages that have real translated content and search value.
- Add internal links from educational content to the relevant product sections and language landing pages.
- Build comparison/use-case pages only where they provide unique user value rather than near-duplicate SEO pages.
- Add original screenshots, workflow examples and export examples where useful.

## Performance and UX

- Preserve the current visual identity and responsive design.
- Keep critical landing assets on Cloudflare Static Assets.
- Avoid unnecessary third-party JavaScript.
- Monitor LCP, INP and CLS after production deployment.
- Keep mobile payment controls readable and touch-friendly.

## CI/CD

Frontend:

1. Build `dist/frontend`.
2. Generate localized HTML for EN/AR/RU/DE/ES.
3. Validate Worker syntax.
4. Deploy with `deploy/wrangler.frontend.jsonc`.
5. Verify Static Assets and `API` service binding.

Backend:

1. Validate backend syntax and regression tests.
2. Deploy with `backend/wrangler.toml`.
3. Verify D1 binding and public API endpoints.

Required GitHub secret for Wrangler workflows:

- `CLOUDFLARE_API_TOKEN`

Cloudflare account:

- Account ID: `90d77a67b5686c9a9eec64a2d3749e0b`

## Production verification checklist

After every production deployment verify:

- `/en` returns English localized HTML.
- `/ar` returns Arabic HTML with `dir="rtl"`.
- `/ru` returns Russian localized HTML.
- `/de` returns German localized HTML.
- `/es` returns Spanish localized HTML.
- Canonical and hreflang annotations are present.
- `/robots.txt` is reachable.
- `/sitemap.xml` contains the five language URLs.
- `/api/health` succeeds.
- `/api/plans` returns the current Monthly/Annual commercial rules.
- `/api/payment-methods` returns Binance and RedotPay and does not publish USDT.
- Manual USDT copy/QR UI works from the frontend configuration.
- Admin generates only Monthly/Annual customer codes.
- A new customer code can bind only one device.
- A second new device receives `DEVICE_LIMIT_REACHED`.
- Frontend Worker has Static Assets and `API -> maps-hunter-pro-api`; it must not depend on D1 for landing HTML.

## Search Console follow-up

After the production URL/domain is final:

- Verify the domain/property in Google Search Console.
- Submit `/sitemap.xml`.
- Inspect `/en`, `/ar`, `/ru`, `/de`, `/es` with URL Inspection.
- Track indexing, search queries, countries, CTR and Core Web Vitals.
- Rework titles/descriptions based on real query data instead of keyword stuffing.
