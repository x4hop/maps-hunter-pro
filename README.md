# Maps Hunter Pro

Production source for the Maps Hunter Pro Chrome extension, multilingual marketing site, manual activation admin console, Cloudflare Worker and D1 licensing backend.

## Commercial rules

- Monthly: USD 20 / 30 days, up to 1,500 accepted leads per UTC day.
- Lifetime: USD 100 one-time, no expiry and no commercial daily platform limit.
- Customer activation code: exactly 1 trusted device.
- Payment: Binance ID / USDT TRC20 / RedotPay, verified manually through WhatsApp.
- There is no customer website account/login flow in the current production model.

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

- Language switching must work consistently from every localized route, including `/en`.
- The language popup is moved outside the sticky-header stacking context before opening so LTR and RTL pages behave the same.
- Every language item owns a direct click handler and navigates to the corresponding language path while preserving query string and hash.
- Regression guard: `node tests/test_language_switcher.mjs`.

## UI identity rule

- Public-site interface icons must use the shared `/assets/mhp-icons.svg` SVG sprite or another reviewed SVG asset that follows the Maps Hunter Pro identity.
- Do not use emoji, decorative Unicode symbols, placeholder letters/numbers, or symbol-font glyphs as interface icons.
- Icon styling must stay within the Paper `#F6F4F1`, Stone `#E4DED2`, Coral `#F95C4B`, and Black `#000000` identity unless a real third-party payment/service mark requires otherwise.
- Run `node tests/test_icon_system.mjs` before merging public-site icon changes.

## Database

Production upgrades are additive migrations under `backend/migrations/`; never rewrite historical migrations after deployment. `schema.sql` is a legacy reference/test fixture and is not the source of the current production schema; do not use it as a production migration command. Lifetime compatibility keeps the legacy storage `plan_id='annual'` only internally and distinguishes real Lifetime access using `is_lifetime=1` with `expires_at=NULL`.

## Extension/data model

Google Maps result/detail data and contact-enrichment results stay in `chrome.storage.local`. The extension fetches public business website pages in the background when a Maps listing has a website in order to discover public email/social links. Lead data is not uploaded to the licensing API. The licensing service receives only activation/device/usage fields required to enforce access and product limits.

Read `PROJECT.md`, `DATA_FLOW.md`, `CHROME_WEB_STORE.md`, `privacy.html`, `terms.html`, and `docs/MAPS_HUNTER_PRO_MASTER_ROADMAP_AR.md` before changing production behavior.