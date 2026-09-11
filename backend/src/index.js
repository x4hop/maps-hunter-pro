const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,authorization,x-admin-token',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS'
};
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: HEADERS });
const fail = (code, status = 400) => { const e = new Error(code); e.status = status; throw e; };
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = n => b64(crypto.getRandomValues(new Uint8Array(n)));
const hash = async v => b64(await crypto.subtle.digest('SHA-256', enc.encode(v)));
const email = v => String(v || '').trim().toLowerCase();
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
const sql = (e, q, ...p) => e.DB.prepare(q).bind(...p);
const first = (e, q, ...p) => sql(e, q, ...p).first();
const rows = async (e, q, ...p) => (await sql(e, q, ...p).all()).results || [];
const run = (e, q, ...p) => sql(e, q, ...p).run();
const key = prefix => prefix + '-' + crypto.randomUUID().replace(/-/g, '').toUpperCase();

async function body(r) {
  if (Number(r.headers.get('content-length') || 0) > 32768) fail('REQUEST_TOO_LARGE', 413);
  const t = await r.text();
  if (t.length > 32768) fail('REQUEST_TOO_LARGE', 413);
  try {
    const x = JSON.parse(t || '{}');
    if (!x || typeof x !== 'object' || Array.isArray(x)) fail('INVALID_JSON');
    return x;
  } catch { fail('INVALID_JSON'); }
}

const PASSWORD_ITERATIONS = 150000;
async function passwordHash(password, salt, iterations = PASSWORD_ITERATIONS) {
  const k = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, k, 256));
}

async function ensureAuthSchema(e) {
  await e.DB.batch([
    sql(e, 'CREATE TABLE IF NOT EXISTS auth_credentials(user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,iterations INTEGER NOT NULL DEFAULT 150000,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'),
    sql(e, 'CREATE TABLE IF NOT EXISTS auth_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)'),
    sql(e, 'CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id,expires_at)'),
    sql(e, 'CREATE TABLE IF NOT EXISTS admin_sessions(id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
  ]);
  try { await run(e, 'ALTER TABLE auth_credentials ADD COLUMN iterations INTEGER NOT NULL DEFAULT 150000'); } catch {}
  try { await run(e, 'INSERT OR IGNORE INTO auth_credentials(user_id,password_hash,password_salt,iterations) SELECT id,password_hash,password_salt,150000 FROM users WHERE password_hash IS NOT NULL AND password_salt IS NOT NULL'); } catch {}
}

async function settingMap(e) {
  return Object.fromEntries((await rows(e, 'SELECT key,value FROM settings')).map(x => [x.key, x.value]));
}

async function settings(e) {
  const z = await settingMap(e);
  const defaults = {
    monthly_price_usd: 20,
    annual_price_usd: 100,
    monthly_daily_limit: 1500,
    allowed_devices: 2,
    affiliate_first_purchase_percent: 50,
    affiliate_renewal_percent: 20,
    affiliate_attribution_days: 30,
    affiliate_hold_days: 7,
    affiliate_min_payout_cents: 2000,
    require_email_verification: 0
  };
  for (const k of Object.keys(defaults)) if (z[k] != null && Number.isFinite(Number(z[k]))) defaults[k] = Number(z[k]);
  return { ...z, ...defaults };
}

const plan = (s, id) => {
  if (!['monthly', 'annual'].includes(id)) fail('INVALID_PLAN');
  return { id, price: Number(s[id + '_price_usd']), dailyLeadLimit: id === 'monthly' ? Number(s.monthly_daily_limit) : null, durationDays: id === 'monthly' ? 30 : 365 };
};

async function session(r, e, admin = false) {
  const a = r.headers.get('authorization') || '';
  if (!a.startsWith('Bearer ')) fail('UNAUTHORIZED', 401);
  const h = await hash(a.slice(7));
  if (admin) {
    const s = await first(e, "SELECT id FROM admin_sessions WHERE token_hash=? AND julianday(expires_at)>julianday('now')", h);
    if (!s) fail('UNAUTHORIZED', 401);
    await run(e, 'UPDATE admin_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?', s.id);
    return { id: s.id, admin: true };
  }
  const u = await first(e, "SELECT u.id,u.email,u.name,u.status,u.locale,u.email_verified_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND julianday(s.expires_at)>julianday('now') AND u.status='active'", h);
  if (!u) fail('UNAUTHORIZED', 401);
  return u;
}

async function rateLimit(r, e, path) {
  const ip = r.headers.get('cf-connecting-ip') || 'unknown';
  const h = await hash(path + '|' + ip + '|' + Math.floor(Date.now() / 600000));
  const q = await first(e, "INSERT INTO request_limits(key,count,expires_at) VALUES(?,1,datetime('now','+20 minutes')) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count", h);
  if (Number(q.count) > 40) fail('TOO_MANY_REQUESTS', 429);
}

async function audit(e, event, actor, targetType, targetId, metadata = null, result = 'success', actorType = 'admin') {
  await run(e, 'INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result,metadata_json) VALUES(?,?,?,?,?,?,?)', event, actorType, String(actor || ''), targetType || null, String(targetId || ''), result, metadata ? JSON.stringify(metadata) : null);
}

async function sendEmail(e, to, subject, html) {
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) return { sent: false, reason: 'EMAIL_NOT_CONFIGURED' };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: e.EMAIL_FROM, to: [to], subject, html })
  });
  if (!r.ok) throw new Error('EMAIL_SEND_FAILED');
  return { sent: true };
}

async function issueEmailVerification(e, u) {
  const raw = random(32), h = await hash(raw);
  await run(e, "UPDATE email_verification_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE user_id=? AND consumed_at IS NULL", u.id);
  await run(e, "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+24 hours'))", u.id, h);
  const base = String(e.PUBLIC_SITE_URL || 'https://maps-hunter-pro-preview.anas98gha.workers.dev').replace(/\/$/, '');
  return sendEmail(e, u.email, 'Verify your Maps Hunter Pro email', `<p>Hello ${String(u.name || '').replace(/[<>&]/g, '')},</p><p>Verify your email:</p><p><a href="${base}/?verify=${encodeURIComponent(raw)}">Verify email</a></p>`);
}

