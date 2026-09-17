# Maps Hunter Pro — SEO & Production Roadmap

Updated: 2026-09-17

## 1. Production architecture

- `main` is the only source of truth.
- Cloudflare remains the hosting platform.
- One production Worker: `maps-hunter-pro-api`.
- One Wrangler source of truth: `wrangler.jsonc`.
- Worker entry: `deploy/unified-worker.js`.
- Static Assets source: `dist/frontend`.
- The same Worker serves the landing page, admin console and `/api/*`.
- D1 is used only for application/licensing/admin data, never landing/admin HTML.
- Cloudflare Workers Builds deploys from GitHub `main`; GitHub Actions only validates/releases.

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
- Explain only real product capabilities: structured Maps data, international phone formatting and Excel/CSV/JSON/table exports.
- Keep Monthly/Annual pricing, manual activation and one-device policy clear.
- Use natural language, not keyword stuffing.
- Keep FAQ for user clarity; do not depend on FAQ rich results as an SEO growth tactic.
- Keep SoftwareApplication/Product-style structured data accurate to the actual offer.
- Add meaningful alt text to real product screenshots.

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
- Only after verification is a Monthly or Annual activation code created or extended.

## 5. Licensing

- Monthly = 30 days, up to 1,500 accepted results/day.
- Annual = 365 days, no commercial daily platform limit.
- Every customer code supports one device only.
- Backend enforces device limit = 1.
- Admin can reset the single device binding for support cases.

## 6. Technical SEO

- Serve localized HTML directly from Workers Static Assets.
- Keep HTTP 200 for valid language pages and 301 from `/` to `/en`.
- Avoid client-only translated primary content.
- Avoid doorway pages, city-page duplication and hidden keyword text.
- Keep mobile and desktop on the same responsive URLs.
- Keep canonical URLs consistent with the request production host.
- Keep privacy/terms crawlable but low-priority in the sitemap.

## 7. Performance

- Keep critical CSS/JS small and local where possible.
- Avoid unnecessary third-party scripts.
- Monitor LCP, INP and CLS after deployment.
- Keep payment and CTA controls touch-friendly on mobile.
- Preserve the approved page aesthetics while reducing render-blocking work where safe.

## 8. Content growth plan

After technical SEO is live and indexed, build original, useful content around real user intent:

- How to extract Google Maps business leads responsibly.
- Google Maps lead research workflows for agencies.
- Exporting Google Maps results to Excel/CSV/JSON.
- International phone-number formatting in lead lists.
- Cleaning and organizing local-business prospect lists.
- Practical outreach preparation workflows using exported business data.
- Product tutorials with original screenshots and export examples.

Start with English topics based on real Search Console queries, then localize pages that have actual demand and high-quality translations.

## 9. Internal linking

- Link educational content to `/en` and relevant product sections.
- For translated content, link to the matching language landing route.
- Use descriptive anchors rather than repetitive exact-match keyword anchors.
- Keep navigation shallow so important pages are reachable within a few clicks.

## 10. Search Console rollout

After the final production host/domain is live:

1. Verify the domain/property in Google Search Console.
2. Submit `/sitemap.xml`.
3. Inspect `/en`, `/ar`, `/ru`, `/de`, `/es` individually.
4. Confirm selected canonical and hreflang behavior.
5. Track indexing, impressions, CTR, countries and Core Web Vitals.
6. Improve titles/descriptions using real query data rather than guessed keyword repetition.

## 11. CI/CD gates

Release checks validate:

- JavaScript syntax.
- Manual-payment architecture.
- One-device licensing policy.
- D1 migration chain.
- Localized HTML generation.
- Arabic RTL output.
- Admin assets included in the production Static Assets bundle.
- Wrangler unified Worker dry-run bundle.
- Extension package version from `extension/manifest.json`.

Cloudflare production deployment uses Workers Builds:

- Repository: `x4hop/maps-hunter-pro`
- Branch: `main`
- Build command: `node scripts/build-frontend-cloudflare.mjs`
- Deploy command: `npx --yes wrangler@4 deploy --config wrangler.jsonc`

No GitHub `CLOUDFLARE_API_TOKEN` is required for this architecture.

## 12. Production smoke test

After deployment verify:

- `/en`
- `/ar`
- `/ru`
- `/de`
- `/es`
- `/robots.txt`
- `/sitemap.xml`
- `/admin/`
- `/api/health`
- `/api/plans`
- frontend does not request payment credentials from an API
- Binance, USDT and RedotPay display directly from manual frontend data
- WhatsApp screenshot-verification flow works
- Monthly/Annual admin code creation works
- new activation binds to one device
- second different device is rejected until reset
- Worker serves landing/admin from Static Assets and uses D1 only for data
