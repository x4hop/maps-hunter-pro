# Maps Hunter Pro — Security & SEO Audit Snapshot

**Audit date:** 2026-09-16  
**Status:** Findings recorded for later remediation. No security/SEO remediation was applied as part of this audit snapshot.  
**Repository:** `x4hop/maps-hunter-pro`  
**Scope:** Live frontend preview, Cloudflare Preview Worker, public API behavior, D1 payment settings, browser/runtime behavior, SEO metadata, localized routes, robots.txt, sitemap.xml, and selected security headers.

---

## 1. Executive summary

The current frontend has a reasonable security baseline and several good SEO foundations, but it is **not yet production-ready from a security/deployment-integrity perspective**.

The most important findings are:

1. The displayed USDT payment address is currently enabled by a browser-side preview runtime override while the D1 source of truth still has an empty `usdt_address`.
2. The live Preview Worker fetches CSS/JavaScript from the GitHub `main` branch at runtime. This creates a supply-chain/deployment-integrity risk and makes Cloudflare behavior change without a Cloudflare deployment.
3. The live Cloudflare Preview Worker has drifted from the committed `deploy/preview-worker.js` file in GitHub.
4. CSP is present and working, but is broader than necessary because it allows inline scripts/styles and broad HTTPS images.
5. Several recommended security headers are absent.
6. Localized SEO metadata is good, but localized body content is still client-side translated after load rather than fully server-rendered per language.
7. Preview canonical URLs currently point to the workers.dev origin; this needs to be revisited when the production domain is connected.

---

## 2. Security findings

### P0 / High — Payment source-of-truth mismatch

**Current state:**

- Publicly confirmed USDT TRC20 address intended for the payment page:
  - `TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS`
- Network: `TRC20`
- D1 currently stores:
  - `usdt_network = TRC20`
  - `usdt_address = ""`
- `assets/app.js` contains safety logic that rejects the same address as blocked/unverified.
- `assets/preview-runtime.js` then force-enables that address in the DOM after page load.

**Why this matters:**

The customer-visible payment address is not coming from one authoritative backend source. A payment address should never depend on a client-side override that disagrees with D1/API safety logic.

**Required remediation:**

- Decide/confirm the production USDT TRC20 address once.
- Store it in the protected backend settings/D1.
- Return it from `/api/payment-methods`.
- Remove the client-side `applyUsdt()` force override from `preview-runtime.js`.
- Remove the address from `BLOCKED_USDT_ADDRESSES` only after server-side verification.
- Make frontend payment state depend only on the API response.
- Add a regression test proving that an empty/unverified D1 address cannot be shown as payable.

---

### P0 / High — Runtime dependency on GitHub `main`

**Current live Preview Worker behavior:**

The Worker fetches preview assets dynamically from:

`https://raw.githubusercontent.com/x4hop/maps-hunter-pro/main/`

It currently exposes/uses preview endpoints similar to:

- `/__latest.css`
- `/__manual.css`
- `/__runtime.js`

with short caching.

**Why this matters:**

A change to GitHub `main` can affect the live preview without a Cloudflare deployment. If the GitHub account/repository were compromised, frontend JavaScript/CSS could change independently of Cloudflare deployment review.

**Required remediation:**

Preferred options, in order:

1. Bundle/static-store frontend assets in the Cloudflare deployment/D1 and deploy immutable code.
2. If remote GitHub assets are temporarily necessary, pin them to a specific immutable commit SHA instead of `main`.
3. Remove the remote runtime dependency before production launch.

---

### P1 / High-Medium — Cloudflare/GitHub deployment drift

The live `maps-hunter-pro-preview` Worker contains preview-asset logic that is not fully represented by the committed GitHub `deploy/preview-worker.js` source.

**Risk:**

- GitHub is documented as the source of truth, but the deployed Worker cannot currently be reproduced exactly from the committed source.
- Rollback/audit/review confidence is reduced.

**Required remediation:**

- Commit the exact intended Worker source to GitHub.
- Make deployment deterministic.
- Prefer CI/CD deployment from reviewed GitHub commits.
- Add a deployment check that compares the expected version/commit with the live Worker.

---

### P1 / Medium — CSP is active but can be tightened

Current CSP includes protections such as:

- `default-src 'self'`
- `frame-ancestors 'none'`
- `base-uri 'self'`
- `form-action 'self' https://wa.me`
- `font-src 'self' https://fonts.gstatic.com`
- `connect-src 'self'`

