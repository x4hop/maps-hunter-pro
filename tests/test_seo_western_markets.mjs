import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const runtime = read('assets/i18n.js');
const seo = read('assets/seo-i18n.js');
const worker = read('deploy/unified-worker.js');
const blog = read('blog/index.html');

assert.match(runtime, /Google Maps Scraper for B2B Leads \|Google Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro/);
assert.match(runtime, /Google Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro|Google Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro/);
assert.match(runtime, /Google Maps Scraper España para Leads B2B | Maps Hunter Pro|Google Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro/);

assert.match(seo, /Google Maps Scraper for Faster B2B Lead Generation/);
assert.match(seo, /Google Maps Scraper für B2B-Leads und Firmendaten/);
assert.match(seo, /Google Maps Scraper para Leads B2B y Datos de Empresas/);

const pages = [
  ['blog/google-maps-email-extractor/index.html', 'Google Maps Email Extractor', '/blog/google-maps-email-extractor/'],
  ['blog/google-maps-scraper-api/index.html', 'Google Maps Scraper API', '/blog/google-maps-scraper-api/'],
  ['blog/best-google-maps-scraper/index.html', 'Best Google Maps Scraper', '/blog/best-google-maps-scraper/'],
];

for (const [path, keyword, canonicalPath] of pages) {
  const html = read(path);
  assert.ok(html.toLowerCase().includes('<title>' + keyword.toLowerCase()), path + ' title');
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, path + ' must have one H1');
  assert.ok(html.includes('rel="canonical" href="https://mapshunterpro.com' + canonicalPath + '"'), path + ' canonical');
  assert.ok(html.includes('"@type":"BlogPosting"'), path + ' BlogPosting schema');
  assert.ok(html.includes('/en#pricing'), path + ' product CTA');
  const slug = canonicalPath.split('/').filter(Boolean).pop();
  assert.ok(worker.includes('/blog/' + slug + '/'), path + ' sitemap');
  assert.ok(blog.includes(canonicalPath), path + ' resource hub link');
}

const outscraper = read('blog/maps-hunter-pro-vs-outscraper/index.html');
const apify = read('blog/maps-hunter-pro-vs-apify/index.html');
const octoparse = read('blog/maps-hunter-pro-vs-octoparse/index.html');

assert.match(outscraper, /<title>Outscraper Google Maps Scraper vsGoogle Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro/);
assert.doesNotMatch(outscraper, /\$100 annual/i);
assert.match(apify, /<title>Apify Google Maps Scraper vsGoogle Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro/);
assert.match(octoparse, /<title>Octoparse Google Maps Scraper vsGoogle Maps Scraper Deutschland für B2B-Leads |Google Maps Scraper España para Leads B2B | Maps Hunter Pro/);

assert.match(worker, /google-maps-email-extractor/);
assert.match(worker, /google-maps-scraper-api/);
assert.match(worker, /best-google-maps-scraper/);


const regional = read('assets/region-i18n.js');
const build = read('scripts/build-frontend-cloudflare.mjs');
const languageRuntime = read('assets/language-runtime-fix.js');

for (const [route, hreflang, phrase] of [
  ['us', 'en-US', 'Google Maps Scraper USA'],
  ['uk', 'en-GB', 'Google Maps Scraper UK'],
  ['ca', 'en-CA', 'Google Maps Scraper Canada'],
  ['au', 'en-AU', 'Google Maps Scraper Australia'],
  ['de', 'de-DE', 'Google Maps Scraper Deutschland'],
  ['es', 'es-ES', 'Google Maps Scraper España'],
]) {
  assert.ok(worker.includes(route + ":{lang:'" + hreflang), route + ' worker route metadata');
  assert.ok(worker.includes("hreflang:'" + hreflang + "'"), route + ' hreflang');
  assert.ok(runtime.includes(route + ":['" + phrase), route + ' runtime metadata');
  assert.ok(regional.includes(route + ':{'), route + ' regional copy');
  assert.ok(build.includes("'" + route + "'"), route + ' build route');
}
assert.match(build, /REGION_SECTIONS/);
assert.match(build, /Google Maps Lead Research for the United States/);
assert.match(build, /Google Maps Lead Research for the United Kingdom/);
assert.match(build, /Google Maps Lead Research for Canada/);
assert.match(build, /Google Maps Lead Research for Australia/);
assert.match(languageRuntime, /ROUTES=\['en','us','uk','ca','au'/);
assert.match(worker, /META\[x\]\.hreflang/);

console.log('Western-market SEO regression checks passed.');
for (const [path, keyword, canonical] of [
  ['blog/de/google-maps-scraper-deutschland/index.html','Google Maps Scraper Deutschland','/blog/de/google-maps-scraper-deutschland/'],
  ['blog/de/google-maps-daten-extrahieren/index.html','Google-Maps-Daten extrahieren','/blog/de/google-maps-daten-extrahieren/'],
  ['blog/es/google-maps-scraper-espana/index.html','Google Maps Scraper España','/blog/es/google-maps-scraper-espana/'],
  ['blog/is-scraping-google-maps-legal/index.html','Is Scraping Google Maps Legal?','/blog/is-scraping-google-maps-legal/'],
]) {
  const html=read(path);
  assert.equal((html.match(/<h1\b/gi)||[]).length,1,path+' must have one H1');
  assert.ok(html.includes('rel="canonical" href="https://mapshunterpro.com'+canonical+'"'),path+' canonical');
  assert.ok(html.toLowerCase().includes(keyword.toLowerCase()),path+' target phrase');
  assert.ok(worker.includes(canonical),path+' sitemap/route');
}
assert.match(build,/Google Maps Lead-Recherche für Deutschland/);
assert.match(build,/Investigación de leads de Google Maps para España/);
assert.match(worker,/inLanguage/);
assert.match(worker,/og:locale:alternate/);