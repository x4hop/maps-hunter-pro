import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('index.html','utf8');
const build=readFileSync('scripts/build-frontend-cloudflare.mjs','utf8');
const app=readFileSync('assets/app.js','utf8');
const polish=readFileSync('assets/ui-polish.css','utf8');
const layout=readFileSync('assets/layout-polish.css','utf8');

const ordered=['/assets/styles.css','/assets/manual.css','/assets/payment-icon-clean.css','/assets/ui-polish.css','/assets/layout-polish.css'];
let last=-1;
for(const href of ordered){
  const i=html.indexOf(`href="${href}"`);
  assert.ok(i>last,`Homepage must load ${href} in the approved pre-icon visual order`);
  last=i;
}
assert.ok(!html.includes('/assets/site-stability.css'),'Global stability CSS must never be loaded');
assert.ok(!build.includes("'site-stability.css'"),'Global stability CSS must never enter critical CSS');
assert.match(build,/\['styles\.css','manual\.css','payment-icon-clean\.css','ui-polish\.css','layout-polish\.css'\]/,'Critical CSS order must match the approved visual baseline');
assert.match(app,/function renderPayments\(\)/,'Payment renderer must remain available');
for(const method of ['binance','usdt','redotpay'])assert.match(app,new RegExp(`data-payment-method="${method}"`),`${method} payment method must remain in the renderer`);
assert.match(html,/\/assets\/maps-hunter-pro-icon\.png/,'Product icon must be used on the public site');
assert.match(html,/\/assets\/mhp-icons\.svg#/,'Homepage must use the SVG icon sprite');
assert.match(polish,/Icon-only layer: preserve the approved card geometry/,'SVG icon CSS must stay icon-only');
assert.doesNotMatch(polish,/\.card \.icon,[\s\S]*box-shadow:0 6px 16px/,'SVG icon layer must not restyle all icon containers');
assert.doesNotMatch(layout,/RTL typography only/,'Layout layer must stay at the approved pre-icon baseline');
console.log('Public-site pre-icon visual baseline + SVG/payment contract checks passed');