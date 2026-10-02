# Maps Hunter Pro — Western Markets SEO Roadmap

**Created:** 2026-10-02  
**Branch:** `seo-western-markets-v1`  
**Status:** Research / planning only — no production SEO changes have been deployed from this branch yet.

## 1. Goal

Build Maps Hunter Pro into a topical authority for Google Maps lead extraction and B2B prospecting, with organic acquisition focused on:

1. United States
2. United Kingdom
3. Canada
4. Australia
5. Germany
6. France
7. Spain / Netherlands only after keyword data validates the opportunity

India and Bangladesh are **not target markets** for this program. We will not create India/Bangladesh landing pages, keyword clusters, outreach campaigns, or geo-targeted content. Organic Google results cannot be cleanly hard-excluded by country through normal SEO, so the strategy is to strongly bias relevance, hreflang, content, examples, links, and rank tracking toward the target markets rather than using IP-based SEO tricks.

## 2. Research status

### Semrush / Noxtool

The requested browser workflow was followed: browser access was used only for Noxtool / Semrush. The current Noxtool session was logged out and the Semrush proxy session returned an expired-session state, so no Volume, KD%, CPC, or traffic numbers are recorded in this roadmap yet. We must not invent those numbers.

When the Noxtool session is active again, validate every shortlisted keyword in these databases:

- US
- UK
- Canada
- Australia
- Germany
- France
- Spain / Netherlands as secondary validation

Collect for each keyword:

- Search volume
- Keyword Difficulty
- CPC
- Intent
- SERP features
- Ranking competitors
- Traffic potential / keyword variations
- Country-specific differences

### WorthAndWhy / Aseel reference

Both requested GitHub connectors were used in read-only mode. No repository exposed to those connectors is literally named `worthandwhy`, and direct lookup of `aseel90/worthandwhy` returned 404. No Aseel repository was modified. Do not claim that the WorthAndWhy implementation was reviewed until the exact repository/project becomes accessible.

## 3. Current Maps Hunter Pro SEO baseline

Existing strengths:

- Build-time localized HTML
- Existing routes: `/en`, `/ar`, `/ru`, `/de`, `/es`
- Self-canonical / hreflang infrastructure
- Sitemap and robots support
- Structured data foundation
- Existing blog
- Existing comparison pages
- Clear product fit for lead generation, Google Maps extraction, email enrichment and Excel/CSV export

Current gaps for the Western-market goal:

- One generic English page currently serves the US, UK, Canada and Australia.
- No `en-US`, `en-GB`, `en-CA`, or `en-AU` targeting.
- Generic English hero/example currently leans on Berlin, not a US-first commercial example.
- France is not currently represented as a localized market.
- JSON-LD is not fully localized/region-aware across all rendered variants.
- Sitemap content is maintained too manually for the scale of pages planned.
- Existing blog depth is too small to build authority in a competitive Google Maps scraping niche.
- There are few dedicated money pages for high-intent queries such as Chrome extension, email extractor, and Google Maps-to-Excel.
- No substantial country-specific content for the primary markets.

## 4. Keyword architecture — provisional until Semrush validation

### Tier A — core commercial queries

These should receive dedicated money pages or the strongest product pages:

- google maps scraper
- google maps lead scraper
- google maps lead extractor
- google maps lead generator
- google maps lead generation tool
- google maps business scraper
- google maps business data extractor
- google maps scraper chrome extension
- google maps email extractor
- google maps email scraper
- google maps scraper with emails
- google maps scraper with email and phone
- google maps contact extractor
- google maps to excel
- google maps to csv
- extract google maps leads to excel
- google maps scraper no code
- google maps scraper without api

### Tier B — informational / problem-solving queries

- how to scrape google maps
- how to scrape google maps for leads
- how to extract business leads from google maps
- how to extract emails from google maps
- how to export google maps results to excel
- how to export google maps results to csv
- find businesses without websites on google maps
- google maps lead generation guide
- google maps prospecting guide

### Tier C — use-case queries

- google maps scraper for lead generation agencies
- google maps scraper for local seo agencies
- google maps scraper for web design agencies
- google maps scraper for cold email research
- google maps scraper for b2b sales
- google maps scraper for cold calling
- google maps scraper for market research

### Tier D — geo-commercial queries

- google maps scraper usa
- google maps scraper united states
- google maps scraper uk
- google maps scraper canada
- google maps scraper australia
- google maps scraper germany
- google maps scraper france

Do not create thin city pages such as dozens of near-identical “Google Maps Scraper New York / Chicago / Dallas” pages. Country pages must be genuinely useful and different.

## 5. Competitor pattern observed in current SERPs

