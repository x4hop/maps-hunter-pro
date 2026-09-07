-- Additive migration for the observed production schema (schema.sql).
CREATE TABLE IF NOT EXISTS entitlement_grants (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 source_type TEXT NOT NULL CHECK(source_type IN ('payment','code')),
 source_ref TEXT NOT NULL,
 user_id INTEGER NOT NULL REFERENCES users(id),
 plan_id TEXT NOT NULL CHECK(plan_id IN ('monthly','annual')),
 license_key TEXT NOT NULL,
 device_limit INTEGER NOT NULL CHECK(device_limit BETWEEN 1 AND 10),
 daily_limit INTEGER,
 subscription_id INTEGER,
 license_id INTEGER,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(source_type,source_ref)
);
CREATE TRIGGER IF NOT EXISTS grant_validate BEFORE INSERT ON entitlement_grants BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active') THEN RAISE(ABORT,'ACCOUNT_INACTIVE') END;
 SELECT CASE WHEN NEW.source_type='code' AND NOT EXISTS(SELECT 1 FROM activation_codes WHERE code=NEW.source_ref AND status='unused' AND plan_id=NEW.plan_id AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))) THEN RAISE(ABORT,'CODE_NOT_AVAILABLE') END;
 SELECT CASE WHEN NEW.source_type='payment' AND NOT EXISTS(SELECT 1 FROM activation_requests a JOIN payments p ON p.payment_ref=a.payment_ref WHERE p.payment_ref=NEW.source_ref AND p.user_id=NEW.user_id AND a.user_id=NEW.user_id AND a.plan_id=NEW.plan_id AND a.status='pending' AND p.status='pending') THEN RAISE(ABORT,'PAYMENT_NOT_PENDING') END;
END;
CREATE TRIGGER IF NOT EXISTS grant_apply AFTER INSERT ON entitlement_grants BEGIN
 INSERT INTO subscriptions(user_id,plan_id,status,started_at,expires_at,daily_lead_limit)
 SELECT NEW.user_id,NEW.plan_id,'active',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NEW.daily_limit
 WHERE NOT EXISTS(SELECT 1 FROM subscriptions WHERE user_id=NEW.user_id AND status='active');
 UPDATE subscriptions SET plan_id=NEW.plan_id,
 expires_at=datetime(CASE WHEN julianday(expires_at)>julianday('now') THEN expires_at ELSE CURRENT_TIMESTAMP END,CASE NEW.plan_id WHEN 'annual' THEN '+365 days' ELSE '+30 days' END),
 daily_lead_limit=NEW.daily_limit,updated_at=CURRENT_TIMESTAMP
 WHERE id=(SELECT id FROM subscriptions WHERE user_id=NEW.user_id AND status='active' ORDER BY id DESC LIMIT 1);
 UPDATE entitlement_grants SET subscription_id=(SELECT id FROM subscriptions WHERE user_id=NEW.user_id AND status='active' ORDER BY id DESC LIMIT 1) WHERE id=NEW.id;
 INSERT INTO licenses(user_id,subscription_id,license_key,status,device_limit,activated_at,expires_at)
 SELECT NEW.user_id,g.subscription_id,NEW.license_key,'active',NEW.device_limit,CURRENT_TIMESTAMP,s.expires_at
 FROM entitlement_grants g JOIN subscriptions s ON s.id=g.subscription_id WHERE g.id=NEW.id
 AND NOT EXISTS(SELECT 1 FROM licenses WHERE user_id=NEW.user_id AND status IN ('active','expired'));
 UPDATE licenses SET status='active',subscription_id=(SELECT subscription_id FROM entitlement_grants WHERE id=NEW.id),
 expires_at=(SELECT expires_at FROM subscriptions WHERE id=(SELECT subscription_id FROM entitlement_grants WHERE id=NEW.id)),updated_at=CURRENT_TIMESTAMP
 WHERE id=(SELECT id FROM licenses WHERE user_id=NEW.user_id AND status IN ('active','expired') ORDER BY id DESC LIMIT 1);
 UPDATE entitlement_grants SET license_id=(SELECT id FROM licenses WHERE user_id=NEW.user_id AND status='active' ORDER BY id DESC LIMIT 1) WHERE id=NEW.id;
 UPDATE activation_codes SET status='redeemed',redeemed_by_user_id=NEW.user_id,redeemed_at=CURRENT_TIMESTAMP WHERE NEW.source_type='code' AND code=NEW.source_ref;
 UPDATE payments SET payment_type=CASE WHEN EXISTS(SELECT 1 FROM payments p WHERE p.user_id=NEW.user_id AND p.status='confirmed') THEN 'renewal' ELSE 'first_purchase' END,
 status='confirmed',subscription_id=(SELECT subscription_id FROM entitlement_grants WHERE id=NEW.id),confirmed_at=CURRENT_TIMESTAMP WHERE NEW.source_type='payment' AND payment_ref=NEW.source_ref;
 UPDATE activation_requests SET status='approved',license_id=(SELECT license_id FROM entitlement_grants WHERE id=NEW.id),approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE NEW.source_type='payment' AND payment_ref=NEW.source_ref;
 INSERT OR IGNORE INTO commissions(affiliate_id,payment_id,commission_type,percent,amount_cents,status,approved_at)
 SELECT a.id,p.id,p.payment_type,CASE p.payment_type WHEN 'renewal' THEN a.renewal_percent ELSE a.first_purchase_percent END,
 CAST(round(p.amount_cents*(CASE p.payment_type WHEN 'renewal' THEN a.renewal_percent ELSE a.first_purchase_percent END)/100.0) AS INTEGER),'approved',CURRENT_TIMESTAMP
 FROM payments p JOIN referrals r ON r.referred_user_id=p.user_id JOIN affiliates a ON a.id=r.affiliate_id
 JOIN users u ON u.id=p.user_id WHERE NEW.source_type='payment' AND p.payment_ref=NEW.source_ref AND a.status='active' AND lower(a.email)!=lower(u.email);
 UPDATE referrals SET converted_at=COALESCE(converted_at,CURRENT_TIMESTAMP) WHERE NEW.source_type='payment' AND referred_user_id=NEW.user_id;
 INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result) VALUES('ENTITLEMENT_GRANTED','system',CAST(NEW.user_id AS TEXT),NEW.source_type,NEW.source_ref,'success');
