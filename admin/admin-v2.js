// Platform administration v2: payment evidence, commercial settings and safer review actions.
function mhpProofLink(url){const v=String(url||'').trim();return /^https?:\/\//i.test(v)?`<a href="${esc(v)}" target="_blank" rel="noopener noreferrer">Open proof</a>`:'—';}
function mhpSet(id,value=''){const el=$(id);if(el)el.value=value??'';}
function mhpCommercialSettingsUI(){
  const grid=$('settings')?.querySelector('.form-grid');
  if(grid&&!$('setUsdtNetwork')) grid.insertAdjacentHTML('beforeend',`
    <div class="field"><label>Affiliate attribution (days)</label><input id="setAffiliateAttribution" type="number" min="1" max="365"></div>
    <div class="field"><label>Affiliate hold (days)</label><input id="setAffiliateHold" type="number" min="0" max="90"></div>
    <div class="field"><label>Minimum affiliate payout (USD)</label><input id="setAffiliateMinPayout" type="number" min="1" step="0.01"></div>
    <div class="field"><label>Require verified email before payment</label><select id="setRequireEmail"><option value="1">Yes</option><option value="0">No</option></select></div>
    <div class="field"><label>USDT network</label><input id="setUsdtNetwork" placeholder="TRC20"></div>
    <div class="field"><label>USDT address</label><input id="setUsdtAddress" autocomplete="off" placeholder="Wallet address"></div>
    <div class="field"><label>RedotPay ID / account</label><input id="setRedotPay" autocomplete="off"></div>
    <div class="field"><label>Support contact</label><input id="setSupportContact" placeholder="Email or support link"></div>
    <div class="field"><label>Extension version</label><input id="setExtensionVersion" placeholder="8.0.8"></div>
    <div class="field"><label>Extension download URL</label><input id="setExtensionDownload" type="url" placeholder="https://..."></div>
    <div class="field"><label>Public site URL</label><input id="setPublicSite" type="url" placeholder="https://..."></div>
  `);
  const payHead=$('payments')?.querySelector('thead tr');
  if(payHead) payHead.innerHTML='<th>Reference / evidence</th><th>User</th><th>Method</th><th>Amount</th><th>Type</th><th>Status</th><th>Submitted</th><th>Review</th><th>Action</th>';
  const arHead=$('activationRequests')?.querySelector('thead tr');
  if(arHead) arHead.innerHTML='<th>Customer</th><th>Plan</th><th>Request</th><th>Payment</th><th>Method / amount</th><th>Evidence</th><th>Status</th><th>Submitted</th><th>Review note</th>';
}

async function loadPayments(){
  const d=await listApi('payments');lastRows.payments=d.payments;
  $('paymentsBody').innerHTML=d.payments.map(x=>`<tr>
    <td class="mono"><strong>${esc(x.payment_ref)}</strong><div class="email">${esc(x.external_reference||'No transaction reference')}</div><div class="email">${mhpProofLink(x.proof_url)}</div></td>
    <td>${esc(x.email)}</td><td>${esc(x.method)}</td><td>${money(x.amount_cents)}</td><td>${esc(x.payment_type)}</td><td>${pill(x.status)}</td>
    <td>${date(x.submitted_at||x.created_at)}</td>
    <td>${date(x.reviewed_at)}<div class="email">${esc(x.review_note||'')}</div></td>
    <td><div class="row-actions">${x.status==='pending'?`<button class="mini" data-payment-confirm="${esc(x.payment_ref)}">Confirm</button><button class="mini" data-payment-reject="${esc(x.payment_ref)}">Reject</button>`:x.status==='confirmed'?`<button class="mini" data-payment-refund="${esc(x.payment_ref)}">Refund</button>`:'—'}</div></td>
  </tr>`).join('')||empty(9);
}

async function loadActivationRequests(){
  const d=await listApi('activation-requests');
  $('activationRequestsBody').innerHTML=d.requests.map(x=>`<tr>
    <td><strong>${esc(x.name||'—')}</strong><div class="email">${esc(x.email)}</div></td><td>${esc(x.plan_id)}</td><td class="mono">${esc(x.request_ref)}</td><td class="mono">${esc(x.payment_ref)}</td>
    <td>${esc(x.method||'—')}<div class="email">${x.amount_cents!=null?money(x.amount_cents):'—'}</div></td>
    <td><div class="mono">${esc(x.external_reference||'—')}</div><div class="email">${mhpProofLink(x.proof_url)}</div></td>
    <td>${pill(x.payment_status||x.status)}</td><td>${date(x.submitted_at||x.created_at)}</td><td>${esc(x.review_note||'—')}</td>
  </tr>`).join('')||empty(9);
}

async function loadSettings(){
  const d=await api('/api/admin/settings');const s=Object.fromEntries(d.settings.map(x=>[x.key,x.value]));
  mhpSet('setMonthlyPrice',s.monthly_price_usd||20);mhpSet('setAnnualPrice',s.annual_price_usd||100);mhpSet('setMonthlyLimit',s.monthly_daily_limit||1500);mhpSet('setAnnualLimit','No commercial daily platform limit');
  mhpSet('setFirstCommission',s.affiliate_first_purchase_percent||50);mhpSet('setRenewCommission',s.affiliate_renewal_percent||20);mhpSet('setDevices',s.allowed_devices||2);mhpSet('setPayments','USDT, REDOTPAY');
  mhpSet('setAffiliateAttribution',s.affiliate_attribution_days||30);mhpSet('setAffiliateHold',s.affiliate_hold_days??7);mhpSet('setAffiliateMinPayout',(Number(s.affiliate_min_payout_cents||2000)/100).toFixed(2));mhpSet('setRequireEmail',s.require_email_verification??1);
  mhpSet('setUsdtNetwork',s.usdt_network||'');mhpSet('setUsdtAddress',s.usdt_address||'');mhpSet('setRedotPay',s.redotpay_id||'');mhpSet('setSupportContact',s.support_contact||'');mhpSet('setExtensionVersion',s.extension_version||'');mhpSet('setExtensionDownload',s.extension_download_url||'');mhpSet('setPublicSite',s.public_site_url||'');
}

async function saveSettings(){
  const b=$('saveSettingsBtn');if(b?.disabled)return;const old=b?.textContent;if(b){b.disabled=true;b.textContent='Saving…';}
  try{
    const payload={monthly_price_usd:$('setMonthlyPrice').value,annual_price_usd:$('setAnnualPrice').value,monthly_daily_limit:$('setMonthlyLimit').value,affiliate_first_purchase_percent:$('setFirstCommission').value,affiliate_renewal_percent:$('setRenewCommission').value,allowed_devices:$('setDevices').value,affiliate_attribution_days:$('setAffiliateAttribution').value,affiliate_hold_days:$('setAffiliateHold').value,affiliate_min_payout_cents:Math.round(Number($('setAffiliateMinPayout').value||0)*100),require_email_verification:$('setRequireEmail').value,usdt_network:$('setUsdtNetwork').value,usdt_address:$('setUsdtAddress').value,redotpay_id:$('setRedotPay').value,support_contact:$('setSupportContact').value,extension_version:$('setExtensionVersion').value,extension_download_url:$('setExtensionDownload').value,public_site_url:$('setPublicSite').value};
    await api('/api/admin/settings',{method:'PATCH',body:JSON.stringify(payload)});toast('Settings saved');await loadSettings();
  }catch(e){toast(e.message)}finally{if(b){b.disabled=false;b.textContent=old;}}
}

async function mhpPaymentAction(button,ref,action){
  if(button?.disabled)return;let body={};
  if(action==='confirm'){
    const existing=(lastRows.payments||[]).find(x=>x.payment_ref===ref)?.external_reference||'';
    const external=prompt('Transaction reference. Leave unchanged if the customer already submitted one:',existing);if(external===null)return;
    if(!external.trim() && !(lastRows.payments||[]).find(x=>x.payment_ref===ref)?.proof_url){toast('Payment evidence is required');return;}
    if(!confirm(`Confirm payment ${ref}? This will activate or extend the subscription.`))return;body={externalReference:external.trim()};
  }else if(action==='reject'){
    const reason=prompt('Reason for rejection (shown in the payment record):','Payment could not be verified');if(reason===null||!reason.trim())return;body={reason:reason.trim()};
  }else if(action==='refund'){if(!confirm(`Refund ${ref}? This revokes the entitlement created by this payment.`))return;}
  const old=button?.textContent;if(button){button.disabled=true;button.textContent='Working…';}
  try{const d=await api(`/api/admin/payments/${encodeURIComponent(ref)}/${action}`,{method:'POST',body:JSON.stringify(body)});toast(d.already?'Already processed':`Payment ${action} complete`);await Promise.all([loadPayments(),loadOverview(),loadSubscriptions(),loadActivationRequests()]);}
  catch(e){toast(e.message)}finally{if(button?.isConnected){button.disabled=false;button.textContent=old;}}
}

mhpCommercialSettingsUI();
loaders.payments=loadPayments;loaders.settings=loadSettings;loaders.activationRequests=loadActivationRequests;
document.addEventListener('click',e=>{
  const c=e.target.closest('[data-payment-confirm]');if(c)mhpPaymentAction(c,c.dataset.paymentConfirm,'confirm');
  const r=e.target.closest('[data-payment-reject]');if(r)mhpPaymentAction(r,r.dataset.paymentReject,'reject');
  const f=e.target.closest('[data-payment-refund]');if(f)mhpPaymentAction(f,f.dataset.paymentRefund,'refund');
});
