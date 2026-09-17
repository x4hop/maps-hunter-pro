const MHP_META={
  en:['Maps Hunter Pro — Google Maps Lead Extraction Chrome Extension','Find, organize and export Google Maps business leads to Excel, CSV and JSON with international phone formatting.'],
  ar:['Maps Hunter Pro — استخراج بيانات الأنشطة التجارية من Google Maps','استخرج ونظّم وصدّر بيانات الأنشطة التجارية من Google Maps إلى Excel وCSV وJSON مع تنسيق أرقام الهاتف الدولي.'],
  ru:['Maps Hunter Pro — экспорт бизнес-лидов из Google Maps','Находите, систематизируйте и экспортируйте бизнес-лиды из Google Maps в Excel, CSV и JSON с международным форматом телефонов.'],
  de:['Maps Hunter Pro — Google Maps Lead-Extraktion für Chrome','Unternehmens-Leads aus Google Maps finden, organisieren und nach Excel, CSV und JSON mit internationalem Telefonnummernformat exportieren.'],
  es:['Maps Hunter Pro — extracción de leads de Google Maps','Encuentra, organiza y exporta leads empresariales de Google Maps a Excel, CSV y JSON con formato telefónico internacional.']
};
const MHP_LANGS=['en','ar','ru','de','es'];
const MHP_LANG_SHORT={en:'EN',ar:'ع',ru:'RU',de:'DE',es:'ES'};
const MHP_LANG_NAME={en:'English',ar:'العربية',ru:'Русский',de:'Deutsch',es:'Español'};

function installChangaTheme(){
  if(!document.getElementById('mhp-readex-font')){
    const link=document.createElement('link');link.id='mhp-readex-font';link.rel='stylesheet';link.href='https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600;700;800&display=swap';document.head.appendChild(link);
  }
  if(!document.getElementById('mhp-ui-polish')){
    const link=document.createElement('link');link.id='mhp-ui-polish';link.rel='stylesheet';link.href='assets/ui-polish.css';document.head.appendChild(link);
  }
  if(!document.getElementById('mhp-layout-polish')){
    const link=document.createElement('link');link.id='mhp-layout-polish';link.rel='stylesheet';link.href='assets/layout-polish.css';document.head.appendChild(link);
  }
  if(!document.getElementById('mhp-language-font-fixes')){
    const style=document.createElement('style');style.id='mhp-language-font-fixes';style.textContent=`
      html,body,button,input,select,textarea{font-family:"Readex Pro",Arial,sans-serif!important}
      body{line-height:1.62}
      h1,h2,h3,h4,h5,h6,.brand,.btn,.buy,.badge,.price,.faq summary{font-family:"Readex Pro",Arial,sans-serif!important;letter-spacing:0!important}
      html[dir="rtl"] body,html[dir="rtl"] button,html[dir="rtl"] input,html[dir="rtl"] select,html[dir="rtl"] textarea{font-family:"Readex Pro",Arial,sans-serif!important}
      html[dir="rtl"] h1,html[dir="rtl"] h2,html[dir="rtl"] h3,html[dir="rtl"] p,html[dir="rtl"] a,html[dir="rtl"] button{letter-spacing:0!important}
      .lang-globe{width:auto!important;min-width:58px!important;padding:0 12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;white-space:nowrap}
      .lang-globe svg{display:none!important}.lang-code{font-size:14px;font-weight:800;line-height:1;direction:ltr;unicode-bidi:isolate}.lang-caret{font-size:12px;line-height:1;opacity:.6;transform:translateY(-1px)}
      .language-menu{position:fixed!important;width:78px!important;min-width:78px!important;max-width:calc(100vw - 20px)!important;padding:6px!important;border-radius:13px!important;z-index:9999!important;right:auto!important;left:10px;top:72px;overflow:hidden!important}
      .language-menu button{width:100%!important;min-height:38px!important;padding:7px 6px!important;text-align:center!important;font-size:13px!important;line-height:1!important;border-radius:8px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;direction:ltr!important}
      .language-menu button[data-lang="ar"]{direction:rtl!important;font-size:16px!important}.language-menu button.active{background:var(--color-coral)!important;color:var(--color-black)!important}
      @media(max-width:760px){body{font-size:16.5px}.hero h1{line-height:1.14!important}.section-title h2{line-height:1.2!important}.card h3,.price-card h3{line-height:1.3!important}.lang-globe{min-width:54px!important;min-height:42px!important;padding:0 10px!important}}
      @media(max-width:390px){.brand-copy strong{font-size:15px!important}.brand-mark{width:40px!important;height:40px!important;flex-basis:40px!important}.nav-wrap{gap:8px!important}}
    `;document.head.appendChild(style);
  }
}

