-- Maps Hunter Pro manual-only licensing. Legacy customer/account tables are intentionally retained but unused.
CREATE TABLE IF NOT EXISTS manual_licenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL,
  plan_id TEXT NOT NULL CHECK(plan_id IN ('monthly','annual')),
  status TEXT NOT NULL DEFAULT 'unused' CHECK(status IN ('unused','active','expired','revoked')),
  duration_days INTEGER NOT NULL CHECK(duration_days IN (30,365)),
  daily_lead_limit INTEGER,
  device_limit INTEGER NOT NULL DEFAULT 2 CHECK(device_limit BETWEEN 1 AND 10),
  activated_at TEXT,
  expires_at TEXT,
  last_validated_at TEXT,
  note TEXT,
  created_by TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_manual_licenses_status ON manual_licenses(status,expires_at);
CREATE INDEX IF NOT EXISTS idx_manual_licenses_hint ON manual_licenses(code_hint);

CREATE TABLE IF NOT EXISTS manual_license_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  manual_license_id INTEGER NOT NULL REFERENCES manual_licenses(id) ON DELETE CASCADE,
  device_uid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trusted' CHECK(status IN ('trusted','blocked')),
  first_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(manual_license_id,device_uid)
);
CREATE INDEX IF NOT EXISTS idx_manual_devices_license ON manual_license_devices(manual_license_id,status);

CREATE TABLE IF NOT EXISTS manual_usage_events (
  request_id TEXT PRIMARY KEY,
  manual_license_id INTEGER NOT NULL REFERENCES manual_licenses(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount BETWEEN 1 AND 100),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS manual_usage_daily (
  manual_license_id INTEGER NOT NULL REFERENCES manual_licenses(id) ON DELETE CASCADE,
  usage_date TEXT NOT NULL,
  leads_processed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(manual_license_id,usage_date)
);
