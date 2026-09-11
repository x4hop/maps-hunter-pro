const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type,authorization',
  'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS'
};

const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: HEADERS });
const fail = (code, status = 400) => { const e = new Error(code); e.status = status; throw e; };
const enc = new TextEncoder();
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const random = n => b64(crypto.getRandomValues(new Uint8Array(n)));
const hash = async v => b64(await crypto.subtle.digest('SHA-256', enc.encode(String(v))));
const normalizeEmail = v => String(v || '').trim().toLowerCase();
const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
const key = prefix => `${prefix}-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
const sql = (e, q, ...p) => e.DB.prepare(q).bind(...p);
const first = (e, q, ...p) => sql(e, q, ...p).first();
const rows = async (e, q, ...p) => (await sql(e, q, ...p).all()).results || [];
const run = (e, q, ...p) => sql(e, q, ...p).run();

async function body(r) {
  if (Number(r.headers.get('content-length') || 0) > 32768) fail('REQUEST_TOO_LARGE', 413);
  const t = await r.text();
  if (t.length > 32768) fail('REQUEST_TOO_LARGE', 413);
  try {
    const x = JSON.parse(t || '{}');
    if (!x || typeof x !== 'object' || Array.isArray(x)) fail('INVALID_JSON');
    return x;
  } catch (err) {
    if (err?.message === 'INVALID_JSON') throw err;
    fail('INVALID_JSON');
  }
}

const PASSWORD_ITERATIONS = 150000;
async function passwordHash(password, salt, iterations = PASSWORD_ITERATIONS) {
  const k = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations }, k, 256));
}

async function settingMap(e) {
  return Object.fromEntries((await rows(e, 'SELECT key,value FROM settings')).map(x => [x.key, x.value]));
}

async function settings(e) {
  const z = await settingMap(e);
  const numeric = [
    'monthly_price_usd', 'annual_price_usd', 'monthly_daily_limit', 'allowed_devices',
    'affiliate_first_purchase_percent', 'affiliate_renewal_percent', 'affiliate_attribution_days',
    'affiliate_hold_days', 'affiliate_min_payout_cents', 'require_email_verification'
  ];
  const out = {
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
  for (const k of numeric) if (z[k] != null && Number.isFinite(Number(z[k]))) out[k] = Number(z[k]);
  return { ...out, raw: z };
}

function plan(s, id) {
  if (!['monthly', 'annual'].includes(id)) fail('INVALID_PLAN');
  return {
    id,
    price: Number(s[`${id}_price_usd`]),
    dailyLeadLimit: id === 'monthly' ? Number(s.monthly_daily_limit) : null,
    durationDays: id === 'monthly' ? 30 : 365
  };
}

async function session(r, e, admin = false) {
  const a = r.headers.get('authorization') || '';
  if (!a.startsWith('Bearer ')) fail('UNAUTHORIZED', 401);
  const tokenHash = await hash(a.slice(7));
  if (admin) {
    const s = await first(e, "SELECT id FROM admin_sessions WHERE token_hash=? AND julianday(expires_at)>julianday('now')", tokenHash);
    if (!s) fail('UNAUTHORIZED', 401);
    await run(e, 'UPDATE admin_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?', s.id);
    return { id: s.id, role: 'admin' };
  }
  const u = await first(e, "SELECT u.id,u.email,u.name,u.status,u.locale,u.email_verified_at FROM auth_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND julianday(s.expires_at)>julianday('now') AND u.status='active'", tokenHash);
  if (!u) fail('UNAUTHORIZED', 401);
  await run(e, 'UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE token_hash=?', tokenHash);
  return u;
}

async function rateLimit(r, e, path, limit = 40) {
  const ip = r.headers.get('cf-connecting-ip') || 'unknown';
  const bucket = Math.floor(Date.now() / 600000);
  const k = await hash(`${path}|${ip}|${bucket}`);
  const q = await first(e, "INSERT INTO request_limits(key,count,expires_at) VALUES(?,1,datetime('now','+20 minutes')) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count", k);
  if (Number(q?.count || 0) > limit) fail('TOO_MANY_REQUESTS', 429);
}

async function audit(e, event, actorType, actor, targetType, targetId, metadata = null, result = 'success', ip = null) {
  await run(e,
    'INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,ip,result,metadata_json) VALUES(?,?,?,?,?,?,?,?)',
    event, actorType || 'system', String(actor || ''), targetType || null, targetId == null ? null : String(targetId), ip, result,
    metadata ? JSON.stringify(metadata) : null
  );
}

async function publicSite(r, e) {
  const z = await settingMap(e);
  const configured = String(z.public_site_url || '').trim();
  if (/^https?:\/\//i.test(configured)) return configured.replace(/\/$/, '');
  const origin = String(r.headers.get('origin') || '').trim();
  return /^https?:\/\//i.test(origin) ? origin.replace(/\/$/, '') : '';
}

async function sendEmail(e, to, subject, html) {
  if (!e.RESEND_API_KEY || !e.EMAIL_FROM) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${e.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: e.EMAIL_FROM, to: [to], subject, html })
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function issueVerification(r, e, u) {
  const token = random(32);
  await e.DB.batch([
    sql(e, 'DELETE FROM email_verification_tokens WHERE user_id=? AND consumed_at IS NULL', u.id),
    sql(e, "INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+24 hours'))", u.id, await hash(token))
  ]);
  const site = await publicSite(r, e);
  const url = site ? `${site}/?verify_email=${encodeURIComponent(token)}#account` : '';
  const safeName = String(u.name || '').replace(/[<>&]/g, '');
  const emailSent = url ? await sendEmail(e, u.email, 'Verify your Maps Hunter Pro email', `<p>Hello ${safeName}</p><p>Verify your email to secure your Maps Hunter Pro account.</p><p><a href="${url}">Verify email</a></p><p>This link expires in 24 hours.</p>`) : false;
  const s = await settings(e);
  return { emailSent, emailConfigured: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM), verificationRequired: s.require_email_verification === 1 };
}

async function issueReset(r, e, u) {
  const token = random(32);
  await e.DB.batch([
    sql(e, 'DELETE FROM password_reset_tokens WHERE user_id=? AND consumed_at IS NULL', u.id),
    sql(e, "INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+1 hour'))", u.id, await hash(token))
  ]);
  const site = await publicSite(r, e);
  if (!site) return false;
  const url = `${site}/?reset_token=${encodeURIComponent(token)}#account`;
  const safeName = String(u.name || '').replace(/[<>&]/g, '');
  return sendEmail(e, u.email, 'Reset your Maps Hunter Pro password', `<p>Hello ${safeName}</p><p><a href="${url}">Reset your password</a></p><p>This link expires in 1 hour.</p>`);
}

async function bindReferral(e, userId, userEmail, code) {
  const ref = String(code || '').trim().toUpperCase();
  if (!ref) return;
  const alreadyPaid = await first(e, "SELECT id FROM payments WHERE user_id=? AND status='confirmed' LIMIT 1", userId);
  if (alreadyPaid) return;
  await run(e,
    "INSERT OR IGNORE INTO referrals(affiliate_id,referred_user_id) SELECT id,? FROM affiliates WHERE referral_code=? AND status='active' AND lower(email)!=?",
    userId, ref, normalizeEmail(userEmail)
  );
}

