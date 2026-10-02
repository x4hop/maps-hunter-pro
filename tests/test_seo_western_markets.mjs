import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const runtime = read('assets/i18n.js');
const seo = read('assets/seo-i18n.js');
const worker = read('deploy/unified-worker.js');
const blog = read('blog/index.html');

assert.match(runtime, /Google Maps Scraper for B2B Leads \| Maps Hunter Pro/);
assert.match(runtime, /Google Maps Scraper für B2B-Leads \| Maps Hunter Pro/);
assert.match(runtime, /Google Maps Scraper para Leads B2B \| Maps Hunter Pro/);

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

assert.match(outscraper, /<title>Outscraper Google Maps Scraper vs Maps Hunter Pro/);
assert.doesNotMatch(outscraper, /\$100 annual/i);
assert.match(apify, /<title>Apify Google Maps Scraper vs Maps Hunter Pro/);
assert.match(octoparse, /<title>Octoparse Google Maps Scraper vs Maps Hunter Pro/);

assert.match(worker, /google-maps-email-extractor/);
assert.match(worker, /google-maps-scraper-api/);
assert.match(worker, /best-google-maps-scraper/);

console.log('Western-market SEO regression checks passed.');
