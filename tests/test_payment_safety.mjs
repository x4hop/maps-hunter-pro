import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('assets/app.js','utf8');
const i18n=readFileSync('assets/i18n.js','utf8');
const entry=readFileSync('backend/src/entry.js','utf8');
const manualUsdt='TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS';

assert.ok(app.includes(manualUsdt),'The current manual USDT TRC20 address must remain in the frontend payment configuration');
assert.ok(i18n.includes(manualUsdt),'Localized payment UI must use the same manual USDT address');
assert.match(app,/usdtNetwork:'TRC20'/,'Manual USDT must remain explicitly TRC20');
assert.doesNotMatch(entry,/USDT\s*:/,'The payment-method API must not publish USDT; USDT is manual frontend data');
assert.match(entry,/REDOTPAY:/,'RedotPay must remain available through the payment API');
assert.match(entry,/BINANCE:/,'Binance must remain available through the payment API');

console.log('Manual USDT regression checks passed');
