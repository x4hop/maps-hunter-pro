import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('assets/app.js','utf8');
const i18n=readFileSync('assets/i18n.js','utf8');
const admin=readFileSync('admin/admin.js','utf8');
const entry=readFileSync('backend/src/entry.js','utf8');

const values={
  binance:'752783284',
  redot:'1831390337',
  usdt:'TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS'
};

assert.ok(app.includes(values.binance),'Manual Binance ID must be published by the frontend');
assert.ok(app.includes(values.redot),'Manual RedotPay ID must be published by the frontend');
assert.ok(app.includes(values.usdt),'Manual USDT TRC20 address must be published by the frontend');
assert.match(app,/usdtNetwork:'TRC20'/,'USDT must stay on TRC20');
assert.doesNotMatch(app,/getJson\(['"]\/api\/payment-methods/,'Frontend must not request payment methods from the API');
assert.doesNotMatch(app,/fetch\([^\n]*\/api\/payment-methods/,'Frontend must not fetch payment methods from the API');
assert.ok(!i18n.includes(values.usdt),'Translation code must not own payment credentials');
assert.doesNotMatch(admin,/sBinanceId.*value/,'Admin must not manage Binance payment credentials');
assert.match(entry,/PAYMENTS_MANUAL_ONLY/,'Backend must explicitly reject payment-method API use');

console.log('Manual payment architecture checks passed');
