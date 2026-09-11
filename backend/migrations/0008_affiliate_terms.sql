-- Enforce affiliate attribution and commission hold terms.
DROP TRIGGER IF EXISTS grant_apply;
CREATE TRIGGER grant_apply AFTER INSERT ON entitlement_grants BEGIN
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
 status='confirmed',subscription_id=(SELECT subscription_id FROM entitlement_grants WHERE id=NEW.id),confirmed_at=CURRENT_TIMESTAMP
 WHERE NEW.source_type='payment' AND payment_ref=NEW.source_ref;

 UPDATE activation_requests SET status='approved',license_id=(SELECT license_id FROM entitlement_grants WHERE id=NEW.id),approved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
 WHERE NEW.source_type='payment' AND payment_ref=NEW.source_ref;

 INSERT OR IGNORE INTO commissions(affiliate_id,payment_id,commission_type,percent,amount_cents,status)
 SELECT a.id,p.id,p.payment_type,
 CASE p.payment_type WHEN 'renewal' THEN a.renewal_percent ELSE a.first_purchase_percent END,
 CAST(round(p.amount_cents*(CASE p.payment_type WHEN 'renewal' THEN a.renewal_percent ELSE a.first_purchase_percent END)/100.0) AS INTEGER),
 'pending'
 FROM payments p
 JOIN referrals r ON r.referred_user_id=p.user_id
 JOIN affiliates a ON a.id=r.affiliate_id
 JOIN users u ON u.id=p.user_id
 WHERE NEW.source_type='payment'
   AND p.payment_ref=NEW.source_ref
   AND a.status='active'
   AND lower(a.email)!=lower(u.email)
   AND julianday(r.first_seen_at)>=julianday('now','-'||(SELECT COALESCE(CAST(value AS INTEGER),30) FROM settings WHERE key='affiliate_attribution_days')||' days');

 UPDATE referrals SET converted_at=COALESCE(converted_at,CURRENT_TIMESTAMP) WHERE NEW.source_type='payment' AND referred_user_id=NEW.user_id;
 INSERT INTO audit_logs(event_type,actor_type,actor,target_type,target_id,result) VALUES('ENTITLEMENT_GRANTED','system',CAST(NEW.user_id AS TEXT),NEW.source_type,NEW.source_ref,'success');
END;
