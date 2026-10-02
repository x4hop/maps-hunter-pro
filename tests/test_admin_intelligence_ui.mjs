import fs from 'node:fs';
import assert from 'node:assert/strict';

const html=fs.readFileSync(new URL('../admin/index.html',import.meta.url),'utf8');
const js=fs.readFileSync(new URL('../admin/admin.js',import.meta.url),'utf8');
const backend=fs.readFileSync(new URL('../backend/src/index.js',import.meta.url),'utf8');

for(const id of ['mRevenue','mCustomers','mTotalLeads','customersBody','salesBody','licensesBody','supportBody','customerDrawerBackdrop']){
  assert.ok(html.includes(`id="${id}"`),`missing admin UI id ${id}`);
}
for(const view of ['dashboard','customers','sales','licenses','support','owner','settings','logs']){
  assert.ok(html.includes(`data-view="${view}"`),`missing admin nav view ${view}`);
}
assert.ok(html.includes('Lead/business records stay on customer devices.'),'privacy invariant must be visible in Admin UI');
assert.ok(js.includes("/api/admin/customers"),'customer API wiring missing');
assert.ok(js.includes("/api/admin/sales"),'sales API wiring missing');
assert.ok(js.includes("/api/admin/support-events"),'support API wiring missing');
assert.ok(js.includes('Customer 360')===false,'drawer title belongs in HTML, not duplicated in JS');
for(const route of ['/api/admin/customers','/api/admin/sales','/api/admin/support-events']){
  assert.ok(backend.includes(route),`backend route missing ${route}`);
}
assert.ok(backend.includes('totalRevenueCents'),'overview revenue KPI missing');
assert.ok(backend.includes('total_leads'),'all-time lead metric missing');
console.log('Admin Intelligence UI/API contract checks passed');