The strongest visible pattern is not “one homepage ranks for everything.” Competitors build several page types:

- Product / money pages for Google Maps scraper
- Dedicated Google Maps Email Extractor pages
- Dedicated Chrome Extension pages
- Google Maps to Excel / CSV guides
- Agency and sales use-case pages
- Country-specific guides
- Comparison pages
- Data/research content

Several competitors also create substantial country pages with local examples, postcode/ZIP context, compliance notes, and original data. This is the pattern Maps Hunter Pro should emulate structurally without copying competitor wording or data.

## 6. International URL architecture

Recommended architecture:

- `/en/` — generic English / x-default
- `/us/` — United States, hreflang `en-US`
- `/uk/` — United Kingdom, hreflang `en-GB`
- `/ca/` — Canada, hreflang `en-CA`
- `/au/` — Australia, hreflang `en-AU`
- `/de/` — Germany, hreflang `de-DE`
- `/fr/` — France, hreflang `fr-FR`
- `/es/` — Spain, hreflang `es-ES`

Keep `/en/` as the generic English page and x-default rather than forcing all English users into a regional route.

Every regional page must have:

- self-referencing canonical
- reciprocal hreflang cluster
- unique title
- unique description
- unique H1
- unique examples
- unique FAQs
- meaningful regional content
- local terminology
- internal links into feature and use-case clusters

Do not perform SEO content switching based on visitor IP and do not automatically redirect Googlebot by geography.

## 7. Regional page content standard

A country page is publishable only when it contains unique value. Required blocks:

- Country-specific headline and search intent
- Realistic local example search
- ZIP/postcode/postal-code explanation where relevant
- Business categories that fit that market
- Phone-number formatting examples
- Local workflow examples
- Local outreach/compliance overview linking to authoritative sources
- Screenshots or product workflow
- Country-specific FAQ
- Original aggregate Maps Hunter Pro benchmark when available
- Links to relevant use-case and feature pages

The goal is to avoid doorway pages and create genuine local resources.

## 8. High-intent landing pages

Build a small number of strong feature pages before expanding the blog:

- `/google-maps-lead-extractor/`
- `/google-maps-scraper-chrome-extension/`
- `/google-maps-email-extractor/`
- `/google-maps-to-excel/`
- `/google-maps-scraper-for-lead-generation-agencies/`
- `/google-maps-scraper-for-local-seo-agencies/`
- `/google-maps-scraper-for-web-design-agencies/`
- `/google-maps-scraper-for-b2b-sales/`

Avoid separate pages whose intent is almost identical. For example, “with emails,” “email scraper,” and “email extractor” must be mapped carefully so they do not cannibalize each other.

## 9. Content clusters

### Cluster A — Google Maps scraping

Pillar: Complete Google Maps Scraping / Lead Generation Guide.

Support content:

- How to scrape Google Maps without code
- Google Maps scraper vs API
- Chrome extension workflow
- How to scrape Google Maps for leads
- How many results can you extract
- How to deduplicate Google Maps results

### Cluster B — email and contact discovery

Pillar: Google Maps Email Extractor Guide.

Support content:

- How emails are discovered from official business websites
- Homepage vs contact/about/imprint discovery
- Why some businesses have no public email
- Business email quality / generic inboxes
- Email and social-link enrichment workflow

Never claim “verified email” unless Maps Hunter Pro actually performs verification.

### Cluster C — export and workflow

Pillar: Google Maps to Excel / CSV.

Support content:

- Excel workflow
- CSV workflow
- JSON workflow
- Phone normalization
- Deduplication
- CRM import preparation

### Cluster D — prospecting / agency workflows

- Find businesses without websites
- Local SEO prospecting
- Web-design prospecting
- Cold email list research
- Cold calling list research
- B2B local market research

### Cluster E — comparisons

Keep and upgrade existing comparison pages rather than creating dozens of low-value alternatives.

Current comparisons should be refreshed with:

- current positioning
- transparent feature matrix
- pricing date
- workflow differences
- ideal-user differences
- screenshots where appropriate
- clear methodology

Add new competitors only when Semrush/SERP data proves search demand.

## 10. Original data strategy

This should become the strongest linkable moat.

Use Maps Hunter Pro itself to publish **aggregate research**, never customer lead rows.

Potential research assets:

- Email availability across US local businesses
- US vs UK vs Canada vs Australia contact-data availability
- Percentage of businesses with websites by category
- Percentage of businesses without websites by category
- Phone / website / social-profile coverage by industry
- Local business review-count benchmarks
- Google Maps Business Data Benchmark — US 2026
- Google Maps Business Data Benchmark — UK 2026

Every research piece should document:

