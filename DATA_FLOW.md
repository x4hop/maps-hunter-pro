# Maps Hunter Pro data flow

Updated: 2026-09-08. This inventory must match the Chrome Web Store privacy form and published policy.

| Data | Source | Destination | Purpose | Retention/control |
|---|---|---|---|---|
| Public business fields and extraction queue | User-selected Maps pages | `chrome.storage.local` only | Organize and export | Until Clear Results, data removal, or uninstall |
| Public email/social links | Business websites after optional permission | Local extension storage | Optional enrichment | Same as results; permission can be revoked |
| License, installation ID, request ID, count | Extension | Anas Cloudflare Worker/D1 | Access, limits, idempotency | Raw events cleaned after 90 days |
| OS/browser label and IP | Browser/Cloudflare | Anas Cloudflare D1 | Device support and security | Device lifetime; IP minimized by maintenance |
| Name, email, password hash/salt, sessions | Website account | Anas Cloudflare D1 | Authentication | Account lifetime; sessions expire |
| Plan, payment, commissions, payouts | User/admin workflow | Anas Cloudflare D1 | Activation and reconciliation | Financial retention as necessary; identity minimized on deletion |
| Referral/UTM | Landing page | Anas Cloudflare D1 after registration | Attribution | Account lifecycle or deletion request |
| Activation/support message | User | WhatsApp/Meta | Manual activation/support | Controlled by WhatsApp/Meta and user chat |

No remote JavaScript or WASM is executed. XLSX/CSV/JSON generation is bundled locally. No browsing history, cookies or visited-site passwords are read.

## Permission justifications
- `storage`: local results, settings, license and resumable work.
- `scripting`: packaged collector in user-selected Maps tabs.
- `sidePanel`: product interface.
- `downloads`: user-requested exports.
- `unlimitedStorage`: avoid silently truncating larger user-owned result sets.
- Maps origins: core operation; Anas API origin: licensing and limits.
- `https://*/*`: disclosed at installation and used only when website enrichment is enabled; no permission prompt appears after Start Search.
