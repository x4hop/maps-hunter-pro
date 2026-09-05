const API_BASE = window.MHP_API_BASE || '';
let token = sessionStorage.getItem('mhp_admin_token') || '';
let currentView = 'overview';
let lastRows = {};

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => `$${(Number(cents||0)/100).toFixed(2)}`;
const date = v => v ? new Date(String(v).replace(' ','T')+'Z').toLocaleString() : '—';
const pill = s => `<span class="pill ${['active','confirmed','trusted','allowed','paid'].includes(s)?'green':['pending','review'].includes(s)?'orange':['revoked','expired','blocked','rejected'].includes(s)?'red':'gray'}">${esc(s||'—')}</span>`;
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),3000); }

async function api(path, options={}) {
  const headers = {'content-type':'application/json', ...(options.headers||{})};
  if(token) headers.authorization=`Bearer ${token}`;
  const r=await fetch(API_BASE+path,{...options,headers});
  let data={}; try{data=await r.json()}catch{}
  if(r.status===401){ sessionStorage.removeItem('mhp_admin_token'); token=''; $('loginGate').style.display='flex'; throw new Error('Unauthorized'); }
  if(!r.ok || data.ok===false) throw new Error(data.error||`HTTP ${r.status}`);
  return data;
}

async function login(){
  token=$('adminTokenInput').value.trim(); $('loginError').textContent='';
  if(!token){$('loginError').textContent='Enter the Admin Token.';return;}
  try{await api('/api/admin/summary');sessionStorage.setItem('mhp_admin_token',token);$('loginGate').style.display='none';await refreshAll();}
  catch(e){$('loginError').textContent='Invalid token or API unavailable.';}
}

async function health(){
  try{const d=await fetch(API_BASE+'/api/health').then(r=>r.json());const ok=d.ok&&d.database==='connected';$('apiStatus').textContent=ok?'API: online':'API: error';$('sidebarStatus').textContent=ok?'● API + D1 operational':'● API issue';$('sidebarStatus').style.color=ok?'#9be5bb':'#ffb4b4';}
  catch{$('apiStatus').textContent='API: offline';$('sidebarStatus').textContent='● API offline';}
}