async function grant(e, sourceType, sourceRef, userId, planId) {
  const existing = await first(e, 'SELECT g.*,l.license_key,s.expires_at FROM entitlement_grants g JOIN licenses l ON l.id=g.license_id JOIN subscriptions s ON s.id=g.subscription_id WHERE source_type=? AND source_ref=?', sourceType, sourceRef);
  if (existing) {
    if (Number(existing.user_id) !== Number(userId)) fail('CODE_ALREADY_USED', 409);
    return { already: true, licenseKey: existing.license_key, expiresAt: existing.expires_at };
  }
  const s = await settings(e), p = plan(s, planId);
  const newKey = key('MHP');
  try {
    await run(e, 'INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES(?,?,?,?,?,?,?)', sourceType, sourceRef, userId, planId, newKey, Number(s.allowed_devices), p.dailyLeadLimit);
  } catch (err) {
    const won = await first(e, 'SELECT user_id FROM entitlement_grants WHERE source_type=? AND source_ref=?', sourceType, sourceRef);
    if (!won || Number(won.user_id) !== Number(userId)) throw err;
  }
  const g = await first(e, 'SELECT l.license_key,s.expires_at FROM entitlement_grants g JOIN licenses l ON l.id=g.license_id JOIN subscriptions s ON s.id=g.subscription_id WHERE g.source_type=? AND g.source_ref=?', sourceType, sourceRef);
  if (!g) fail('ENTITLEMENT_FAILED', 500);
  return { licenseKey: g.license_key, expiresAt: g.expires_at };
}

async function ownerAccess(e, x) {
  const code = String(x.licenseKey || '').trim().toUpperCase();
  if (!code.startsWith('MHP-OWNER-')) return null;
  const device = String(x.deviceId || '').trim();
  if (!device || device.length > 128 || code.length > 120) fail('LICENSE_AND_DEVICE_REQUIRED');
  const owner = await first(e, "SELECT id FROM owner_access WHERE id=1 AND status='active' AND code_hash=?", await hash(code));
  if (!owner) fail('INVALID_LICENSE', 401);
  return { ok: true, valid: true, license: { planId: 'owner', dailyLeadLimit: null, deviceLimit: null, expiresAt: null, owner: true }, usedToday: 0 };
}

async function validateLicense(r, e, x) {
  const licenseKey = String(x.licenseKey || '').trim().toUpperCase();
  const deviceId = String(x.deviceId || '').trim();
  if (!licenseKey || !deviceId || deviceId.length > 128) fail('LICENSE_AND_DEVICE_REQUIRED');
  const l = await first(e,
    "SELECT l.*,s.plan_id,s.daily_lead_limit,u.email FROM licenses l JOIN subscriptions s ON s.id=l.subscription_id JOIN users u ON u.id=l.user_id WHERE l.license_key=? AND l.status='active' AND s.status='active' AND u.status='active' AND julianday(l.expires_at)>julianday('now') AND julianday(s.expires_at)>julianday('now')",
    licenseKey
  );
  if (!l) fail('INVALID_LICENSE', 401);
  let d = await first(e, 'SELECT id,status FROM devices WHERE license_id=? AND device_uid=?', l.id, deviceId);
  if (d?.status === 'blocked') fail('DEVICE_BLOCKED', 403);
  if (!d) {
    try {
      await run(e, "INSERT INTO devices(user_id,license_id,device_uid,os,browser,last_ip,status) VALUES(?,?,?,?,?,?,'trusted')", l.user_id, l.id, deviceId, String(x.os || '').slice(0, 100), String(x.browser || '').slice(0, 100), r.headers.get('cf-connecting-ip'));
    } catch (err) {
      d = await first(e, 'SELECT status FROM devices WHERE license_id=? AND device_uid=?', l.id, deviceId);
      if (!d) fail('DEVICE_LIMIT_REACHED', 403);
      if (d.status === 'blocked') fail('DEVICE_BLOCKED', 403);
    }
  } else await run(e, 'UPDATE devices SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?', d.id);
  return l;
}

async function publicPlans(e) {
  const s = await settings(e);
  return json({ ok: true, plans: ['monthly', 'annual'].map(id => plan(s, id)), affiliate: { firstPurchasePercent: Number(s.affiliate_first_purchase_percent), renewalPercent: Number(s.affiliate_renewal_percent) } });
}

