import sqlite3
from pathlib import Path

db = sqlite3.connect(':memory:')
db.row_factory = sqlite3.Row
db.executescript(Path('backend/schema.sql').read_text())
db.executescript(Path('backend/migrations/0003_atomic_entitlements.sql').read_text())
db.execute("INSERT INTO users(id,email,name,password_hash,password_salt) VALUES(1,'buyer@example.test','Buyer','x','y')")
db.execute("INSERT INTO activation_codes(code,plan_id) VALUES('MHP-M-ONE','monthly')")
db.execute("INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES('code','MHP-M-ONE',1,'monthly','LIC-ONE',2,3)")
first_expiry = db.execute('SELECT expires_at FROM subscriptions WHERE user_id=1').fetchone()[0]
assert db.execute("SELECT status FROM activation_codes WHERE code='MHP-M-ONE'").fetchone()[0] == 'redeemed'
assert db.execute("SELECT license_key FROM licenses WHERE user_id=1").fetchone()[0] == 'LIC-ONE'
try:
    db.execute("INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES('code','MHP-M-ONE',1,'monthly','LIC-TWO',2,3)")
    raise AssertionError('code reused')
except sqlite3.IntegrityError:
    pass
db.execute("INSERT INTO activation_codes(code,plan_id) VALUES('MHP-M-TWO','monthly')")
db.execute("INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES('code','MHP-M-TWO',1,'monthly','IGNORED',2,3)")
second_expiry = db.execute('SELECT expires_at FROM subscriptions WHERE user_id=1').fetchone()[0]
assert second_expiry > first_expiry
db.execute("INSERT INTO devices(user_id,license_id,device_uid) VALUES(1,1,'one')")
db.execute("INSERT INTO devices(user_id,license_id,device_uid) VALUES(1,1,'two')")
try:
    db.execute("INSERT INTO devices(user_id,license_id,device_uid) VALUES(1,1,'three')")
    raise AssertionError('device limit bypassed')
except sqlite3.IntegrityError as error:
    assert 'DEVICE_LIMIT_REACHED' in str(error)
for i in range(3):
    db.execute("INSERT INTO usage_events(request_id,user_id,license_id,usage_date,amount) VALUES(?,1,1,date('now'),1)",(f'request-{i}',))
assert db.execute("SELECT leads_processed FROM usage_daily WHERE user_id=1").fetchone()[0] == 3
try:
    db.execute("INSERT INTO usage_events(request_id,user_id,license_id,usage_date,amount) VALUES('request-over',1,1,date('now'),1)")
    raise AssertionError('daily limit bypassed')
except sqlite3.IntegrityError as error:
    assert 'DAILY_LIMIT_REACHED' in str(error)
print('SQL entitlement, renewal, device, and daily-limit tests passed')
