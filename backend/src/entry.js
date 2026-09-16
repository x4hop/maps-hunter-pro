import app from './index.js';

const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,authorization',
  'access-control-allow-methods':'GET,POST,PATCH,OPTIONS'
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:HEADERS});

const DEFAULT_BINANCE_ID='752783284';
const DEFAULT_REDOTPAY_ID='1831390337';
const BLOCKED_USDT_ADDRESSES=new Set(['TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS']);

const normalizeNetwork=value=>String(value||'').trim().toUpperCase().replace(/[\s_-]+/g,'');
const isTrc20=value=>['TRC20','TRON(TRC20)','TRONTRC20'].includes(normalizeNetwork(value));
const isTronAddress=value=>/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(value||'').trim());

async function settings(env){
  const result=await env.DB.prepare('SELECT key,value FROM settings').all();
  return Object.fromEntries((result.results||[]).map(row=>[row.key,row.value]));
}

async function paymentMethods(env){
  const s=await settings(env);
  const binanceId=String(s.binance_id||DEFAULT_BINANCE_ID).trim();
  const redotpayId=String(s.redotpay_id||DEFAULT_REDOTPAY_ID).trim();
  const network=String(s.usdt_network||'TRC20').trim()||'TRC20';
  const address=String(s.usdt_address||'').trim();
  const usdtSafe=isTrc20(network)&&isTronAddress(address)&&!BLOCKED_USDT_ADDRESSES.has(address);
  return json({
    ok:true,
    methods:{
      BINANCE:{enabled:Boolean(binanceId),id:binanceId||null},
      USDT:{enabled:usdtSafe,network,address:usdtSafe?address:null},
      REDOTPAY:{enabled:Boolean(redotpayId),account:redotpayId||null}
    },
    support:String(s.support_contact||'').trim()||null
  });
}

async function saveBinanceAfterAuthorizedSettingsPatch(request,response,env){
  if(!response.ok)return response;
  let body;
  try{body=await request.json()}catch{return response}
  if(!body?.settings||!Object.prototype.hasOwnProperty.call(body.settings,'binance_id'))return response;
  const value=String(body.settings.binance_id||'').trim();
  await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('binance_id',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(value).run();
  try{
    await env.DB.prepare("INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result,metadata_json) VALUES('SETTINGS_UPDATED','admin','admin','settings','platform','success',?)").bind(JSON.stringify({keys:['binance_id']})).run();
  }catch{}
  return response;
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/api/payment-methods'&&request.method==='GET')return paymentMethods(env);
    if(url.pathname==='/api/admin/settings'&&request.method==='PATCH'){
      const copy=request.clone();
      const response=await app.fetch(request,env,ctx);
      return saveBinanceAfterAuthorizedSettingsPatch(copy,response,env);
    }
    return app.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};