async function loadOverview(){ const d=await api('/api/admin/summary'); const s=d.summary; $('sActiveUsers').textContent=s.activeUsers; $('sRevenue').textContent=`$${Number(s.monthlyRevenue).toFixed(2)}`; $('sLicenses').textContent=s.activeLicenses; $('sExpiring').textContent=`${s.expiringSoon} expiring soon`; $('sLeads').textContent=Number(s.leadsToday).toLocaleString(); $('sSubs').textContent=s.activeSubscriptions; $('sPending').textContent=s.pendingPayments; $('sAffiliates').textContent=s.activeAffiliates; }
async function loadUsers(){const d=await api('/api/admin/users');lastRows.users=d.users;$('usersBody').innerHTML=d.users.map(x=>`<tr><td>${x.id}</td><td><strong>${esc(x.name||'—')}</strong><div class="email">${esc(x.email)}</div></td><td>${esc(x.plan_id||'—')}</td><td>${pill(x.subscription_status)}</td><td>${date(x.expires_at)}</td><td>${x.devices}</td><td>${pill(x.status)}</td></tr>`).join('')||empty(7);}
async function loadSubscriptions(){const d=await api('/api/admin/subscriptions');lastRows.subscriptions=d.subscriptions;$('subscriptionsBody').innerHTML=d.subscriptions.map(x=>`<tr><td>${x.id}</td><td>${esc(x.email)}</td><td>${esc(x.plan_id)}</td><td>${pill(x.status)}</td><td>${date(x.started_at)}</td><td>${date(x.expires_at)}</td><td>${x.daily_lead_limit==null?'Unlimited':x.daily_lead_limit}</td></tr>`).join('')||empty(7);}
async function loadLicenses(){const d=await api('/api/admin/licenses');lastRows.licenses=d.licenses;$('licensesBody').innerHTML=d.licenses.map(x=>`<tr><td class="mono"><strong>${esc(x.license_key)}</strong></td><td>${esc(x.email)}</td><td>${esc(x.plan_id||'—')}</td><td>${pill(x.status)}</td><td>${x.device_limit}</td><td>${date(x.expires_at)}</td><td>${x.status==='active'?`<button class="mini" data-revoke="${esc(x.license_key)}">Revoke</button>`:'—'}</td></tr>`).join('')||empty(7);}
async function loadDevices(){const d=await api('/api/admin/devices');lastRows.devices=d.devices;$('devicesBody').innerHTML=d.devices.map(x=>`<tr><td class="mono">${esc(x.device_uid)}</td><td>${esc(x.email)}</td><td class="mono">${esc(x.license_key)}</td><td>${esc(x.os||'—')}</td><td>${esc(x.browser||'—')}</td><td>${esc(x.last_ip||'—')}</td><td>${pill(x.status)}</td><td>${date(x.last_seen_at)}</td></tr>`).join('')||empty(8);}
async function loadPayments(){const d=await api('/api/admin/payments');lastRows.payments=d.payments;$('paymentsBody').innerHTML=d.payments.map(x=>`<tr><td class="mono">${esc(x.payment_ref)}</td><td>${esc(x.email)}</td><td>${esc(x.method)}</td><td>${money(x.amount_cents)}</td><td>${esc(x.payment_type)}</td><td>${pill(x.status)}</td><td>${date(x.created_at)}</td><td>${x.status==='pending'?`<button class="mini" data-confirm-payment="${esc(x.payment_ref)}">Confirm</button>`:'—'}</td></tr>`).join('')||empty(8);}
async function loadAffiliates(){const d=await api('/api/admin/affiliates');lastRows.affiliates=d.affiliates;$('affiliatesBody').innerHTML=d.affiliates.map(x=>`<tr><td>${x.id}</td><td><strong>${esc(x.name||'—')}</strong><div class="email">${esc(x.email)}</div></td><td class="mono">${esc(x.referral_code)}</td><td>${x.referrals}</td><td>${money(x.commission_cents)}</td><td>${x.first_purchase_percent}%</td><td>${x.renewal_percent}%</td><td>${pill(x.status)}</td></tr>`).join('')||empty(8);}
async function loadPayouts(){const d=await api('/api/admin/payouts');lastRows.payouts=d.payouts;$('payoutsBody').innerHTML=d.payouts.map(x=>`<tr><td>${esc(x.payout_ref)}</td><td>${esc(x.email)}</td><td>${money(x.amount_cents)}</td><td>${esc(x.method)}</td><td>${esc(x.destination)}</td><td>${pill(x.status)}</td><td>${date(x.created_at)}</td></tr>`).join('')||empty(7);}
async function loadUsage(){const d=await api('/api/admin/usage');lastRows.usage=d.usage;$('usageBody').innerHTML=d.usage.map(x=>`<tr><td>${esc(x.usage_date)}</td><td>${esc(x.email)}</td><td>${Number(x.leads_processed).toLocaleString()}</td><td>${x.api_errors}</td><td>${date(x.updated_at)}</td></tr>`).join('')||empty(5);}
async function loadLogs(){const d=await api('/api/admin/logs');lastRows.logs=d.logs;$('logsBody').innerHTML=d.logs.map(x=>`<tr><td>${date(x.created_at)}</td><td>${esc(x.event_type)}</td><td>${esc(x.actor||x.actor_type)}</td><td>${esc([x.target_type,x.target_id].filter(Boolean).join(': ')||'—')}</td><td>${esc(x.ip||'—')}</td><td>${pill(x.result)}</td></tr>`).join('')||empty(6);}
async function loadSettings(){const d=await api('/api/admin/settings');const s=Object.fromEntries(d.settings.map(x=>[x.key,x.value]));$('setMonthlyPrice').value=s.monthly_price_usd||20;$('setAnnualPrice').value=s.annual_price_usd||100;$('setMonthlyLimit').value=s.monthly_daily_limit||1500;$('setAnnualLimit').value=s.annual_daily_limit||'unlimited';$('setFirstCommission').value=s.affiliate_first_purchase_percent||50;$('setRenewCommission').value=s.affiliate_renewal_percent||20;$('setDevices').value=s.allowed_devices||2;$('setPayments').value=s.payment_methods||'USDT,REDOTPAY';}
function empty(n){return `<tr><td colspan="${n}" class="empty">No records yet.</td></tr>`;}
const loaders={overview:loadOverview,users:loadUsers,subscriptions:loadSubscriptions,licenses:loadLicenses,devices:loadDevices,payments:loadPayments,affiliates:loadAffiliates,payouts:loadPayouts,usage:loadUsage,logs:loadLogs,settings:loadSettings};
async function loadView(view){try{document.querySelector('.content').classList.add('loading');await loaders[view]?.();}catch(e){toast(e.message);}finally{document.querySelector('.content').classList.remove('loading');}}
async function refreshAll(){await health();await loadView(currentView);}

