# Maps Hunter Pro — Chrome Web Store brief

## Single purpose

User-initiated business research from Google Maps: collect public business listing data, fetch the official public website linked by a selected Maps result when available to discover public business email/social links, keep results locally, and export XLSX/CSV/JSON.

## Host permissions

Stable v1.1.0 requests `http://*/*` and `https://*/*` because official websites attached to user-selected Maps results can be hosted on arbitrary public domains. Those pages are fetched in the extension service worker and are never opened as visible enrichment tabs.

The permission is used for the user-initiated Maps research/enrichment workflow and `mapshunterpro.com` licensing calls; it is not used for general browsing surveillance.

## Data handling

Lead data stays in `chrome.storage.local`. The licensing API receives activation/device/usage fields only; it does not receive the user's lead list.

## Remote code

No remote JavaScript or WASM is executed. Extraction, export and UI code is packaged with the extension. Public website HTML is treated as data only.

Before store submission, the privacy form and host-permission justification must explicitly disclose public website enrichment.