function updateLanguageControl(lang){
  const toggle=document.getElementById('langToggle');
  if(toggle){toggle.innerHTML=`<span class="lang-code">${MHP_LANG_SHORT[lang]}</span><span class="lang-caret" aria-hidden="true">⌄</span>`;toggle.setAttribute('aria-label',`Language: ${MHP_LANG_NAME[lang]}`);toggle.setAttribute('title',MHP_LANG_NAME[lang])}
  document.querySelectorAll('[data-lang]').forEach(el=>{const code=el.dataset.lang;el.textContent=MHP_LANG_SHORT[code]||code.toUpperCase();el.setAttribute('title',MHP_LANG_NAME[code]||code);el.setAttribute('aria-label',MHP_LANG_NAME[code]||code);el.setAttribute('role','menuitem');el.classList.toggle('active',code===lang)})
}

function applyLanguage(lang){
  if(!MHP_LANGS.includes(lang))lang='en';
  const dict=(window.MHP_LOCALES||{})[lang]||{};
  document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body?.setAttribute('dir',lang==='ar'?'rtl':'ltr');
  document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(Object.prototype.hasOwnProperty.call(dict,key))el.textContent=dict[key]});
  updateLanguageControl(lang);
  const [title,description]=MHP_META[lang];document.title=title;document.querySelector('meta[name="description"]')?.setAttribute('content',description);
  try{localStorage.setItem('mhp_lang',lang)}catch{}
  window.dispatchEvent(new CustomEvent('mhp:languagechange',{detail:{lang}}));
}

function positionLanguageMenu(){
  const toggle=document.getElementById('langToggle'),menu=document.getElementById('languageMenu');if(!toggle||!menu)return;
  const rect=toggle.getBoundingClientRect(),width=78,gutter=10;menu.style.left=`${Math.round(Math.max(gutter,Math.min(window.innerWidth-width-gutter,rect.left+(rect.width-width)/2)))}px`;menu.style.top=`${Math.round(Math.min(window.innerHeight-12,rect.bottom+8))}px`;menu.style.right='auto';
}

function initLanguageSwitcher(){
  installChangaTheme();
  const toggle=document.getElementById('langToggle'),menu=document.getElementById('languageMenu'),switcher=document.getElementById('languageSwitcher');if(!toggle||!menu||!switcher)return;
  toggle.addEventListener('click',event=>{event.stopPropagation();const open=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open));if(open)requestAnimationFrame(positionLanguageMenu)});
  menu.addEventListener('click',event=>{const item=event.target.closest('[data-lang]');if(!item)return;const target=item.dataset.lang;if(!MHP_LANGS.includes(target))return;const next=`/${target}${location.search||''}${location.hash||''}`;if(location.pathname.replace(/\/$/,'')!==`/${target}`)location.assign(next);else{menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');applyLanguage(target)}});
  document.addEventListener('click',event=>{if(!switcher.contains(event.target)&&!menu.contains(event.target)){menu.classList.remove('open');toggle.setAttribute('aria-expanded','false')}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){menu.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.focus()}});
  window.addEventListener('resize',()=>{if(menu.classList.contains('open'))positionLanguageMenu()});window.addEventListener('scroll',()=>{if(menu.classList.contains('open'))positionLanguageMenu()},{passive:true});
  const route=location.pathname.replace(/\/$/,'').split('/').pop();applyLanguage(MHP_LANGS.includes(route)?route:'en');
}

document.addEventListener('DOMContentLoaded',initLanguageSwitcher);