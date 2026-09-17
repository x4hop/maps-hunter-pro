# Maps Hunter Pro — Cloudflare Native Build

This repository uses one Cloudflare Worker as the production application.

## Production Worker

- Worker name: `maps-hunter-pro-api`
- Repository: `x4hop/maps-hunter-pro`
- Production branch: `main`
- Wrangler config: `/wrangler.jsonc`
- Worker entry: `/deploy/unified-worker.js`
- Static assets: `/dist/frontend`
- D1 binding: `DB`
- D1 database: `maps-hunter-pro`

The same Worker serves:

- `/en`
- `/ar`
- `/ru`
- `/de`
- `/es`
- `/admin/`
- `/api/*`
- `/robots.txt`
- `/sitemap.xml`

The old `maps-hunter-pro-preview` and `maps-hunter-pro-admin` Workers are legacy resources and should be deleted only after the unified Worker has passed production smoke tests.

## Workers Builds configuration

Use Cloudflare Workers Builds GitHub integration, not GitHub Actions deployment tokens.

- Git provider: GitHub
- Repository: `x4hop/maps-hunter-pro`
- Production branch: `main`
- Root directory: `/`
- Build command: `node scripts/build-frontend-cloudflare.mjs`
- Deploy command: `npx --yes wrangler@4 deploy --config wrangler.jsonc`
- Non-production branch builds: optional/off for production simplicity

Cloudflare Workers Builds creates and manages its deployment token inside Cloudflare, so this repository does not require a `CLOUDFLARE_API_TOKEN` GitHub secret.

## Production architecture rules

1. `main` is the only source of truth.
2. Landing HTML is never stored in D1.
3. Static frontend and admin files are built into `dist/frontend`.
4. `/api/*` runs the backend code directly in the same Worker.
5. D1 is only for application data, licensing, usage and admin state.
6. Payment methods are manual frontend content; payment credentials are not served by the API.
7. Monthly and Annual activation codes are limited to one device by backend enforcement.
8. The extension keeps using `https://maps-hunter-pro-api.anas98gha.workers.dev` so installed versions remain compatible.

## Safe reset order

When Cloudflare control-plane access is available:

1. Export/backup D1 before destructive changes.
2. Deploy the unified `maps-hunter-pro-api` Worker from `main` using Workers Builds.
3. Verify `/api/health`, `/api/plans`, all language routes and `/admin/`.
4. Verify one-device activation behavior against D1.
5. Delete legacy Workers `maps-hunter-pro-preview` and `maps-hunter-pro-admin`.
6. Remove any remaining legacy Maps Hunter Pages/build resources only after confirming they are unused.
7. Keep only the unified Worker plus its required D1 database.

Do not delete the production D1 before a verified backup exists.