async function authRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (['/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password'].includes(p) && m === 'POST') await rateLimit(r, e, p);
  if (p === '/api/auth/register' && m === 'POST') {
    await ensureAuthSchema(e);
    const x = await body(r), em = email(x.email), pw = String(x.password || '');
    if (!validEmail(em) || pw.length < 8 || pw.length > 256) fail('INVALID_INPUT');
    if (!x.acceptTerms) fail('TERMS_REQUIRED');
    if (await first(e, 'SELECT id FROM users WHERE email=?', em)) fail('ACCOUNT_EXISTS', 409);
    const name = String(x.name || '').trim().slice(0, 120);
    if (!name) fail('NAME_REQUIRED');
    await run(e, 'INSERT INTO users(email,name,locale) VALUES(?,?,?)', em, name, ['en', 'ar', 'ru', 'de', 'es'].includes(x.locale) ? x.locale : 'en');
    const u = await first(e, 'SELECT id,email,name,status,locale,email_verified_at FROM users WHERE email=?', em);
    const salt = random(16);
    await run(e, 'INSERT INTO auth_credentials(user_id,password_hash,password_salt,iterations) VALUES(?,?,?,?)', u.id, await passwordHash(pw, salt), salt, PASSWORD_ITERATIONS);
    await run(e, 'INSERT OR IGNORE INTO acquisition(user_id,source,campaign) VALUES(?,?,?)', u.id, String(x.source || 'direct').slice(0, 120), String(x.campaign || '').slice(0, 120));
    const verification = await issueEmailVerification(e, u).catch(() => ({ sent: false, reason: 'EMAIL_SEND_FAILED' }));
    const t = random(32);
    await run(e, "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 days'))", u.id, await hash(t));
    return json({ ok: true, token: t, user: { id: u.id, email: u.email, name: u.name, emailVerified: Boolean(u.email_verified_at) }, verification }, 201);
  }
  if (p === '/api/auth/login' && m === 'POST') {
    await ensureAuthSchema(e);
    const x = await body(r), em = email(x.email), pw = String(x.password || '');
    const u = validEmail(em) ? await first(e, 'SELECT id,email,name,status,email_verified_at FROM users WHERE email=?', em) : null;
    const c = u ? await first(e, 'SELECT password_hash,password_salt,iterations FROM auth_credentials WHERE user_id=?', u.id) : null;
    if (!u || u.status !== 'active' || !c || await passwordHash(pw, c.password_salt, Number(c.iterations || PASSWORD_ITERATIONS)) !== c.password_hash) fail('INVALID_CREDENTIALS', 401);
    const t = random(32);
    await run(e, "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 days'))", u.id, await hash(t));
    return json({ ok: true, token: t, user: { id: u.id, email: u.email, name: u.name, emailVerified: Boolean(u.email_verified_at) } });
  }
  if (p === '/api/auth/logout' && m === 'POST') {
    const a = (r.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (a) await run(e, 'DELETE FROM auth_sessions WHERE token_hash=?', await hash(a));
    return json({ ok: true });
  }
  if (p === '/api/auth/resend-verification' && m === 'POST') {
    const u = await session(r, e);
    if (u.email_verified_at) return json({ ok: true, alreadyVerified: true });
    const sent = await issueEmailVerification(e, u);
    return json({ ok: true, verification: sent });
  }
  if (p === '/api/auth/verify-email' && m === 'POST') {
    const x = await body(r), raw = String(x.token || '');
    if (raw.length < 20) fail('INVALID_TOKEN');
    const h = await hash(raw), t = await first(e, "SELECT * FROM email_verification_tokens WHERE token_hash=? AND consumed_at IS NULL AND julianday(expires_at)>julianday('now')", h);
    if (!t) fail('INVALID_OR_EXPIRED_TOKEN', 400);
    await e.DB.batch([sql(e, 'UPDATE users SET email_verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?', t.user_id), sql(e, 'UPDATE email_verification_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=?', t.id)]);
    return json({ ok: true });
  }
  if (p === '/api/auth/forgot-password' && m === 'POST') {
    const x = await body(r), em = email(x.email), u = validEmail(em) ? await first(e, 'SELECT id,email,name FROM users WHERE email=?', em) : null;
    if (u) {
      const raw = random(32);
      await run(e, "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+1 hour'))", u.id, await hash(raw));
      const base = String(e.PUBLIC_SITE_URL || 'https://maps-hunter-pro-preview.anas98gha.workers.dev').replace(/\/$/, '');
      await sendEmail(e, u.email, 'Reset your Maps Hunter Pro password', `<p><a href="${base}/?reset=${encodeURIComponent(raw)}">Reset password</a></p>`).catch(() => {});
    }
    return json({ ok: true });
  }
  if (p === '/api/auth/reset-password' && m === 'POST') {
    const x = await body(r), raw = String(x.token || ''), pw = String(x.password || '');
    if (raw.length < 20 || pw.length < 8 || pw.length > 256) fail('INVALID_INPUT');
    const h = await hash(raw), t = await first(e, "SELECT * FROM password_reset_tokens WHERE token_hash=? AND consumed_at IS NULL AND julianday(expires_at)>julianday('now')", h);
    if (!t) fail('INVALID_OR_EXPIRED_TOKEN');
    const salt = random(16), ph = await passwordHash(pw, salt);
    await e.DB.batch([sql(e, 'UPDATE auth_credentials SET password_hash=?,password_salt=?,iterations=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?', ph, salt, PASSWORD_ITERATIONS, t.user_id), sql(e, 'UPDATE password_reset_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=?', t.id), sql(e, 'DELETE FROM auth_sessions WHERE user_id=?', t.user_id)]);
    return json({ ok: true });
  }
  return null;
}

async function accountRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (!p.startsWith('/api/account/')) return null;
  const u = await session(r, e);
  if (p === '/api/account/me' && m === 'GET') {
    const subscription = await first(e, 'SELECT id,plan_id,status,started_at,expires_at,daily_lead_limit FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1', u.id);
    const license = await first(e, 'SELECT license_key,status,device_limit,expires_at FROM licenses WHERE user_id=? ORDER BY id DESC LIMIT 1', u.id);
    const usage = await first(e, "SELECT leads_processed,api_errors FROM usage_daily WHERE user_id=? AND usage_date=date('now')", u.id);
    return json({ ok: true, user: { id: u.id, email: u.email, name: u.name, locale: u.locale, emailVerified: Boolean(u.email_verified_at) }, subscription, license, usage: usage || { leads_processed: 0, api_errors: 0 } });
  }
  if (p === '/api/account/payments' && m === 'GET') return json({ ok: true, payments: await rows(e, 'SELECT payment_ref,amount_cents,currency,method,payment_type,status,external_reference,proof_url,created_at,submitted_at,confirmed_at,reviewed_at,review_note FROM payments WHERE user_id=? ORDER BY id DESC LIMIT 50', u.id) });
  if (p === '/api/account/download' && m === 'GET') {
    const z = await settingMap(e);
    return json({ ok: true, version: z.extension_version || null, url: z.extension_download_url || null, instructions: z.extension_install_instructions || null });
  }
  if (p === '/api/account/profile' && m === 'PATCH') {
    const x = await body(r), name = String(x.name || '').trim().slice(0, 120), locale = ['en', 'ar', 'ru', 'de', 'es'].includes(x.locale) ? x.locale : u.locale;
    if (!name) fail('NAME_REQUIRED');
    await run(e, 'UPDATE users SET name=?,locale=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', name, locale, u.id);
    return json({ ok: true });
  }
  if (p === '/api/account/password' && m === 'POST') {
    const x = await body(r), oldPw = String(x.currentPassword || ''), newPw = String(x.newPassword || '');
    if (newPw.length < 8 || newPw.length > 256) fail('INVALID_PASSWORD');
    const c = await first(e, 'SELECT * FROM auth_credentials WHERE user_id=?', u.id);
    if (!c || await passwordHash(oldPw, c.password_salt, Number(c.iterations || PASSWORD_ITERATIONS)) !== c.password_hash) fail('INVALID_CREDENTIALS', 401);
    const salt = random(16), ph = await passwordHash(newPw, salt);
    await run(e, 'UPDATE auth_credentials SET password_hash=?,password_salt=?,iterations=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?', ph, salt, PASSWORD_ITERATIONS, u.id);
    return json({ ok: true });
  }
  if (p === '/api/account/data-request' && m === 'POST') {
    const x = await body(r);
    if (!['access', 'correction', 'deletion'].includes(x.type)) fail('INVALID_REQUEST_TYPE');
    const ref = key('DR');
    await run(e, 'INSERT INTO data_requests(request_ref,user_id,request_type,note) VALUES(?,?,?,?)', ref, u.id, x.type, String(x.note || '').slice(0, 1000));
    return json({ ok: true, requestRef: ref, status: 'pending' }, 201);
  }
  return null;
}

