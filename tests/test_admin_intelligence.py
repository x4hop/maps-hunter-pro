import sqlite3
from pathlib import Path

root=Path(__file__).parents[1]
db=sqlite3.connect(':memory:')
for migration in sorted((root/'backend'/'migrations').glob('*.sql')):
    db.executescript(migration.read_text())

required={'admin_customers','admin_sales','admin_support_events'}
tables={row[0] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
assert required <= tables, required-tables

cols={row[1] for row in db.execute('PRAGMA table_info(manual_licenses)')}
assert 'customer_id' in cols

customers=db.execute('SELECT display_name,country_code,country_name FROM admin_customers ORDER BY id').fetchall()
assert len(customers)==3, customers
assert {row[2] for row in customers}=={'Algeria','Palestine','Oman'}

revenue=db.execute("SELECT coalesce(sum(amount_cents),0) FROM admin_sales WHERE status='paid'").fetchone()[0]
sales=db.execute("SELECT count(*) FROM admin_sales WHERE status='paid'").fetchone()[0]
assert revenue==9000, revenue
assert sales==3, sales
assert round(revenue/sales)==3000

# Link a customer to a license and prove all-time/today usage can be derived without storing lead records.
customer_id=db.execute("SELECT id FROM admin_customers WHERE country_name='Algeria'").fetchone()[0]
db.execute("INSERT INTO manual_licenses(code_hash,code_hint,plan_id,status,duration_days,daily_lead_limit,device_limit,is_lifetime,customer_id) VALUES('admin-intel-test','MHP-ADMIN-TEST','monthly','active',30,1500,1,0,?)",(customer_id,))
license_id=db.execute("SELECT id FROM manual_licenses WHERE code_hash='admin-intel-test'").fetchone()[0]
db.execute("INSERT INTO manual_usage_daily(manual_license_id,usage_date,leads_processed) VALUES(?,date('now'),125)",(license_id,))
db.execute("INSERT INTO manual_usage_daily(manual_license_id,usage_date,leads_processed) VALUES(?,date('now','-1 day'),75)",(license_id,))
all_time=db.execute("SELECT coalesce(sum(u.leads_processed),0) FROM manual_usage_daily u JOIN manual_licenses l ON l.id=u.manual_license_id WHERE l.customer_id=?",(customer_id,)).fetchone()[0]
today=db.execute("SELECT coalesce(sum(u.leads_processed),0) FROM manual_usage_daily u JOIN manual_licenses l ON l.id=u.manual_license_id WHERE l.customer_id=? AND u.usage_date=date('now')",(customer_id,)).fetchone()[0]
assert all_time==200, all_time
assert today==125, today

print('Admin Intelligence migration/revenue/usage checks passed: $90 revenue, 3 customers, aggregate lead metrics')