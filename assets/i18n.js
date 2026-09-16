const MHP_META={"en":["Maps Hunter Pro — Google Maps Lead Extraction Chrome Extension","Find, organize and export Google Maps business leads to Excel, CSV and JSON with international phone formatting."],"ar":["Maps Hunter Pro — استخراج بيانات الأعمال من Google Maps","استخرج ونظّم وصدّر بيانات الأنشطة التجارية من Google Maps إلى Excel وCSV وJSON مع تنسيق أرقام الهاتف الدولي."],"ru":["Maps Hunter Pro — экспорт лидов из Google Maps","Находите, систематизируйте и экспортируйте бизнес-лиды из Google Maps в Excel, CSV и JSON с международным форматом телефонов."],"de":["Maps Hunter Pro — Google Maps Lead-Extraktion","Finde, organisiere und exportiere Unternehmens-Leads aus Google Maps nach Excel, CSV und JSON mit internationalem Telefonnummernformat."],"es":["Maps Hunter Pro — extracción de leads de Google Maps","Encuentra, organiza y exporta leads empresariales de Google Maps a Excel, CSV y JSON con formato telefónico internacional."]};
const MHP_LANGS=['en','ar','ru','de','es'];
const MHP_LANG_SHORT={en:'EN',ar:'ع',ru:'RU',de:'DE',es:'ES'};
const MHP_LANG_NAME={en:'English',ar:'العربية',ru:'Русский',de:'Deutsch',es:'Español'};
const MHP_CONFIRMED_PAYMENT={binance:'752783284',redotpay:'1831390337',usdt:'TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS',network:'TRC20'};
const MHP_PAYMENT_UI={
  en:{binance:'Send with your Binance ID.',redot:'Pay with your RedotPay ID.',usdt:'USDT transfer on TRC20.',wallet:'Wallet address',network:'Network',copyId:'Copy ID',copyAddress:'Copy Address',showQr:'Show QR',copied:'Copied',modalTitle:'USDT payment',modalText:'Scan the QR code or copy the wallet address below.',value:'Wallet address',close:'Close'},
  ar:{binance:'ادفع باستخدام Binance ID.',redot:'ادفع باستخدام RedotPay ID.',usdt:'تحويل USDT عبر شبكة TRC20.',wallet:'عنوان المحفظة',network:'الشبكة',copyId:'نسخ ID',copyAddress:'نسخ العنوان',showQr:'عرض QR',copied:'تم النسخ',modalTitle:'دفع USDT',modalText:'امسح رمز QR أو انسخ عنوان المحفظة بالأسفل.',value:'عنوان المحفظة',close:'إغلاق'},
  ru:{binance:'Оплата через Binance ID.',redot:'Оплата через RedotPay ID.',usdt:'Перевод USDT по сети TRC20.',wallet:'Адрес кошелька',network:'Сеть',copyId:'Копировать ID',copyAddress:'Копировать адрес',showQr:'Показать QR',copied:'Скопировано',modalTitle:'Оплата USDT',modalText:'Отсканируйте QR-код или скопируйте адрес кошелька ниже.',value:'Адрес кошелька',close:'Закрыть'},
  de:{binance:'Mit Binance ID bezahlen.',redot:'Mit RedotPay ID bezahlen.',usdt:'USDT-Transfer über TRC20.',wallet:'Wallet-Adresse',network:'Netzwerk',copyId:'ID kopieren',copyAddress:'Adresse kopieren',showQr:'QR anzeigen',copied:'Kopiert',modalTitle:'USDT-Zahlung',modalText:'QR-Code scannen oder die Wallet-Adresse unten kopieren.',value:'Wallet-Adresse',close:'Schließen'},
  es:{binance:'Paga con tu Binance ID.',redot:'Paga con tu RedotPay ID.',usdt:'Transferencia USDT por TRC20.',wallet:'Dirección de la billetera',network:'Red',copyId:'Copiar ID',copyAddress:'Copiar dirección',showQr:'Ver QR',copied:'Copiado',modalTitle:'Pago USDT',modalText:'Escanea el código QR o copia la dirección de la billetera.',value:'Dirección de la billetera',close:'Cerrar'}
};