async function grant(e, sourceType, sourceRef, userId, planId) {
  const existing = await first(e,
    'SELECT g.user_id,l.license_key,s.expires_at FROM entitlement_grants g JOIN licenses l ON l.id=g.license_id JOIN subscriptions s ON s.id=g.subscription_id WHERE g.source_type=? AND g.source_ref=?',
    sourceType, sourceRef
  );
  if (existing) {
    if (Number(existing.user_id) !== Number(userId)) fail('CODE_ALREADY_USED', 409);
    return { already: true, licenseKey: existing.license_key, expiresAt: existing.expires_at };
  }
  const s = await settings(e);
  const p = plan(s, planId);
  const licenseKey = key('MHP');
  try {
    await run(e,
      'INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES(?,?,?,?,?,?,?)',
      sourceType, sourceRef, userId, planId, licenseKey, s.allowed_devices, p.dailyLeadLimit
    );
  } catch (err) {
    const won = await first(e, 'SELECT user_id FROM entitlement_grants WHERE source_type=? AND source_ref=?', sourceType, sourceRef);
    if (!won || Number(won.user_id) !== Number(userId)) throw err;
  }
  const g = await first(e,
    'SELECT l.license_key,s.expires_at FROM entitlement_grants g JOIN licenses l ON l.id=g.license_id JOIN subscriptions s ON s.id=g.subscription_id WHERE g.source_type=? AND g.source_ref=?',
    sourceType, sourceRef
  );
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
  return { ok: true, valid: true, license: { key: code, planId: 'owner', dailyLeadLimit: null, deviceLimit: null, expiresAt: null, owner: true }, usedToday: 0 };
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
  const ip = r.headers.get('cf-connecting-ip');
  if (!d) {
    try {
      await run(e,
        "INSERT INTO devices(user_id,license_id,device_uid,os,browser,last_ip,status) VALUES(?,?,?,?,?,?,'trusted')",
        l.user_id, l.id, deviceId, String(x.os || '').slice(0, 100), String(x.browser || '').slice(0, 100), ip
      );
    } catch (err) {
      d = await first(e, 'SELECT id,status FROM devices WHERE license_id=? AND device_uid=?', l.id, deviceId);
      if (!d) throw err;
      if (d.status === 'blocked') fail('DEVICE_BLOCKED', 403);
    }
  } else {
    await run(e, 'UPDATE devices SET last_seen_at=CURRENT_TIMESTAMP,last_ip=? WHERE id=?', ip, d.id);
  }
  return l;
}

async function activationRequest(r, e, x, u) {
  const s = await settings(e);
  if (s.require_email_verification === 1 && !u.email_verified_at) fail('EMAIL_NOT_VERIFIED', 403);
  const p = plan(s, x.planId);
  const method = String(x.paymentMethod || '').trim().toUpperCase();
  if (!['USDT', 'REDOTPAY'].includes(method)) fail('INVALID_PAYMENT_METHOD');
  const annual = await first(e, "SELECT id FROM subscriptions WHERE user_id=? AND plan_id='annual' AND status='active' AND julianday(expires_at)>julianday('now')", u.id);
  if (annual && p.id === 'monthly') fail('ANNUAL_DOWNGRADE_NOT_ALLOWED', 409);
  await bindReferral(e, u.id, u.email, x.referralCode);

  let old = await first(e,
    "SELECT a.request_ref,a.payment_ref,a.plan_id,p.amount_cents,p.method FROM activation_requests a JOIN payments p ON p.payment_ref=a.payment_ref WHERE a.user_id=? AND a.plan_id=? AND a.status='pending' AND p.status='pending' ORDER BY a.id DESC LIMIT 1",
    u.id, p.id
  );
  if (old && old.method !== method) {
    await e.DB.batch([
      sql(e, "UPDATE activation_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE request_ref=? AND status='pending'", old.request_ref),
      sql(e, "UPDATE payments SET status='rejected',review_note='Superseded by a new payment method',reviewed_at=CURRENT_TIMESTAMP WHERE payment_ref=? AND status='pending'", old.payment_ref)
    ]);
    old = null;
  }
  if (!old) {
    const pending = await rows(e, "SELECT payment_ref FROM activation_requests WHERE user_id=? AND status='pending'", u.id);
    if (pending.length) {
      await e.DB.batch([
        sql(e, "UPDATE activation_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND status='pending'", u.id),
        ...pending.map(v => sql(e, "UPDATE payments SET status='rejected',review_note='Superseded by a new request',reviewed_at=CURRENT_TIMESTAMP WHERE payment_ref=? AND status='pending'", v.payment_ref))
      ]);
    }
    const requestRef = key('ACT');
    const paymentRef = key('PAY');
    const hadPaid = await first(e, "SELECT id FROM payments WHERE user_id=? AND status='confirmed' LIMIT 1", u.id);
    await e.DB.batch([
      sql(e, "INSERT INTO payments(payment_ref,user_id,method,amount_cents,payment_type,status) VALUES(?,?,?,?,?,'pending')", paymentRef, u.id, method, Math.round(p.price * 100), hadPaid ? 'renewal' : 'first_purchase'),
      sql(e, 'INSERT INTO activation_requests(request_ref,user_id,plan_id,payment_ref) VALUES(?,?,?,?)', requestRef, u.id, p.id, paymentRef)
    ]);
    old = { request_ref: requestRef, payment_ref: paymentRef, plan_id: p.id, amount_cents: Math.round(p.price * 100), method };
  }
  return json({ ok: true, requestRef: old.request_ref, paymentRef: old.payment_ref, planId: old.plan_id, amount: Number(old.amount_cents) / 100, paymentMethod: old.method, status: 'pending' }, 201);
}

