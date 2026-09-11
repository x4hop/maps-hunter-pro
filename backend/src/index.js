const HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'content-type,authorization',
  'access-control-allow-methods':'GET,POST,PATCH,OPTIONS'
};
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:HEADERS});
const fail=(code,status=400)=>{const e=new Error(code);e.status=status;throw e};
const enc=new TextEncoder();
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const random=n=>b64(crypto.getRandomValues(new Uint8Array(n)));
const hash=async v=>b64(await crypto.subtle.digest('SHA-256',enc.encode(String(v))));
const sql=(e,q,...p)=>e.DB.prepare(q).bind(...p);
const first=(e,q,...p)=>sql(e,q,...p).first();
const rows=async(e,q,...p)=>(await sql(e,q,...p).all()).results||[];
const run=(e,q,...p)=>sql(e,q,...p).run();
const upper=v=>String(v||'').trim().toUpperCase();
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
async function body(r){
  if(Number(r.headers.get('content-length')||0)>16384)fail('REQUEST_TOO_LARGE',413);
  const t=await r.text(); if(t.length>16384)fail('REQUEST_TOO_LARGE',413);
  try{const x=JSON.parse(t||'{}'); if(!x||typeof x!=='object'||Array.isArray(x))fail('INVALID_JSON'); return x}catch(e){if(e.status)throw e;fail('INVALID_JSON')}
}
async function ensureAdmin(e){
  await e.DB.batch([
    sql(e,"CREATE TABLE IF NOT EXISTS admin_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    sql(e,"CREATE TABLE IF NOT EXISTS request_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at TEXT NOT NULL)"),
    sql(e,"CREATE TABLE IF NOT EXISTS audit_logs(id INTEGER PRIMARY KEY AUTOINCREMENT,event_type TEXT NOT NULL,actor_type TEXT NOT NULL DEFAULT 'system',actor TEXT,target_type TEXT,target_id TEXT,result TEXT NOT NULL DEFAULT 'success',metadata_json TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    sql(e,"CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    sql(e,"CREATE TABLE IF NOT EXISTS owner_access(id INTEGER PRIMARY KEY CHECK(id=1),code_hash TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)")
  ]);
}
async function settings(e){
  const db=Object.fromEntries((await rows(e,'SELECT key,value FROM settings')).map(x=>[x.key,x.value]));
  return {
    monthly_price_usd:Number(db.monthly_price_usd||20),
    annual_price_usd:Number(db.annual_price_usd||100),
    monthly_daily_limit:Number(db.monthly_daily_limit||1500),
    allowed_devices:clamp(Number(db.allowed_devices||2),1,10),
    usdt_network:db.usdt_network||'TRC20',
    usdt_address:db.usdt_address||'',
    redotpay_id:db.redotpay_id||'',
    support_contact:db.support_contact||'',
    extension_version:db.extension_version||'8.2.0',
    extension_download_url:db.extension_download_url||'',
    public_site_url:db.public_site_url||''
  };
}
const plan=(s,id)=>{
  if(!['monthly','annual'].includes(id))fail('INVALID_PLAN');
  return id==='monthly'
    ? {id:'monthly',price:s.monthly_price_usd,durationDays:30,dailyLeadLimit:s.monthly_daily_limit}
    : {id:'annual',price:s.annual_price_usd,durationDays:365,dailyLeadLimit:null};
};
async function rateLimit(r,e,path){
  const ip=r.headers.get('cf-connecting-ip')||'unknown', bucket=Math.floor(Date.now()/600000), k=await hash(path+'|'+ip+'|'+bucket);
  const q=await first(e,"INSERT INTO request_limits(key,count,expires_at) VALUES(?,1,datetime('now','+20 minutes')) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",k);
  if(Number(q?.count||0)>40)fail('TOO_MANY_REQUESTS',429);
}
async function audit(e,event,targetType,targetId,metadata=null,result='success'){
  await run(e,'INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result,metadata_json) VALUES(?,?,?,?,?,?,?)',event,'admin','admin',targetType||null,String(targetId||''),result,metadata?JSON.stringify(metadata):null);
}
async function adminSession(r,e){
  const a=r.headers.get('authorization')||''; if(!a.startsWith('Bearer '))fail('UNAUTHORIZED',401);
  const h=await hash(a.slice(7));
  const s=await first(e,"SELECT id FROM admin_sessions WHERE token_hash=? AND julianday(expires_at)>julianday('now')",h);
  if(!s)fail('UNAUTHORIZED',401);
  await run(e,'UPDATE admin_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?',s.id).catch(()=>{});
  return s;
}
function codeHint(code){return code.slice(0,8)+'…'+code.slice(-6)}
function makeCode(){return 'MHP-'+random(18).toUpperCase()}
async function ownerAccess(e,x){
  const code=upper(x.licenseKey); if(!code.startsWith('MHP-OWNER-'))return null;
  const device=String(x.deviceId||'').trim(); if(!device||device.length>128)fail('LICENSE_AND_DEVICE_REQUIRED');
  const owner=await first(e,"SELECT id FROM owner_access WHERE id=1 AND status='active' AND code_hash=?",await hash(code));
  if(!owner)fail('INVALID_LICENSE',401);
  return {ok:true,valid:true,license:{expiresAt:null,owner:true}};
}
async function loadManualLicense(e,code){return first(e,'SELECT * FROM manual_licenses WHERE code_hash=?',await hash(code))}
async function activateManual(e,l){
  if(l.status==='unused'){
    await run(e,"UPDATE manual_licenses SET status='active',activated_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+'||duration_days||' days'),last_validated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='unused'",l.id);
    l=await first(e,'SELECT * FROM manual_licenses WHERE id=?',l.id);
  }
  if(l.status==='active'&&l.expires_at&&Date.parse(l.expires_at+'Z')<=Date.now()){
    await run(e,"UPDATE manual_licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=?",l.id);
    l.status='expired';
  }
  if(l.status==='revoked')fail('LICENSE_REVOKED',403);
  if(l.status==='expired')fail('LICENSE_EXPIRED',403);
  if(l.status!=='active')fail('INVALID_LICENSE',401);
  return l;
}
async function bindDevice(e,l,x){
  const device=String(x.deviceId||'').trim(); if(!device||device.length>128)fail('LICENSE_AND_DEVICE_REQUIRED');
  let d=await first(e,'SELECT id,status FROM manual_license_devices WHERE manual_license_id=? AND device_uid=?',l.id,device);
  if(d?.status==='blocked')fail('DEVICE_BLOCKED',403);
  if(!d){
    const count=Number((await first(e,"SELECT count(*) c FROM manual_license_devices WHERE manual_license_id=? AND status='trusted'",l.id))?.c||0);
    if(count>=Number(l.device_limit))fail('DEVICE_LIMIT_REACHED',403);
    try{await run(e,"INSERT INTO manual_license_devices(manual_license_id,device_uid,status) VALUES(?,?,'trusted')",l.id,device)}
    catch(err){d=await first(e,'SELECT id,status FROM manual_license_devices WHERE manual_license_id=? AND device_uid=?',l.id,device);if(!d)fail('DEVICE_LIMIT_REACHED',403);if(d.status==='blocked')fail('DEVICE_BLOCKED',403)}
  }else await run(e,'UPDATE manual_license_devices SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?',d.id);
}
async function manualValidate(e,x){
  const code=upper(x.licenseKey); if(!code||code.length>128)fail('ACTIVATION_CODE_REQUIRED');
  let l=await loadManualLicense(e,code); if(!l)fail('INVALID_LICENSE',401);
  l=await activateManual(e,l); await bindDevice(e,l,x);
  await run(e,'UPDATE manual_licenses SET last_validated_at=CURRENT_TIMESTAMP WHERE id=?',l.id);
  return l;
}
async function extensionRoutes(r,e,url){
  const p=url.pathname,m=r.method; if(!['/api/license/validate','/api/usage/consume'].includes(p)||m!=='POST')return null;
  const x=await body(r), owner=await ownerAccess(e,x); if(owner)return json(owner);
  const l=await manualValidate(e,x);
  if(p.endsWith('/consume')){
    const requestId=String(x.requestId||''), amount=Number(x.amount||1);
    if(requestId.length<8||requestId.length>128||!Number.isInteger(amount)||amount<1||amount>100)fail('INVALID_USAGE');
    const prior=await first(e,'SELECT manual_license_id,amount FROM manual_usage_events WHERE request_id=?',requestId);
    if(prior&&(Number(prior.manual_license_id)!==Number(l.id)||Number(prior.amount)!==amount))fail('REQUEST_ID_CONFLICT',409);
    if(!prior){
      const today=Number((await first(e,"SELECT leads_processed FROM manual_usage_daily WHERE manual_license_id=? AND usage_date=date('now')",l.id))?.leads_processed||0);
      if(l.daily_lead_limit!=null&&today+amount>Number(l.daily_lead_limit))fail('DAILY_LIMIT_REACHED',409);
      try{
        await e.DB.batch([
          sql(e,"INSERT INTO manual_usage_events(request_id,manual_license_id,usage_date,amount) VALUES(?,?,date('now'),?)",requestId,l.id,amount),
          sql(e,"INSERT INTO manual_usage_daily(manual_license_id,usage_date,leads_processed) VALUES(?,date('now'),?) ON CONFLICT(manual_license_id,usage_date) DO UPDATE SET leads_processed=leads_processed+excluded.leads_processed,updated_at=CURRENT_TIMESTAMP",l.id,amount)
        ]);
      }catch(err){
        const won=await first(e,'SELECT manual_license_id,amount FROM manual_usage_events WHERE request_id=?',requestId);
        if(!won)throw err; if(Number(won.manual_license_id)!==Number(l.id)||Number(won.amount)!==amount)fail('REQUEST_ID_CONFLICT',409);
      }
    }
  }
  return json({ok:true,valid:true,license:{expiresAt:l.expires_at}});
}
async function adminRoutes(r,e,url){
  const p=url.pathname,m=r.method;
  if(p==='/api/admin/login'&&m==='POST'){
    await rateLimit(r,e,p); await ensureAdmin(e); const x=await body(r);
    if(!e.ADMIN_TOKEN||x.username!==(e.ADMIN_USERNAME||'anasbm')||await hash(String(x.password||''))!==await hash(e.ADMIN_TOKEN))fail('INVALID_ADMIN_CREDENTIALS',401);
    const t=random(32); await run(e,"INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,datetime('now','+4 hours'))",await hash(t)); await audit(e,'ADMIN_LOGIN','session','created',{ip:r.headers.get('cf-connecting-ip')}); return json({ok:true,token:t});
  }
  if(!p.startsWith('/api/admin/'))return null;
  const admin=await adminSession(r,e), s=await settings(e);
  if(p==='/api/admin/logout'&&m==='POST'){await run(e,'DELETE FROM admin_sessions WHERE id=?',admin.id);return json({ok:true})}
  if(p==='/api/admin/summary'&&m==='GET'){
    const c=async q=>Number((await first(e,q)).c||0);
    return json({ok:true,summary:{unusedCodes:await c("SELECT count(*) c FROM manual_licenses WHERE status='unused'"),activeLicenses:await c("SELECT count(*) c FROM manual_licenses WHERE status='active' AND julianday(expires_at)>julianday('now')"),expiredLicenses:await c("SELECT count(*) c FROM manual_licenses WHERE status='expired' OR (status='active' AND julianday(expires_at)<=julianday('now'))"),expiringSoon:await c("SELECT count(*) c FROM manual_licenses WHERE status='active' AND julianday(expires_at)>julianday('now') AND julianday(expires_at)<=julianday('now','+3 days')"),leadsToday:await c("SELECT coalesce(sum(leads_processed),0) c FROM manual_usage_daily WHERE usage_date=date('now')")}})
  }
  if(p==='/api/admin/settings'&&m==='GET')return json({ok:true,settings:await rows(e,'SELECT key,value,updated_at FROM settings ORDER BY key')});
  if(p==='/api/admin/settings'&&m==='PATCH'){
    const x=await body(r), allowed=new Set(['monthly_price_usd','annual_price_usd','monthly_daily_limit','allowed_devices','usdt_network','usdt_address','redotpay_id','support_contact','extension_version','extension_download_url','public_site_url']);
    const entries=Object.entries(x.settings||{}).filter(([k])=>allowed.has(k)); if(!entries.length)fail('NO_SETTINGS');
    await e.DB.batch(entries.map(([k,v])=>sql(e,"INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",k,String(v))));
    await audit(e,'SETTINGS_UPDATED','settings','platform',{keys:entries.map(x=>x[0])}); return json({ok:true});
  }
  if(p==='/api/admin/manual-licenses'&&m==='POST'){
    const x=await body(r), pl=plan(s,x.planId), count=clamp(Number(x.count||1),1,50), out=[];
    for(let i=0;i<count;i++){
      const raw=makeCode(), h=await hash(raw), hint=codeHint(raw);
      await run(e,'INSERT INTO manual_licenses(code_hash,code_hint,plan_id,duration_days,daily_lead_limit,device_limit,note) VALUES(?,?,?,?,?,?,?)',h,hint,pl.id,pl.durationDays,pl.dailyLeadLimit,s.allowed_devices,String(x.note||'').slice(0,500)||null);
      out.push(raw);
    }
    await audit(e,'MANUAL_CODES_CREATED','manual_license',String(count),{planId:pl.id,count}); return json({ok:true,codes:out},201);
  }
  if(p==='/api/admin/manual-licenses'&&m==='GET'){
    const q=String(url.searchParams.get('q')||'').trim(), limit=clamp(Number(url.searchParams.get('limit')||50),1,100), offset=Math.max(0,Number(url.searchParams.get('offset')||0));
    let data;
    if(q.toUpperCase().startsWith('MHP-'))data=await rows(e,"SELECT l.*,(SELECT count(*) FROM manual_license_devices d WHERE d.manual_license_id=l.id AND d.status='trusted') device_count,COALESCE((SELECT leads_processed FROM manual_usage_daily u WHERE u.manual_license_id=l.id AND u.usage_date=date('now')),0) used_today FROM manual_licenses l WHERE code_hash=? ORDER BY id DESC LIMIT ? OFFSET ?",await hash(q.toUpperCase()),limit,offset);
    else data=await rows(e,"SELECT l.*,(SELECT count(*) FROM manual_license_devices d WHERE d.manual_license_id=l.id AND d.status='trusted') device_count,COALESCE((SELECT leads_processed FROM manual_usage_daily u WHERE u.manual_license_id=l.id AND u.usage_date=date('now')),0) used_today FROM manual_licenses l WHERE code_hint LIKE ? OR coalesce(note,'') LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?",'%'+q+'%','%'+q+'%',limit,offset);
    return json({ok:true,licenses:data});
  }
  let mm=p.match(/^\/api\/admin\/manual-licenses\/(\d+)\/(revoke|extend|reset-devices)$/);
  if(mm&&m==='POST'){
    const id=Number(mm[1]),action=mm[2],l=await first(e,'SELECT * FROM manual_licenses WHERE id=?',id); if(!l)fail('LICENSE_NOT_FOUND',404);
    if(action==='revoke'){await run(e,"UPDATE manual_licenses SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=?",id);await audit(e,'MANUAL_LICENSE_REVOKED','manual_license',id);return json({ok:true})}
    if(action==='reset-devices'){await run(e,'DELETE FROM manual_license_devices WHERE manual_license_id=?',id);await audit(e,'MANUAL_DEVICES_RESET','manual_license',id);return json({ok:true})}
    if(action==='extend'){
      if(l.status==='revoked')fail('LICENSE_REVOKED',409); const x=await body(r),pl=plan(s,x.planId||l.plan_id);
      if(l.status==='unused')await run(e,'UPDATE manual_licenses SET plan_id=?,duration_days=?,daily_lead_limit=?,device_limit=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',pl.id,pl.durationDays,pl.dailyLeadLimit,s.allowed_devices,id);
      else await run(e,"UPDATE manual_licenses SET plan_id=?,duration_days=?,daily_lead_limit=?,device_limit=?,status='active',expires_at=datetime(CASE WHEN expires_at IS NOT NULL AND julianday(expires_at)>julianday('now') THEN expires_at ELSE CURRENT_TIMESTAMP END,'+'||?||' days'),updated_at=CURRENT_TIMESTAMP WHERE id=?",pl.id,pl.durationDays,pl.dailyLeadLimit,s.allowed_devices,pl.durationDays,id);
      await audit(e,'MANUAL_LICENSE_EXTENDED','manual_license',id,{planId:pl.id}); return json({ok:true,license:await first(e,'SELECT id,code_hint,plan_id,status,activated_at,expires_at FROM manual_licenses WHERE id=?',id)});
    }
  }
  if(p==='/api/admin/owner-access'&&m==='GET')return json({ok:true,owner:await first(e,'SELECT status,created_at,updated_at FROM owner_access WHERE id=1')});
  if(p==='/api/admin/owner-access/rotate'&&m==='POST'){
    const code='MHP-OWNER-'+random(32).toUpperCase(); await run(e,"INSERT INTO owner_access(id,code_hash,status) VALUES(1,?,'active') ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,status='active',updated_at=CURRENT_TIMESTAMP",await hash(code)); await audit(e,'OWNER_CODE_ROTATED','owner_access','1'); return json({ok:true,code,expiresAt:null},201);
  }
  if(p==='/api/admin/owner-access/revoke'&&m==='POST'){await run(e,"UPDATE owner_access SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=1");await audit(e,'OWNER_CODE_REVOKED','owner_access','1');return json({ok:true})}
  if(p==='/api/admin/logs'&&m==='GET'){const q='%'+String(url.searchParams.get('q')||'').slice(0,120)+'%';return json({ok:true,logs:await rows(e,"SELECT * FROM audit_logs WHERE event_type LIKE ? OR coalesce(target_id,'') LIKE ? ORDER BY id DESC LIMIT 100",q,q)})}
  return null;
}
async function maintenance(e){
  await e.DB.batch([
    sql(e,"DELETE FROM admin_sessions WHERE julianday(expires_at)<=julianday('now')"),
    sql(e,"DELETE FROM request_limits WHERE julianday(expires_at)<=julianday('now')"),
    sql(e,"UPDATE manual_licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='active' AND expires_at IS NOT NULL AND julianday(expires_at)<=julianday('now')"),
    sql(e,"DELETE FROM manual_usage_events WHERE julianday(created_at)<=julianday('now','-90 days')")
  ]);
}
async function dispatch(r,e){
  const url=new URL(r.url),p=url.pathname,m=r.method; if(m==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  if(p==='/api/health'){await ensureAdmin(e);return json({ok:true,version:'7.0.0-manual',database:(await first(e,'SELECT 1 ok')).ok===1?'connected':'error',mode:'manual-only'})}
  if(p==='/api/plans'&&m==='GET'){const s=await settings(e);return json({ok:true,plans:['monthly','annual'].map(id=>plan(s,id))})}
  if(p==='/api/payment-methods'&&m==='GET'){const s=await settings(e);return json({ok:true,methods:{USDT:{enabled:Boolean(s.usdt_address),network:s.usdt_network,address:s.usdt_address||null},REDOTPAY:{enabled:Boolean(s.redotpay_id),account:s.redotpay_id||null}},support:s.support_contact||null})}
  return await extensionRoutes(r,e,url)||await adminRoutes(r,e,url)||fail('NOT_FOUND',404);
}
export default {async fetch(r,e){try{return await dispatch(r,e)}catch(err){const message=String(err.message||err);const known=['INVALID_LICENSE','LICENSE_EXPIRED','LICENSE_REVOKED','DEVICE_LIMIT_REACHED','DEVICE_BLOCKED','DAILY_LIMIT_REACHED','REQUEST_ID_CONFLICT','INVALID_ADMIN_CREDENTIALS'].find(x=>message.includes(x));return json({ok:false,error:err.status?message:known||'SERVER_ERROR'},err.status||(known?409:500))}},async scheduled(c,e,ctx){ctx.waitUntil(maintenance(e))}};