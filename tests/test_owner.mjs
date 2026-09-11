import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import worker from '../backend/src/index.js';
globalThis.crypto ||= webcrypto;
const code='MHP-OWNER-TEST-ONLY';
const digest=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(code))).toString('base64url');
let active=true;
const env={DB:{prepare(query){return {bind(...args){return {async first(){if(query.includes('owner_access'))return active&&args[0]===digest?{id:1}:null;if(query.includes('admin_sessions'))return null;throw new Error('Unexpected database query: '+query)}}}}}}};
async function request(path,licenseKey=code){return worker.fetch(new Request('https://test.invalid'+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({licenseKey,deviceId:'test-device',requestId:'owner-test-123',amount:1})}),env)}
for(const path of ['/api/license/validate','/api/usage/consume']){const r=await request(path);assert.equal(r.status,200);const d=await r.json();assert.equal(d.license.planId,'owner');assert.equal(d.license.expiresAt,null);assert.equal(d.license.dailyLeadLimit,null);assert.equal(d.license.key,undefined)}
assert.equal((await request('/api/license/validate','MHP-OWNER-WRONG')).status,401);
active=false;assert.equal((await request('/api/license/validate')).status,401);
assert.equal((await request('/api/admin/owner-access/rotate')).status,401);
console.log('Owner: permanent access, unlimited consume, wrong/revoked rejection, and admin isolation passed');