async function authRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (['/api/auth/register', '/api/auth/login', '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/verify-email', '/api/auth/resend-verification'].includes(p) && m === 'POST') await rateLimit(r, e, p, 25);

  if (['/api/auth/register', '/api/auth/login'].includes(p) && m === 'POST') {
    const x = await body(r), em = normalizeEmail(x.email), pw = String(x.password || '');
    if (!validEmail(em) || pw.length < 8 || pw.length > 256) fail('INVALID_INPUT');
    let u = await first(e, 'SELECT id,email,name,status,locale,email_verified_at FROM users WHERE email=?', em);
    let credential = u ? await first(e, 'SELECT password_hash,password_salt,iterations FROM auth_credentials WHERE user_id=?', u.id) : null;
    if (p.endsWith('/register')) {
      if (u) fail('ACCOUNT_EXISTS', 409);
      const name = String(x.name || '').trim().slice(0, 120);
      if (!name) fail('NAME_REQUIRED');
      if (x.acceptTerms !== true) fail('TERMS_REQUIRED');
      const locale = ['en', 'ar', 'ru', 'de', 'es'].includes(x.locale) ? x.locale : 'en';
      await run(e, 'INSERT INTO users(email,name,locale) VALUES(?,?,?)', em, name, locale);
      u = await first(e, 'SELECT id,email,name,status,locale,email_verified_at FROM users WHERE email=?', em);
      const salt = random(16);
      await run(e, 'INSERT INTO auth_credentials(user_id,password_hash,password_salt,iterations) VALUES(?,?,?,?)', u.id, await passwordHash(pw, salt), salt, PASSWORD_ITERATIONS);
      await run(e, 'INSERT OR IGNORE INTO acquisition(user_id,source,campaign) VALUES(?,?,?)', u.id, String(x.source || 'direct').slice(0, 120), String(x.campaign || '').slice(0, 120));
      await bindReferral(e, u.id, u.email, x.referralCode);
    } else {
      if (!u || u.status !== 'active' || !credential) fail('INVALID_CREDENTIALS', 401);
      const calculated = await passwordHash(pw, credential.password_salt, Number(credential.iterations) || PASSWORD_ITERATIONS);
      if (calculated !== credential.password_hash) fail('INVALID_CREDENTIALS', 401);
    }
    const token = random(32);
    await run(e, "INSERT INTO auth_sessions(user_id,token_hash,expires_at) VALUES(?,?,datetime('now','+30 days'))", u.id, await hash(token));
    let verification = { emailSent: false, emailConfigured: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM), verificationRequired: (await settings(e)).require_email_verification === 1 };
    if (p.endsWith('/register') && !u.email_verified_at) verification = await issueVerification(r, e, u);
    return json({ ok: true, token, user: { id: u.id, email: u.email, name: u.name, emailVerified: Boolean(u.email_verified_at) }, ...verification }, p.endsWith('/register') ? 201 : 200);
  }

  if (p === '/api/auth/logout' && m === 'POST') {
    const a = (r.headers.get('authorization') || '').replace(/^Bearer /, '');
    if (a) await run(e, 'DELETE FROM auth_sessions WHERE token_hash=?', await hash(a));
    return json({ ok: true });
  }

  if (p === '/api/auth/verify-email' && m === 'POST') {
    const x = await body(r), tokenHash = await hash(String(x.token || ''));
    const z = await first(e, "SELECT id,user_id FROM email_verification_tokens WHERE token_hash=? AND consumed_at IS NULL AND julianday(expires_at)>julianday('now')", tokenHash);
    if (!z) fail('INVALID_OR_EXPIRED_TOKEN', 400);
    await e.DB.batch([
      sql(e, 'UPDATE email_verification_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=?', z.id),
      sql(e, 'UPDATE users SET email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?', z.user_id)
    ]);
    return json({ ok: true });
  }

  if (p === '/api/auth/resend-verification' && m === 'POST') {
    const u = await session(r, e);
    const full = await first(e, 'SELECT id,email,name,email_verified_at FROM users WHERE id=?', u.id);
    if (full.email_verified_at) return json({ ok: true, alreadyVerified: true });
    return json({ ok: true, ...await issueVerification(r, e, full) });
  }

  if (p === '/api/auth/forgot-password' && m === 'POST') {
    const x = await body(r), em = normalizeEmail(x.email);
    if (validEmail(em)) {
      const u = await first(e, "SELECT id,email,name FROM users WHERE email=? AND status='active'", em);
      if (u) await issueReset(r, e, u);
    }
    return json({ ok: true });
  }

  if (p === '/api/auth/reset-password' && m === 'POST') {
    const x = await body(r), pw = String(x.password || '');
    if (pw.length < 8 || pw.length > 256) fail('INVALID_PASSWORD');
    const tokenHash = await hash(String(x.token || ''));
    const z = await first(e, "SELECT id,user_id FROM password_reset_tokens WHERE token_hash=? AND consumed_at IS NULL AND julianday(expires_at)>julianday('now')", tokenHash);
    if (!z) fail('INVALID_OR_EXPIRED_TOKEN', 400);
    const salt = random(16);
    await e.DB.batch([
      sql(e, 'UPDATE auth_credentials SET password_hash=?,password_salt=?,iterations=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?', await passwordHash(pw, salt), salt, PASSWORD_ITERATIONS, z.user_id),
      sql(e, 'UPDATE password_reset_tokens SET consumed_at=CURRENT_TIMESTAMP WHERE id=?', z.id),
      sql(e, 'DELETE FROM auth_sessions WHERE user_id=?', z.user_id)
    ]);
    return json({ ok: true });
  }
  return null;
}