async function paymentRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (p === '/api/payment-methods' && m === 'GET') {
    const z = await settingMap(e);
    return json({ ok: true, methods: { USDT: { enabled: Boolean(z.usdt_address), network: z.usdt_network || null, address: z.usdt_address || null }, REDOTPAY: { enabled: Boolean(z.redotpay_id), account: z.redotpay_id || null } }, support: z.support_contact || null });
  }
  if (p === '/api/activation/request' && m === 'POST') {
    const u = await session(r, e), x = await body(r), s = await settings(e), pp = plan(s, x.planId);
    if (Number(s.require_email_verification) && !u.email_verified_at) fail('EMAIL_NOT_VERIFIED', 403);
    const method = String(x.paymentMethod || '').trim().toUpperCase();
    if (!['USDT', 'REDOTPAY'].includes(method)) fail('INVALID_PAYMENT_METHOD');
    const methodEnabled = method === 'USDT' ? Boolean(s.usdt_address) : Boolean(s.redotpay_id);
    if (!methodEnabled) fail('PAYMENT_METHOD_NOT_CONFIGURED', 409);
    const refCode = String(x.referralCode || '').trim().toUpperCase();
    if (refCode && !await first(e, "SELECT id FROM payments WHERE user_id=? AND status='confirmed'", u.id)) await run(e, "INSERT OR IGNORE INTO referrals(affiliate_id,referred_user_id) SELECT id,? FROM affiliates WHERE referral_code=? AND status='active' AND lower(email)!=?", u.id, refCode, u.email);
    let old = await first(e, "SELECT a.request_ref,a.payment_ref,a.plan_id,p.amount_cents,p.method FROM activation_requests a JOIN payments p ON p.payment_ref=a.payment_ref WHERE a.user_id=? AND a.plan_id=? AND a.status='pending' AND p.status='pending' ORDER BY a.id DESC LIMIT 1", u.id, pp.id);
    if (old && old.method !== method) {
      await e.DB.batch([sql(e, "UPDATE activation_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE request_ref=?", old.request_ref), sql(e, "UPDATE payments SET status='rejected',review_note='Replaced by a new payment method',reviewed_at=CURRENT_TIMESTAMP WHERE payment_ref=? AND status='pending'", old.payment_ref)]);
      old = null;
    }
    if (!old) {
      const ar = key('ACT'), pay = key('PAY');
      await e.DB.batch([sql(e, "INSERT INTO payments(payment_ref,user_id,method,amount_cents,payment_type,status) VALUES(?,?,?,?,?,'pending')", pay, u.id, method, Math.round(pp.price * 100), await first(e, "SELECT id FROM payments WHERE user_id=? AND status='confirmed'", u.id) ? 'renewal' : 'first_purchase'), sql(e, "INSERT INTO activation_requests(request_ref,user_id,plan_id,payment_ref) VALUES(?,?,?,?)", ar, u.id, pp.id, pay)]);
      old = { request_ref: ar, payment_ref: pay, plan_id: pp.id, amount_cents: Math.round(pp.price * 100), method };
    }
    return json({ ok: true, requestRef: old.request_ref, paymentRef: old.payment_ref, planId: old.plan_id, amount: old.amount_cents / 100, paymentMethod: old.method, status: 'pending' }, 201);
  }
  if (/^\/api\/payments\/[^/]+\/submit$/.test(p) && m === 'POST') {
    const u = await session(r, e), ref = decodeURIComponent(p.split('/')[3]), x = await body(r);
    const payment = await first(e, 'SELECT * FROM payments WHERE payment_ref=? AND user_id=?', ref, u.id);
    if (!payment) fail('PAYMENT_NOT_FOUND', 404);
    if (payment.status !== 'pending') fail('PAYMENT_NOT_PENDING', 409);
    const external = String(x.transactionReference || '').trim().slice(0, 200), proof = String(x.proofUrl || '').trim().slice(0, 1000);
    if (!external && !proof) fail('PAYMENT_PROOF_REQUIRED');
    if (external && await first(e, 'SELECT payment_ref FROM payments WHERE external_reference=? AND payment_ref!=?', external, ref)) fail('DUPLICATE_EXTERNAL_REFERENCE', 409);
    await run(e, "UPDATE payments SET external_reference=?,proof_url=?,submitted_at=COALESCE(submitted_at,CURRENT_TIMESTAMP) WHERE payment_ref=? AND user_id=? AND status='pending'", external || null, proof || null, ref, u.id);
    await audit(e, 'PAYMENT_PROOF_SUBMITTED', u.email, 'payment', ref, { method: payment.method, hasReference: Boolean(external), hasProof: Boolean(proof) }, 'success', 'user');
    return json({ ok: true, paymentRef: ref, status: 'pending_review' });
  }
  return null;
}

async function codeRoutes(r, e, url) {
  if (url.pathname !== '/api/codes/redeem' || r.method !== 'POST') return null;
  await rateLimit(r, e, url.pathname);
  const u = await session(r, e), x = await body(r), c = String(x.code || '').trim().toUpperCase();
  const z = await first(e, 'SELECT * FROM activation_codes WHERE code=?', c);
  if (!z) fail('CODE_NOT_FOUND', 404);
  if (z.status === 'redeemed') fail('CODE_ALREADY_USED', 409);
  if (z.status !== 'unused') fail('CODE_NOT_AVAILABLE', 409);
  if (z.expires_at && Date.parse(z.expires_at) <= Date.now()) fail('CODE_EXPIRED', 410);
  if (z.purchaser_email && email(z.purchaser_email) !== u.email) fail('CODE_ACCOUNT_MISMATCH', 403);
  return json({ ok: true, planId: z.plan_id, ...await grant(e, 'code', c, u.id, z.plan_id) });
}

