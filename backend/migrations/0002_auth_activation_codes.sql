-- Complete the baseline created by 0001. Run once, after 0001, on new databases.
ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_salt TEXT;

CREATE TABLE IF NOT EXISTS auth_sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id,expires_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,token_hash TEXT NOT NULL UNIQUE,expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activation_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,request_ref TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 plan_id TEXT NOT NULL CHECK(plan_id IN ('monthly','annual')),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','cancelled')),
 whatsapp_number TEXT NOT NULL DEFAULT '+218931650822',payment_ref TEXT,license_id INTEGER REFERENCES licenses(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,approved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_activation_requests_status ON activation_requests(status,created_at);

CREATE TABLE IF NOT EXISTS activation_codes (
 id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT NOT NULL UNIQUE COLLATE NOCASE,plan_id TEXT NOT NULL CHECK(plan_id IN ('monthly','annual')),
 status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','redeemed','revoked','expired')),created_by TEXT NOT NULL DEFAULT 'admin',
 note TEXT,purchaser_email TEXT,redeemed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,redeemed_at TEXT,expires_at TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_activation_codes_status ON activation_codes(status);
CREATE INDEX IF NOT EXISTS idx_activation_codes_user ON activation_codes(redeemed_by_user_id);

