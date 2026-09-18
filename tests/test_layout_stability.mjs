import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync('assets/site-stability.css','utf8');
const build=readFileSync('scripts/build-frontend-cloudflare.mjs','utf8');
const html=readFileSync('index.html','utf8');

assert.match(css,/html\[dir="rtl"\] \.nav-links\{display:none!important\}/,
  'RTL desktop navigation must not crowd the language control');
assert.match(css,/\.nav-actions\{[^}]*z-index:220!important/s,
  'Header actions need a protected stacking lane');
assert.match(css,/\.section-title h2\{[\s\S]*display:flex!important[\s\S]*position:static!important/,
  'Section icons and headings must stay in normal flow');
assert.match(css,/#how \.how-grid,#features \.features,#data-fields \.features,#use-cases \.features,\.pricing\{\s*grid-template-columns:1fr!important/s,
  'Mobile content cards must collapse to one column');
assert.match(css,/grid-template-areas:"binance" "usdt" "redot"!important/,
  'Mobile payment methods must stack instead of overlap');
assert.match(css,/-webkit-line-clamp:unset!important/,
  'Translated card copy must not be clipped into overlapping layouts');
assert.match(build,/['"]site-stability\.css['"]/,
  'Final stability layer must be included in critical production CSS');
assert.match(html,/\/assets\/site-stability\.css/,
  'Base page must load the final stability layer');

console.log('RTL language action and non-overlapping section layout regression checks passed');