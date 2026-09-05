const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization,x-admin-token'
};

const PLANS = {
  monthly: { id: 'monthly', name: 'Monthly', price: 20, amountCents: 2000, currency: 'USD', billing: 'month', dailyLeadLimit: 1500 },
  annual: { id: 'annual', name: 'Annual', price: 100, amountCents: 10000, currency: 'USD', billing: 'year', dailyLeadLimit: null }
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...extraHeaders } });
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

function validEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function cleanEmail(value) { return String(value || '').trim().toLowerCase(); }
function uid(prefix) { return `${prefix}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`; }
function licenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12); crypto.getRandomValues(bytes);
  let raw = ''; for (const b of bytes) raw += chars[b % chars.length];
  return `MHP-${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`;
}
function referralCode() { return `AF-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`; }
function ipOf(request) { return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || null; }

function isAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return false;
  const auth = request.headers.get('authorization') || '';
  const x = request.headers.get('x-admin-token') || '';
  return auth === `Bearer ${env.ADMIN_TOKEN}` || x === env.ADMIN_TOKEN;
}

async function audit(env, request, eventType, actorType, actor, targetType, targetId, result = 'success', metadata = null) {
  try {
    await env.DB.prepare(`INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,ip,result,metadata_json) VALUES(?,?,?,?,?,?,?,?)`)
      .bind(eventType, actorType, actor || null, targetType || null, targetId ? String(targetId) : null, ipOf(request), result, metadata ? JSON.stringify(metadata) : null).run();
  } catch (_) {}
}

async function getOrCreateUser(env, email, name = null, locale = 'en') {
  const normalized = cleanEmail(email);
  let user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalized).first();
  if (user) return user;
  await env.DB.prepare('INSERT INTO users(email,name,locale) VALUES(?,?,?)').bind(normalized, name || null, locale || 'en').run();
  return env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(normalized).first();
}

async function publicPlans(env) {
  const rows = await env.DB.prepare('SELECT key,value FROM settings').all();
  const settings = Object.fromEntries((rows.results || []).map(r => [r.key, r.value]));
  return {
    plans: [
      { ...PLANS.monthly, price: Number(settings.monthly_price_usd || 20), dailyLeadLimit: Number(settings.monthly_daily_limit || 1500) },
      { ...PLANS.annual, price: Number(settings.annual_price_usd || 100), dailyLeadLimit: null }
    ],
    paymentMethods: String(settings.payment_methods || 'USDT,REDOTPAY').split(',').map(x => x.trim()).filter(Boolean),
    affiliate: {
      firstPurchasePercent: Number(settings.affiliate_first_purchase_percent || 50),
      renewalPercent: Number(settings.affiliate_renewal_percent || 20)
    }
  };
}

async function handleCheckout(request, env) {
  const body = await readJson(request);
  if (!body || !validEmail(body.email)) return json({ ok:false, error:'VALID_EMAIL_REQUIRED' }, 400);
  const plan = PLANS[body.planId];
  if (!plan) return json({ ok:false, error:'INVALID_PLAN' }, 400);
  const method = String(body.method || 'USDT').toUpperCase();
  if (!['USDT','REDOTPAY'].includes(method)) return json({ ok:false, error:'INVALID_PAYMENT_METHOD' }, 400);

  const user = await getOrCreateUser(env, body.email, body.name, body.locale);
  const current = await env.DB.prepare(`SELECT s.* FROM subscriptions s WHERE s.user_id=? AND s.status='active' ORDER BY s.id DESC LIMIT 1`).bind(user.id).first();
  const paymentType = current ? 'renewal' : 'first_purchase';
  const paymentRef = uid('PAY');
  await env.DB.prepare(`INSERT INTO payments(payment_ref,user_id,method,amount_cents,currency,payment_type,status) VALUES(?,?,?,?,?,?, 'pending')`)
    .bind(paymentRef, user.id, method, plan.amountCents, 'USD', paymentType).run();

  if (body.referralCode) {
    const affiliate = await env.DB.prepare(`SELECT id FROM affiliates WHERE referral_code=? AND status='active'`).bind(String(body.referralCode).trim().toUpperCase()).first();
    if (affiliate) await env.DB.prepare(`INSERT OR IGNORE INTO referrals(affiliate_id,referred_user_id) VALUES(?,?)`).bind(affiliate.id, user.id).run();
  }

  await audit(env, request, 'CHECKOUT_CREATED', 'user', user.email, 'payment', paymentRef, 'success', { planId: plan.id, method, paymentType });
  return json({ ok:true, payment:{ reference:paymentRef, status:'pending', amount:plan.price, currency:'USD', method, type:paymentType }, plan, next:'PAYMENT_VERIFICATION_REQUIRED' }, 201);
}

