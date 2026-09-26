const MHP_META={
  en:['Google Maps Scraper & Lead Extractor for Chrome | Maps Hunter Pro','Extract structured business leads from Google Maps, including phones, websites, available emails and social links, then export clean data to Excel, CSV or JSON.'],
  ar:['استخراج بيانات Google Maps والعملاء المحتملين | Maps Hunter Pro','استخرج بيانات الأنشطة التجارية من Google Maps مثل الهاتف والموقع والبيانات المتاحة، ثم صدّر النتائج بشكل منظم إلى Excel أو CSV أو JSON.'],
  ru:['Парсер Google Maps и сборщик лидов для Chrome | Maps Hunter Pro','Собирайте структурированные данные компаний из Google Maps — телефоны, сайты, доступные email и соцсети — и экспортируйте результаты в Excel, CSV или JSON.'],
  de:['Google Maps Scraper & Lead-Extractor für Chrome | Maps Hunter Pro','Extrahiere strukturierte Unternehmensdaten aus Google Maps – Telefonnummern, Websites, verfügbare E-Mails und Social Links – und exportiere sie in Excel, CSV oder JSON.'],
  es:['Google Maps Scraper y Extractor de Leads | Maps Hunter Pro','Extrae datos estructurados de negocios desde Google Maps, como teléfonos, sitios web, correos disponibles y redes sociales, y expórtalos a Excel, CSV o JSON.']
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