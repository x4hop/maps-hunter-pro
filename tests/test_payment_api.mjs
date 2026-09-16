import assert from 'node:assert/strict';
import entry from '../backend/src/entry.js';

class FakeDB{
  constructor(values){this.values=values}
  prepare(sql){
    if(sql==='SELECT key,value FROM settings')return {all:async()=>({results:Object.entries(this.values).map(([key,value])=>({key,value}))})};
    throw new Error('Unexpected SQL in payment-method test: '+sql);
  }
}

async function payment(values={}){
  const response=await entry.fetch(new Request('https://test.invalid/api/payment-methods'),{DB:new FakeDB(values)},{});
  assert.equal(response.status,200);
  return response.json();
}

const defaults=await payment();
assert.deepEqual(defaults.methods.BINANCE,{enabled:true,id:'752783284'});
assert.deepEqual(defaults.methods.REDOTPAY,{enabled:true,account:'1831390337'});
assert.equal(Object.prototype.hasOwnProperty.call(defaults.methods,'USDT'),false,'USDT is manual frontend data and must not be served by the payment API');

const configured=await payment({binance_id:'999',redotpay_id:'888',support_contact:'+218000000000'});
assert.equal(configured.methods.BINANCE.id,'999');
assert.equal(configured.methods.REDOTPAY.account,'888');
assert.equal(configured.support,'+218000000000');

console.log('Payment API contract checks passed');