async function handleAffiliateRegister(request, env) {
  const body = await readJson(request);
  if (!body || !validEmail(body.email)) return json({ ok:false, error:'VALID_EMAIL_REQUIRED' }, 400);
  const email = cleanEmail(body.email);
  let affiliate = await env.DB.prepare('SELECT * FROM affiliates WHERE email=?').bind(email).first();
  if (!affiliate) {
    const code = referralCode();
    await env.DB.prepare(`INSERT INTO affiliates(email,name,referral_code,status) VALUES(?,?,?,'active')`).bind(email, body.name || null, code).run();
    affiliate = await env.DB.prepare('SELECT * FROM affiliates WHERE email=?').bind(email).first();
    await audit(env, request, 'AFFILIATE_CREATED', 'affiliate', email, 'affiliate', affiliate.id, 'success');
  }
  return json({ ok:true, affiliate:{ id:affiliate.id, email:affiliate.email, name:affiliate.name, referralCode:affiliate.referral_code, status:affiliate.status, firstPurchasePercent:affiliate.first_purchase_percent, renewalPercent:affiliate.renewal_percent } }, 201);
}

async function handleLicenseValidate(request, env) {
  const body = await readJson(request);
  if (!body || typeof body.licenseKey !== 'string') return json({ ok:false, valid:false, error:'LICENSE_KEY_REQUIRED' }, 400);
  const key = body.licenseKey.trim().toUpperCase();
  const row = await env.DB.prepare(`SELECT l.*,u.email,s.plan_id,s.status AS subscription_status FROM licenses l JOIN users u ON u.id=l.user_id LEFT JOIN subscriptions s ON s.id=l.subscription_id WHERE l.license_key=?`).bind(key).first();
  if (!row || row.status !== 'active') {
    await audit(env, request, 'LICENSE_VALIDATE', 'extension', body.email || null, 'license', key, 'denied');
    return json({ ok:true, valid:false, reason: row ? row.status : 'not_found' });
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    await env.DB.prepare(`UPDATE licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(row.id).run();
    return json({ ok:true, valid:false, reason:'expired' });
  }

  if (body.deviceId) {
    const device = await env.DB.prepare('SELECT * FROM devices WHERE license_id=? AND device_uid=?').bind(row.id, String(body.deviceId)).first();
    if (!device) {
      const count = await env.DB.prepare(`SELECT COUNT(*) AS c FROM devices WHERE license_id=? AND status!='blocked'`).bind(row.id).first();
      if (Number(count.c) >= Number(row.device_limit)) return json({ ok:true, valid:false, reason:'device_limit_reached', deviceLimit:row.device_limit });
      await env.DB.prepare(`INSERT INTO devices(user_id,license_id,device_uid,os,browser,last_ip,status) VALUES(?,?,?,?,?,?,'trusted')`)
        .bind(row.user_id,row.id,String(body.deviceId),body.os||null,body.browser||null,ipOf(request)).run();
    } else {
      if (device.status === 'blocked') return json({ ok:true, valid:false, reason:'device_blocked' });
      await env.DB.prepare(`UPDATE devices SET last_seen_at=CURRENT_TIMESTAMP,last_ip=?,os=COALESCE(?,os),browser=COALESCE(?,browser) WHERE id=?`)
        .bind(ipOf(request),body.os||null,body.browser||null,device.id).run();
    }
  }
  await audit(env, request, 'LICENSE_VALIDATE', 'extension', row.email, 'license', key, 'allowed');
  return json({ ok:true, valid:true, license:{ key, planId:row.plan_id, expiresAt:row.expires_at, deviceLimit:row.device_limit }, user:{ email:row.email } });
}

async function adminSummary(env) {
  const q = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) c FROM users WHERE status='active'`),
    env.DB.prepare(`SELECT COUNT(*) c FROM subscriptions WHERE status='active'`),
    env.DB.prepare(`SELECT COUNT(*) c FROM licenses WHERE status='active'`),
    env.DB.prepare(`SELECT COALESCE(SUM(amount_cents),0) cents FROM payments WHERE status='confirmed' AND substr(confirmed_at,1,7)=substr(datetime('now'),1,7)`),
    env.DB.prepare(`SELECT COALESCE(SUM(leads_processed),0) c FROM usage_daily WHERE usage_date=date('now')`),
    env.DB.prepare(`SELECT COUNT(*) c FROM payments WHERE status='pending'`),
    env.DB.prepare(`SELECT COUNT(*) c FROM affiliates WHERE status='active'`),
    env.DB.prepare(`SELECT COUNT(*) c FROM subscriptions WHERE status='active' AND expires_at IS NOT NULL AND expires_at <= datetime('now','+3 days')`)
  ]);
  return {
    activeUsers:Number(q[0].results?.[0]?.c||0), activeSubscriptions:Number(q[1].results?.[0]?.c||0), activeLicenses:Number(q[2].results?.[0]?.c||0),
    monthlyRevenue:Number(q[3].results?.[0]?.cents||0)/100, leadsToday:Number(q[4].results?.[0]?.c||0), pendingPayments:Number(q[5].results?.[0]?.c||0),
    activeAffiliates:Number(q[6].results?.[0]?.c||0), expiringSoon:Number(q[7].results?.[0]?.c||0)
  };
}