async function accountRoutes(r, e, url) {
  const p = url.pathname, m = r.method;
  if (p === '/api/account/me' && m === 'GET') {
    const u = await session(r, e);
    const full = await first(e, 'SELECT id,email,name,status,locale,email_verified_at,created_at FROM users WHERE id=?', u.id);
    const subscription = await first(e, 'SELECT * FROM subscriptions WHERE user_id=? ORDER BY id DESC LIMIT 1', u.id);
    const license = await first(e, 'SELECT license_key,status,device_limit,expires_at FROM licenses WHERE user_id=? ORDER BY id DESC LIMIT 1', u.id);
    const usage = await first(e, "SELECT leads_processed FROM usage_daily WHERE user_id=? AND usage_date=date('now')", u.id);
    const usedToday = Number(usage?.leads_processed || 0);
    const dailyLimit = subscription?.daily_lead_limit ?? null;
    return json({ ok: true, user: { ...full, emailVerified: Boolean(full.email_verified_at) }, subscription, license, usage: { usedToday, dailyLimit, remaining: dailyLimit == null ? null : Math.max(0, Number(dailyLimit) - usedToday) } });
  }

  if (p === '/api/account/payments' && m === 'GET') {
    const u = await session(r, e);
    return json({ ok: true, payments: await rows(e, 'SELECT payment_ref,amount_cents,currency,method,payment_type,status,external_reference,proof_url,submitted_at,review_note,created_at,confirmed_at FROM payments WHERE user_id=? ORDER BY id DESC LIMIT 50', u.id) });
  }

  if (p === '/api/account/usage' && m === 'GET') {
    const u = await session(r, e);
    const sub = await first(e, "SELECT daily_lead_limit FROM subscriptions WHERE user_id=? AND status='active' AND julianday(expires_at)>julianday('now') ORDER BY id DESC LIMIT 1", u.id);
    const today = await first(e, "SELECT leads_processed FROM usage_daily WHERE user_id=? AND usage_date=date('now')", u.id);
    const usedToday = Number(today?.leads_processed || 0), dailyLimit = sub?.daily_lead_limit ?? null;
    return json({ ok: true, usedToday, dailyLimit, remaining: dailyLimit == null ? null : Math.max(0, Number(dailyLimit) - usedToday), history: await rows(e, 'SELECT usage_date,leads_processed,api_errors FROM usage_daily WHERE user_id=? ORDER BY usage_date DESC LIMIT 31', u.id) });
  }

  if (p === '/api/account/download' && m === 'GET') {
    await session(r, e);
    const z = await settingMap(e);
    return json({ ok: true, version: z.extension_version || '', url: z.extension_download_url || '', support: z.support_contact || '' });
  }

  if (p === '/api/account/profile' && m === 'PATCH') {
    const u = await session(r, e), x = await body(r);
    const name = String(x.name || '').trim().slice(0, 120), locale = String(x.locale || '');
    if (!name) fail('NAME_REQUIRED');
    if (!['en', 'ar', 'ru', 'de', 'es'].includes(locale)) fail('INVALID_LOCALE');
    await run(e, 'UPDATE users SET name=?,locale=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', name, locale, u.id);
    return json({ ok: true });
  }

  if (p === '/api/account/change-password' && m === 'POST') {
    const u = await session(r, e), x = await body(r);
    const current = String(x.currentPassword || ''), next = String(x.newPassword || '');
    if (next.length < 8 || next.length > 256) fail('INVALID_PASSWORD');
    const c = await first(e, 'SELECT password_hash,password_salt,iterations FROM auth_credentials WHERE user_id=?', u.id);
    if (!c || await passwordHash(current, c.password_salt, Number(c.iterations) || PASSWORD_ITERATIONS) !== c.password_hash) fail('INVALID_CREDENTIALS', 401);
    const salt = random(16);
    await e.DB.batch([
      sql(e, 'UPDATE auth_credentials SET password_hash=?,password_salt=?,iterations=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=?', await passwordHash(next, salt), salt, PASSWORD_ITERATIONS, u.id),
      sql(e, 'DELETE FROM auth_sessions WHERE user_id=?', u.id)
    ]);
    return json({ ok: true, reauthenticate: true });
  }

  if (p === '/api/activation/request' && m === 'POST') return activationRequest(r, e, await body(r), await session(r, e));

  const paymentSubmit = p.match(/^\/api\/payments\/([^/]+)\/submit$/);
  if (paymentSubmit && m === 'POST') {
    const u = await session(r, e), ref = decodeURIComponent(paymentSubmit[1]), x = await body(r);
    const payment = await first(e, 'SELECT * FROM payments WHERE payment_ref=? AND user_id=?', ref, u.id);
    if (!payment) fail('PAYMENT_NOT_FOUND', 404);
    if (payment.status !== 'pending') fail('PAYMENT_NOT_PENDING', 409);
    const external = String(x.transactionReference || '').trim().slice(0, 200);
    const proof = String(x.proofUrl || '').trim().slice(0, 1000);
    if (!external && !proof) fail('PAYMENT_PROOF_REQUIRED');
    if (external) {
      const duplicate = await first(e, 'SELECT payment_ref FROM payments WHERE external_reference=? AND payment_ref!=?', external, ref);
      if (duplicate) fail('DUPLICATE_EXTERNAL_REFERENCE', 409);
    }
    await run(e, "UPDATE payments SET external_reference=?,proof_url=?,submitted_at=CURRENT_TIMESTAMP,review_note=NULL WHERE payment_ref=? AND user_id=? AND status='pending'", external || null, proof || null, ref, u.id);
    await audit(e, 'PAYMENT_PROOF_SUBMITTED', 'user', u.email, 'payment', ref, { method: payment.method, hasReference: Boolean(external), hasProof: Boolean(proof) }, 'success', r.headers.get('cf-connecting-ip'));
    return json({ ok: true, paymentRef: ref, status: 'pending_review' });
  }

  if (p === '/api/codes/redeem' && m === 'POST') {
    await rateLimit(r, e, p, 25);
    const u = await session(r, e), x = await body(r), code = String(x.code || '').trim().toUpperCase();
    const z = await first(e, 'SELECT * FROM activation_codes WHERE code=?', code);
    if (!z) fail('CODE_NOT_FOUND', 404);
    if (z.status === 'redeemed') fail('CODE_ALREADY_USED', 409);
    if (z.status !== 'unused') fail('CODE_NOT_AVAILABLE', 409);
    if (z.expires_at && Date.parse(z.expires_at) <= Date.now()) fail('CODE_EXPIRED', 410);
    return json({ ok: true, planId: z.plan_id, ...await grant(e, 'code', code, u.id, z.plan_id) });
  }

  if (p === '/api/affiliate/register' && m === 'POST') {
    const u = await session(r, e), s = await settings(e);
    await run(e, "INSERT OR IGNORE INTO affiliates(email,name,referral_code,status,first_purchase_percent,renewal_percent) VALUES(?,?,?,'active',?,?)", u.email, u.name, key('AF'), s.affiliate_first_purchase_percent, s.affiliate_renewal_percent);
    return json({ ok: true, affiliate: await first(e, 'SELECT referral_code,status,first_purchase_percent,renewal_percent FROM affiliates WHERE email=?', u.email) });
  }

  if (p === '/api/affiliate/me' && m === 'GET') {
    const u = await session(r, e), a = await first(e, "SELECT * FROM affiliates WHERE email=? AND status='active'", u.email);
    if (!a) fail('AFFILIATE_NOT_FOUND', 404);
    const stats = await first(e, `SELECT
      (SELECT count(*) FROM referrals WHERE affiliate_id=?) referrals,
      (SELECT count(*) FROM referrals WHERE affiliate_id=? AND converted_at IS NOT NULL) conversions,
      (SELECT coalesce(sum(amount_cents),0) FROM commissions WHERE affiliate_id=? AND status='pending') pending_cents,
      (SELECT coalesce(sum(amount_cents),0) FROM commissions WHERE affiliate_id=? AND status IN ('approved','paid')) earned_cents,
      (SELECT coalesce(sum(c.amount_cents),0) FROM commissions c LEFT JOIN payout_commissions pc ON pc.commission_id=c.id WHERE c.affiliate_id=? AND c.status='approved' AND pc.commission_id IS NULL) available_cents`, a.id, a.id, a.id, a.id, a.id);
    const s = await settings(e);
    return json({ ok: true, affiliate: { referralCode: a.referral_code, firstPurchasePercent: a.first_purchase_percent, renewalPercent: a.renewal_percent }, terms: { attributionDays: s.affiliate_attribution_days, holdDays: s.affiliate_hold_days, minPayoutCents: s.affiliate_min_payout_cents }, stats, payouts: await rows(e, 'SELECT payout_ref,amount_cents,method,destination,status,created_at,processed_at FROM payouts WHERE affiliate_id=? ORDER BY id DESC LIMIT 50', a.id) });
  }

  if (p === '/api/affiliate/payouts' && m === 'POST') {
    const u = await session(r, e), x = await body(r), a = await first(e, "SELECT id FROM affiliates WHERE email=? AND status='active'", u.email);
    if (!a) fail('AFFILIATE_NOT_FOUND', 404);
    const method = String(x.method || '').toUpperCase(), destination = String(x.destination || '').trim().slice(0, 200);
    if (!['USDT', 'REDOTPAY'].includes(method) || destination.length < 4) fail('INVALID_PAYOUT');
    const cs = await rows(e, "SELECT c.id,c.amount_cents FROM commissions c LEFT JOIN payout_commissions pc ON pc.commission_id=c.id WHERE c.affiliate_id=? AND c.status='approved' AND pc.commission_id IS NULL ORDER BY c.id", a.id);
    const amount = cs.reduce((n, c) => n + Number(c.amount_cents), 0), s = await settings(e);
    if (amount < s.affiliate_min_payout_cents) fail('MINIMUM_PAYOUT_NOT_REACHED', 409);
    const ref = key('PO');
    await e.DB.batch([
      sql(e, "INSERT INTO payouts(payout_ref,affiliate_id,amount_cents,method,destination,status) VALUES(?,?,?,?,?,'pending')", ref, a.id, amount, method, destination),
      ...cs.map(c => sql(e, 'INSERT INTO payout_commissions(payout_id,commission_id,amount_cents) SELECT id,?,? FROM payouts WHERE payout_ref=?', c.id, c.amount_cents, ref))
    ]);
    return json({ ok: true, payoutRef: ref, amountCents: amount }, 201);
  }

  if (p === '/api/account/data-request' && m === 'POST') {
    const u = await session(r, e), x = await body(r);
    if (!['access', 'correction', 'deletion'].includes(x.type)) fail('INVALID_REQUEST_TYPE');
    const ref = key('DR');
    await run(e, 'INSERT INTO data_requests(request_ref,user_id,request_type,note) VALUES(?,?,?,?)', ref, u.id, x.type, String(x.note || '').slice(0, 1000));
    return json({ ok: true, requestRef: ref, status: 'pending' }, 201);
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
    await rateLimit(r, e, p, 20);
    const x = await body(r);
    if (!e.ADMIN_TOKEN || x.username !== (e.ADMIN_USERNAME || 'anasbm') || await hash(String(x.password || '')) !== await hash(e.ADMIN_TOKEN)) fail('INVALID_ADMIN_CREDENTIALS', 401);
    const token = random(32);
    await run(e, "INSERT INTO admin_sessions(token_hash,expires_at) VALUES(?,datetime('now','+4 hours'))", await hash(token));
    await audit(e, 'ADMIN_LOGIN', 'admin', x.username, 'session', 'created', null, 'success', r.headers.get('cf-connecting-ip'));
    return json({ ok: true, token });
  }
  if (!p.startsWith('/api/admin/')) return null;
  await session(r, e, true);

  if (p === '/api/admin/logout' && m === 'POST') {
    const a = (r.headers.get('authorization') || '').slice(7);
    await run(e, 'DELETE FROM admin_sessions WHERE token_hash=?', await hash(a));
    await audit(e, 'ADMIN_LOGOUT', 'admin', 'admin', 'session', 'current');
    return json({ ok: true });
  }

  if (p === '/api/admin/owner-access' && m === 'GET') return json({ ok: true, owner: await first(e, 'SELECT status,created_at,updated_at FROM owner_access WHERE id=1') });
  if (p === '/api/admin/owner-access/rotate' && m === 'POST') {
    const code = `MHP-OWNER-${random(32).toUpperCase()}`;
    await e.DB.batch([
      sql(e, "INSERT INTO owner_access(id,code_hash,status) VALUES(1,?,'active') ON CONFLICT(id) DO UPDATE SET code_hash=excluded.code_hash,status='active',updated_at=CURRENT_TIMESTAMP", await hash(code)),
      sql(e, "INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result) VALUES('OWNER_CODE_ROTATED','admin','admin','owner_access','1','success')")
    ]);
    return json({ ok: true, code, note: 'Store this owner code securely. It will not be shown again.' });
  }
  if (p === '/api/admin/owner-access/revoke' && m === 'POST') {
    await e.DB.batch([
      sql(e, "UPDATE owner_access SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE id=1"),
      sql(e, "INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result) VALUES('OWNER_CODE_REVOKED','admin','admin','owner_access','1','success')")
    ]);
    return json({ ok: true });
  }

  if (p === '/api/admin/summary' && m === 'GET') {
    const count = async q => Number((await first(e, q)).c || 0);
    const active = "status='active' AND julianday(expires_at)>julianday('now')";
    return json({ ok: true, summary: {
      users: await count('SELECT count(*) c FROM users'),
      activeUsers: await count("SELECT count(*) c FROM users WHERE status='active'"),
      pendingActivations: await count("SELECT count(*) c FROM activation_requests WHERE status='pending'"),
      activeSubscriptions: await count(`SELECT count(*) c FROM subscriptions WHERE ${active}`),
      activeLicenses: await count(`SELECT count(*) c FROM licenses WHERE ${active}`),
      unusedCodes: await count("SELECT count(*) c FROM activation_codes WHERE status='unused' AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))"),
      monthlyRevenue: await count("SELECT coalesce(sum(amount_cents),0) c FROM payments WHERE status='confirmed' AND strftime('%Y-%m',confirmed_at)=strftime('%Y-%m','now')") / 100,
      leadsToday: await count("SELECT coalesce(sum(leads_processed),0) c FROM usage_daily WHERE usage_date=date('now')"),
      pendingPayments: await count("SELECT count(*) c FROM payments WHERE status='pending'"),
      activeAffiliates: await count("SELECT count(*) c FROM affiliates WHERE status='active'"),
      expiringSoon: await count("SELECT count(*) c FROM subscriptions WHERE status='active' AND julianday(expires_at)>julianday('now') AND julianday(expires_at)<=julianday('now','+3 days')")
    } });
  }

  if (p === '/api/admin/settings') {
    if (m === 'PATCH') {
      const x = await body(r);
      const ranges = {
        monthly_price_usd: [1, 10000], annual_price_usd: [1, 100000], monthly_daily_limit: [1, 1000000], allowed_devices: [1, 10],
        affiliate_first_purchase_percent: [0, 100], affiliate_renewal_percent: [0, 100], affiliate_attribution_days: [1, 365], affiliate_hold_days: [0, 90],
        affiliate_min_payout_cents: [100, 1000000], require_email_verification: [0, 1]
      };
      const strings = { usdt_network: 30, usdt_address: 300, redotpay_id: 300, support_contact: 300, extension_download_url: 1000, extension_version: 50, public_site_url: 1000, affiliate_self_referral: 20 };
      const ops = [], changed = [];
      for (const [k, v] of Object.entries(x)) {
        if (k in ranges) {
          const n = Number(v), [lo, hi] = ranges[k];
          if (!Number.isFinite(n) || n < lo || n > hi || (!k.includes('price') && !Number.isInteger(n))) fail('INVALID_SETTING');
          changed.push(k); ops.push(sql(e, 'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP', k, String(n)));
        } else if (k in strings) {
          const val = String(v ?? '').trim().slice(0, strings[k]);
          if (k === 'affiliate_self_referral' && !['blocked', 'allowed'].includes(val)) fail('INVALID_SETTING');
          changed.push(k); ops.push(sql(e, 'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP', k, val));
        }
      }
      if (ops.length) { await e.DB.batch(ops); await audit(e, 'SETTINGS_UPDATED', 'admin', 'admin', 'settings', 'commercial', { keys: changed }); }
    }
    if (!['GET', 'PATCH'].includes(m)) fail('METHOD_NOT_ALLOWED', 405);
    return json({ ok: true, settings: await rows(e, 'SELECT key,value,updated_at FROM settings ORDER BY key') });
  }

  if (p === '/api/admin/codes/generate' && m === 'POST') {
    const x = await body(r), s = await settings(e), p0 = plan(s, x.planId), quantity = Number(x.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) fail('INVALID_QUANTITY');
    let expiresAt = null;
    if (x.expiresAt) {
      if (!Number.isFinite(Date.parse(x.expiresAt)) || Date.parse(x.expiresAt) <= Date.now()) fail('INVALID_EXPIRY');
      expiresAt = new Date(x.expiresAt).toISOString();
    }
    const codes = Array.from({ length: quantity }, () => key(`MHP-${p0.id === 'annual' ? 'Y' : 'M'}`));
    await e.DB.batch(codes.map(c => sql(e, 'INSERT INTO activation_codes(code,plan_id,note,purchaser_email,expires_at) VALUES(?,?,?,?,?)', c, p0.id, String(x.note || '').slice(0, 500) || null, normalizeEmail(x.purchaserEmail) || null, expiresAt)));
    await audit(e, 'CODES_GENERATED', 'admin', 'admin', 'activation_code', p0.id, { quantity });
    return json({ ok: true, codes, planId: p0.id }, 201);
  }

  let a = p.match(/^\/api\/admin\/codes\/([^/]+)\/revoke$/);
  if (a && m === 'POST') {
    const code = decodeURIComponent(a[1]);
    const z = await first(e, 'SELECT status FROM activation_codes WHERE code=?', code);
    if (!z) fail('CODE_NOT_FOUND', 404);
    if (z.status === 'redeemed') fail('CODE_ALREADY_USED', 409);
    await run(e, "UPDATE activation_codes SET status='revoked' WHERE code=? AND status='unused'", code);
    await audit(e, 'CODE_REVOKED', 'admin', 'admin', 'activation_code', code);
    return json({ ok: true });
  }

  if (p === '/api/admin/licenses' && m === 'POST') {
    const x = await body(r), s = await settings(e), p0 = plan(s, x.planId), em = normalizeEmail(x.email);
    const u = await first(e, "SELECT id,email FROM users WHERE email=? AND status='active'", em);
    if (!u) fail('CUSTOMER_ACCOUNT_REQUIRED', 409);
    const source = key('MHP-A');
    await run(e, 'INSERT INTO activation_codes(code,plan_id,note,purchaser_email) VALUES(?,?,?,?)', source, p0.id, 'Direct admin activation', em);
    const result = await grant(e, 'code', source, u.id, p0.id);
    const deviceLimit = Math.min(10, Math.max(1, Number(x.deviceLimit) || s.allowed_devices));
    await run(e, 'UPDATE licenses SET device_limit=? WHERE license_key=?', deviceLimit, result.licenseKey);
    await audit(e, 'LICENSE_CREATED', 'admin', 'admin', 'license', result.licenseKey, { email: em, planId: p0.id, deviceLimit });
    return json({ ok: true, license: { licenseKey: result.licenseKey, email: em, planId: p0.id, expiresAt: result.expiresAt, deviceLimit } }, 201);
  }

  a = p.match(/^\/api\/admin\/licenses\/([^/]+)\/revoke$/);
  if (a && m === 'POST') {
    const licenseKey = decodeURIComponent(a[1]);
    const z = await first(e, 'SELECT id,status FROM licenses WHERE license_key=?', licenseKey);
    if (!z) fail('NOT_FOUND', 404);
    await run(e, "UPDATE licenses SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE license_key=?", licenseKey);
    await audit(e, 'LICENSE_REVOKED', 'admin', 'admin', 'license', licenseKey);
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/devices\/(\d+)\/(block|unblock|release)$/);
  if (a && m === 'POST') {
    const id = Number(a[1]), action = a[2], d = await first(e, 'SELECT id FROM devices WHERE id=?', id);
    if (!d) fail('NOT_FOUND', 404);
    if (action === 'release') await run(e, 'DELETE FROM devices WHERE id=?', id);
    else await run(e, "UPDATE devices SET status=? WHERE id=?", action === 'block' ? 'blocked' : 'trusted', id);
    await audit(e, `DEVICE_${action.toUpperCase()}`, 'admin', 'admin', 'device', id);
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/payments\/([^/]+)\/confirm$/);
  if (a && m === 'POST') {
    const ref = decodeURIComponent(a[1]), x = await body(r);
    const z = await first(e, 'SELECT a.*,p.external_reference,p.proof_url,p.status payment_status FROM activation_requests a JOIN payments p ON p.payment_ref=a.payment_ref WHERE p.payment_ref=?', ref);
    if (!z) fail('ACTIVATION_REQUEST_REQUIRED', 409);
    if (z.status === 'approved' || z.payment_status === 'confirmed') return json({ ok: true, already: true });
    if (z.payment_status !== 'pending') fail('PAYMENT_NOT_PENDING', 409);
    const external = String(x.externalReference || z.external_reference || '').trim().slice(0, 200);
    if (!external && !z.proof_url) fail('PAYMENT_EVIDENCE_REQUIRED', 409);
    if (external) {
      const duplicate = await first(e, 'SELECT payment_ref FROM payments WHERE external_reference=? AND payment_ref!=?', external, ref);
      if (duplicate) fail('DUPLICATE_EXTERNAL_REFERENCE', 409);
      await run(e, "UPDATE payments SET external_reference=? WHERE payment_ref=? AND status='pending'", external, ref);
    }
    const result = await grant(e, 'payment', z.payment_ref, z.user_id, z.plan_id);
    await run(e, "UPDATE payments SET reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin',review_note=NULL WHERE payment_ref=?", ref);
    await audit(e, 'PAYMENT_CONFIRMED', 'admin', 'admin', 'payment', ref, { externalReference: external || null });
    return json({ ok: true, ...result });
  }

  a = p.match(/^\/api\/admin\/payments\/([^/]+)\/reject$/);
  if (a && m === 'POST') {
    const ref = decodeURIComponent(a[1]), x = await body(r), z = await first(e, 'SELECT status FROM payments WHERE payment_ref=?', ref);
    if (!z) fail('PAYMENT_NOT_FOUND', 404);
    if (z.status !== 'pending') fail('PAYMENT_NOT_PENDING', 409);
    const note = String(x.reason || 'Payment could not be verified').trim().slice(0, 500);
    await e.DB.batch([
      sql(e, "UPDATE payments SET status='rejected',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin',review_note=? WHERE payment_ref=? AND status='pending'", note, ref),
      sql(e, "UPDATE activation_requests SET status='rejected',updated_at=CURRENT_TIMESTAMP WHERE payment_ref=? AND status='pending'", ref)
    ]);
    await audit(e, 'PAYMENT_REJECTED', 'admin', 'admin', 'payment', ref, { reason: note });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/payments\/([^/]+)\/refund$/);
  if (a && m === 'POST') {
    const ref = decodeURIComponent(a[1]), p0 = await first(e, "SELECT * FROM payments WHERE payment_ref=? AND status='confirmed'", ref);
    if (!p0) fail('PAYMENT_NOT_CONFIRMED', 409);
    await e.DB.batch([
      sql(e, "UPDATE payments SET status='refunded',reviewed_at=CURRENT_TIMESTAMP,reviewed_by='admin' WHERE id=? AND status='confirmed'", p0.id),
      sql(e, "UPDATE commissions SET status='cancelled' WHERE payment_id=? AND status!='paid'", p0.id),
      sql(e, "UPDATE licenses SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE subscription_id=?", p0.subscription_id),
      sql(e, "UPDATE subscriptions SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?", p0.subscription_id)
    ]);
    await audit(e, 'PAYMENT_REFUNDED', 'admin', 'admin', 'payment', ref, { amountCents: p0.amount_cents });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/payouts\/([^/]+)\/(approve|reject|pay)$/);
  if (a && m === 'POST') {
    const ref = decodeURIComponent(a[1]), action = a[2], z = await first(e, 'SELECT id,status FROM payouts WHERE payout_ref=?', ref);
    if (!z) fail('NOT_FOUND', 404);
    if (action === 'approve' && z.status === 'pending') await run(e, "UPDATE payouts SET status='approved',processed_at=CURRENT_TIMESTAMP WHERE id=?", z.id);
    else if (action === 'reject' && ['pending', 'approved'].includes(z.status)) {
      await e.DB.batch([sql(e, "UPDATE payouts SET status='rejected',processed_at=CURRENT_TIMESTAMP WHERE id=?", z.id), sql(e, 'DELETE FROM payout_commissions WHERE payout_id=?', z.id)]);
    } else if (action === 'pay' && z.status === 'approved') {
      await e.DB.batch([sql(e, "UPDATE payouts SET status='paid',processed_at=CURRENT_TIMESTAMP WHERE id=?", z.id), sql(e, "UPDATE commissions SET status='paid',paid_at=CURRENT_TIMESTAMP WHERE id IN (SELECT commission_id FROM payout_commissions WHERE payout_id=?)", z.id)]);
    } else fail('INVALID_PAYOUT_STATE', 409);
    await audit(e, `PAYOUT_${action.toUpperCase()}`, 'admin', 'admin', 'payout', ref);
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/users\/(\d+)\/status$/);
  if (a && m === 'POST') {
    const x = await body(r), status = String(x.status || '');
    if (!['active', 'suspended', 'inactive'].includes(status)) fail('INVALID_STATUS');
    await run(e, 'UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', status, Number(a[1]));
    if (status !== 'active') await run(e, 'DELETE FROM auth_sessions WHERE user_id=?', Number(a[1]));
    await audit(e, 'USER_STATUS_CHANGED', 'admin', 'admin', 'user', a[1], { status, reason: String(x.reason || '').slice(0, 500) });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/subscriptions\/(\d+)\/extend$/);
  if (a && m === 'POST') {
    const x = await body(r), days = Number(x.days), id = Number(a[1]);
    if (!Number.isInteger(days) || days < 1 || days > 730) fail('INVALID_EXTENSION');
    const sub = await first(e, 'SELECT id FROM subscriptions WHERE id=?', id);
    if (!sub) fail('NOT_FOUND', 404);
    await e.DB.batch([
      sql(e, "UPDATE subscriptions SET status='active',started_at=COALESCE(started_at,CURRENT_TIMESTAMP),expires_at=datetime(CASE WHEN expires_at IS NOT NULL AND julianday(expires_at)>julianday('now') THEN expires_at ELSE CURRENT_TIMESTAMP END, '+'||?||' days'),updated_at=CURRENT_TIMESTAMP WHERE id=?", days, id),
      sql(e, "UPDATE licenses SET status='active',expires_at=(SELECT expires_at FROM subscriptions WHERE id=?),updated_at=CURRENT_TIMESTAMP WHERE subscription_id=?", id, id)
    ]);
    await audit(e, 'SUBSCRIPTION_EXTENDED', 'admin', 'admin', 'subscription', id, { days });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/subscriptions\/(\d+)\/plan$/);
  if (a && m === 'POST') {
    const x = await body(r), id = Number(a[1]), s = await settings(e), p0 = plan(s, x.planId);
    const sub = await first(e, 'SELECT id FROM subscriptions WHERE id=?', id);
    if (!sub) fail('NOT_FOUND', 404);
    await run(e, 'UPDATE subscriptions SET plan_id=?,daily_lead_limit=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', p0.id, p0.dailyLeadLimit, id);
    await audit(e, 'SUBSCRIPTION_PLAN_CHANGED', 'admin', 'admin', 'subscription', id, { planId: p0.id });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/subscriptions\/(\d+)\/status$/);
  if (a && m === 'POST') {
    const x = await body(r), id = Number(a[1]), status = String(x.status || '');
    if (!['active', 'cancelled', 'expired'].includes(status)) fail('INVALID_STATUS');
    await run(e, 'UPDATE subscriptions SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', status, id);
    if (status !== 'active') await run(e, "UPDATE licenses SET status='revoked',updated_at=CURRENT_TIMESTAMP WHERE subscription_id=?", id);
    await audit(e, 'SUBSCRIPTION_STATUS_CHANGED', 'admin', 'admin', 'subscription', id, { status });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/affiliates\/(\d+)\/status$/);
  if (a && m === 'POST') {
    const x = await body(r), status = String(x.status || '');
    if (!['active', 'suspended', 'pending'].includes(status)) fail('INVALID_STATUS');
    await run(e, 'UPDATE affiliates SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', status, Number(a[1]));
    await audit(e, 'AFFILIATE_STATUS_CHANGED', 'admin', 'admin', 'affiliate', a[1], { status });
    return json({ ok: true });
  }

  a = p.match(/^\/api\/admin\/data-requests\/([^/]+)\/complete$/);
  if (a && m === 'POST') {
    const ref = decodeURIComponent(a[1]), z = await first(e, "SELECT * FROM data_requests WHERE request_ref=? AND status IN ('pending','verified')", ref);
    if (!z) fail('REQUEST_NOT_PENDING', 409);
    if (z.request_type === 'deletion') {
      await e.DB.batch([
        sql(e, 'DELETE FROM auth_sessions WHERE user_id=?', z.user_id),
        sql(e, 'DELETE FROM auth_credentials WHERE user_id=?', z.user_id),
        sql(e, 'DELETE FROM devices WHERE user_id=?', z.user_id),
        sql(e, 'DELETE FROM acquisition WHERE user_id=?', z.user_id),
        sql(e, "UPDATE users SET email='deleted+'||id||'@privacy.invalid',name='Deleted user',status='inactive',updated_at=CURRENT_TIMESTAMP WHERE id=?", z.user_id)
      ]);
    }
    await run(e, "UPDATE data_requests SET status='completed',completed_at=CURRENT_TIMESTAMP WHERE id=?", z.id);
    await audit(e, 'DATA_REQUEST_COMPLETED', 'admin', 'admin', 'data_request', ref, { type: z.request_type, userId: z.user_id });
    return json({ ok: true });
  }

  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50));
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
  const q = `%${String(url.searchParams.get('q') || '').slice(0, 120)}%`;
  const lists = {
    users: ['users', "SELECT u.id,u.email,u.name,u.status,u.locale,u.email_verified_at,u.created_at,s.plan_id,s.status subscription_status,s.expires_at,(SELECT count(*) FROM devices d WHERE d.user_id=u.id) devices FROM users u LEFT JOIN subscriptions s ON s.id=(SELECT id FROM subscriptions WHERE user_id=u.id ORDER BY id DESC LIMIT 1) WHERE u.email LIKE ? OR u.name LIKE ? ORDER BY u.id DESC"],
    'activation-requests': ['requests', 'SELECT ar.*,u.email,u.name,p.method,p.amount_cents,p.status payment_status,p.external_reference,p.proof_url,p.submitted_at,p.review_note FROM activation_requests ar JOIN users u ON u.id=ar.user_id LEFT JOIN payments p ON p.payment_ref=ar.payment_ref WHERE u.email LIKE ? OR ar.request_ref LIKE ? ORDER BY ar.id DESC'],
    subscriptions: ['subscriptions', 'SELECT s.*,u.email FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE u.email LIKE ? OR s.plan_id LIKE ? ORDER BY s.id DESC'],
    licenses: ['licenses', 'SELECT l.*,u.email,s.plan_id FROM licenses l JOIN users u ON u.id=l.user_id LEFT JOIN subscriptions s ON s.id=l.subscription_id WHERE u.email LIKE ? OR l.license_key LIKE ? ORDER BY l.id DESC'],
    codes: ['codes', "SELECT ac.*,u.email redeemed_by_email FROM activation_codes ac LEFT JOIN users u ON u.id=ac.redeemed_by_user_id WHERE ac.code LIKE ? OR coalesce(u.email,'') LIKE ? ORDER BY ac.id DESC"],
    devices: ['devices', 'SELECT d.*,u.email,l.license_key FROM devices d JOIN users u ON u.id=d.user_id JOIN licenses l ON l.id=d.license_id WHERE u.email LIKE ? OR d.device_uid LIKE ? ORDER BY d.id DESC'],
    payments: ['payments', 'SELECT p.*,u.email FROM payments p JOIN users u ON u.id=p.user_id WHERE u.email LIKE ? OR p.payment_ref LIKE ? ORDER BY p.id DESC'],
    affiliates: ['affiliates', "SELECT a.*,(SELECT count(*) FROM referrals r WHERE r.affiliate_id=a.id) referrals,(SELECT coalesce(sum(amount_cents),0) FROM commissions c WHERE c.affiliate_id=a.id AND status IN ('approved','paid')) commission_cents,(SELECT coalesce(sum(amount_cents),0) FROM commissions c WHERE c.affiliate_id=a.id AND status='pending') pending_cents FROM affiliates a WHERE a.email LIKE ? OR a.referral_code LIKE ? ORDER BY a.id DESC"],
    payouts: ['payouts', 'SELECT p.*,a.email FROM payouts p JOIN affiliates a ON a.id=p.affiliate_id WHERE a.email LIKE ? OR p.payout_ref LIKE ? ORDER BY p.id DESC'],
    usage: ['usage', 'SELECT d.*,u.email FROM usage_daily d JOIN users u ON u.id=d.user_id WHERE u.email LIKE ? OR d.usage_date LIKE ? ORDER BY d.usage_date DESC'],
    logs: ['logs', "SELECT * FROM audit_logs WHERE coalesce(actor,'') LIKE ? OR event_type LIKE ? ORDER BY id DESC"],
    'data-requests': ['requests', 'SELECT d.*,u.email FROM data_requests d JOIN users u ON u.id=d.user_id WHERE u.email LIKE ? OR d.request_ref LIKE ? ORDER BY d.id DESC']
  };
  const spec = lists[p.split('/').pop()];
  if (spec && m === 'GET') {
    const [name, query] = spec;
    const data = await rows(e, `${query} LIMIT ? OFFSET ?`, q, q, limit + 1, offset);
    return json({ ok: true, [name]: data.slice(0, limit), hasMore: data.length > limit, offset, limit });
  }
  fail('NOT_FOUND', 404);
}

