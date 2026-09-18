# Maps Hunter Pro — Chrome Web Store brief

## Single purpose

User-initiated business research from Google Maps: collect public business listing data, keep results locally, and export XLSX/CSV/JSON. When Google Maps itself exposes a public email address, the extension can include it in the saved result.

## Host permissions

The production manifest is intentionally limited to Google Maps/Google pages used by the extraction workflow plus `mapshunterpro.com` for activation and usage validation.

- `https://*.google.com/*`: collect and extract the user-requested Google Maps results.
- `https://mapshunterpro.com/*`: license validation and usage accounting.

The extension does **not** open or fetch business websites to search for emails or social profiles, so broad `http://*/*` / `https://*/*` host access is not required.

## Data handling

The extension processes:
- public Google Maps business fields selected by the user;
- public email/social data only when exposed directly in the selected Google Maps listing/detail content;
- local queue/runtime state needed to resume extraction;
- activation/device/usage identifiers required for licensing.

Business result data stays in `chrome.storage.local` and is not uploaded to the licensing API. The licensing API receives only activation/device/usage fields.

## Remote code

No remote JavaScript or WASM is executed. Extraction, export and UI code is packaged with the extension.

## Review notes

Do not claim Google endorsement, guaranteed Chrome Web Store approval, unlimited legal rights to Google content, guaranteed availability of emails/phones, or authorization inferred from competitor behavior.

Before store submission verify:
- Manifest permissions match the Maps-only behavior.
- Privacy policy says business websites are not fetched for enrichment.
- Activation and one-device policy work.
- Maps scan/extraction and XLSX/CSV/JSON exports work.
