# Maps Hunter Pro — Current Stable Release

## Approved stable baseline

- **Extension version:** `1.1.1`
- **Status:** CURRENT STABLE / APPROVED FOR CUSTOMER DISTRIBUTION
- **Approved date:** 2026-09-19
- **Reference tested archive SHA-256:** `e1ea5cc773af3805d4e9a1e520c5e841521a92a93e15697ce64ed438b031ba26`

This is the current known-good functional baseline. The email extraction workflow was tested by the operator on real result sets and confirmed working as expected. Automated checks cover JavaScript syntax, package structure, contact extraction behavior and XLSX export.

Stable behavior: Google Maps collection/detail extraction, 1–8 Maps workers, licensed usage consumption per accepted lead, Maps data saved first, asynchronous public business website enrichment without visible website tabs, fast homepage + /contact + /contact-us pass, bounded deeper fallback, waiting for pending enrichment before completion, XLSX/CSV/JSON export, live license validation, and one-device customer codes.

Deferred hardening is documented in `CLOUDFLARE_SECURITY_ROADMAP_AR.md`: atomic D1 daily-limit enforcement and later migration of website enrichment to a dedicated Cloudflare Worker with short-lived licensed sessions and SSRF protections.

Until those phases are deliberately implemented and verified, **v1.1.1 is the current stable release; v1.1.0 remains the previous rollback baseline**.

## v1.1.1 hotfix

Adds licensing API network failover between the apex and www custom domains. It retries only transport failures/timeouts; server-side license decisions such as expiry, revocation, device limit and daily limit are never bypassed. Extraction and enrichment behavior are unchanged from v1.1.0.