async function dispatch(r, e) {
  const url = new URL(r.url), p = url.pathname, m = r.method;
  if (m === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  if (p === '/api/health' && m === 'GET') {
    return json({ ok: true, version: '6.0.0-platform', database: (await first(e, 'SELECT 1 ok')).ok === 1 ? 'connected' : 'error', email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM) ? 'configured' : 'not_configured' });
  }

  if (p === '/api/plans' && m === 'GET') {
    const s = await settings(e);
    return json({ ok: true, plans: ['monthly', 'annual'].map(id => plan(s, id)), affiliate: { firstPurchasePercent: s.affiliate_first_purchase_percent, renewalPercent: s.affiliate_renewal_percent, attributionDays: s.affiliate_attribution_days, holdDays: s.affiliate_hold_days, minPayoutCents: s.affiliate_min_payout_cents } });
  }

  if (p === '/api/payment-methods' && m === 'GET') {
    const z = await settingMap(e);
    return json({ ok: true, methods: {
      USDT: { enabled: Boolean(z.usdt_address), network: z.usdt_network || null, address: z.usdt_address || null },
      REDOTPAY: { enabled: Boolean(z.redotpay_id), account: z.redotpay_id || null }
    }, support: z.support_contact || null });
  }

  const admin = await adminRoutes(r, e, url); if (admin) return admin;
  const auth = await authRoutes(r, e, url); if (auth) return auth;
  const account = await accountRoutes(r, e, url); if (account) return account;
  const extension = await extensionRoutes(r, e, url); if (extension) return extension;
  fail('NOT_FOUND', 404);
}

