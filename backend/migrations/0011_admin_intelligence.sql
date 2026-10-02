-- Admin Intelligence v1: customers, real sales/revenue, support telemetry, and customer/license linkage.
-- Additive only. Lead/business data remains local to the extension; this schema stores admin metadata and aggregate usage only.

CREATE TABLE IF NOT EXISTS admin_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  country_code TEXT,
  country_name TEXT,
  contact TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_customers_country ON admin_customers(country_code,country_name);
CREATE INDEX IF NOT EXISTS idx_admin_customers_status ON admin_customers(status,created_at);

CREATE TABLE IF NOT EXISTS admin_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES admin_customers(id) ON DELETE RESTRICT,
  manual_license_id INTEGER REFERENCES manual_licenses(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK(amount_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  plan_label TEXT,
  payment_method TEXT,
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('paid','refunded','void')),
  sold_at TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_sales_customer ON admin_sales(customer_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_admin_sales_license ON admin_sales(manual_license_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_admin_sales_date ON admin_sales(sold_at,status);

CREATE TABLE IF NOT EXISTS admin_support_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER REFERENCES admin_customers(id) ON DELETE SET NULL,
  manual_license_id INTEGER REFERENCES manual_licenses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  error_code TEXT,
  extension_version TEXT,
  phase TEXT,
  context_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_support_events_customer ON admin_support_events(customer_id,created_at);
CREATE INDEX IF NOT EXISTS idx_admin_support_events_license ON admin_support_events(manual_license_id,created_at);
CREATE INDEX IF NOT EXISTS idx_admin_support_events_type ON admin_support_events(event_type,error_code,created_at);

ALTER TABLE manual_licenses ADD COLUMN customer_id INTEGER REFERENCES admin_customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_manual_licenses_customer ON manual_licenses(customer_id,status);

-- Historical owner-provided sales. Exact sale dates/license mapping were not provided,
-- so sold_at/manual_license_id are intentionally left NULL until linked from Admin.
INSERT INTO admin_customers(display_name,country_code,country_name,note)
VALUES ('Customer 001','DZ','Algeria','Historical customer imported for Admin Intelligence v1; usage starts from the new Admin baseline until a license is linked.');
INSERT INTO admin_customers(display_name,country_code,country_name,note)
VALUES ('Customer 002','PS','Palestine','Historical customer imported for Admin Intelligence v1; usage starts from the new Admin baseline until a license is linked.');
INSERT INTO admin_customers(display_name,country_code,country_name,note)
VALUES ('Customer 003','OM','Oman','Historical customer imported for Admin Intelligence v1; usage starts from the new Admin baseline until a license is linked.');

INSERT INTO admin_sales(customer_id,amount_cents,currency,plan_label,payment_method,status,note)
SELECT id,5000,'USD','Custom / historical','Manual','paid','Historical sale entered from owner record; exact sale date and license link not provided.'
FROM admin_customers WHERE display_name='Customer 001' ORDER BY id DESC LIMIT 1;
INSERT INTO admin_sales(customer_id,amount_cents,currency,plan_label,payment_method,status,note)
SELECT id,2000,'USD','Custom / historical','Manual','paid','Historical sale entered from owner record; exact sale date and license link not provided.'
FROM admin_customers WHERE display_name='Customer 002' ORDER BY id DESC LIMIT 1;
INSERT INTO admin_sales(customer_id,amount_cents,currency,plan_label,payment_method,status,note)
SELECT id,2000,'USD','Custom / historical','Manual','paid','Historical sale entered from owner record; exact sale date and license link not provided.'
FROM admin_customers WHERE display_name='Customer 003' ORDER BY id DESC LIMIT 1;
