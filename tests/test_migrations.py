import sqlite3
from pathlib import Path

root=Path(__file__).parents[1]
db=sqlite3.connect(':memory:')
for name in ['0001_initial.sql','0002_auth_activation_codes.sql','0003_atomic_entitlements.sql','0004_operations_privacy.sql','0005_auth_credentials_compat.sql']:
    db.executescript((root/'backend'/'migrations'/name).read_text())
required={'users','auth_credentials','auth_sessions','admin_sessions','activation_requests','activation_codes','entitlement_grants','usage_events','data_requests','payout_commissions'}
actual={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert required<=actual, required-actual
cols={row[1] for row in db.execute('PRAGMA table_info(users)')}
assert {'password_hash','password_salt'}<=cols
db.execute("INSERT INTO users(id,email,name,password_hash,password_salt) VALUES(1,'new@example.test','New','h','s')")
db.executescript((root/'backend'/'migrations'/'0005_auth_credentials_compat.sql').read_text())
assert db.execute('SELECT password_hash,password_salt FROM auth_credentials WHERE user_id=1').fetchone()==('h','s')
db.execute("INSERT INTO payments(payment_ref,user_id,method,amount_cents) VALUES('PAY-NEW',1,'MANUAL_WHATSAPP',2000)")
db.execute("INSERT INTO activation_requests(request_ref,user_id,plan_id,payment_ref) VALUES('ACT-NEW',1,'monthly','PAY-NEW')")
db.execute("INSERT INTO activation_codes(code,plan_id) VALUES('YEAR','annual')")
db.execute("INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES('code','YEAR',1,'annual','LIC',2,NULL)")
db.execute("INSERT INTO activation_codes(code,plan_id) VALUES('MONTH','monthly')")
try:
    db.execute("INSERT INTO entitlement_grants(source_type,source_ref,user_id,plan_id,license_key,device_limit,daily_limit) VALUES('code','MONTH',1,'monthly','LIC2',2,1500)")
    raise AssertionError('annual rights were silently downgraded')
except sqlite3.IntegrityError as error:
    assert 'ANNUAL_DOWNGRADE_NOT_ALLOWED' in str(error)
print('Fresh migration chain and annual downgrade guard passed')
