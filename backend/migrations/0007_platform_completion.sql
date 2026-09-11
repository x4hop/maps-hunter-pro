-- Maps Hunter Pro platform completion: account recovery, verification, payment review and launch settings.
-- Additive only. Legacy activation_requests.whatsapp_number is intentionally retained for compatibility but is no longer used by the API/UI.

ALTER TABLE users ADD COLUMN email_verified_at TEXT;
ALTER TABLE payments ADD COLUMN submitted_at TEXT;
ALTER TABLE payments ADD COLUMN reviewed_at TEXT;
ALTER TABLE payments ADD COLUMN reviewed_by TEXT;
ALTER TABLE payments ADD COLUMN review_note TEXT;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 consumed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id,expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 consumed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id,expires_at);

INSERT OR IGNORE INTO settings(key,value) VALUES
 ('usdt_network','TRC20'),
 ('usdt_address',''),
 ('redotpay_id',''),
 ('support_contact',''),
 ('extension_download_url',''),
 ('extension_version',''),
 ('public_site_url',''),
 ('require_email_verification','0'),
 ('affiliate_attribution_days','30'),
 ('affiliate_hold_days','7'),
 ('affiliate_min_payout_cents','2000'),
 ('affiliate_self_referral','blocked');

CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id,status,created_at);
