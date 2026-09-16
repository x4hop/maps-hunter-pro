import app from './index.js';

const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,authorization',
  'access-control-allow-methods':'GET,POST,PATCH,OPTIONS'
};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:HEADERS});

async function enforceSingleDevice(env){
  try{
    await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('allowed_devices','1',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='1',updated_at=CURRENT_TIMESTAMP").run();
    await env.DB.prepare('UPDATE manual_licenses SET device_limit=1 WHERE device_limit<>1').run();
    await env.DB.prepare("UPDATE manual_license_devices SET status='blocked' WHERE status='trusted' AND id NOT IN (SELECT MIN(id) FROM manual_license_devices WHERE status='trusted' GROUP BY manual_license_id)").run();
  }catch(error){
    console.warn('Single-device normalization skipped until licensing tables are ready',error?.message||error);
  }
}

async function normalizeAdminSettingsRequest(request){
  let payload;
  try{payload=await request.clone().json()}catch{return request}
  if(!payload?.settings||typeof payload.settings!=='object')return request;
  payload.settings={...payload.settings,allowed_devices:'1'};
  delete payload.settings.binance_id;
  delete payload.settings.redotpay_id;
  delete payload.settings.usdt_network;
  delete payload.settings.usdt_address;
  return new Request(request,{body:JSON.stringify(payload)});
}

function needsSingleDeviceEnforcement(path){
  return path.startsWith('/api/license/')||path.startsWith('/api/usage/')||path.startsWith('/api/admin/');
}

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);

    if(url.pathname==='/api/payment-methods'){
      return json({ok:false,error:'PAYMENTS_MANUAL_ONLY',message:'Binance, USDT TRC20 and RedotPay are published manually on the frontend and verified by payment screenshot.'},404);
    }

    if(needsSingleDeviceEnforcement(url.pathname))await enforceSingleDevice(env);

    if(url.pathname==='/api/admin/settings'&&request.method==='PATCH'){
      request=await normalizeAdminSettingsRequest(request);
    }

    return app.fetch(request,env,ctx);
  },
  async scheduled(controller,env,ctx){
    if(typeof app.scheduled==='function')return app.scheduled(controller,env,ctx);
  }
};
