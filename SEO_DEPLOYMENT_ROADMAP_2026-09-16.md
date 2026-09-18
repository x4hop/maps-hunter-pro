> **2026-09-18 update:** the public Annual plan was replaced by Lifetime ($100 one-time). Any Annual wording below has been updated to the current commercial model.

# Maps Hunter Pro — SEO & Production Roadmap

Updated: 2026-09-18

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

- One clear H1 focused on Google Maps lead extraction.
- Explain only real product capabilities.
- Keep Monthly/Lifetime pricing, manual activation and one-device policy clear.
- Use natural language, not keyword stuffing.
- Keep FAQ for user clarity; do not depend on FAQ rich results as a growth tactic.
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
- Only after verification is a Monthly or Lifetime activation code created or updated.

## 5. Licensing

- Monthly = 30 days, up to 1,500 accepted results/day.
- Lifetime = $100 one-time, no expiry, no commercial daily platform limit.
- Every customer code supports one device only.
- Backend enforces device limit = 1.
- Admin can reset the single device binding for support cases.

## 6. Technical SEO

- Serve localized HTML directly from Workers Static Assets.
- Keep HTTP 200 for valid language pages and 301 from `/` to `/en`.
- Avoid client-only translated primary content.
- Avoid doorway pages, city-page duplication and hidden keyword text.
- Keep mobile and desktop on the same responsive URLs.
- Keep canonical URLs consistent with the production host.
- Keep privacy/terms crawlable but low-priority in the sitemap.
- Add every published article to routing and sitemap when required.

## 7. Performance

- Keep critical CSS/JS small and local where possible.
- Avoid unnecessary third-party scripts.
- Monitor LCP, INP and CLS after deployment.
- Keep payment and CTA controls touch-friendly on mobile.
- Preserve the approved page aesthetics while reducing render-blocking work where safe.

## 8. Content growth plan

Build original, useful content around real user intent:

- Google Maps business lead extraction.
- Business email discovery from collected businesses.
- Google Maps lead research workflows for agencies.
- Exporting Google Maps results to Excel/CSV/JSON.
- International phone-number formatting in lead lists.
- Businesses without websites.
- Local SEO / web design / B2B prospecting use cases.
- Evidence-based competitor comparisons.

Use Search Console demand to prioritize localization and updates.

## 9. Internal linking

- Link educational content to the matching language landing route and relevant product section.
- Use descriptive anchors rather than repetitive exact-match anchors.
- Keep navigation shallow.
- Give every important article at least one contextual inbound link.

## 10. Search Console rollout

1. Maintain domain verification.
2. Submit and monitor `/sitemap.xml`.
3. Inspect `/en`, `/ar`, `/ru`, `/de`, `/es`.
4. Confirm selected canonical and hreflang behavior.
5. Track indexing, impressions, CTR, countries and Core Web Vitals.
6. Improve titles/descriptions using real query data.

## 11. CI/CD gates

Release checks validate:

- JavaScript syntax including extension overrides/contact enrichment.
- Manual-payment architecture.
- Clipboard fallback and payment/currency regressions.
- Monthly/Lifetime consistency.
- One-device licensing policy.
- D1 migration chain through the newest migration.
- Manifest/permission behavior.
- Localized HTML generation.
- Arabic RTL output.
- Admin assets in production Static Assets.
- Wrangler dry-run.
- XLSX generation.
- Extension release package.

Cloudflare production deployment uses Workers Builds from `main`.

## 12. Production smoke test

After deployment verify:

- all five language routes;
- `/robots.txt` and `/sitemap.xml`;
- `/admin/`;
- `/api/health` and `/api/plans`;
- Monthly $20 / Lifetime $100 one-time;
- Binance, USDT and RedotPay rendering;
- Copy ID / Copy Address behavior;
- USDT QR;
- WhatsApp selected-plan handoff;
- Monthly/Lifetime code creation;
- one-device enforcement;
- current blog routes and sitemap entries;
- Worker serves landing/admin from Static Assets and uses D1 only for data.
