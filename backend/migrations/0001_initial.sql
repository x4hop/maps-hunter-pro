PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','inactive')),
  locale TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id TEXT NOT NULL CHECK(plan_id IN ('monthly','annual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','expired','cancelled')),
  started_at TEXT,
  expires_at TEXT,
  daily_lead_limit INTEGER,
  renewal_mode TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subscription_id INTEGER,
  license_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked','expired','pending')),
  device_limit INTEGER NOT NULL DEFAULT 2,
  activated_at TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  license_id INTEGER NOT NULL,
  device_uid TEXT NOT NULL,
  os TEXT,
  browser TEXT,
  last_ip TEXT,
  status TEXT NOT NULL DEFAULT 'trusted' CHECK(status IN ('trusted','review','blocked')),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(license_id, device_uid),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(license_id) REFERENCES licenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_ref TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  subscription_id INTEGER,
  method TEXT NOT NULL CHECK(method IN ('USDT','REDOTPAY')),
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_type TEXT NOT NULL DEFAULT 'first_purchase' CHECK(payment_type IN ('first_purchase','renewal')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','refunded')),
  external_reference TEXT,
  proof_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS affiliates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','suspended','pending')),
  first_purchase_percent INTEGER NOT NULL DEFAULT 50,
  renewal_percent INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  referred_user_id INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  converted_at TEXT,
  UNIQUE(referred_user_id),
  FOREIGN KEY(affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
  FOREIGN KEY(referred_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  affiliate_id INTEGER NOT NULL,
  payment_id INTEGER NOT NULL UNIQUE,
  commission_type TEXT NOT NULL CHECK(commission_type IN ('first_purchase','renewal')),
  percent INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','paid','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  paid_at TEXT,
  FOREIGN KEY(affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE,
  FOREIGN KEY(payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payout_ref TEXT NOT NULL UNIQUE,
  affiliate_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('USDT','REDOTPAY')),
  destination TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','paid','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  FOREIGN KEY(affiliate_id) REFERENCES affiliates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS usage_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  usage_date TEXT NOT NULL,
  leads_processed INTEGER NOT NULL DEFAULT 0,
  api_errors INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, usage_date),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL DEFAULT 'system',
  actor TEXT,
  target_type TEXT,
  target_id TEXT,
  ip TEXT,
  result TEXT NOT NULL DEFAULT 'success',
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id,status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires ON subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_licenses_user_status ON licenses(user_id,status);
CREATE INDEX IF NOT EXISTS idx_payments_status_created ON payments(status,created_at);
CREATE INDEX IF NOT EXISTS idx_commissions_affiliate_status ON commissions(affiliate_id,status);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_daily(usage_date);
CREATE INDEX IF NOT EXISTS idx_logs_created ON audit_logs(created_at DESC);

INSERT OR IGNORE INTO settings(key,value) VALUES
('monthly_price_usd','20'),
('annual_price_usd','100'),
('monthly_daily_limit','1500'),
('annual_daily_limit','unlimited'),
('affiliate_first_purchase_percent','50'),
('affiliate_renewal_percent','20'),
('allowed_devices','2'),
('payment_methods','USDT,REDOTPAY');

