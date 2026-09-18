# Chrome Web Store submission brief

Updated: 2026-09-18

## Single purpose

User-initiated business research from Google Maps: collect public business listing data, enrich collected businesses from their public websites for business email/social links, keep results locally, and export XLSX/CSV/JSON.

## Host permissions

The current production manifest requests `http://*/*` and `https://*/*`. The reason is functional: after the user chooses Google Maps keywords/cities, the extension may fetch the public website linked by each collected business to locate public contact/about/legal pages, email addresses and social profile links. Those pages are processed in the extension service worker and are not opened as visible tabs.

Do not describe the product as Maps-only if website enrichment is enabled. Store listing, privacy policy and permission justification must all say the same thing.

## Privacy form

Disclose, as applicable:

- activation/authentication information (activation code usage);
- random installation/device identifier;
- website content processed for the user-requested business research workflow;
- product usage/diagnostic counts needed for licensing/limits.

State clearly:

- business result lists stay in local extension storage;
- Maps Hunter Pro does not upload the user's business lead dataset to its licensing server;
- public business website HTML is processed to derive public contact fields;
- payment verification is manual through WhatsApp;
- no Google endorsement is claimed.

## Reviewer access

Generate a dedicated reviewer activation code in `/admin/`; never provide the admin password. Manual payment is not required for store review. Reviewer steps: install → enter reviewer code → add keyword/city tags → Start → allow the scan/extraction to finish → inspect Results → export.

## Claims to avoid

Do not claim Google endorsement, guaranteed Chrome Web Store approval, unlimited legal rights to Google content, guaranteed availability of emails/phones, or authorization inferred from competitor behavior.

## Submission checklist

- Manifest version and release ZIP match.
- Permission justification matches actual website enrichment behavior.
- Privacy policy matches `DATA_FLOW.md`.
- One-device activation works for reviewer code.
- No remote executable JS/WASM.
- All UI is functional without developer mode assumptions.
- Payment/marketing claims use Monthly + Lifetime terminology.
