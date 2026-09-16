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

async function settings(env){
  const result=await env.DB.prepare('SELECT key,value FROM settings').all();
  return Object.fromEntries((result.results||[]).map(row=>[row.key,row.value]));
}

async function paymentMethods(env){
  const s=await settings(env);
  const binanceId=String(s.binance_id||DEFAULT_BINANCE_ID).trim();
  const redotpayId=String(s.redotpay_id||DEFAULT_REDOTPAY_ID).trim();
  return json({
    ok:true,
    methods:{
      BINANCE:{enabled:Boolean(binanceId),id:binanceId||null},
      REDOTPAY:{enabled:Boolean(redotpayId),account:redotpayId||null}
    },
    support:String(s.support_contact||'').trim()||null
  });
}

async function enforceSingleDevice(env){
  await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('allowed_devices','1',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='1',updated_at=CURRENT_TIMESTAMP").run();
  await env.DB.prepare('UPDATE manual_licenses SET device_limit=1 WHERE device_limit<>1').run();
  await env.DB.prepare("UPDATE manual_license_devices SET status='blocked' WHERE status='trusted' AND id NOT IN (SELECT MIN(id) FROM manual_license_devices WHERE status='trusted' GROUP BY manual_license_id)").run();
}

async function normalizeAdminSettingsRequest(request){
  let payload;
  try{payload=await request.clone().json()}catch{return {request,payload:null}}
  if(!payload?.settings||typeof payload.settings!=='object')return {request,payload};
  payload.settings={...payload.settings,allowed_devices:'1'};
  delete payload.settings.usdt_network;
  delete payload.settings.usdt_address;
  const normalized=new Request(request,{body:JSON.stringify(payload)});
  return {request:normalized,payload};
}

async function saveBinanceAfterAuthorizedSettingsPatch(payload,response,env){
  if(!response.ok||!payload?.settings)return response;
  await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('allowed_devices','1',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='1',updated_at=CURRENT_TIMESTAMP").run();
  if(!Object.prototype.hasOwnProperty.call(payload.settings,'binance_id'))return response;
  const value=String(payload.settings.binance_id||'').trim();
  await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('binance_id',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(value).run();
  try{
    await env.DB.prepare("INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result,metadata_json) VALUES('SETTINGS_UPDATED','admin','admin','settings','platform','success',?)").bind(JSON.stringify({keys:['binance_id','allowed_devices']})).run();
  }catch{}
  return response;
}

function needsSingleDeviceEnforcement(path){
  return path.startsWith('/api/license/')||path.startsWith('/api/usage/')||path.startsWith('/api/admin/');
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(needsSingleDeviceEnforcement(url.pathname))await enforceSingleDevice(env);

    if(url.pathname==='/api/payment-methods'&&request.method==='GET')return paymentMethods(env);

    if(url.pathname==='/api/admin/settings'&&request.method==='PATCH'){
      const normalized=await normalizeAdminSettingsRequest(request);
      const response=await app.fetch(normalized.request,env,ctx);
      return saveBinanceAfterAuthorizedSettingsPatch(normalized.payload,response,env);
    }

    return app.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};