async function affiliateRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (!p.startsWith('/api/affiliate/')) return null;
  const u = await session(r, e), s = await settings(e);
  if (p === '/api/affiliate/register' && m === 'POST') {
    await run(e, "INSERT OR IGNORE INTO affiliates(email,name,referral_code,status,first_purchase_percent,renewal_percent) VALUES(?,?,?,'active',?,?)", u.email, u.name, key('AF'), Number(s.affiliate_first_purchase_percent), Number(s.affiliate_renewal_percent));
    const a = await first(e, 'SELECT referral_code,status,first_purchase_percent,renewal_percent FROM affiliates WHERE email=?', u.email);
    return json({ ok: true, affiliate: a, terms: { attributionDays: Number(s.affiliate_attribution_days), holdDays: Number(s.affiliate_hold_days), minPayoutCents: Number(s.affiliate_min_payout_cents), selfReferral: false } });
  }
  if (p === '/api/affiliate/me' && m === 'GET') {
    const a = await first(e, "SELECT * FROM affiliates WHERE email=? AND status='active'", u.email);
    if (!a) fail('AFFILIATE_NOT_FOUND', 404);
    await run(e, "UPDATE commissions SET status='approved',approved_at=CURRENT_TIMESTAMP WHERE affiliate_id=? AND status='pending' AND julianday(created_at)<=julianday('now','-'||?||' days')", a.id, Number(s.affiliate_hold_days));
    const stats = await first(e, "SELECT (SELECT count(*) FROM referrals WHERE affiliate_id=?) referrals,(SELECT count(*) FROM referrals WHERE affiliate_id=? AND converted_at IS NOT NULL) conversions,(SELECT coalesce(sum(amount_cents),0) FROM commissions WHERE affiliate_id=? AND status IN ('approved','paid')) earned_cents,(SELECT coalesce(sum(c.amount_cents),0) FROM commissions c LEFT JOIN payout_commissions pc ON pc.commission_id=c.id WHERE c.affiliate_id=? AND c.status='approved' AND pc.commission_id IS NULL) available_cents,(SELECT coalesce(sum(amount_cents),0) FROM commissions WHERE affiliate_id=? AND status='pending') pending_cents", a.id, a.id, a.id, a.id, a.id);
    return json({ ok: true, affiliate: { referralCode: a.referral_code, firstPurchasePercent: a.first_purchase_percent, renewalPercent: a.renewal_percent }, stats, terms: { attributionDays: Number(s.affiliate_attribution_days), holdDays: Number(s.affiliate_hold_days), minPayoutCents: Number(s.affiliate_min_payout_cents) }, payouts: await rows(e, 'SELECT payout_ref,amount_cents,method,destination,status,created_at,processed_at FROM payouts WHERE affiliate_id=? ORDER BY id DESC LIMIT 50', a.id) });
  }
  if (p === '/api/affiliate/payouts' && m === 'POST') {
    const x = await body(r), a = await first(e, "SELECT id FROM affiliates WHERE email=? AND status='active'", u.email);
    if (!a) fail('AFFILIATE_NOT_FOUND', 404);
    if (!['USDT', 'REDOTPAY'].includes(x.method) || String(x.destination || '').trim().length < 4) fail('INVALID_PAYOUT');
    await run(e, "UPDATE commissions SET status='approved',approved_at=CURRENT_TIMESTAMP WHERE affiliate_id=? AND status='pending' AND julianday(created_at)<=julianday('now','-'||?||' days')", a.id, Number(s.affiliate_hold_days));
    const cs = await rows(e, "SELECT c.id,c.amount_cents FROM commissions c LEFT JOIN payout_commissions pc ON pc.commission_id=c.id WHERE c.affiliate_id=? AND c.status='approved' AND pc.commission_id IS NULL ORDER BY c.id", a.id);
    const amount = cs.reduce((n, c) => n + Number(c.amount_cents), 0);
    if (amount < Number(s.affiliate_min_payout_cents)) fail('MIN_PAYOUT_NOT_REACHED', 409);
    const ref = key('PO');
    await e.DB.batch([sql(e, "INSERT INTO payouts(payout_ref,affiliate_id,amount_cents,method,destination,status) VALUES(?,?,?,?,?,'pending')", ref, a.id, amount, x.method, String(x.destination).trim().slice(0, 200)), ...cs.map(c => sql(e, 'INSERT INTO payout_commissions(payout_id,commission_id,amount_cents) SELECT id,?,? FROM payouts WHERE payout_ref=?', c.id, c.amount_cents, ref))]);
    return json({ ok: true, payoutRef: ref, amountCents: amount }, 201);
  }
  return null;
}

async function extensionRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (!['/api/license/validate', '/api/usage/consume'].includes(p) || m !== 'POST') return null;
  const x = await body(r);
  const owner = await ownerAccess(e, x);
  if (owner) return json(owner);
  const l = await validateLicense(r, e, x);
  if (p.endsWith('/consume')) {
    const requestId = String(x.requestId || ''), amount = Number(x.amount || 1);
    if (requestId.length < 8 || requestId.length > 128 || !Number.isInteger(amount) || amount < 1 || amount > 100) fail('INVALID_USAGE');
    const prior = await first(e, 'SELECT user_id,license_id,amount FROM usage_events WHERE request_id=?', requestId);
    if (prior && (Number(prior.user_id) !== Number(l.user_id) || Number(prior.license_id) !== Number(l.id) || Number(prior.amount) !== amount)) fail('REQUEST_ID_CONFLICT', 409);
    if (!prior) await run(e, "INSERT INTO usage_events(request_id,user_id,license_id,usage_date,amount) VALUES(?,?,?,date('now'),?)", requestId, l.user_id, l.id, amount);
  }
  const used = await first(e, "SELECT leads_processed FROM usage_daily WHERE user_id=? AND usage_date=date('now')", l.user_id);
  return json({ ok: true, valid: true, license: { key: l.license_key, planId: l.plan_id, dailyLeadLimit: l.daily_lead_limit, deviceLimit: l.device_limit, expiresAt: l.expires_at }, usedToday: Number(used?.leads_processed || 0) });
}

