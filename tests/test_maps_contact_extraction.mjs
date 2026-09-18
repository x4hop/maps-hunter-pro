import fs from 'node:fs';
import assert from 'node:assert/strict';

const wrapper = fs.readFileSync(new URL('../extension/background-wrapper.js', import.meta.url), 'utf8');
const fix = fs.readFileSync(new URL('../extension/contact-extraction-fix.js', import.meta.url), 'utf8');
const maps = fs.readFileSync(new URL('../extension/maps-page-overrides.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

assert.match(wrapper, /importScripts\("contact-extraction-fix\.js"\)/);
assert.ok(wrapper.indexOf('contact-extraction-fix.js') > wrapper.indexOf('maps-page-overrides.js'));

// The fix may improve readiness/timing, but must not replace contact parsing.
assert.match(fix, /async function processPlace/);
assert.doesNotMatch(fix, /function extractGoogleMapsPlace\s*\(/);
assert.doesNotMatch(fix, /document\.documentElement/);
assert.doesNotMatch(fix, /fullHtml|fullText/);

// Contact extraction must stay scoped to the Maps place panel.
assert.match(maps, /const root = document\.querySelector\("div\[role='main'\]"\) \|\| document\.body/);
assert.match(maps, /root\?\.querySelectorAll/);
assert.match(maps, /button\[data-item-id\^='phone:tel:'\]/);
assert.match(maps, /a\[href\^='tel:'\]/);
assert.match(maps, /addEmails\(root\?\.innerHTML \|\| ""\)/);

// No website crawling and no broad host permissions.
assert.doesNotMatch(fix, /fetch\s*\(/);
assert.deepEqual(new Set(manifest.host_permissions), new Set([
  'https://*.google.com/*',
  'https://mapshunterpro.com/*'
]));

console.log('Maps contact scope/readiness regression checks passed');
