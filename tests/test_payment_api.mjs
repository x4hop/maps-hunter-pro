import assert from 'node:assert/strict';
import entry from '../backend/src/entry.js';

const response=await entry.fetch(new Request('https://test.invalid/api/payment-methods'),{DB:{}},{});
assert.equal(response.status,404);
const payload=await response.json();
assert.equal(payload.ok,false);
assert.equal(payload.error,'PAYMENTS_MANUAL_ONLY');

console.log('Payment API is disabled: payment methods are manual frontend data');