async function maintenance(e) {
  const s = await settings(e);
  const results = await e.DB.batch([
    sql(e, "DELETE FROM auth_sessions WHERE julianday(expires_at)<=julianday('now')"),
    sql(e, "DELETE FROM admin_sessions WHERE julianday(expires_at)<=julianday('now')"),
    sql(e, "DELETE FROM request_limits WHERE julianday(expires_at)<=julianday('now')"),
    sql(e, "DELETE FROM email_verification_tokens WHERE consumed_at IS NOT NULL OR julianday(expires_at)<=julianday('now','-7 days')"),
    sql(e, "DELETE FROM password_reset_tokens WHERE consumed_at IS NOT NULL OR julianday(expires_at)<=julianday('now','-7 days')"),
    sql(e, "DELETE FROM usage_events WHERE julianday(created_at)<=julianday('now','-90 days')"),
    sql(e, "UPDATE devices SET last_ip=NULL WHERE last_ip IS NOT NULL AND julianday(last_seen_at)<=julianday('now','-30 days')"),
    sql(e, "UPDATE subscriptions SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='active' AND julianday(expires_at)<=julianday('now')"),
    sql(e, "UPDATE licenses SET status='expired',updated_at=CURRENT_TIMESTAMP WHERE status='active' AND julianday(expires_at)<=julianday('now')"),
    sql(e, "UPDATE activation_codes SET status='expired' WHERE status='unused' AND expires_at IS NOT NULL AND julianday(expires_at)<=julianday('now')"),
    sql(e, "UPDATE commissions SET status='approved',approved_at=CURRENT_TIMESTAMP WHERE status='pending' AND julianday(created_at)<=julianday('now', '-'||?||' days')", s.affiliate_hold_days)
  ]);
  const changed = results.reduce((n, x) => n + Number(x.meta?.changes || 0), 0);
  await run(e, "INSERT INTO maintenance_runs(run_type,rows_changed) VALUES('retention',?)", changed);
  return changed;
}