function installChangaTheme(){
  if(!document.getElementById('mhp-changa-font')){
    const link=document.createElement('link');
    link.id='mhp-changa-font';
    link.rel='stylesheet';
    link.href='https://fonts.googleapis.com/css2?family=Changa:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }
  if(!document.getElementById('mhp-ui-polish')){
    const link=document.createElement('link');
    link.id='mhp-ui-polish';
    link.rel='stylesheet';
    link.href='assets/ui-polish.css';
    document.head.appendChild(link);
  }
  if(!document.getElementById('mhp-language-font-fixes')){
    const style=document.createElement('style');
    style.id='mhp-language-font-fixes';
    style.textContent=`
      html,body,button,input,select,textarea{font-family:"Changa",Arial,sans-serif!important}
      body{line-height:1.62}
      h1,h2,h3,h4,h5,h6,.brand,.btn,.buy,.badge,.price,.faq summary{font-family:"Changa",Arial,sans-serif!important;letter-spacing:0!important}
      html[dir="rtl"] body,html[dir="rtl"] button,html[dir="rtl"] input,html[dir="rtl"] select,html[dir="rtl"] textarea{font-family:"Changa",Arial,sans-serif!important}
      html[dir="rtl"] h1,html[dir="rtl"] h2,html[dir="rtl"] h3,html[dir="rtl"] p,html[dir="rtl"] a,html[dir="rtl"] button{letter-spacing:0!important}
      .lang-globe{width:auto!important;min-width:58px!important;padding:0 12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;white-space:nowrap}
      .lang-globe svg{display:none!important}
      .lang-code{font-size:14px;font-weight:800;line-height:1;direction:ltr;unicode-bidi:isolate}
      .lang-caret{font-size:12px;line-height:1;opacity:.6;transform:translateY(-1px)}
      .language-menu{position:fixed!important;width:78px!important;min-width:78px!important;max-width:calc(100vw - 20px)!important;padding:6px!important;border-radius:13px!important;z-index:9999!important;right:auto!important;left:10px;top:72px;overflow:hidden!important}
      .language-menu button{width:100%!important;min-height:38px!important;padding:7px 6px!important;text-align:center!important;font-size:13px!important;line-height:1!important;border-radius:8px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;direction:ltr!important}
      .language-menu button[data-lang="ar"]{direction:rtl!important;font-size:16px!important}
      .language-menu button.active{background:var(--color-coral)!important;color:var(--color-black)!important}
      @media(max-width:760px){
        body{font-size:16.5px}
        .hero h1{line-height:1.12!important}
        .section-title h2{line-height:1.2!important}
        .card h3,.price-card h3{line-height:1.3!important}
        .lang-globe{min-width:54px!important;min-height:42px!important;padding:0 10px!important}
      }
      @media(max-width:390px){
        .brand-copy strong{font-size:15px!important}
        .brand-mark{width:40px!important;height:40px!important;flex-basis:40px!important}
        .nav-wrap{gap:8px!important}
      }
    `;
    document.head.appendChild(style);
  }
}

function updateLanguageControl(lang){
  const toggle=document.getElementById('langToggle');
  if(toggle){
    toggle.innerHTML=`<span class="lang-code">${MHP_LANG_SHORT[lang]}</span><span class="lang-caret" aria-hidden="true">⌄</span>`;
    toggle.setAttribute('aria-label',`Language: ${MHP_LANG_NAME[lang]}`);
    toggle.setAttribute('title',MHP_LANG_NAME[lang]);
  }
  document.querySelectorAll('[data-lang]').forEach(el=>{
    const code=el.dataset.lang;
    el.textContent=MHP_LANG_SHORT[code]||code.toUpperCase();
    el.setAttribute('title',MHP_LANG_NAME[code]||code);
    el.setAttribute('aria-label',MHP_LANG_NAME[code]||code);
    el.setAttribute('role','menuitem');
    el.classList.toggle('active',code===lang);
  });
}

function setTextIfChanged(el,value){if(el&&typeof value==='string'&&el.textContent!==value)el.textContent=value}
function isCopiedState(text){return ['Copied','تم النسخ','Скопировано','Kopiert','Copiado'].includes(String(text||'').trim())}
function setCopyButton(btn,normal,copied){
  if(!btn)return;
  const current=btn.textContent.trim();
  if(isCopiedState(current))setTextIfChanged(btn,copied);
  else setTextIfChanged(btn,normal);
  btn.dataset.originalText=normal;
  if(btn.disabled&&!isCopiedState(btn.textContent.trim()))btn.disabled=false;
}

function polishPaymentUI(lang=document.documentElement.lang||'en'){
  const t=MHP_PAYMENT_UI[lang]||MHP_PAYMENT_UI.en;
  const wrap=document.querySelector('.manual-payments');
  if(!wrap)return;
  const binance=wrap.querySelector('[data-payment-method="binance"]');
  const redot=wrap.querySelector('[data-payment-method="redotpay"]');
  const usdt=wrap.querySelector('[data-payment-method="usdt"]');

  for(const card of [binance,redot,usdt])if(card?.classList.contains('payment-unavailable'))card.classList.remove('payment-unavailable');

  const binanceValue=document.getElementById('binanceId');
  if(binanceValue&&(!binanceValue.textContent.trim()||binanceValue.textContent.trim()==='—'||/unavailable|غير متاح/i.test(binanceValue.textContent)))setTextIfChanged(binanceValue,MHP_CONFIRMED_PAYMENT.binance);
  const redotValue=document.getElementById('redotpayAccount');
  if(redotValue&&(!redotValue.textContent.trim()||redotValue.textContent.trim()==='—'||/unavailable|غير متاح/i.test(redotValue.textContent)))setTextIfChanged(redotValue,MHP_CONFIRMED_PAYMENT.redotpay);
  const usdtValue=document.getElementById('usdtAddress');
  if(usdtValue&&(!usdtValue.textContent.trim()||usdtValue.textContent.trim()==='—'||/unavailable|غير متاح/i.test(usdtValue.textContent)))setTextIfChanged(usdtValue,MHP_CONFIRMED_PAYMENT.usdt);

  setTextIfChanged(binance?.querySelector('.pay-brand span'),t.binance);
  setTextIfChanged(redot?.querySelector('.pay-brand span'),t.redot);
  setTextIfChanged(usdt?.querySelector('.pay-brand span'),t.usdt);

  const usdtLabel=usdt?.querySelector('.pay-value-wrap label');
  setTextIfChanged(usdtLabel,t.wallet);
  const network=document.getElementById('usdtNetwork');
  setTextIfChanged(network,`${t.network}: ${MHP_CONFIRMED_PAYMENT.network}`);

  setCopyButton(binance?.querySelector('.copy-trigger'),t.copyId,t.copied);
  setCopyButton(redot?.querySelector('.copy-trigger'),t.copyId,t.copied);
  setCopyButton(usdt?.querySelector('.copy-trigger'),t.copyAddress,t.copied);
  const qr=usdt?.querySelector('.qr-trigger');
  if(qr){setTextIfChanged(qr,t.showQr);if(qr.disabled)qr.disabled=false}

  const modal=document.getElementById('paymentModal');
  if(modal){
    const title=document.getElementById('paymentModalTitle');
    const subtitle=document.getElementById('paymentModalSubtitle');
    const small=modal.querySelector('.payment-modal-value small');
    const close=modal.querySelector('.payment-modal-close');
    if(!modal.hidden){setTextIfChanged(title,t.modalTitle);setTextIfChanged(subtitle,t.modalText)}
    setTextIfChanged(small,t.value);
    if(close)close.setAttribute('aria-label',t.close);
    setCopyButton(modal.querySelector('.copy-trigger'),t.copyAddress,t.copied);
  }
}

function installPaymentPolishObserver(){
  const wrap=document.querySelector('.manual-payments');
  if(!wrap||wrap.dataset.polishObserved)return;
  wrap.dataset.polishObserved='1';
  let scheduled=false;
  const run=()=>{scheduled=false;polishPaymentUI(document.documentElement.lang||'en')};
  const observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;queueMicrotask(run)}});
  observer.observe(wrap,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled']});
  const modalHost=document.body;
  if(modalHost)observer.observe(modalHost,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','class']});
  polishPaymentUI(document.documentElement.lang||'en');
}

function applyLanguage(lang){
  if(!MHP_LANGS.includes(lang))lang='en';
  const dict=(window.MHP_LOCALES||{})[lang];
  if(!dict)return;
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  document.body?.setAttribute('dir',lang==='ar'?'rtl':'ltr');
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.dataset.i18n;
    if(Object.prototype.hasOwnProperty.call(dict,key))el.textContent=dict[key];
  });
  updateLanguageControl(lang);
  polishPaymentUI(lang);
  const [title,description]=MHP_META[lang];
  document.title=title;
  const md=document.querySelector('meta[name="description"]');
  if(md)md.setAttribute('content',description);
  try{localStorage.setItem('mhp_lang',lang)}catch{}
  window.dispatchEvent(new CustomEvent('mhp:languagechange',{detail:{lang}}));
}

