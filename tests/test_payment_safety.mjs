import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync('assets/app.js','utf8');

const unverifiedTrxAddress='TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS';
assert.match(app,/BLOCKED_USDT_ADDRESSES/,'USDT must have an explicit safety blocklist');
assert.ok(app.includes(unverifiedTrxAddress),'The known TRX deposit address must stay explicitly blocked until verified as USDT');
assert.doesNotMatch(app,/CONFIRMED_PAYMENT\s*=\s*\{[^}]*usdtAddress/i,'An unverified USDT address must never be a static confirmed fallback');
assert.match(app,/isSafeUsdtConfig/,'USDT rendering must pass a safety validator');
assert.match(app,/method\?\.enabled===true/,'USDT must be explicitly enabled by the API');
assert.match(app,/!BLOCKED_USDT_ADDRESSES\.has\(address\)/,'Blocked crypto addresses must not be rendered as payable USDT');

console.log('Payment safety regression checks passed');
