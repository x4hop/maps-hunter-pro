# Maps Hunter Pro — Agent Handoff

Branch: `handoff/8.4.0-rc10-maps-first`
Source package: Maps Hunter Pro 8.4.0 RC10 MAPS-FIRST

## Scope
Continue work on the Chrome extension only. Landing page, admin, SEO and backend are considered working and should not be modified unless absolutely required for extension compatibility.

## Current extension status
- Google Maps scan works.
- Phone extraction works and international normalization is implemented.
- Stop Scan & Extract exists.
- Stop All exists and should stop collector/workers/queues while preserving completed results.
- Results tab works.
- Excel export works and uses compact Calibri formatting.
- CSV/JSON export exists.
- Activation system exists.
- Website Enrichment toggle was removed.

## Highest priority problem
Email extraction is still not reliable enough. Email + Phone are the two most important lead fields.

The desired architecture is:
1. FAST SCAN: collect all Maps business URLs/cards quickly. Do not block scanning on website visits.
2. MAPS EXTRACTION: after scan, open each business in Google Maps and extract Phone + Email + Website + address/category/rating/etc. Email must be attempted from Google Maps itself even when there is no business website.
3. WEBSITE FALLBACK: only when Maps does not provide Email and a Website exists, use the business website to fill Email/Social gaps.
4. COMPLETED only after extraction queues are actually finished.

## Important historical finding
An older working extractor searched the full Google Maps place text for email using an email regex. That allowed email extraction even for leads with no Website. Later revisions over-focused on Website enrichment and lost this behavior.

RC10 restores a Maps-first approach and attempts email from:
- visible page text
- mailto links
- relevant DOM attributes
- Google Maps internal page data such as `APP_INITIALIZATION_STATE`, with safeguards to avoid unrelated Google-account emails

Website fallback is secondary, not the main source.

## Do not regress
- Do not break phone extraction while changing email logic.
- Do not change Excel unless directly required.
- Do not re-add the Website Enrichment toggle.
- Do not ask for runtime website permission on Start.
- Do not add a visible country field to Search.
- Keep UI compact; no unnecessary scrolling.
- Do not merge to `main` until tested.

## Regression checklist before release
- Search keyword + city
- Maps scan/scroll
- Stop Scan & Extract
- Stop All
- Phone extraction
- International phone output (+218, +49, +1 sample checks)
- Email extraction from Maps when Website is absent
- Email extraction from website fallback when Website exists
- Facebook/Instagram extraction when present
- No duplicate leads
- Results tab
- Excel non-empty and correct
- CSV/JSON
- Activation
- Closing/reopening panel does not lose active state

## Recommended test searches
- Restaurants — Tripoli, Libya
- Dentists — Berlin, Germany
- Plumbers — Miami, USA

For email testing, manually compare a sample of businesses to their Google Maps place details and website/contact pages when available.

## Release discipline
Work on this branch or a child branch. Create a new RC for each isolated fix. Do not overwrite stable/main until the extension passes the regression checklist.
