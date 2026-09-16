# Maps Hunter Pro — SEO & Production Roadmap

Date: 2026-09-16

## 1. Production architecture

- `main` is the only source of truth.
- Current landing page design is preserved.
- Frontend is deployed as Cloudflare Workers Static Assets from `dist/frontend`.
- Frontend Worker: `maps-hunter-pro-preview`.
- Backend service binding: `API -> maps-hunter-pro-api`.
- Landing HTML must not come from D1.

## 2. Language SEO structure

Indexable routes:

- `/en`
- `/ar`
- `/ru`
- `/de`
- `/es`

Implementation:

- Generate localized HTML at build time for every language.
- `/` permanently redirects to `/en`.
- Arabic HTML uses `dir="rtl"`.
- Language picker navigates to the language URL instead of only changing local JavaScript state.
- Add a self-canonical to every language page.
- Add reciprocal `hreflang` links for EN/AR/RU/DE/ES plus `x-default -> /en`.
- Publish all five routes in `sitemap.xml`.
- Publish `robots.txt` with the sitemap URL.
- Localize title, meta description, Open Graph and Twitter metadata.

## 3. On-page SEO

Keep the visual layout unchanged while improving meaning and crawlability:

- One clear H1 focused on Google Maps lead extraction.
- Explain real product capabilities only: structured Maps data, international phone formatting and Excel/CSV/JSON/table exports.
- Keep Monthly/Annual pricing, manual activation and one-device policy clear.
- Use natural language, not keyword stuffing.
- Keep FAQ for user clarity; do not depend on FAQ rich results as an SEO growth tactic.
- Keep SoftwareApplication/Product-style structured data accurate to the actual offer.
- Add meaningful alt text when real product screenshots are added.

## 4. Manual payment architecture

All payment methods are manual frontend content:

- Binance ID
- USDT TRC20
- RedotPay ID

Rules:

- Do not fetch payment methods from the API.
- Do not expose payment credentials in admin settings.
- Customer sends screenshot + transaction reference/address through WhatsApp.
- Admin verifies the payment manually.
- Only after verification is a Monthly or Annual activation code created/extended.

## 5. Licensing

- Monthly = 30 days, up to 1,500 accepted results/day.
- Annual = 365 days, no commercial daily platform limit.
- Every customer code supports one device only.
- Backend enforces device limit = 1.
- Admin can reset the single device binding for support cases.

## 6. Technical SEO

- Serve localized HTML directly from Static Assets.
- Keep HTTP 200 for valid language pages and 301 from `/` to `/en`.
- Avoid client-only translated primary content.
- Avoid doorway pages, city-page duplication and hidden keyword text.
- Keep mobile and desktop on the same responsive URLs.
- Keep canonical URLs consistent with final production host.
- Ensure privacy/terms remain crawlable but low-priority in sitemap.

## 7. Performance

- Keep critical CSS/JS small and local where possible.
- Avoid unnecessary third-party scripts.
- Monitor LCP, INP and CLS after production deployment.
- Keep payment and CTA controls touch-friendly on mobile.
- Preserve the approved page aesthetics while reducing render-blocking work where safe.

## 8. Content growth plan

After technical SEO is live and indexed, build high-value content around real user intent:

- How to extract Google Maps business leads responsibly.
- Google Maps lead research workflows for agencies.
- Exporting Google Maps results to Excel/CSV/JSON.
- International phone-number formatting in lead lists.
- Cleaning and organizing local-business prospect lists.
- Practical outreach preparation workflows using exported business data.
- Product tutorials with original screenshots and export examples.

Start with English pages based on real Search Console queries, then localize pages that have actual search demand and quality translations.

## 9. Internal linking

- Link educational content to `/en` and relevant product sections.
- For translated articles, link to the matching language landing route.
- Use descriptive anchors rather than repetitive exact-match keyword anchors.
- Keep navigation shallow so important pages are reachable within a few clicks.

## 10. Search Console rollout

After final production host/domain is confirmed:

1. Verify the domain/property in Google Search Console.
2. Submit `/sitemap.xml`.
3. Inspect `/en`, `/ar`, `/ru`, `/de`, `/es` individually.
4. Confirm selected canonical and hreflang behavior.
5. Track indexing, impressions, CTR, countries and Core Web Vitals.
6. Improve titles/descriptions using real query data rather than guessed keyword repetition.

## 11. CI/CD gates

Release checks must validate:

- JavaScript syntax.
- Manual-payment architecture.
- One-device licensing policy.
- Localized HTML generation.
- Arabic RTL output.
- Extension packaging using the version from `extension/manifest.json`.

Frontend deploy:

- Build `dist/frontend`.
- Deploy using `deploy/wrangler.frontend.jsonc`.

Backend deploy:

- Deploy using `backend/wrangler.toml`.

Wrangler GitHub workflows require `CLOUDFLARE_API_TOKEN`.

## 12. Production smoke test

After deployment verify:

- `/en`
- `/ar`
- `/ru`
- `/de`
- `/es`
- `/robots.txt`
- `/sitemap.xml`
- `/api/health`
- `/api/plans`
- `/api/payment-methods` returns `PAYMENTS_MANUAL_ONLY` and the frontend does not use it.
- Binance, USDT and RedotPay display directly from manual frontend data.
- WhatsApp screenshot-verification flow works.
- Monthly/Annual admin code creation works.
- New activation binds to one device.
- Second different device is rejected until reset.
- Cloudflare frontend Worker has Static Assets and `API -> maps-hunter-pro-api` with no D1 landing HTML dependency.
