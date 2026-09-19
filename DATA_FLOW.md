# Maps Hunter Pro data flow

Updated: 2026-09-19. This inventory must stay synchronized with the Chrome Web Store privacy form and published privacy policy.

| Data | Source | Destination | Purpose | Retention/control |
|---|---|---|---|---|
| Public Google Maps business fields and extraction queue | User-selected Google Maps searches/results | `chrome.storage.local` | Build, resume and export lead lists | Until Clear Results, extension data removal or uninstall |
| Public business website HTML | Official website linked by a selected Maps result | Processed transiently in the extension service worker | Discover public business email/social links | Raw pages are not intentionally persisted |
| Derived public email/social links | Google Maps + official public website | `chrome.storage.local` | Contact qualification and export | Same as local lead results |
| Activation code | User/operator | Cloudflare Worker/D1 as SHA-256 hash | Validate product access | License lifetime / until revoked |
| Random installation/device ID | Extension | Cloudflare Worker/D1 | Enforce one-device activation | Until reset/revoke/cleanup |
| Usage request ID + accepted count | Extension | Cloudflare Worker/D1 | Daily limit + idempotency | Usage events cleaned after 90 days |

## Current stable extension behavior — v1.1.0

Google Maps details are extracted and saved first. When Maps supplies an official website, enrichment runs asynchronously in the service worker with no visible business-website tabs. The fast pass checks homepage + `/contact` + `/contact-us`; bounded deeper fallbacks run only when needed. Enrichment is limited to 5 concurrent website jobs and up to 12 pages per site. Final completion waits for pending enrichment tasks. Lead lists are never sent to the licensing API.

`http://*/*` and `https://*/*` are required for Maps, licensing, and public official business websites selected through the user-requested workflow.