async function adminRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (p === '/api/admin/login' && m === 'POST') {
    await rateLimit(r, e, p); await ensureAuthSchema(e);
    const x = await body(r);
    if (!e.ADMIN_TOKEN || x.username !== (e.ADMIN_USERNAME || 'anasbm') || await hash(String(x.password || '')) !== await hash(e.ADMIN_TOKEN)) fail('INVALID_ADMIN_CREDENTIALS', 401);
    const t = random(32);
    await run(e, "INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,datetime('now','+4 hours'))", await hash(t));
    await audit(e, 'ADMIN_LOGIN', x.username, 'session', 'created', { ip: r.headers.get('cf-connecting-ip') });
    return json({ ok: true, token: t });
  }
  if (!p.startsWith('/api/admin/')) return null;
  const admin = await session(r, e, true);
  const s = await settings(e);
  if (p === '/api/admin/logout' && m === 'POST') {
    await run(e, 'DELETE FROM admin_sessions WHERE id=?', admin.id); return json({ ok: true });
  }
  if (p === '/api/admin/summary' && m === 'GET') {
    const count = async q => Number((await first(e, q)).c || 0), active = "status='active' AND julianday(expires_at)>julianday('now')";
    return json({ ok: true, summary: { users: await count('SELECT count(*) c FROM users'), activeUsers: await count("SELECT count(*) c FROM users WHERE status='active'"), pendingActivations: await count("SELECT count(*) c FROM activation_requests WHERE status='pending'"), activeSubscriptions: await count('SELECT count(*) c FROM subscriptions WHERE ' + active), activeLicenses: await count('SELECT count(*) c FROM licenses WHERE ' + active), unusedCodes: await count("SELECT count(*) c FROM activation_codes WHERE status='unused' AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))"), monthlyRevenue: await count("SELECT coalesce(sum(amount_cents),0) c FROM payments WHERE status='confirmed' AND strftime('%Y-%m',confirmed_at)=strftime('%Y-%m','now')") / 100, leadsToday: await count("SELECT coalesce(sum(leads_processed),0) c FROM usage_daily WHERE usage_date=date('now')"), pendingPayments: await count("SELECT count(*) c FROM payments WHERE status='pending'"), activeAffiliates: await count("SELECT count(*) c FROM affiliates WHERE status='active'"), expiringSoon: await count("SELECT count(*) c FROM subscriptions WHERE status='active' AND julianday(expires_at)>julianday('now') AND julianday(expires_at)<=julianday('now','+3 days')") } });
  }
  if (p === '/api/admin/settings' && m === 'GET') return json({ ok: true, settings: await rows(e, 'SELECT key,value,updated_at FROM settings ORDER BY key') });
  if (p === '/api/admin/settings' && m === 'PATCH') {
    const x = await body(r), allowed = new Set(['monthly_price_usd','annual_price_usd','monthly_daily_limit','allowed_devices','affiliate_first_purchase_percent','affiliate_renewal_percent','affiliate_attribution_days','affiliate_hold_days','affiliate_min_payout_cents','require_email_verification','usdt_network','usdt_address','redotpay_id','support_contact','extension_version','extension_download_url','extension_install_instructions','public_site_url']);
    const entries = Object.entries(x.settings || {}).filter(([k]) => allowed.has(k));
    if (!entries.length) fail('NO_SETTINGS');
    await e.DB.batch(entries.map(([k, v]) => sql(e, "INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP", k, String(v))));
    await audit(e, 'SETTINGS_UPDATED', 'admin', 'settings', 'platform', { keys: entries.map(x => x[0]) });
    return json({ ok: true });
  }
  if (p === '/api/admin/owner-access' && m === 'GET') return json({ ok: true, owner: await first(e, 'SELECT status,created_at,updated_at FROM owner_access WHERE id=1') });
  if (p === '/api/admin/owner-access/rotate' && m === 'POST') {
    const code = 'MHP-OWNER-' + random(32).toUpperCase();
    await run(e, "INSERT INTO owner_access(id,code_hash,status) VALUES(1,?,'active') ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,status='active',updated_at=CURRENT_TIMESTAMP", await hash(code));
    await audit(e, 'OWNER_CODE_ROTATED', 'admin', 'owner_access', '1');
    return json({ ok: true, code, expiresAt: null }, 201);
  }
  if (p === '/api/admin/owner-access/revoke' && m === 'POST') {
    await run(e, "UPDATE owner_access SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=1");
    await audit(e, 'OWNER_CODE_REVOKED', 'admin', 'owner_access', '1');
    return json({ ok: true });
  }
  if (p === '/api/admin/payments/confirm' && m === 'POST') {
    const x = await body(r), ref = String(x.paymentRef || ''), payment = await first(e, 'SELECT p.*,a.plan_id,a.user_id activation_user FROM payments p JOIN activation_requests a ON a.payment_ref=p.payment_ref WHERE p.payment_ref=?', ref);
    if (!payment) fail('PAYMENT_NOT_FOUND', 404);
    if (payment.status === 'confirmed') return json({ ok: true, already: true, ...await grant(e, 'payment', ref, payment.user_id, payment.plan_id) });
    if (payment.status !== 'pending') fail('PAYMENT_NOT_PENDING', 409);
    if (!payment.external_reference && !payment.proof_url) fail('PAYMENT_NOT_SUBMITTED', 409);
    const result = await grant(e, 'payment', ref, payment.user_id, payment.plan_id);
    await run(e, "UPDATE payments SET reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin',review_note=? WHERE payment_ref=?", String(x.note || '').slice(0, 500) || null, ref);
    await audit(e, 'PAYMENT_CONFIRMED', 'admin', 'payment', ref, { plan: payment.plan_id });
    return json({ ok: true, ...result });
  }
  if (p === '/api/admin/payments/reject' && m === 'POST') {
    const x = await body(r), ref = String(x.paymentRef || ''), reason = String(x.reason || '').trim().slice(0, 500);
    if (!reason) fail('REJECTION_REASON_REQUIRED');
    const payment = await first(e, 'SELECT user_id,status FROM payments WHERE payment_ref=?', ref);
    if (!payment) fail('PAYMENT_NOT_FOUND', 404);
    if (payment.status !== 'pending') fail('PAYMENT_NOT_PENDING', 409);
    await e.DB.batch([sql(e, "UPDATE payments SET status='rejected',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin',review_note=? WHERE payment_ref=? AND status='pending'", reason, ref), sql(e, "UPDATE activation_requests SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE payment_ref=? AND status='pending'", ref)]);
    await audit(e, 'PAYMENT_REJECTED', 'admin', 'payment', ref, { reason });
    return json({ ok: true });
  }
  if (p === '/api/admin/payments/refund' && m === 'POST') {
    const x = await body(r), ref = String(x.paymentRef || ''), payment = await first(e, "SELECT id,user_id,status FROM payments WHERE payment_ref=?", ref);
    if (!payment || payment.status !== 'confirmed') fail('PAYMENT_NOT_CONFIRMED', 409);
    await e.DB.batch([sql(e, "UPDATE payments SET status='refunded',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin',review_note=? WHERE id=?", String(x.reason || 'Refunded').slice(0, 500), payment.id), sql(e, "UPDATE commissions SET status='cancelled' WHERE payment_id=? AND status!='paid'", payment.id)]);
    await audit(e, 'PAYMENT_REFUNDED', 'admin', 'payment', ref, { reason: String(x.reason || '') });
    return json({ ok: true });
  }
  if (p === '/api/admin/codes' && m === 'POST') {
    const x = await body(r), planId = plan(s, x.planId).id, count = Math.min(100, Math.max(1, Number(x.count || 1))), codes = [];
    for (let i = 0; i < count; i++) { const c = key('MHP-CODE'); await run(e, 'INSERT INTO activation_codes(code,plan_id,created_by,note,purchaser_email,expires_at) VALUES(?,?,?,?,?,?)', c, planId, 'admin', String(x.note || '').slice(0, 500), x.email ? email(x.email) : null, x.codeExpiresAt || null); codes.push(c); }
    await audit(e, 'ACTIVATION_CODES_CREATED', 'admin', 'activation_code', String(count), { planId, count });
    return json({ ok: true, codes }, 201);
  }
  if (/^\/api\/admin\/codes\/[^/]+\/revoke$/.test(p) && m === 'POST') {
    const code = decodeURIComponent(p.split('/')[4]); await run(e, "UPDATE activation_codes SET status='revoked' WHERE code=? AND status='unused'", code); await audit(e, 'ACTIVATION_CODE_REVOKED', 'admin', 'activation_code', code); return json({ ok: true });
  }
  if (/^\/api\/admin\/users\/\d+\/status$/.test(p) && m === 'PATCH') {
    const id = Number(p.split('/')[4]), x = await body(r); if (!['active','suspended','inactive'].includes(x.status)) fail('INVALID_STATUS'); await run(e, 'UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', x.status, id); await audit(e, 'USER_STATUS_CHANGED','admin','user',id,{status:x.status}); return json({ok:true});
  }
  if (/^\/api\/admin\/devices\/\d+\/status$/.test(p) && m === 'PATCH') {
    const id=Number(p.split('/')[4]),x=await body(r);if(!['trusted','review','blocked'].includes(x.status))fail('INVALID_STATUS');await run(e,'UPDATE devices SET status=? WHERE id=?',x.status,id);return json({ok:true});
  }
  if (/^\/api\/admin\/licenses\/\d+\/status$/.test(p) && m === 'PATCH') {
    const id=Number(p.split('/')[4]),x=await body(r);if(!['active','revoked','expired','pending'].includes(x.status))fail('INVALID_STATUS');await run(e,'UPDATE licenses SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',x.status,id);return json({ok:true});
  }
  if (/^\/api\/admin\/payouts\/\d+\/status$/.test(p) && m === 'PATCH') {
    const id=Number(p.split('/')[4]),x=await body(r);if(!['approved','paid','rejected'].includes(x.status))fail('INVALID_STATUS');const payout=await first(e,'SELECT * FROM payouts WHERE id=?',id);if(!payout)fail('PAYOUT_NOT_FOUND',404);await run(e,"UPDATE payouts SET status=?,processed_at=CASE WHEN ? IN ('paid','rejected') THEN CURRENT_TIMESTAMP ELSE processed_at END WHERE id=?",x.status,x.status,id);if(x.status==='paid')await run(e,"UPDATE commissions SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id IN (SELECT commission_id FROM payout_commissions WHERE payout_id=?)",id);return json({ok:true});
  }
  if (/^\/api\/admin\/data-requests\/[^/]+\/status$/.test(p) && m === 'PATCH') {
    const ref=decodeURIComponent(p.split('/')[4]),x=await body(r);if(!['pending','verified','completed','rejected'].includes(x.status))fail('INVALID_STATUS');await run(e,"UPDATE data_requests SET status=?,completed_at=CASE WHEN ?='completed' THEN CURRENT_TIMESTAMP ELSE completed_at END WHERE request_ref=?",x.status,x.status,ref);return json({ok:true});
  }
  const listSpecs = {
    users: ['users', "SELECT id,email,name,status,locale,email_verified_at,created_at FROM users WHERE email LIKE ? OR coalesce(name,'') LIKE ? ORDER BY id DESC"],
    subscriptions: ['subscriptions', 'SELECT s.*,u.email FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE u.email LIKE ? ORDER BY s.id DESC'],
    licenses: ['licenses', 'SELECT l.*,u.email,s.plan_id FROM licenses l JOIN users u ON u.id=l.user_id LEFT JOIN subscriptions s ON s.id=l.subscription_id WHERE u.email LIKE ? OR l.license_key LIKE ? ORDER BY l.id DESC'],
    devices: ['devices', 'SELECT d.*,u.email,l.license_key FROM devices d JOIN users u ON u.id=d.user_id JOIN licenses l ON l.id=d.license_id WHERE u.email LIKE ? OR d.device_uid LIKE ? ORDER BY d.id DESC'],
    codes: ['codes', 'SELECT * FROM activation_codes WHERE code LIKE ? OR coalesce(purchaser_email,\'\') LIKE ? ORDER BY id DESC'],
    'activation-requests': ['requests', 'SELECT a.*,u.email,p.amount_cents,p.currency,p.method,p.status payment_status,p.external_reference,p.proof_url,p.submitted_at,p.reviewed_at,p.review_note FROM activation_requests a JOIN users u ON u.id=a.user_id LEFT JOIN payments p ON p.payment_ref=a.payment_ref WHERE u.email LIKE ? OR a.request_ref LIKE ? ORDER BY a.id DESC'],
    payments: ['payments', 'SELECT p.*,u.email,a.plan_id FROM payments p JOIN users u ON u.id=p.user_id LEFT JOIN activation_requests a ON a.payment_ref=p.payment_ref WHERE u.email LIKE ? OR p.payment_ref LIKE ? OR coalesce(p.external_reference,\'\') LIKE ? ORDER BY p.id DESC'],
    affiliates: ['affiliates', "SELECT a.*,(SELECT count(*) FROM referrals r WHERE r.affiliate_id=a.id) referrals,(SELECT coalesce(sum(amount_cents),0) FROM commissions c WHERE c.affiliate_id=a.id AND status IN ('approved','paid')) commission_cents,(SELECT coalesce(sum(amount_cents),0) FROM commissions c WHERE c.affiliate_id=a.id AND status='pending') pending_cents FROM affiliates a WHERE a.email LIKE ? ORDER BY a.id DESC"],
    payouts: ['payouts', 'SELECT p.*,a.email FROM payouts p JOIN affiliates a ON a.id=p.affiliate_id WHERE a.email LIKE ? ORDER BY p.id DESC'],
    usage: ['usage', 'SELECT d.*,u.email FROM usage_daily d JOIN users u ON u.id=d.user_id WHERE u.email LIKE ? ORDER BY d.usage_date DESC'],
    logs: ['logs', "SELECT * FROM audit_logs WHERE coalesce(actor,'') LIKE ? OR event_type LIKE ? ORDER BY id DESC"],
    'data-requests': ['requests', 'SELECT d.*,u.email FROM data_requests d JOIN users u ON u.id=d.user_id WHERE u.email LIKE ? OR d.request_ref LIKE ? ORDER BY d.id DESC']
  };
  const name = p.split('/').pop(), spec = listSpecs[name];
  if (spec && m === 'GET') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50)), offset = Math.max(0, Number(url.searchParams.get('offset')) || 0), q = '%' + String(url.searchParams.get('q') || '').slice(0, 120) + '%';
    const params = Array((spec[1].match(/\?/g) || []).length).fill(q), data = await rows(e, spec[1] + ' LIMIT ? OFFSET ?', ...params, limit + 1, offset);
    return json({ ok: true, [spec[0]]: data.slice(0, limit), hasMore: data.length > limit, offset, limit });
  }
  return null;
}

