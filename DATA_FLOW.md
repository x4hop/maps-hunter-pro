# Maps Hunter Pro data flow

Updated: 2026-09-18. This inventory must stay synchronized with the Chrome Web Store privacy form and the published privacy policy.

| Data | Source | Destination | Purpose | Retention/control |
|---|---|---|---|---|
| Public Google Maps business fields and extraction queue | User-selected Google Maps searches/results | `chrome.storage.local` | Build, resume and export business lead lists | Until Clear Results, extension data removal or uninstall |
| Public email/social links exposed directly by Google Maps listing/detail content | User-selected Google Maps results | `chrome.storage.local` | Contact qualification and export | Same as local results |
| Activation code | User/operator | Cloudflare Worker/D1 as a SHA-256 hash; raw code remains with customer | Validate product access | License lifetime / until revoked; raw customer code is not stored server-side |
| Random installation/device ID | Extension | Cloudflare Worker/D1 | Enforce one-device activation | Device binding until reset/revoke/cleanup |
| Usage request ID + accepted count | Extension | Cloudflare Worker/D1 | Daily limit + idempotency | Usage events cleaned by maintenance after 90 days; daily aggregates retained for operations |
| Standard connection/IP metadata | Browser/Cloudflare | Cloudflare edge/logging; limited audit metadata where recorded | Security, abuse prevention and operations | Subject to platform/log retention; avoid unnecessary persistence |
| Admin session hash/audit events | Admin console | D1 | Protect/administer licensing | Sessions expire; audit records retained for operations |
| Payment screenshot/transaction reference | Customer | WhatsApp/Meta chat with operator | Manual payment verification | Controlled by operator and WhatsApp/Meta chat retention |

## Current extension behavior

- No remote JavaScript or WASM is executed.
- XLSX/CSV/JSON generation is bundled and runs locally.
- The extension does not read browser history, cookies, saved passwords or unrelated tabs for profiling.
- Email extraction is Maps-only: the extension reads public email text/attributes exposed in the Google Maps listing/detail page.
- The extension does **not** open or fetch business websites for email/social enrichment.
- Lead lists are not sent to the Maps Hunter Pro licensing API.

## Permission justifications

- `storage`: local results, settings, activation data and resumable queue/runtime state.
- `scripting`: inject packaged collection/extraction code into Google Maps pages.
- `sidePanel`: primary extension interface.
- `downloads`: user-requested exports.
- `unlimitedStorage`: avoid truncating larger user-owned result sets.
- `activeTab`: operate on the user-selected current tab/workflow.
- `https://*.google.com/*`: collect and extract the user-requested Google Maps results.
- `https://mapshunterpro.com/*`: validate activation and record licensed usage against the Maps Hunter Pro API.

## Licensing/server boundary

The licensing API receives activation/device/usage fields only. It does not receive exported business names, phone numbers, websites, emails, social links, addresses or Maps result datasets.

## Legacy database note

Older account/subscription/payment/affiliate tables may still exist in D1 from previous architecture phases. The current customer production flow is manual activation-code based and does not use a website customer account/login flow.
