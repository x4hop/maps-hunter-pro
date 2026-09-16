const API_BASE=window.MHP_API_BASE||'';
const CONFIRMED_PAYMENT={binanceId:'752783284',redotpayId:'1831390337',usdtAddress:'TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS',usdtNetwork:'TRC20'};
const BLOCKED_USDT_ADDRESSES=new Set();
let plansPayload=null,paymentPayload=null,selectedPlan='';

async function getJson(path){
  try{
    const r=await fetch(`${API_BASE}${path}`,{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`${path}:${r.status}`);
    return await r.json();
  }catch(e){
    console.info('Maps Hunter Pro API unavailable; using only locally confirmed non-crypto payment data.',e.message);
    return null;
  }
}

function localeText(en,ar){return document.documentElement.lang==='ar'?ar:en}
function textOf(id){const el=document.getElementById(id);return el?el.textContent.trim():''}
function normalizeNetwork(v){return String(v||'').trim().toUpperCase().replace(/[\s_-]+/g,'')}
function isTrc20Network(v){return ['TRC20','TRON(TRC20)','TRONTRC20'].includes(normalizeNetwork(v))}
function isTronAddress(v){return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(String(v||'').trim())}
function isSafeUsdtConfig(method){
  const address=String(method?.address||'').trim();
  return method?.enabled===true&&isTrc20Network(method?.network)&&isTronAddress(address)&&!BLOCKED_USDT_ADDRESSES.has(address);
}

async function copyText(value){
  if(!value)throw new Error('EMPTY_COPY_VALUE');
  if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(value);
  const field=document.createElement('textarea');
  field.value=value;field.setAttribute('readonly','');field.style.position='absolute';field.style.left='-9999px';
  document.body.appendChild(field);field.select();
  try{document.execCommand('copy')}finally{field.remove()}
}
function flashCopy(btn){
  if(!btn)return;
  const original=btn.dataset.originalText||btn.textContent.trim();
  btn.dataset.originalText=original;btn.textContent=localeText('Copied','تم النسخ');btn.disabled=true;
  setTimeout(()=>{btn.textContent=original;btn.disabled=false},1400);
}

const usdtIcon='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="currentColor" opacity=".16"/><path d="M17.5 8.5v2.3c2.8.2 4.8 1.1 4.8 2.2 0 1.1-2 2-4.8 2.2v1.6c4 .2 7 .9 7 1.9 0 1.1-3 1.8-7 2v2.3h-3v-2.3c-4.1-.2-7-1-7-2s2.9-1.7 7-1.9v-1.7c-2.8-.2-4.8-1.1-4.8-2.2 0-1.1 2-2 4.8-2.2V8.5h3Zm-1.5 3.8c-1.9.1-3.1.5-3.1.8s1.2.7 3.1.8v-1.6Zm0 4.8c-2.8.1-4.6.5-4.6.9s1.8.8 4.6.9v-1.8Zm1.5 1.8c2.8-.1 4.6-.5 4.6-.9s-1.8-.8-4.6-.9v1.8Zm0-4.8c1.9-.1 3.1-.5 3.1-.8s-1.2-.7-3.1-.8v1.6Z" fill="currentColor"/></svg>';
const binanceIcon='<svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M16 4l4.2 4.2-2.8 2.8L16 9.6 14.6 11 11.8 8.2 16 4Zm8 8 4 4-4 4-2.8-2.8 1.4-1.4-1.4-1.4L24 12Zm-16 0 2.8 2.8-1.4 1.4 1.4 1.4L8 20l-4-4 4-4Zm8 8 1.4 1.4 2.8-2.8L16 16.4l-4.2 4.2 2.8 2.8L16 20Zm0-7 3 3-3 3-3-3 3-3Z"/></svg>';
const redotIcon='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="12" fill="currentColor" opacity=".18"/><path d="M10 10h7.8c3 0 5.2 2.1 5.2 4.8 0 1.9-1.1 3.5-2.8 4.2l3.1 3H19l-2.6-2.5H14V22h-4V10Zm4 3.2v3.4h3.3c1.1 0 1.8-.7 1.8-1.7s-.7-1.7-1.8-1.7H14Z" fill="currentColor"/></svg>';

function paymentCards(){return `<article class="pay pay-card" data-payment-method="binance"><div class="pay-brand"><span class="pay-logo logo-binance" aria-hidden="true">${binanceIcon}</span><div><strong>Binance</strong><span>${localeText('Send directly with your Binance ID.','ادفع مباشرة باستخدام Binance ID.')}</span></div></div><div class="pay-value-wrap"><label>Binance ID</label><code id="binanceId">—</code></div><div class="pay-actions"><button class="btn btn-secondary copy-trigger" type="button" data-copy-target="binanceId">${localeText('Copy ID','نسخ ID')}</button></div></article><article class="pay pay-card" data-payment-method="usdt"><div class="pay-brand"><span class="pay-logo logo-usdt" aria-hidden="true">${usdtIcon}</span><div><strong>USDT</strong><span id="usdtStatusText">${localeText('Temporarily unavailable until the USDT TRC20 deposit address is verified.','غير متاح مؤقتًا حتى يتم التحقق من عنوان إيداع USDT TRC20.')}</span></div></div><div class="pay-value-wrap"><label>${localeText('Wallet address','عنوان المحفظة')}</label><span id="usdtNetwork">Network: TRC20</span><code id="usdtAddress">${localeText('Unavailable','غير متاح')}</code></div><div class="pay-actions"><button class="btn btn-secondary copy-trigger" type="button" data-copy-target="usdtAddress" data-usdt-action disabled>${localeText('Copy Address','نسخ العنوان')}</button><button class="btn btn-primary qr-trigger" type="button" data-qr-target="usdtAddress" data-qr-type="usdt" data-usdt-action disabled>${localeText('Show QR','عرض QR')}</button></div></article><article class="pay pay-card" data-payment-method="redotpay"><div class="pay-brand"><span class="pay-logo logo-redotpay" aria-hidden="true">${redotIcon}</span><div><strong>RedotPay</strong><span>${localeText('Use your RedotPay account or ID to pay.','استخدم حساب أو ID في RedotPay للدفع.')}</span></div></div><div class="pay-value-wrap"><label>RedotPay ID</label><code id="redotpayAccount">—</code></div><div class="pay-actions"><button class="btn btn-secondary copy-trigger" type="button" data-copy-target="redotpayAccount">${localeText('Copy ID','نسخ ID')}</button></div></article>`}
function paymentModalMarkup(){return `<div class="payment-modal-backdrop" data-close-modal></div><div class="payment-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle"><button class="payment-modal-close" type="button" data-close-modal aria-label="Close">×</button><div class="payment-modal-header"><span id="paymentModalIcon" class="payment-modal-icon pay-logo logo-usdt" aria-hidden="true">${usdtIcon}</span><div><h3 id="paymentModalTitle">Payment QR</h3><p id="paymentModalSubtitle"></p></div></div><div class="payment-qr-frame"><img id="paymentQrImage" alt="Payment QR code" /></div><div class="payment-modal-value"><small>${localeText('Value','القيمة')}</small><code id="paymentModalValue"></code></div><div class="pay-actions center"><button class="btn btn-secondary copy-trigger" type="button" data-copy-target="paymentModalValue">${localeText('Copy Value','نسخ القيمة')}</button></div></div>`}
function upgradePaymentsUI(){
  const wrap=document.querySelector('.manual-payments');
  if(wrap&&!wrap.dataset.enhanced){wrap.innerHTML=paymentCards();wrap.dataset.enhanced='1'}
  if(!document.getElementById('paymentModal')){const modal=document.createElement('div');modal.id='paymentModal';modal.className='payment-modal';modal.hidden=true;modal.setAttribute('aria-hidden','true');modal.innerHTML=paymentModalMarkup();document.body.appendChild(modal)}
}

function applyPlans(payload){
  if(!payload?.plans)return;plansPayload=payload;
  const monthly=payload.plans.find(x=>x.id==='monthly'),annual=payload.plans.find(x=>x.id==='annual'),prices=document.querySelectorAll('.price');
  if(monthly&&prices[0])prices[0].firstChild.nodeValue=`$${monthly.price} `;
  if(annual&&prices[1])prices[1].firstChild.nodeValue=`$${annual.price} `;
  const limit=document.querySelector('[data-i18n="monthly_1500"]'),save=document.querySelector('[data-i18n="save_140"]');
  if(limit&&monthly)limit.textContent=localeText(`Up to ${Number(monthly.dailyLeadLimit||1500).toLocaleString()} leads per day`,`حتى ${Number(monthly.dailyLeadLimit||1500).toLocaleString()} Lead يوميًا`);
  if(save&&monthly&&annual)save.textContent=localeText(`Save $${Math.max(0,monthly.price*12-annual.price)} vs monthly billing`,`توفر $${Math.max(0,monthly.price*12-annual.price)} مقارنة بالدفع الشهري`)
}
function waNumber(raw){if(!raw)return '';if(/^https?:\/\//i.test(raw))return String(raw).split(/[?#]/)[0];const digits=String(raw).replace(/\D/g,'');return digits?`https://wa.me/${digits}`:''}
function selectedLabel(){const p=plansPayload?.plans?.find(x=>x.id===selectedPlan);if(!p)return localeText('Selected plan: choose Monthly or Annual above','الخطة المختارة: اختر الشهرية أو السنوية أعلاه');const name=selectedPlan==='monthly'?localeText('Monthly','الشهرية'):localeText('Annual','السنوية');return localeText(`Selected plan: ${name} — $${p.price}`,`الخطة المختارة: ${name} — $${p.price}`)}
function updateWhatsApp(){
  const a=document.getElementById('whatsappPayment'),label=document.getElementById('selectedPlanText');if(label)label.textContent=selectedLabel();if(!a)return;
  const base=waNumber(paymentPayload?.support)||waNumber(a.getAttribute('href'))||'';const p=plansPayload?.plans?.find(x=>x.id===selectedPlan),name=selectedPlan==='monthly'?'Monthly':selectedPlan==='annual'?'Annual':'';
  const msg=name?`Hello, I paid for the Maps Hunter Pro ${name} plan${p?` ($${p.price})`:''}. I will send the payment screenshot and transaction reference/address for verification.`:'Hello, I want to activate Maps Hunter Pro. I will send the payment screenshot and transaction reference/address for verification.';
  if(base)a.href=`${base}?text=${encodeURIComponent(msg)}`
}

function setMethodDisabled(name,disabled){const card=document.querySelector(`[data-payment-method="${name}"]`);if(card)card.classList.toggle('payment-unavailable',disabled);card?.querySelectorAll('button').forEach(b=>b.disabled=disabled)}
function applyPayments(payload){
  paymentPayload=payload||{};
  const methods=payload?.methods||{};
  const b=methods.BINANCE,u=methods.USDT,r=methods.REDOTPAY;
  const bi=document.getElementById('binanceId'),n=document.getElementById('usdtNetwork'),ad=document.getElementById('usdtAddress'),rp=document.getElementById('redotpayAccount'),status=document.getElementById('usdtStatusText');

  const binanceId=String(b?.id||CONFIRMED_PAYMENT.binanceId).trim();
  if(bi)bi.textContent=binanceId||localeText('Unavailable','غير متاح');
  setMethodDisabled('binance',!binanceId||(b&&b.enabled===false));

  const redotId=String(r?.account||(payload? '':CONFIRMED_PAYMENT.redotpayId)).trim();
  const effectiveRedot=redotId||(!r?CONFIRMED_PAYMENT.redotpayId:'');
  if(rp)rp.textContent=effectiveRedot||localeText('Unavailable','غير متاح');
  setMethodDisabled('redotpay',!effectiveRedot||(r&&r.enabled===false));

  const effectiveUsdt=(u?.enabled===true&&u?.address)?u:{enabled:true,network:CONFIRMED_PAYMENT.usdtNetwork,address:CONFIRMED_PAYMENT.usdtAddress};
  const safeUsdt=isSafeUsdtConfig(effectiveUsdt);
  const network=String(effectiveUsdt?.network||CONFIRMED_PAYMENT.usdtNetwork).trim()||'TRC20';
  if(n)n.textContent=`Network: ${network}`;
  if(ad)ad.textContent=safeUsdt?String(effectiveUsdt.address).trim():localeText('Unavailable — address not verified','غير متاح — العنوان غير موثّق');
  if(status)status.textContent=safeUsdt?localeText(`USDT transfer on ${network}. Verify the network before sending.`,`تحويل USDT على شبكة ${network}. تحقق من الشبكة قبل الإرسال.`):localeText('Temporarily unavailable until the USDT TRC20 deposit address is verified.','غير متاح مؤقتًا حتى يتم التحقق من عنوان إيداع USDT TRC20.');
  document.querySelectorAll('[data-usdt-action]').forEach(btn=>btn.disabled=!safeUsdt);
  setMethodDisabled('usdt',!safeUsdt);
  updateWhatsApp();
}

function qrUrl(value){return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(value)}`}
function openPaymentModal(type,title,value,subtitle){
  if(type==='usdt'&&!isTronAddress(value))return;
  const modal=document.getElementById('paymentModal'),img=document.getElementById('paymentQrImage'),titleEl=document.getElementById('paymentModalTitle'),subEl=document.getElementById('paymentModalSubtitle'),valueEl=document.getElementById('paymentModalValue');
  if(!modal||!img||!value)return;
  if(titleEl)titleEl.textContent=title;if(subEl)subEl.textContent=subtitle||localeText('Scan the QR code or copy the value below.','امسح رمز QR أو انسخ القيمة بالأسفل.');if(valueEl)valueEl.textContent=value;
  img.src=qrUrl(value);img.alt=`${title} QR`;modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open')
}
function closePaymentModal(){const modal=document.getElementById('paymentModal'),img=document.getElementById('paymentQrImage');if(!modal)return;modal.hidden=true;modal.setAttribute('aria-hidden','true');if(img)img.removeAttribute('src');document.body.classList.remove('modal-open')}
function bindPlans(){document.querySelectorAll('[data-mhp-plan]').forEach(a=>{if(a.dataset.boundPlan)return;a.dataset.boundPlan='1';a.addEventListener('click',()=>{selectedPlan=a.dataset.mhpPlan||'';updateWhatsApp()})})}
function initSaasScrollExperience(){
  document.documentElement.classList.add('js-scroll');
  let progress=document.querySelector('.scroll-progress');
  if(!progress){progress=document.createElement('div');progress.className='scroll-progress';progress.setAttribute('aria-hidden','true');document.body.prepend(progress)}
  const header=document.querySelector('.site-header');
  const updateScroll=()=>{const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),ratio=Math.min(1,Math.max(0,scrollY/max));progress.style.transform=`scaleX(${ratio})`;header?.classList.toggle('is-scrolled',scrollY>18)};
  updateScroll();addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',updateScroll,{passive:true});

  const revealTargets=[...document.querySelectorAll('.section-title,.card,.excel-shell,.price-card,.referral,.manual-payments,.manual-payment-flow,.faq details')];
  revealTargets.forEach((el,i)=>{el.classList.add('reveal');el.style.setProperty('--reveal-delay',`${Math.min((i%6)*55,275)}ms`)});
  if('IntersectionObserver'in window){const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver.unobserve(entry.target)}})},{threshold:.12,rootMargin:'0px 0px -6%'});revealTargets.forEach(el=>revealObserver.observe(el))}else revealTargets.forEach(el=>el.classList.add('is-visible'));

  const navLinks=[...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections=navLinks.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if('IntersectionObserver'in window&&sections.length){const sectionObserver=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(!visible)return;navLinks.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${visible.target.id}`))},{rootMargin:'-24% 0px -58%',threshold:[0,.15,.35,.55]});sections.forEach(sec=>sectionObserver.observe(sec))}
}

