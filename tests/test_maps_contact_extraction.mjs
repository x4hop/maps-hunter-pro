import fs from 'node:fs';
import assert from 'node:assert/strict';

const wrapper = fs.readFileSync(new URL('../extension/background-wrapper.js', import.meta.url), 'utf8');
const fix = fs.readFileSync(new URL('../extension/contact-extraction-fix.js', import.meta.url), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'));

assert.match(wrapper, /importScripts\("contact-extraction-fix\.js"\)/);
assert.ok(wrapper.indexOf('contact-extraction-fix.js') > wrapper.indexOf('performance-overrides.js'));

assert.match(fix, /waitForTabComplete\(tab\.id, 9000\)/);
assert.match(fix, /const maxWait = 10000/);
assert.match(fix, /data-item-id\^='phone:tel:'/);
assert.match(fix, /const fullHtml = String\(doc\?\.innerHTML/);
assert.match(fix, /addEmails\(fullHtml\)/);
assert.match(fix, /%40\/gi/);
assert.doesNotMatch(fix, /fetch\s*\(/);
assert.doesNotMatch(fix, /chromeTabsCreate\([^\n]*website/);

assert.deepEqual(new Set(manifest.host_permissions), new Set([
  'https://*.google.com/*',
  'https://mapshunterpro.com/*'
]));

console.log('Maps contact extraction regression checks passed');
