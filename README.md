# Maps Hunter Pro

Production source for the Chrome extension, multilingual landing page, customer account flow, admin console and Anas Cloudflare Worker/D1 backend.

## Commercial rules
- Monthly: USD 20, 1,500 saved leads per UTC day.
- Annual: USD 100, no product daily limit.
- Affiliate: 50% first confirmed purchase, 20% eligible renewals.
- Payment: manual activation through WhatsApp +218931650822.

## Release
```bash
node scripts/build.mjs
python3 tests/test_migrations.py
python3 tests/test_sql.py
python3 tests/test_manifest.py
node tests/test_xlsx.mjs
node scripts/release-extension.mjs
```
The extension ZIP contains only `extension/` files and has a generated SHA-256 and content list.

## Database
Fresh installation applies migrations in numeric order: `0001`, `0002`, `0003`, `0004`. Production upgrades are additive and must be backed up before importing. Never run `schema.sql` over production; it is a consolidated reference/test fixture.

## Privacy and store submission
Read `DATA_FLOW.md`, `CHROME_WEB_STORE.md`, `privacy.html` and `terms.html`. Business results and resumable queues remain in local extension storage. Licensing/usage sends only the documented operational fields. Website enrichment is optional and requests broad HTTPS access only after the user enables it.

## Ownership
Repository: `x4hop/maps-hunter-pro`. Cloudflare account ID: `90d77a67b5686c9a9eec64a2d3749e0b`. Do not deploy this project to any Aseel/Salah account.