const KNOWN = [
  'CODE_NOT_AVAILABLE','CODE_ALREADY_USED','CODE_NOT_FOUND','CODE_EXPIRED','PAYMENT_NOT_PENDING','PAYMENT_NOT_FOUND','PAYMENT_NOT_CONFIRMED','PAYMENT_EVIDENCE_REQUIRED',
  'ACCOUNT_INACTIVE','ANNUAL_DOWNGRADE_NOT_ALLOWED','DAILY_LIMIT_REACHED','INVALID_LICENSE','DEVICE_LIMIT_REACHED','DEVICE_BLOCKED','DUPLICATE_EXTERNAL_REFERENCE',
  'INVALID_CREDENTIALS','INVALID_ADMIN_CREDENTIALS','EMAIL_NOT_VERIFIED','INVALID_OR_EXPIRED_TOKEN','MINIMUM_PAYOUT_NOT_REACHED','REQUEST_ID_CONFLICT','TERMS_REQUIRED'
];

export default {
  async fetch(r, e) {
    try { return await dispatch(r, e); }
    catch (err) {
      const message = String(err?.message || err);
      const known = KNOWN.find(x => message.includes(x));
      return json({ ok: false, error: err?.status ? message : (known || 'SERVER_ERROR') }, err?.status || (known ? 409 : 500));
    }
  },
  async scheduled(controller, e, ctx) { ctx.waitUntil(maintenance(e)); }
};
