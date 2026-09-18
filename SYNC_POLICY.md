# Maps Hunter Pro synchronization policy

Cloudflare production is the canonical release store. GitHub `main/extension` must be an exact mirror of the current production ZIP.

Current production metadata is published at:
- https://mapshunterpro.com/release.json
- https://mapshunterpro.com/downloads/latest.zip

Rules:
1. Never publish a new extension version until the complete ZIP is stored in Cloudflare and its SHA-256 is recorded.
2. GitHub `main/extension` is synchronized from that verified production ZIP.
3. The sync workflow runs on every push to `main`, manually, and every 15 minutes as a drift safety net.
4. Any obsolete temporary release/upload mechanism must be removed after a release is finalized.
5. Production version, download URL, and SHA-256 must always refer to the same artifact.

Current canonical release: 8.4.7 EMAIL-FIRST.
