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
    lifetime_price_usd:Number(db.lifetime_price_usd||db.annual_price_usd||100),
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
  if(!['monthly','lifetime','annual'].includes(id))fail('INVALID_PLAN');
  if(id==='monthly')return {id:'monthly',storagePlanId:'monthly',storageDurationDays:30,price:s.monthly_price_usd,durationDays:30,dailyLeadLimit:s.monthly_daily_limit,isLifetime:false};
  return {id:'lifetime',storagePlanId:'annual',storageDurationDays:365,price:s.lifetime_price_usd,durationDays:null,dailyLeadLimit:null,isLifetime:true};
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
    if(Number(l.is_lifetime)===1)await run(e,"UPDATE manual_licenses SET status='active',activated_at=CURRENT_TIMESTAMP,expires_at=NULL,last_validated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='unused'",l.id);
    else await run(e,"UPDATE manual_licenses SET status='active',activated_at=CURRENT_TIMESTAMP,expires_at=datetime('now','+'||duration_days||' days'),last_validated_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='unused'",l.id);
    l=await first(e,'SELECT * FROM manual_licenses WHERE id=?',l.id);
  }
  if(l.status==='active'&&Number(l.is_lifetime)===1&&l.expires_at){
    await run(e,"UPDATE manual_licenses SET expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",l.id);
    l.expires_at=null;
  }
  if(l.status==='active'&&Number(l.is_lifetime)!==1&&l.expires_at&&Date.parse(l.expires_at+'Z')<=Date.now()){
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
function adminHealth(row){
  const licenses=Number(row?.license_count||0),active=Number(row?.active_license_count||0);
  if(!licenses)return 'needs-link';
  if(!active)return 'problem';
  if(row?.next_expiry){
    const t=Date.parse(String(row.next_expiry).includes('T')?row.next_expiry:String(row.next_expiry)+'Z');
    if(Number.isFinite(t)&&t-Date.now()<=3*86400000)return 'attention';
  }
  return 'healthy';
}
async function customerRows(e,where='1=1',params=[]){
  const data=await rows(e,`SELECT c.*,
    COALESCE((SELECT SUM(s.amount_cents) FROM admin_sales s WHERE s.customer_id=c.id AND s.status='paid'),0) revenue_cents,
    COALESCE((SELECT COUNT(*) FROM admin_sales s WHERE s.customer_id=c.id AND s.status='paid'),0) sales_count,
    COALESCE((SELECT COUNT(*) FROM manual_licenses l WHERE l.customer_id=c.id),0) license_count,
    COALESCE((SELECT COUNT(*) FROM manual_licenses l WHERE l.customer_id=c.id AND l.status='active' AND (l.is_lifetime=1 OR julianday(l.expires_at)>julianday('now'))),0) active_license_count,
    COALESCE((SELECT SUM(u.leads_processed) FROM manual_usage_daily u JOIN manual_licenses l ON l.id=u.manual_license_id WHERE l.customer_id=c.id),0) total_leads,
    COALESCE((SELECT SUM(u.leads_processed) FROM manual_usage_daily u JOIN manual_licenses l ON l.id=u.manual_license_id WHERE l.customer_id=c.id AND u.usage_date=date('now')),0) leads_today,
    (SELECT MAX(l.last_validated_at) FROM manual_licenses l WHERE l.customer_id=c.id) last_validated_at,
    (SELECT MAX(d.last_seen_at) FROM manual_license_devices d JOIN manual_licenses l ON l.id=d.manual_license_id WHERE l.customer_id=c.id) device_last_seen_at,
    (SELECT MAX(u.usage_date) FROM manual_usage_daily u JOIN manual_licenses l ON l.id=u.manual_license_id WHERE l.customer_id=c.id) last_usage_date,
    (SELECT MIN(l.expires_at) FROM manual_licenses l WHERE l.customer_id=c.id AND l.status='active' AND l.is_lifetime=0 AND l.expires_at IS NOT NULL) next_expiry
    FROM admin_customers c WHERE ${where} ORDER BY c.id DESC`,...params);
  return data.map(x=>({...x,health:adminHealth(x)}));
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
    const c=async(q,...args)=>Number((await first(e,q,...args))?.c||0);
    const revenue=await c("SELECT coalesce(sum(amount_cents),0) c FROM admin_sales WHERE status='paid'");
    const sales=await c("SELECT count(*) c FROM admin_sales WHERE status='paid'");
    const customers=await c("SELECT count(*) c FROM admin_customers WHERE status<>'archived'");
    const countryRevenue=await rows(e,"SELECT c.country_name country,coalesce(sum(s.amount_cents),0) revenue_cents,count(s.id) sales FROM admin_sales s JOIN admin_customers c ON c.id=s.customer_id WHERE s.status='paid' GROUP BY c.country_name ORDER BY revenue_cents DESC LIMIT 10");
    const customerHealth=await customerRows(e,"c.status<>'archived'");
    return json({ok:true,summary:{
      totalRevenueCents:revenue,salesCount:sales,customersCount:customers,countriesCount:await c("SELECT count(DISTINCT country_code) c FROM admin_customers WHERE status<>'archived' AND coalesce(country_code,'')<>''"),averageSaleCents:sales?Math.round(revenue/sales):0,
      unusedCodes:await c("SELECT count(*) c FROM manual_licenses WHERE status='unused'"),
      activeLicenses:await c("SELECT count(*) c FROM manual_licenses WHERE status='active' AND (is_lifetime=1 OR julianday(expires_at)>julianday('now'))"),
      expiredLicenses:await c("SELECT count(*) c FROM manual_licenses WHERE status='expired' OR (status='active' AND is_lifetime=0 AND julianday(expires_at)<=julianday('now'))"),
      expiringSoon:await c("SELECT count(*) c FROM manual_licenses WHERE status='active' AND is_lifetime=0 AND julianday(expires_at)>julianday('now') AND julianday(expires_at)<=julianday('now','+3 days')"),
      leadsToday:await c("SELECT coalesce(sum(leads_processed),0) c FROM manual_usage_daily WHERE usage_date=date('now')"),
      leads7d:await c("SELECT coalesce(sum(leads_processed),0) c FROM manual_usage_daily WHERE usage_date>=date('now','-6 days')"),
      totalLeads:await c("SELECT coalesce(sum(leads_processed),0) c FROM manual_usage_daily"),
      attentionCustomers:customerHealth.filter(x=>x.health!=='healthy').length
    },countryRevenue,recentCustomers:customerHealth.slice(0,6)});
  }

  if(p==='/api/admin/customers'&&m==='GET'){
    const q=String(url.searchParams.get('q')||'').trim().slice(0,120);
    const where=q?"c.status<>'archived' AND (c.display_name LIKE ? OR coalesce(c.country_name,'') LIKE ? OR coalesce(c.contact,'') LIKE ? OR coalesce(c.note,'') LIKE ?)":"c.status<>'archived'";
    const params=q?Array(4).fill('%'+q+'%'):[];
    return json({ok:true,customers:await customerRows(e,where,params)});
  }
  if(p==='/api/admin/customers'&&m==='POST'){
    const x=await body(r),name=String(x.displayName||'').trim().slice(0,120); if(!name)fail('CUSTOMER_NAME_REQUIRED');
    const result=await run(e,'INSERT INTO admin_customers(display_name,country_code,country_name,contact,note) VALUES(?,?,?,?,?)',name,String(x.countryCode||'').trim().toUpperCase().slice(0,8)||null,String(x.countryName||'').trim().slice(0,80)||null,String(x.contact||'').trim().slice(0,160)||null,String(x.note||'').trim().slice(0,1000)||null);
    const id=Number(result.meta?.last_row_id||0); await audit(e,'CUSTOMER_CREATED','customer',id,{displayName:name});
    return json({ok:true,customer:(await customerRows(e,'c.id=?',[id]))[0]},201);
  }
  let cm=p.match(/^\/api\/admin\/customers\/(\d+)$/);
  if(cm&&m==='GET'){
    const id=Number(cm[1]),customer=(await customerRows(e,'c.id=?',[id]))[0]; if(!customer)fail('CUSTOMER_NOT_FOUND',404);
    const licenses=await rows(e,`SELECT l.*,
      (SELECT count(*) FROM manual_license_devices d WHERE d.manual_license_id=l.id AND d.status='trusted') device_count,
      COALESCE((SELECT sum(u.leads_processed) FROM manual_usage_daily u WHERE u.manual_license_id=l.id),0) total_leads,
      COALESCE((SELECT sum(u.leads_processed) FROM manual_usage_daily u WHERE u.manual_license_id=l.id AND u.usage_date=date('now')),0) used_today,
      (SELECT max(d.last_seen_at) FROM manual_license_devices d WHERE d.manual_license_id=l.id) device_last_seen_at
      FROM manual_licenses l WHERE l.customer_id=? ORDER BY l.id DESC`,id);
    const salesRows=await rows(e,'SELECT * FROM admin_sales WHERE customer_id=? ORDER BY coalesce(sold_at,created_at) DESC,id DESC',id);
    const usage=await rows(e,"SELECT u.usage_date,sum(u.leads_processed) leads FROM manual_usage_daily u JOIN manual_licenses l ON l.id=u.manual_license_id WHERE l.customer_id=? GROUP BY u.usage_date ORDER BY u.usage_date DESC LIMIT 90",id);
    const support=await rows(e,'SELECT * FROM admin_support_events WHERE customer_id=? OR manual_license_id IN (SELECT id FROM manual_licenses WHERE customer_id=?) ORDER BY id DESC LIMIT 100',id,id);
    const today=new Date(),cut7=new Date(today.getTime()-6*86400000).toISOString().slice(0,10),cut30=new Date(today.getTime()-29*86400000).toISOString().slice(0,10);
    const leads7d=usage.filter(x=>x.usage_date>=cut7).reduce((a,x)=>a+Number(x.leads||0),0),leads30d=usage.filter(x=>x.usage_date>=cut30).reduce((a,x)=>a+Number(x.leads||0),0),peak=usage.reduce((a,x)=>Math.max(a,Number(x.leads||0)),0);
    return json({ok:true,customer,licenses,sales:salesRows,usage,metrics:{leads7d,leads30d,peakDay:peak,activeDays:usage.length},support});
  }
  if(cm&&m==='PATCH'){
    const id=Number(cm[1]); if(!(await first(e,'SELECT id FROM admin_customers WHERE id=?',id)))fail('CUSTOMER_NOT_FOUND',404);
    const x=await body(r),sets=[],vals=[];
    const fields=[['displayName','display_name',120],['countryCode','country_code',8],['countryName','country_name',80],['contact','contact',160],['note','note',1000],['status','status',16]];
    for(const [key,col,max] of fields)if(Object.prototype.hasOwnProperty.call(x,key)){let v=String(x[key]??'').trim().slice(0,max)||null;if(key==='countryCode'&&v)v=v.toUpperCase();if(key==='status'&&!['active','inactive','archived'].includes(v))fail('INVALID_CUSTOMER_STATUS');sets.push(`${col}=?`);vals.push(v)}
    if(!sets.length)fail('NO_CHANGES'); vals.push(id); await run(e,`UPDATE admin_customers SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`,...vals); await audit(e,'CUSTOMER_UPDATED','customer',id,{fields:sets.map(x=>x.split('=')[0])});
    return json({ok:true,customer:(await customerRows(e,'c.id=?',[id]))[0]});
  }
  let cl=p.match(/^\/api\/admin\/customers\/(\d+)\/(link-license|unlink-license)$/);
  if(cl&&m==='POST'){
    const customerId=Number(cl[1]),action=cl[2],x=await body(r),licenseId=Number(x.licenseId||0); if(!licenseId)fail('LICENSE_REQUIRED');
    if(!(await first(e,'SELECT id FROM admin_customers WHERE id=?',customerId)))fail('CUSTOMER_NOT_FOUND',404);
    if(!(await first(e,'SELECT id FROM manual_licenses WHERE id=?',licenseId)))fail('LICENSE_NOT_FOUND',404);
    if(action==='link-license')await run(e,'UPDATE manual_licenses SET customer_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',customerId,licenseId); else await run(e,'UPDATE manual_licenses SET customer_id=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=?',licenseId,customerId);
    await audit(e,action==='link-license'?'CUSTOMER_LICENSE_LINKED':'CUSTOMER_LICENSE_UNLINKED','manual_license',licenseId,{customerId}); return json({ok:true});
  }

  if(p==='/api/admin/sales'&&m==='GET'){
    const q=String(url.searchParams.get('q')||'').trim().slice(0,120),like='%'+q+'%';
    const salesRows=await rows(e,`SELECT s.*,c.display_name customer_name,c.country_name,l.code_hint license_hint FROM admin_sales s JOIN admin_customers c ON c.id=s.customer_id LEFT JOIN manual_licenses l ON l.id=s.manual_license_id WHERE ?='' OR c.display_name LIKE ? OR coalesce(c.country_name,'') LIKE ? OR coalesce(s.transaction_reference,'') LIKE ? ORDER BY coalesce(s.sold_at,s.created_at) DESC,s.id DESC LIMIT 200`,q,like,like,like);
    return json({ok:true,sales:salesRows});
  }
  if(p==='/api/admin/sales'&&m==='POST'){
    const x=await body(r),customerId=Number(x.customerId||0),licenseId=x.manualLicenseId?Number(x.manualLicenseId):null;
    if(!(await first(e,'SELECT id FROM admin_customers WHERE id=?',customerId)))fail('CUSTOMER_NOT_FOUND',404);
    if(licenseId&&!(await first(e,'SELECT id FROM manual_licenses WHERE id=?',licenseId)))fail('LICENSE_NOT_FOUND',404);
    const amountCents=Number.isInteger(Number(x.amountCents))?Number(x.amountCents):Math.round(Number(x.amountUsd||0)*100); if(!Number.isInteger(amountCents)||amountCents<0)fail('INVALID_AMOUNT');
    const soldAt=String(x.soldAt||'').trim()||null;
    const result=await run(e,'INSERT INTO admin_sales(customer_id,manual_license_id,amount_cents,currency,plan_label,payment_method,transaction_reference,status,sold_at,note) VALUES(?,?,?,?,?,?,?,?,?,?)',customerId,licenseId,amountCents,String(x.currency||'USD').trim().toUpperCase().slice(0,8),String(x.planLabel||'').trim().slice(0,80)||null,String(x.paymentMethod||'Manual').trim().slice(0,80)||null,String(x.transactionReference||'').trim().slice(0,180)||null,'paid',soldAt,String(x.note||'').trim().slice(0,1000)||null);
    const id=Number(result.meta?.last_row_id||0); await audit(e,'SALE_CREATED','sale',id,{customerId,amountCents,licenseId}); return json({ok:true,id},201);
  }
  let sm=p.match(/^\/api\/admin\/sales\/(\d+)$/);
  if(sm&&m==='PATCH'){
    const id=Number(sm[1]),sale=await first(e,'SELECT id FROM admin_sales WHERE id=?',id); if(!sale)fail('SALE_NOT_FOUND',404); const x=await body(r),sets=[],vals=[];
    if(Object.prototype.hasOwnProperty.call(x,'status')){if(!['paid','refunded','void'].includes(x.status))fail('INVALID_SALE_STATUS');sets.push('status=?');vals.push(x.status)}
    if(Object.prototype.hasOwnProperty.call(x,'amountCents')){const n=Number(x.amountCents);if(!Number.isInteger(n)||n<0)fail('INVALID_AMOUNT');sets.push('amount_cents=?');vals.push(n)}
    for(const [key,col,max] of [['planLabel','plan_label',80],['paymentMethod','payment_method',80],['transactionReference','transaction_reference',180],['note','note',1000],['soldAt','sold_at',40]])if(Object.prototype.hasOwnProperty.call(x,key)){sets.push(`${col}=?`);vals.push(String(x[key]??'').trim().slice(0,max)||null)}
    if(!sets.length)fail('NO_CHANGES');vals.push(id);await run(e,`UPDATE admin_sales SET ${sets.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`,...vals);await audit(e,'SALE_UPDATED','sale',id,{fields:sets.map(x=>x.split('=')[0])});return json({ok:true});
  }

  if(p==='/api/admin/support-events'&&m==='GET'){
    const data=await rows(e,`SELECT se.*,c.display_name customer_name,l.code_hint license_hint FROM admin_support_events se LEFT JOIN admin_customers c ON c.id=se.customer_id LEFT JOIN manual_licenses l ON l.id=se.manual_license_id ORDER BY se.id DESC LIMIT 200`); return json({ok:true,events:data});
  }

  if(p==='/api/admin/settings'&&m==='GET')return json({ok:true,settings:await rows(e,'SELECT key,value,updated_at FROM settings ORDER BY key')});
  if(p==='/api/admin/settings'&&m==='PATCH'){
    const x=await body(r), allowed=new Set(['monthly_price_usd','lifetime_price_usd','annual_price_usd','monthly_daily_limit','allowed_devices','usdt_network','usdt_address','redotpay_id','support_contact','extension_version','extension_download_url','public_site_url']);
    const entries=Object.entries(x.settings||{}).filter(([k])=>allowed.has(k)); if(!entries.length)fail('NO_SETTINGS');
    await e.DB.batch(entries.map(([k,v])=>sql(e,"INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP",k,String(v))));
    await audit(e,'SETTINGS_UPDATED','settings','platform',{keys:entries.map(x=>x[0])}); return json({ok:true});
  }
  if(p==='/api/admin/manual-licenses'&&m==='POST'){
    const x=await body(r), pl=plan(s,x.planId), count=clamp(Number(x.count||1),1,50), out=[];
    for(let i=0;i<count;i++){
      const raw=makeCode(), h=await hash(raw), hint=codeHint(raw);
      await run(e,'INSERT INTO manual_licenses(code_hash,code_hint,plan_id,duration_days,daily_lead_limit,device_limit,note,is_lifetime,customer_id) VALUES(?,?,?,?,?,?,?,?,?)',h,hint,pl.storagePlanId,pl.storageDurationDays,pl.dailyLeadLimit,s.allowed_devices,String(x.note||'').slice(0,500)||null,pl.isLifetime?1:0,x.customerId?Number(x.customerId):null);
      out.push(raw);
    }
    await audit(e,'MANUAL_CODES_CREATED','manual_license',String(count),{planId:pl.id,count,customerId:x.customerId||null}); return json({ok:true,codes:out},201);
  }
  if(p==='/api/admin/manual-licenses'&&m==='GET'){
    const q=String(url.searchParams.get('q')||'').trim(), limit=clamp(Number(url.searchParams.get('limit')||100),1,200), offset=Math.max(0,Number(url.searchParams.get('offset')||0));
    const base=`SELECT l.*,c.display_name customer_name,c.country_name,
      (SELECT count(*) FROM manual_license_devices d WHERE d.manual_license_id=l.id AND d.status='trusted') device_count,
      COALESCE((SELECT leads_processed FROM manual_usage_daily u WHERE u.manual_license_id=l.id AND u.usage_date=date('now')),0) used_today,
      COALESCE((SELECT sum(leads_processed) FROM manual_usage_daily u WHERE u.manual_license_id=l.id),0) total_leads,
      (SELECT max(usage_date) FROM manual_usage_daily u WHERE u.manual_license_id=l.id) last_usage_date,
      (SELECT max(last_seen_at) FROM manual_license_devices d WHERE d.manual_license_id=l.id) device_last_seen_at
      FROM manual_licenses l LEFT JOIN admin_customers c ON c.id=l.customer_id`;
    let data;
    if(q.toUpperCase().startsWith('MHP-'))data=await rows(e,base+" WHERE l.code_hash=? ORDER BY l.id DESC LIMIT ? OFFSET ?",await hash(q.toUpperCase()),limit,offset);
    else data=await rows(e,base+" WHERE l.code_hint LIKE ? OR coalesce(l.note,'') LIKE ? OR coalesce(c.display_name,'') LIKE ? OR coalesce(c.country_name,'') LIKE ? ORDER BY l.id DESC LIMIT ? OFFSET ?",'%'+q+'%','%'+q+'%','%'+q+'%','%'+q+'%',limit,offset);
    data=data.map(x=>({...x,health:adminHealth({license_count:1,active_license_count:x.status==='active'&&(Number(x.is_lifetime)===1||!x.expires_at||Date.parse(x.expires_at+'Z')>Date.now())?1:0,next_expiry:Number(x.is_lifetime)===1?null:x.expires_at})}));
    return json({ok:true,licenses:data});
  }
  let mm=p.match(/^\/api\/admin\/manual-licenses\/(\d+)\/(revoke|extend|reset-devices)$/);
  if(mm&&m==='POST'){
    const id=Number(mm[1]),action=mm[2],l=await first(e,'SELECT * FROM manual_licenses WHERE id=?',id); if(!l)fail('LICENSE_NOT_FOUND',404);
    if(action==='revoke'){await run(e,"UPDATE manual_licenses SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=?",id);await audit(e,'MANUAL_LICENSE_REVOKED','manual_license',id);return json({ok:true})}
    if(action==='reset-devices'){await run(e,'DELETE FROM manual_license_devices WHERE manual_license_id=?',id);await audit(e,'MANUAL_DEVICES_RESET','manual_license',id);return json({ok:true})}
    if(action==='extend'){
      if(l.status==='revoked')fail('LICENSE_REVOKED',409); const x=await body(r),pl=plan(s,x.planId||l.plan_id);
      if(l.status==='unused')await run(e,'UPDATE manual_licenses SET plan_id=?,duration_days=?,daily_lead_limit=?,device_limit=?,is_lifetime=?,expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?',pl.storagePlanId,pl.storageDurationDays,pl.dailyLeadLimit,s.allowed_devices,pl.isLifetime?1:0,id);
      else if(pl.isLifetime)await run(e,"UPDATE manual_licenses SET plan_id=?,duration_days=?,daily_lead_limit=?,device_limit=?,is_lifetime=1,status='active',expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?",pl.storagePlanId,pl.storageDurationDays,pl.dailyLeadLimit,s.allowed_devices,id);
      else await run(e,"UPDATE manual_licenses SET plan_id=?,duration_days=?,daily_lead_limit=?,device_limit=?,is_lifetime=0,status='active',expires_at=datetime(CASE WHEN expires_at IS NOT NULL AND julianday(expires_at)>julianday('now') THEN expires_at ELSE CURRENT_TIMESTAMP END,'+'||?||' days'),updated_at=CURRENT_TIMESTAMP WHERE id=?",pl.storagePlanId,pl.storageDurationDays,pl.dailyLeadLimit,s.allowed_devices,pl.storageDurationDays,id);
      await audit(e,'MANUAL_LICENSE_EXTENDED','manual_license',id,{planId:pl.id}); return json({ok:true,license:await first(e,'SELECT id,code_hint,plan_id,status,activated_at,expires_at FROM manual_licenses WHERE id=?',id)});
    }
  }
  if(p==='/api/admin/owner-access'&&m==='GET')return json({ok:true,owner:await first(e,'SELECT status,created_at,updated_at FROM owner_access WHERE id=1')});
  if(p==='/api/admin/owner-access/rotate'&&m==='POST'){
    const code='MHP-OWNER-'+random(32).toUpperCase(); await run(e,"INSERT INTO owner_access(id,code_hash,status) VALUES(1,?,'active') ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,status='active',updated_at=CURRENT_TIMESTAMP",await hash(code)); await audit(e,'OWNER_CODE_ROTATED','owner_access','1'); return json({ok:true,code,expiresAt:null},201);
  }
  if(p==='/api/admin/owner-access/revoke'&&m==='POST'){await run(e,"UPDATE owner_access SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=1");await audit(e,'OWNER_CODE_REVOKED','owner_access','1');return json({ok:true})}
  if(p==='/api/admin/logs'&&m==='GET'){const q='%'+String(url.searchParams.get('q')||'').slice(0,120)+'%';return json({ok:true,logs:await rows(e,"SELECT * FROM audit_logs WHERE event_type LIKE ? OR coalesce(target_id,'') LIKE ? ORDER BY id DESC LIMIT 150",q,q)})}
  return null;
}
async function maintenance(e){
  await e.DB.batch([
    sql(e,"DELETE FROM admin_sessions WHERE julianday(expires_at)<=julianday('now')"),
    sql(e,"DELETE FROM request_limits WHERE julianday(expires_at)<=julianday('now')"),
    sql(e,"UPDATE manual_licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='active' AND is_lifetime=0 AND expires_at IS NOT NULL AND julianday(expires_at)<=julianday('now')"),
    sql(e,"DELETE FROM manual_usage_events WHERE julianday(created_at)<=julianday('now','-90 days')")
  ]);
}
async function dispatch(r,e){
  const url=new URL(r.url),p=url.pathname,m=r.method; if(m==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
  if(p==='/api/health'){await ensureAdmin(e);return json({ok:true,version:'7.0.0-manual',database:(await first(e,'SELECT 1 ok')).ok===1?'connected':'error',mode:'manual-only'})}
  if(p==='/api/plans'&&m==='GET'){const s=await settings(e);return json({ok:true,plans:['monthly','lifetime'].map(id=>plan(s,id)).map(({storagePlanId,storageDurationDays,...x})=>x)})}
  if(p==='/api/payment-methods'&&m==='GET'){const s=await settings(e);return json({ok:true,methods:{USDT:{enabled:Boolean(s.usdt_address),network:s.usdt_network,address:s.usdt_address||null},REDOTPAY:{enabled:Boolean(s.redotpay_id),account:s.redotpay_id||null}},support:s.support_contact||null})}
  return await extensionRoutes(r,e,url)||await adminRoutes(r,e,url)||fail('NOT_FOUND',404);
}
export default {async fetch(r,e){try{return await dispatch(r,e)}catch(err){const message=String(err.message||err);const known=['INVALID_LICENSE','LICENSE_EXPIRED','LICENSE_REVOKED','DEVICE_LIMIT_REACHED','DEVICE_BLOCKED','DAILY_LIMIT_REACHED','REQUEST_ID_CONFLICT','INVALID_ADMIN_CREDENTIALS'].find(x=>message.includes(x));return json({ok:false,error:err.status?message:known||'SERVER_ERROR'},err.status||(known?409:500))}},async scheduled(c,e,ctx){ctx.waitUntil(maintenance(e))}};