function syncLanguageRoute(lang){
  const pathname=location.pathname.replace(/\/$/,'')||'/';
  if(/^\/(en|ar|ru|de|es)$/.test(pathname)){
    try{history.replaceState(null,'','/'+lang+(location.search||'')+(location.hash||''))}catch{}
  }
}

function positionLanguageMenu(){
  const toggle=document.getElementById('langToggle');
  const menu=document.getElementById('languageMenu');
  if(!toggle||!menu)return;
  const rect=toggle.getBoundingClientRect();
  const width=78;
  const gutter=10;
  const left=Math.max(gutter,Math.min(window.innerWidth-width-gutter,rect.left+(rect.width-width)/2));
  const top=Math.min(window.innerHeight-12,rect.bottom+8);
  menu.style.left=`${Math.round(left)}px`;
  menu.style.top=`${Math.round(top)}px`;
  menu.style.right='auto';
}

function initLanguageSwitcher(){
  installChangaTheme();
  const toggle=document.getElementById('langToggle');
  const menu=document.getElementById('languageMenu');
  const switcher=document.getElementById('languageSwitcher');
  if(!toggle||!menu||!switcher)return;

  toggle.addEventListener('click',event=>{
    event.stopPropagation();
    const open=menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded',String(open));
    if(open)requestAnimationFrame(positionLanguageMenu);
  });

  menu.addEventListener('click',event=>{
    const item=event.target.closest('[data-lang]');
    if(!item)return;
    const lang=item.dataset.lang;
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded','false');
    applyLanguage(lang);
    syncLanguageRoute(lang);
  });

  document.addEventListener('click',event=>{
    if(!switcher.contains(event.target)&&!menu.contains(event.target)){
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
    }
  });

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      menu.classList.remove('open');
      toggle.setAttribute('aria-expanded','false');
      toggle.focus();
    }
  });

  window.addEventListener('resize',()=>{if(menu.classList.contains('open'))positionLanguageMenu()});
  window.addEventListener('scroll',()=>{if(menu.classList.contains('open'))positionLanguageMenu()},{passive:true});

  let saved;
  try{saved=localStorage.getItem('mhp_lang')}catch{}
  const route=location.pathname.replace(/\/$/,'').split('/').pop();
  if(MHP_LANGS.includes(route))saved=route;
  const browser=(navigator.language||'en').slice(0,2).toLowerCase();
  applyLanguage(saved||(MHP_LANGS.includes(browser)?browser:'en'));
  installPaymentPolishObserver();
  setTimeout(()=>polishPaymentUI(document.documentElement.lang||'en'),0);
  setTimeout(()=>polishPaymentUI(document.documentElement.lang||'en'),600);
  setTimeout(()=>polishPaymentUI(document.documentElement.lang||'en'),1800);
}

document.addEventListener('DOMContentLoaded',initLanguageSwitcher);
