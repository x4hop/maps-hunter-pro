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

const blocked='TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS';
const blockedResult=await payment({usdt_network:'TRC20',usdt_address:blocked});
assert.equal(blockedResult.methods.USDT.enabled,false);
assert.equal(blockedResult.methods.USDT.address,null);
assert.deepEqual(blockedResult.methods.BINANCE,{enabled:true,id:'752783284'});
assert.deepEqual(blockedResult.methods.REDOTPAY,{enabled:true,account:'1831390337'});

const candidate='TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJT';
const safeResult=await payment({usdt_network:'Tron (TRC20)',usdt_address:candidate,binance_id:'999',redotpay_id:'888'});
assert.equal(safeResult.methods.USDT.enabled,true);
assert.equal(safeResult.methods.USDT.address,candidate);
assert.equal(safeResult.methods.BINANCE.id,'999');
assert.equal(safeResult.methods.REDOTPAY.account,'888');

const wrongNetwork=await payment({usdt_network:'BEP20',usdt_address:candidate});
assert.equal(wrongNetwork.methods.USDT.enabled,false);
assert.equal(wrongNetwork.methods.USDT.address,null);

console.log('Payment API contract checks passed');
