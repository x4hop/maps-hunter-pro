import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync('index.html','utf8');
const build=readFileSync('scripts/build-frontend-cloudflare.mjs','utf8');
const app=readFileSync('assets/app.js','utf8');

const ordered=['/assets/styles.css','/assets/manual.css','/assets/ui-polish.css','/assets/layout-polish.css','/assets/payment-icon-clean.css'];
let last=-1;
for(const href of ordered){
  const i=html.indexOf(`href="${href}"`);
  assert.ok(i>last,`Homepage must load ${href} in approved visual order`);
  last=i;
}
assert.ok(!html.includes('/assets/site-stability.css'),'Retired global stability CSS must not be loaded');
assert.ok(!build.includes("'site-stability.css'"),'Retired global stability CSS must not be in critical CSS');
for(const file of ['styles.css','manual.css','ui-polish.css','layout-polish.css','payment-icon-clean.css'])assert.ok(build.includes(`'${file}'`),`Critical CSS must include ${file}`);

assert.match(html,/data-payment-method="binance"/,'Binance fallback card must exist in static HTML');
assert.match(html,/data-payment-method="usdt"/,'USDT fallback card must exist in static HTML');
assert.match(html,/data-payment-method="redotpay"/,'RedotPay fallback card must exist in static HTML');
assert.match(html,/752783284/,'Binance ID must remain visible without JS');
assert.match(html,/TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS/,'USDT address must remain visible without JS');
assert.match(html,/1831390337/,'RedotPay ID must remain visible without JS');
assert.match(app,/function renderPayments\(\)/,'JavaScript enhancement for payment cards must remain available');

const iconRefs=(html.match(/\/assets\/maps-hunter-pro-icon\.png/g)||[]).length;
assert.ok(iconRefs>=4,'Tool icon must be used for metadata plus visible header/footer branding');
assert.ok(!html.includes('<span class="pin">'),'Footer must not use a Unicode placeholder icon');
console.log('Public-site visual/payment/icon contract checks passed');