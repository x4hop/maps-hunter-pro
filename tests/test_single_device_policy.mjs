import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const entry=readFileSync('backend/src/entry.js','utf8');
const admin=readFileSync('admin/admin.js','utf8');

assert.match(entry,/UPDATE manual_licenses SET device_limit=1/,'Backend must force every subscription code to one device');
assert.match(entry,/allowed_devices','1'/,'Backend settings must be normalized to one device');
assert.match(entry,/SET status='blocked'/,'Extra trusted devices must be blocked when the one-device policy is enforced');
assert.doesNotMatch(admin,/allowed_devices:\$\('sDevices'\)/,'Admin must not be able to submit a custom device count');

console.log('Single-device licensing policy checks passed');
