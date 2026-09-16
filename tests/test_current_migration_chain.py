import sqlite3
from pathlib import Path

root=Path(__file__).parents[1]
db=sqlite3.connect(':memory:')
for migration in sorted((root/'backend'/'migrations').glob('*.sql')):
    db.executescript(migration.read_text())

tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
required={
    'settings','admin_sessions','audit_logs','owner_access',
    'manual_licenses','manual_license_devices','manual_usage_events','manual_usage_daily'
}
missing=required-tables
assert not missing, f'missing current tables: {sorted(missing)}'

settings=dict(db.execute('SELECT key,value FROM settings'))
assert settings.get('usdt_network')=='TRC20'
assert 'usdt_address' in settings
assert 'redotpay_id' in settings

manual_cols={row[1] for row in db.execute('PRAGMA table_info(manual_licenses)')}
assert {'code_hash','code_hint','plan_id','status','duration_days','daily_lead_limit','device_limit','expires_at'}<=manual_cols

usage_cols={row[1] for row in db.execute('PRAGMA table_info(manual_usage_events)')}
assert {'request_id','manual_license_id','usage_date','amount'}<=usage_cols

print('Current migration chain 0001..0009 passed')