async function createLicense(){try{const body={email:$('licEmail').value.trim(),name:$('licName').value.trim(),planId:$('licPlan').value,deviceLimit:Number($('licDevices').value)};const d=await api('/api/admin/licenses',{method:'POST',body:JSON.stringify(body)});$('licenseModal').classList.remove('open');toast(`Created: ${d.license.licenseKey}`);await loadOverview();await loadLicenses();}catch(e){toast(e.message);}}
async function revoke(key){if(!confirm(`Revoke ${key}?`))return;try{await api(`/api/admin/licenses/${encodeURIComponent(key)}/revoke`,{method:'POST',body:'{}'});toast('License revoked');await loadLicenses();await loadOverview();}catch(e){toast(e.message);}}
async function confirmPayment(ref){const external=prompt('External transaction/reference (optional):','')||'';if(!confirm(`Confirm payment ${ref}? This activates a subscription.`))return;try{await api(`/api/admin/payments/${encodeURIComponent(ref)}/confirm`,{method:'POST',body:JSON.stringify({externalReference:external})});toast('Payment confirmed');await loadPayments();await loadOverview();await loadSubscriptions();}catch(e){toast(e.message);}}
async function saveSettings(){try{await api('/api/admin/settings',{method:'PATCH',body:JSON.stringify({monthly_price_usd:$('setMonthlyPrice').value,annual_price_usd:$('setAnnualPrice').value,monthly_daily_limit:$('setMonthlyLimit').value,annual_daily_limit:$('setAnnualLimit').value,affiliate_first_purchase_percent:$('setFirstCommission').value,affiliate_renewal_percent:$('setRenewCommission').value,allowed_devices:$('setDevices').value,payment_methods:$('setPayments').value})});toast('Settings saved');}catch(e){toast(e.message);}}

document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));currentView=btn.dataset.view;$(currentView).classList.add('active');$('sidebar').classList.remove('open');loadView(currentView);}));
$('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
$('loginBtn').addEventListener('click',login);$('adminTokenInput').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
$('refreshBtn').addEventListener('click',refreshAll);$('logoutBtn').addEventListener('click',()=>{sessionStorage.removeItem('mhp_admin_token');token='';location.reload();});
document.querySelectorAll('[data-open-license]').forEach(x=>x.addEventListener('click',()=>$('licenseModal').classList.add('open')));$('closeModal').onclick=$('cancelModal').onclick=()=>$('licenseModal').classList.remove('open');$('createLicenseBtn').addEventListener('click',createLicense);$('saveSettingsBtn').addEventListener('click',saveSettings);
document.addEventListener('click',e=>{const r=e.target.closest('[data-revoke]');if(r)revoke(r.dataset.revoke);const p=e.target.closest('[data-confirm-payment]');if(p)confirmPayment(p.dataset.confirmPayment);});
$('searchInput').addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll(`#${currentView} tbody tr`).forEach(tr=>tr.style.display=tr.textContent.toLowerCase().includes(q)?'':'none');});

health();
if(token){$('loginGate').style.display='none';refreshAll();}