function bindPaymentActions(){
  document.querySelectorAll('.copy-trigger').forEach(btn=>{if(btn.dataset.boundCopy)return;btn.dataset.boundCopy='1';btn.addEventListener('click',async()=>{if(btn.disabled)return;const value=btn.dataset.copyValue||textOf(btn.dataset.copyTarget);if(!value||/unavailable|غير متاح/i.test(value))return;try{await copyText(value);flashCopy(btn)}catch(e){console.warn('Copy failed',e)}})});
  document.querySelectorAll('.qr-trigger').forEach(btn=>{if(btn.dataset.boundQr)return;btn.dataset.boundQr='1';btn.addEventListener('click',()=>{if(btn.disabled)return;const value=textOf(btn.dataset.qrTarget),network=textOf('usdtNetwork').replace(/^Network:\s*/i,'')||'TRC20';openPaymentModal(btn.dataset.qrType||'usdt',`USDT (${network})`,value,localeText(`Network: ${network}. Confirm it matches the sender wallet before paying.`,`الشبكة: ${network}. تأكد أنها مطابقة لمحفظة الإرسال قبل الدفع.`))})});
  document.querySelectorAll('[data-close-modal]').forEach(el=>{if(el.dataset.boundClose)return;el.dataset.boundClose='1';el.addEventListener('click',closePaymentModal)});
  if(!document.body.dataset.paymentEscBound){document.body.dataset.paymentEscBound='1';document.addEventListener('keydown',e=>{if(e.key==='Escape')closePaymentModal()})}
}

document.addEventListener('DOMContentLoaded',async()=>{
  upgradePaymentsUI();bindPlans();bindPaymentActions();initSaasScrollExperience();
  const [plans,pay]=await Promise.all([getJson('/api/plans'),getJson('/api/payment-methods')]);
  applyPlans(plans);applyPayments(pay);
});
window.addEventListener('mhp:languagechange',()=>{if(plansPayload)setTimeout(()=>applyPlans(plansPayload),0);setTimeout(()=>{upgradePaymentsUI();applyPayments(paymentPayload);updateWhatsApp()},0)});