Positive result: during live testing, an installed browser extension attempted to inject Megabonus/Proxima Nova/SF Pro fonts from `cdn.megabonus.com`, and the page CSP blocked those requests. This confirmed that CSP enforcement is working.

**Important:** those Megabonus requests were injected by the test browser extension/environment and were **not found in Maps Hunter Pro source code**.

Current CSP is still broader than ideal because it permits:

- `script-src 'self' 'unsafe-inline'`
- `style-src 'self' 'unsafe-inline' ...`
- `img-src 'self' https: data:`

**Required remediation:**

- Move inline JavaScript into static files or use CSP nonces/hashes.
- Reduce/remove `'unsafe-inline'` for scripts first.
- Restrict image origins to known hosts.
- Self-host or explicitly restrict fonts where practical.
- Test all languages, payment modal, WhatsApp flow, and admin pages after tightening.

---

### P1 / Medium — Missing recommended response headers

Observed on the live landing page:

Present:

- `Content-Security-Policy`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

Not observed:

- `Strict-Transport-Security`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Cross-Origin-Resource-Policy`
- `X-Frame-Options`

`X-Frame-Options` is less important because CSP already uses `frame-ancestors 'none'`, but can still be used as a legacy defense-in-depth header if desired.

**Required remediation:**

- Add HSTS once production HTTPS/domain behavior is finalized.
- Add an intentionally restrictive Permissions-Policy.
- Evaluate COOP/CORP based on extension/API requirements before enabling.

---

### P1 / Medium — Public API CORS is broad

Current API response headers use:

- `Access-Control-Allow-Origin: *`
- allowed methods include `GET,POST,PATCH,OPTIONS`
- allowed headers include `content-type,authorization`

Positive result:

- Tested `/api/admin/*` endpoints without an admin bearer token returned `401`.
- Admin sessions are bearer-token protected and server-side hashed.
- Admin login is rate-limited.

**Required remediation:**

- Keep truly public endpoints public.
- Review whether wildcard CORS is required for extension endpoints.
- If possible, narrow allowed origins by endpoint class rather than using one shared CORS policy for everything.
- Add/confirm rate limiting for abuse-prone public endpoints such as license validation and usage consumption.

---

### P2 / Medium-Low — Third-party QR and font dependencies

The current frontend can use external services/resources including:

- Google Fonts
- external QR generation (`api.qrserver.com`) from payment UI code

**Risk:** privacy leakage, availability dependency, and expanded supply-chain surface.

**Required remediation:**

- Prefer generating QR locally in the browser or server-side.
- Self-host Tajawal if licensing/packaging permits.
- Keep CSP restricted to only necessary origins.

---

### P2 / Low — No security.txt

`/.well-known/security.txt` currently returns `404`.

**Recommended remediation:**

Add a minimal security contact policy before public launch so researchers know where to report vulnerabilities.

---

## 3. Positive security observations

The audit also confirmed several good controls:

- Unknown frontend routes return `404` instead of silently serving the landing page.
- Admin routes reject unauthenticated requests with `401`.
- Admin tokens are not visible in the public DOM.
- No obvious Cloudflare/API secrets were found in the rendered page.
- The browser page itself showed no application cookies.
- The only normal application localStorage key observed was `mhp_lang`.
- Admin sessions in backend code are hashed and expire.
- Request body size is limited.
- License codes are hashed server-side.
- Owner code is server-side validated and stored as a hash.
- Usage events use request IDs/idempotency controls.
- Audit logging exists for critical admin actions.

---

## 4. SEO audit findings

### Good current SEO foundations

The current landing page includes:

- `<meta name="viewport">`
- index/follow robots meta
- per-language `<title>`
- per-language meta description
- Open Graph title/description/locale
- Twitter card metadata
- canonical URL generation
- `hreflang` for:
  - `en`
  - `ar`
  - `ru`
  - `de`
  - `es`
  - `x-default`
- JSON-LD containing:
  - `SoftwareApplication`
  - `FAQPage`
  - Monthly and Annual offers
- `/robots.txt`
- `/sitemap.xml`
- one H1 on the English route
- normal 404 behavior
- language-specific HTML `lang`/`dir` attributes

The sitemap currently returns 7 URLs: five language routes plus privacy and terms.

---

### P1 / Medium — Localized body content is client-side translated

For `/ar`, the server response correctly changes:

- page title
- meta description
- canonical
- hreflang
- `html lang="ar"`
- `dir="rtl"`

However, the landing-page body/H1 source is initially English and is translated by JavaScript after load.

**Why this matters:**

Search engines can render JavaScript, but fully localized server-rendered HTML is more deterministic, more accessible to non-JS crawlers, and reduces duplicate-content ambiguity.

**Required remediation:**

- Render visible landing-page content server-side for each language route.
- Keep client-side switching for interactivity only.
- Ensure H1, headings, payment instructions, FAQ, and schema content match each language route before JavaScript executes.

---

### P1 / Medium — Canonical origin tied to current request origin

Canonical URLs are generated using the current request origin.

At present this means workers.dev pages canonicalize to workers.dev themselves.

**Required remediation before production domain launch:**

- Introduce a fixed `PUBLIC_ORIGIN`/production-site URL.
- Make canonical/hreflang/sitemap consistently use the production domain.
- Redirect workers.dev to the production domain, or mark preview routes `noindex`.
- Do not allow both workers.dev and the production domain to self-canonicalize as separate copies.

---

### P2 / Medium-Low — Missing social preview image

Not observed:

- `og:image`
- `twitter:image`

The page currently declares `twitter:card = summary_large_image`, so a real social sharing image should be supplied.

**Recommended remediation:**

- Create a branded 1200×630 social image.
- Add absolute `og:image` and `twitter:image` URLs.
- Include image width/height/type where useful.

---

### P2 / Low — Missing favicon / web app icon

No favicon link was observed in the live page.

**Recommended remediation:**

Add favicon/app icon assets and explicit `<link rel="icon">` metadata.

---

### P2 / Low — Sitemap improvements

Current sitemap works and includes all five language routes, but does not currently include:

- `<lastmod>`
- xhtml hreflang alternates inside sitemap entries

These are optional improvements rather than blocking problems.

---

## 5. Performance snapshot

A live browser test produced an approximate snapshot of:

- TTFB: ~450 ms
- DOMContentLoaded: ~864 ms
- full load: ~1.05 s
- page document transfer: ~29 KB compressed
- total observed transfer: ~166 KB in the test environment

The live runtime-loaded CSS/JS added separate network requests and hundreds of milliseconds of latency in some tests.

**Note:** requests injected by the Megabonus browser extension were excluded conceptually from Maps Hunter Pro application behavior and should not be treated as site dependencies.

---

## 6. Remediation order for the next session

When work resumes, use this order:

### Step 1 — Payment integrity

- Put the approved USDT TRC20 address into protected D1/backend settings.
- Remove the preview runtime USDT DOM override.
- Remove contradictory blocking only after server-side verification.
- Test `/api/payment-methods` and payment UI together.

### Step 2 — Deployment integrity

- Stop fetching frontend JavaScript/CSS from GitHub `main` at runtime.
- Commit the exact live Preview Worker implementation to GitHub.
- Make GitHub the reproducible source of truth again.
- Prefer immutable deployment artifacts/commit pinning.

### Step 3 — Browser security hardening

- Tighten CSP.
- Remove inline JS where possible.
- Add HSTS and Permissions-Policy when production domain behavior is ready.
- Replace remote QR generation if practical.

### Step 4 — API hardening

- Review wildcard CORS endpoint-by-endpoint.
- Extend rate limiting to abuse-prone public endpoints where appropriate.
- Re-test all admin endpoints for unauthorized access and IDOR-style issues.

### Step 5 — SEO productionization

- Server-render localized visible content.
- Set fixed production canonical origin.
- Redirect/noindex preview workers.dev.
- Add social sharing image and favicon.
- Optionally improve sitemap lastmod/hreflang.

### Step 6 — Regression verification

After fixes, repeat:

- all five language routes
- canonical/hreflang
- robots/sitemap
- schema validation
- CSP console errors
- admin unauthorized tests
- payment source-of-truth tests
- Monthly/Annual payment flow
- WhatsApp handoff
- mobile responsive checks
- extension license validation and usage accounting

---

## 7. Important context for future work

- GitHub must remain the source of truth.
- Maps Hunter Pro Cloudflare resources must remain under the Anas account only.
- Do not use resources from previous Cloudflare accounts.
- Customer flow remains manual payment + manual verification + activation code.
- Payment proof must never auto-activate a subscription.
- Security fixes must not change the extraction algorithm or silently alter licensing/usage rules.
- The current warm cream/orange Maps Hunter Pro design identity should be preserved while hardening the implementation.

---

## 8. Audit status

**Recorded:** 2026-09-16  
**Remediation status:** Pending  
**Next action when resumed:** Start with payment source-of-truth and deployment-integrity fixes before lower-priority SEO polish.
