-- Operational controls, privacy requests, and financial idempotency.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_external_reference
ON payments(external_reference) WHERE external_reference IS NOT NULL AND external_reference!='';

CREATE TABLE IF NOT EXISTS data_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,request_ref TEXT NOT NULL UNIQUE,user_id INTEGER NOT NULL REFERENCES users(id),
 request_type TEXT NOT NULL CHECK(request_type IN ('access','correction','deletion')),status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','completed','rejected')),
 note TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,completed_at TEXT
);

CREATE TABLE IF NOT EXISTS payout_commissions (
 payout_id INTEGER NOT NULL REFERENCES payouts(id),commission_id INTEGER NOT NULL UNIQUE REFERENCES commissions(id),
 amount_cents INTEGER NOT NULL,PRIMARY KEY(payout_id,commission_id)
);

CREATE TABLE IF NOT EXISTS maintenance_runs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,run_type TEXT NOT NULL,rows_changed INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS grant_validate;
CREATE TRIGGER grant_validate BEFORE INSERT ON entitlement_grants BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND status='active') THEN RAISE(ABORT,'ACCOUNT_INACTIVE') END;
 SELECT CASE WHEN NEW.plan_id='monthly' AND EXISTS(SELECT 1 FROM subscriptions WHERE user_id=NEW.user_id AND status='active' AND plan_id='annual' AND julianday(expires_at)>julianday('now')) THEN RAISE(ABORT,'ANNUAL_DOWNGRADE_NOT_ALLOWED') END;
 SELECT CASE WHEN NEW.source_type='code' AND NOT EXISTS(SELECT 1 FROM activation_codes WHERE code=NEW.source_ref AND status='unused' AND plan_id=NEW.plan_id AND (expires_at IS NULL OR julianday(expires_at)>julianday('now'))) THEN RAISE(ABORT,'CODE_NOT_AVAILABLE') END;
 SELECT CASE WHEN NEW.source_type='payment' AND NOT EXISTS(SELECT 1 FROM activation_requests a JOIN payments p ON p.payment_ref=a.payment_ref WHERE p.payment_ref=NEW.source_ref AND p.user_id=NEW.user_id AND a.user_id=NEW.user_id AND a.plan_id=NEW.plan_id AND a.status='pending' AND p.status='pending') THEN RAISE(ABORT,'PAYMENT_NOT_PENDING') END;
END;