- sample size
- date collected
- categories
- locations
- methodology
- limitations

These studies can earn citations/backlinks and make the site harder to imitate.

## 11. Technical SEO changes

Priority technical work:

- Regional hreflang support for English variants
- French locale support
- Fully localized/region-aware structured data
- Replace hardcoded sitemap maintenance with a content manifest / generated sitemap
- Generate accurate `lastmod`
- Article / Breadcrumb / WebPage structured data
- Correct Open Graph locales and alternates
- Unique title / description / H1 tests
- Canonical tests
- hreflang reciprocity tests
- sitemap inclusion tests
- redirect / 404 checks
- structured-data JSON validity tests
- content-primary-keyword collision test to reduce cannibalization

## 12. Internal linking model

Use hub-and-spoke linking:

Regional pages → core product / features / local use cases  
Feature pages → guides + regional pages  
Guides → relevant feature page + relevant use case  
Use-case pages → product page + supporting guides  
Comparison pages → product features + relevant guide

Anchor text should be natural, not mechanically repeated exact-match keywords.

## 13. Authority / backlinks

Focus link acquisition on the same markets as SEO:

- lead generation communities
- local SEO communities
- sales / outbound resources
- agency blogs
- Chrome extension directories
- SaaS directories
- scraper/data tooling comparisons
- citations of original Maps Hunter Pro studies

Original research should be the preferred outreach asset.

Do not use PBNs, automated link spam, paid link networks, or mass guest-post footprints.

## 14. Geo-targeting policy

India and Bangladesh are not campaign targets.

Actions:

- no India/Bangladesh regional pages
- no India/Bangladesh keyword plan
- no India/Bangladesh backlink outreach
- no local examples for those markets
- no rank tracking for those databases
- target-country examples, spelling and regulatory context instead
- build backlinks primarily from US/UK/CA/AU/EU sites

Do not geo-block countries merely to manipulate organic rankings. Hard blocking would be a separate Cloudflare/product decision, not an SEO optimization.

## 15. 90-day execution plan

### Days 1–14 — foundation

- Restore Noxtool/Semrush session and validate keyword metrics in target databases
- Create master keyword map with one primary intent per URL
- Implement regional routing and hreflang architecture
- Add France
- Fix localized structured data
- Build generated sitemap/content manifest
- Add SEO CI regression tests
- Change generic-English examples away from a Berlin-first presentation toward globally neutral / US-first commercial examples where appropriate

### Days 15–30 — money pages

Publish:

- US hub
- UK hub
- Canada hub
- Australia hub
- Google Maps Lead Extractor
- Chrome Extension
- Email Extractor
- Google Maps to Excel

Every page must satisfy the unique-content standard before indexing.

### Days 31–60 — topical authority

- Publish two high-value pages/articles per week
- Build agency / local SEO / web-design / B2B sales use cases
- Refresh all existing competitor comparisons
- Strengthen internal links
- Add evidence, screenshots, workflows and FAQs

### Days 61–90 — authority and optimization

- Publish at least one original US-focused data study
- Publish one US-vs-UK/CA/AU comparative study
- Outreach for backlinks/citations
- Expand German and French content based on validated query demand
- Optimize pages using GSC + Semrush query/rank data
- Consolidate cannibalizing pages instead of endlessly adding URLs

## 16. Semrush scoring framework

Once Semrush access is active, score every candidate 0–100:

- Product relevance: 30
- Commercial / buyer intent: 20
- Search volume / traffic opportunity: 20
- Ranking feasibility / KD: 15
- CPC / commercial value: 10
- Target-market fit: 5

A lower-volume high-intent query may outrank a high-volume generic query in publishing priority.

## 17. KPIs

Measure target-country performance, not global traffic alone.

Primary KPIs:

- non-brand impressions from US/UK/CA/AU/DE/FR
- non-brand clicks from target countries
- target keywords in Top 20 / Top 10 / Top 3
- clicks to money pages
- download / purchase-intent actions from organic
- target-country share of organic traffic
- referring domains from target regions
- indexed valid pages
- CTR by query/page/country
- conversions per landing page

India/Bangladesh traffic can be segmented in reporting, but it should not be treated as a growth KPI.

## 18. Implementation guardrails

- Work on `seo-western-markets-v1` until technical + content QA passes.
- Log every implementation step in README before merge.
- Do not modify Aseel/WorthAndWhy source.
- Do not ship programmatic city doorway pages.
- Do not stuff lists of countries/cities into titles or page copy.
- Do not invent Semrush metrics.
- Do not claim capabilities Maps Hunter Pro does not have.
- Do not alter licensing, Admin, extraction, payment, or extension behavior as part of SEO unless separately approved.
