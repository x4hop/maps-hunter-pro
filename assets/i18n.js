const MHP_META={
  en:['Maps Hunter Pro — Google Maps Lead Extraction Chrome Extension','Find, organize and export Google Maps business leads to Excel, CSV and JSON with international phone formatting.'],
  ar:['Maps Hunter Pro — استخراج بيانات الأنشطة التجارية من Google Maps','استخرج ونظّم وصدّر بيانات الأنشطة التجارية من Google Maps إلى Excel وCSV وJSON مع تنسيق أرقام الهاتف الدولي.'],
  ru:['Maps Hunter Pro — экспорт бизнес-лидов из Google Maps','Находите, систематизируйте и экспортируйте бизнес-лиды из Google Maps в Excel, CSV и JSON с международным форматом телефонов.'],
  de:['Maps Hunter Pro — Google Maps Lead-Extraktion für Chrome','Unternehmens-Leads aus Google Maps finden, organisieren und nach Excel, CSV und JSON mit internationalem Telefonnummernformat exportieren.'],
  es:['Maps Hunter Pro — extracción de leads de Google Maps','Encuentra, organiza y exporta leads empresariales de Google Maps a Excel, CSV y JSON con formato telefónico internacional.']
};
const MHP_LANGS=['en','ar','ru','de','es'];
const MHP_LANG_NAME={en:'English',ar:'العربية',ru:'Русский',de:'Deutsch',es:'Español'};
const MHP_LANG_ARIA={en:'Change language. Current: English',ar:'تغيير اللغة. الحالية: العربية',ru:'Сменить язык. Текущий: Русский',de:'Sprache ändern. Aktuell: Deutsch',es:'Cambiar idioma. Actual: Español'};

function applyLanguage(lang){
  if(!MHP_LANGS.includes(lang))lang='en';
  const dict=(window.MHP_LOCALES||{})[lang]||{};
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==='ar'?'rtl':'ltr';
  document.body?.setAttribute('dir',lang==='ar'?'rtl':'ltr');
  document.querySelectorAll('[data-i18n]').forEach(el=>{
    const key=el.dataset.i18n;
    if(Object.prototype.hasOwnProperty.call(dict,key))el.textContent=dict[key];
  });
  const toggle=document.getElementById('langToggle');
  if(toggle){
    toggle.setAttribute('aria-label',MHP_LANG_ARIA[lang]);
    toggle.setAttribute('title',MHP_LANG_NAME[lang]);
  }
  document.querySelectorAll('#languageMenu [data-lang]').forEach(el=>{
    const code=el.dataset.lang;
    el.classList.toggle('active',code===lang);
    el.setAttribute('aria-current',code===lang?'true':'false');
  });
  const [title,description]=MHP_META[lang];
  document.title=title;
  document.querySelector('meta[name="description"]')?.setAttribute('content',description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content',title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content',description);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content',title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content',description);
  const canonical=`${location.origin}/${lang}`;
  document.querySelector('link[rel="canonical"]')?.setAttribute('href',canonical);
  document.querySelector('meta[property="og:url"]')?.setAttribute('content',canonical);
  try{localStorage.setItem('mhp_lang',lang)}catch{}
  window.dispatchEvent(new CustomEvent('mhp:languagechange',{detail:{lang}}));
}

function languageTargetUrl(target){
  if(!MHP_LANGS.includes(target))return null;
  const url=new URL(location.href);
  url.pathname=`/${target}`;
  return `${url.pathname}${url.search}${url.hash}`;
}

function closeLanguageMenu(toggle,menu){
  menu.classList.remove('open');
  toggle.setAttribute('aria-expanded','false');
}

function initLanguageSwitcher(){
  const toggle=document.getElementById('langToggle');
  const menu=document.getElementById('languageMenu');
  const switcher=document.getElementById('languageSwitcher');
  if(!toggle||!menu||!switcher)return;

  toggle.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    const open=menu.classList.toggle('open');
    toggle.setAttribute('aria-expanded',String(open));
  });

  menu.querySelectorAll('[data-lang]').forEach(item=>{
    item.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      const target=item.dataset.lang;
      const next=languageTargetUrl(target);
      if(!next)return;
      const current=location.pathname.replace(/\/$/,'')||'/en';
      if(current!==`/${target}`)location.assign(next);
      else closeLanguageMenu(toggle,menu);
    });
  });

  document.addEventListener('click',event=>{
    if(!switcher.contains(event.target))closeLanguageMenu(toggle,menu);
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeLanguageMenu(toggle,menu);toggle.focus()}
  });

  const route=location.pathname.replace(/\/$/,'').split('/').pop();
  applyLanguage(MHP_LANGS.includes(route)?route:'en');
}

document.addEventListener('DOMContentLoaded',initLanguageSwitcher);