END;
CREATE TRIGGER IF NOT EXISTS device_limit_guard BEFORE INSERT ON devices WHEN NEW.status!='blocked' BEGIN
 SELECT CASE WHEN (SELECT count(*) FROM devices WHERE license_id=NEW.license_id AND status!='blocked') >= (SELECT device_limit FROM licenses WHERE id=NEW.license_id) THEN RAISE(ABORT,'DEVICE_LIMIT_REACHED') END;
END;
CREATE TABLE IF NOT EXISTS usage_events (
 request_id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),license_id INTEGER NOT NULL REFERENCES licenses(id),
 usage_date TEXT NOT NULL,amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 100),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS usage_guard BEFORE INSERT ON usage_events BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM licenses l JOIN subscriptions s ON s.id=l.subscription_id JOIN users u ON u.id=l.user_id WHERE l.id=NEW.license_id AND l.user_id=NEW.user_id AND l.status='active' AND s.status='active' AND u.status='active' AND julianday(l.expires_at)>julianday('now') AND julianday(s.expires_at)>julianday('now')) THEN RAISE(ABORT,'INVALID_LICENSE') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM licenses l JOIN subscriptions s ON s.id=l.subscription_id WHERE l.id=NEW.license_id AND s.daily_lead_limit IS NOT NULL AND COALESCE((SELECT leads_processed FROM usage_daily WHERE user_id=NEW.user_id AND usage_date=NEW.usage_date),0)+NEW.amount>s.daily_lead_limit) THEN RAISE(ABORT,'DAILY_LIMIT_REACHED') END;
END;
CREATE TRIGGER IF NOT EXISTS usage_apply AFTER INSERT ON usage_events BEGIN
 INSERT INTO usage_daily(user_id,usage_date,leads_processed) VALUES(NEW.user_id,NEW.usage_date,NEW.amount)
 ON CONFLICT(user_id,usage_date) DO UPDATE SET leads_processed=leads_processed+NEW.amount,updated_at=CURRENT_TIMESTAMP;
END;
CREATE TABLE IF NOT EXISTS request_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS acquisition (user_id INTEGER PRIMARY KEY REFERENCES users(id),source TEXT,campaign TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO settings(key,value) VALUES ('monthly_price_usd','20'),('annual_price_usd','100'),('monthly_daily_limit','1500'),('allowed_devices','2'),('affiliate_first_purchase_percent','50'),('affiliate_renewal_percent','20');