async function handleAdmin(request, env, url) {
  if (!isAdmin(request, env)) return json({ ok:false, error:'UNAUTHORIZED' }, 401);
  const p = url.pathname;
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 100), 1), 500);

  if (p === '/api/admin/summary' && request.method === 'GET') return json({ ok:true, summary:await adminSummary(env) });
  if (p === '/api/admin/users' && request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT u.*, (SELECT plan_id FROM subscriptions s WHERE s.user_id=u.id ORDER BY s.id DESC LIMIT 1) plan_id, (SELECT status FROM subscriptions s WHERE s.user_id=u.id ORDER BY s.id DESC LIMIT 1) subscription_status, (SELECT expires_at FROM subscriptions s WHERE s.user_id=u.id ORDER BY s.id DESC LIMIT 1) expires_at, (SELECT COUNT(*) FROM devices d WHERE d.user_id=u.id) devices FROM users u ORDER BY u.id DESC LIMIT ?`).bind(limit).all();
    return json({ok:true,users:rows.results||[]});
  }
  if (p === '/api/admin/subscriptions' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT s.*,u.email FROM subscriptions s JOIN users u ON u.id=s.user_id ORDER BY s.id DESC LIMIT ?`).bind(limit).all(); return json({ok:true,subscriptions:rows.results||[]});
  }
  if (p === '/api/admin/licenses' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT l.*,u.email,s.plan_id FROM licenses l JOIN users u ON u.id=l.user_id LEFT JOIN subscriptions s ON s.id=l.subscription_id ORDER BY l.id DESC LIMIT ?`).bind(limit).all(); return json({ok:true,licenses:rows.results||[]});
  }
  if (p === '/api/admin/licenses' && request.method === 'POST') {
    const body=await readJson(request); if(!body||!validEmail(body.email)||!PLANS[body.planId]) return json({ok:false,error:'VALID_EMAIL_AND_PLAN_REQUIRED'},400);
    const user=await getOrCreateUser(env,body.email,body.name); const plan=PLANS[body.planId]; const days=body.planId==='annual'?365:30;
    await env.DB.prepare(`INSERT INTO subscriptions(user_id,plan_id,status,started_at,expires_at,daily_lead_limit) VALUES(?,?,'active',CURRENT_TIMESTAMP,datetime('now', ?),?)`)
      .bind(user.id,plan.id,`+${days} days`,plan.dailyLeadLimit).run();
    const sub=await env.DB.prepare(`SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1`).bind(user.id).first();
    let key; for(let i=0;i<5;i++){ key=licenseKey(); const exists=await env.DB.prepare('SELECT id FROM licenses WHERE license_key=?').bind(key).first(); if(!exists)break; }
    const deviceLimit=Math.min(Math.max(Number(body.deviceLimit||2),1),10);
    await env.DB.prepare(`INSERT INTO licenses(user_id,subscription_id,license_key,status,device_limit,activated_at,expires_at) VALUES(?,?,?,'active',?,CURRENT_TIMESTAMP,?)`).bind(user.id,sub.id,key,deviceLimit,sub.expires_at).run();
    await audit(env,request,'LICENSE_CREATE','admin','admin','license',key,'success',{email:user.email,planId:plan.id});
    return json({ok:true,license:{licenseKey:key,email:user.email,planId:plan.id,expiresAt:sub.expires_at,deviceLimit}},201);
  }
  const revokeMatch=p.match(/^\/api\/admin\/licenses\/([^/]+)\/revoke$/);
  if(revokeMatch&&request.method==='POST'){
    const key=decodeURIComponent(revokeMatch[1]).toUpperCase(); const r=await env.DB.prepare(`UPDATE licenses SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE license_key=?`).bind(key).run();
    await audit(env,request,'LICENSE_REVOKE','admin','admin','license',key,r.meta?.changes?'success':'not_found'); return json({ok:true,changed:r.meta?.changes||0});
  }
  if (p === '/api/admin/devices' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT d.*,u.email,l.license_key FROM devices d JOIN users u ON u.id=d.user_id JOIN licenses l ON l.id=d.license_id ORDER BY d.last_seen_at DESC LIMIT ?`).bind(limit).all(); return json({ok:true,devices:rows.results||[]});
  }
  if (p === '/api/admin/payments' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT p.*,u.email FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.id DESC LIMIT ?`).bind(limit).all(); return json({ok:true,payments:rows.results||[]});
  }
  const confirmMatch=p.match(/^\/api\/admin\/payments\/([^/]+)\/confirm$/);
  if(confirmMatch&&request.method==='POST'){
    const ref=decodeURIComponent(confirmMatch[1]); const body=await readJson(request)||{};
    const payment=await env.DB.prepare(`SELECT p.*,u.email FROM payments p JOIN users u ON u.id=p.user_id WHERE p.payment_ref=?`).bind(ref).first();
    if(!payment)return json({ok:false,error:'PAYMENT_NOT_FOUND'},404); if(payment.status==='confirmed')return json({ok:true,alreadyConfirmed:true});
    const planId=Number(payment.amount_cents)>=10000?'annual':'monthly'; const plan=PLANS[planId]; const days=planId==='annual'?365:30;
    await env.DB.prepare(`INSERT INTO subscriptions(user_id,plan_id,status,started_at,expires_at,daily_lead_limit) VALUES(?,?,'active',CURRENT_TIMESTAMP,datetime('now', ?),?)`).bind(payment.user_id,planId,`+${days} days`,plan.dailyLeadLimit).run();
    const sub=await env.DB.prepare(`SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1`).bind(payment.user_id).first();
    await env.DB.prepare(`UPDATE payments SET status='confirmed',subscription_id=?,external_reference=?,confirmed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(sub.id,body.externalReference||null,payment.id).run();
    const referral=await env.DB.prepare(`SELECT r.*,a.first_purchase_percent,a.renewal_percent FROM referrals r JOIN affiliates a ON a.id=r.affiliate_id WHERE r.referred_user_id=?`).bind(payment.user_id).first();
    if(referral){const pct=payment.payment_type==='renewal'?referral.renewal_percent:referral.first_purchase_percent; const amount=Math.round(payment.amount_cents*pct/100); await env.DB.prepare(`INSERT OR IGNORE INTO commissions(affiliate_id,payment_id,commission_type,percent,amount_cents,status) VALUES(?,?,?,?,?,'approved')`).bind(referral.affiliate_id,payment.id,payment.payment_type,pct,amount).run(); await env.DB.prepare(`UPDATE referrals SET converted_at=COALESCE(converted_at,CURRENT_TIMESTAMP) WHERE id=?`).bind(referral.id).run();}
    await audit(env,request,'PAYMENT_CONFIRM','admin','admin','payment',ref,'success',{subscriptionId:sub.id}); return json({ok:true,paymentRef:ref,subscriptionId:sub.id});
  }
  if (p === '/api/admin/affiliates' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT a.*, (SELECT COUNT(*) FROM referrals r WHERE r.affiliate_id=a.id) referrals, (SELECT COALESCE(SUM(amount_cents),0) FROM commissions c WHERE c.affiliate_id=a.id AND c.status IN ('approved','paid')) commission_cents FROM affiliates a ORDER BY a.id DESC LIMIT ?`).bind(limit).all(); return json({ok:true,affiliates:rows.results||[]});
  }
  if (p === '/api/admin/payouts' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT p.*,a.email,a.referral_code FROM payouts p JOIN affiliates a ON a.id=p.affiliate_id ORDER BY p.id DESC LIMIT ?`).bind(limit).all(); return json({ok:true,payouts:rows.results||[]});
  }
  if (p === '/api/admin/usage' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT ud.*,u.email FROM usage_daily ud JOIN users u ON u.id=ud.user_id ORDER BY ud.usage_date DESC,ud.leads_processed DESC LIMIT ?`).bind(limit).all(); return json({ok:true,usage:rows.results||[]});
  }
  if (p === '/api/admin/logs' && request.method === 'GET') {
    const rows=await env.DB.prepare(`SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?`).bind(limit).all(); return json({ok:true,logs:rows.results||[]});
  }
  if (p === '/api/admin/settings' && request.method === 'GET') {
    const rows=await env.DB.prepare('SELECT key,value,updated_at FROM settings ORDER BY key').all(); return json({ok:true,settings:rows.results||[]});
  }
  if (p === '/api/admin/settings' && request.method === 'PATCH') {
    const body=await readJson(request); if(!body||typeof body!=='object')return json({ok:false,error:'JSON_REQUIRED'},400);
    const allowed=['monthly_price_usd','annual_price_usd','monthly_daily_limit','annual_daily_limit','affiliate_first_purchase_percent','affiliate_renewal_percent','allowed_devices','payment_methods'];
    for(const key of allowed){if(body[key]!==undefined)await env.DB.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP`).bind(key,String(body[key])).run();}
    await audit(env,request,'SETTINGS_UPDATE','admin','admin','settings','global','success'); return json({ok:true});
  }
  return json({ok:false,error:'ADMIN_ROUTE_NOT_FOUND'},404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:JSON_HEADERS });
    try {
      if (url.pathname === '/api/health' && request.method === 'GET') {
        const db = await env.DB.prepare('SELECT 1 AS ok').first();
        return json({ ok:true, service:'maps-hunter-pro-api', version:'1.0.0', database:db?.ok===1?'connected':'error' });
      }
      if (url.pathname === '/api/plans' && request.method === 'GET') return json({ ok:true, ...(await publicPlans(env)) });
      if (url.pathname === '/api/checkout' && request.method === 'POST') return handleCheckout(request,env);
      if (url.pathname === '/api/affiliate/register' && request.method === 'POST') return handleAffiliateRegister(request,env);
      if (url.pathname === '/api/license/validate' && request.method === 'POST') return handleLicenseValidate(request,env);
      if (url.pathname.startsWith('/api/admin/')) return handleAdmin(request,env,url);
      return json({ ok:false, error:'NOT_FOUND' },404);
    } catch (error) {
      console.error(error);
      return json({ ok:false, error:'INTERNAL_ERROR', message:String(error?.message||error) },500);
    }
  }
};