async function maintenance(e) {
  const s = await settings(e), results = await e.DB.batch([
    sql(e, "DELETE FROM auth_sessions WHERE julianday(expires_at)<=julianday('now')"),
    sql(e, "DELETE FROM admin_sessions WHERE julianday(expires_at)<=julianday('now')"),
    sql(e, "DELETE FROM request_limits WHERE julianday(expires_at)<=julianday('now')"),
    sql(e, "DELETE FROM usage_events WHERE julianday(created_at)<=julianday('now','-90 days')"),
    sql(e, "UPDATE devices SET last_ip=NULL WHERE last_ip IS NOT NULL AND julianday(last_seen_at)<=julianday('now','-30 days')"),
    sql(e, "UPDATE commissions SET status='approved',approved_at=CURRENT_TIMESTAMP WHERE status='pending' AND julianday(created_at)<=julianday('now','-'||?||' days')", Number(s.affiliate_hold_days))
  ]);
  const changed = results.reduce((n, x) => n + Number(x.meta?.changes || 0), 0);
  await run(e, "INSERT INTO maintenance_runs(run_type,rows_changed) VALUES('retention',?)", changed);
  return changed;
}

async function dispatch(r, e) {
  const url = new URL(r.url), p = url.pathname, m = r.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  if (p === '/api/health') {
    await ensureAuthSchema(e);
    return json({ ok: true, version: '6.0.1-platform', database: (await first(e, 'SELECT 1 ok')).ok === 1 ? 'connected' : 'error', email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM) ? 'configured' : 'not_configured' });
  }
  if (p === '/api/plans' && m === 'GET') return publicPlans(e);
  return await authRoutes(r,e,url) || await paymentRoutes(r,e,url) || await codeRoutes(r,e,url) || await affiliateRoutes(r,e,url) || await extensionRoutes(r,e,url) || await adminRoutes(r,e,url) || await accountRoutes(r,e,url) || fail('NOT_FOUND',404);
}

export default {
  async fetch(r, e) {
    try { return await dispatch(r, e); }
    catch (err) {
      const message = String(err.message || err);
      const known = ['ACCOUNT_EXISTS','TERMS_REQUIRED','INVALID_CREDENTIALS','EMAIL_NOT_VERIFIED','PAYMENT_METHOD_NOT_CONFIGURED','PAYMENT_NOT_PENDING','PAYMENT_NOT_SUBMITTED','DUPLICATE_EXTERNAL_REFERENCE','CODE_NOT_AVAILABLE','CODE_ALREADY_USED','ANNUAL_DOWNGRADE_NOT_ALLOWED','DAILY_LIMIT_REACHED','INVALID_LICENSE','DEVICE_LIMIT_REACHED','MIN_PAYOUT_NOT_REACHED','REQUEST_ID_CONFLICT'].find(x => message.includes(x));
      return json({ ok: false, error: err.status ? message : known || 'SERVER_ERROR' }, err.status || (known ? 409 : 500));
    }
  },
  async scheduled(c, e, ctx) { ctx.waitUntil(maintenance(e)); }
};
