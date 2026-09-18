(()=>{
  const LANGS=['en','ar','ru','de','es'];
  const routeLang=()=>{const code=location.pathname.replace(/\/$/,'').split('/').pop();return LANGS.includes(code)?code:'en'};
  const setRoute=(lang)=>{
    const url=new URL(location.href);
    url.pathname=`/${lang}`;
    history.pushState({mhpLang:lang},'',`${url.pathname}${url.search}${url.hash}`);
  };
  const apply=(lang)=>{
    if(!LANGS.includes(lang))lang='en';
    if(typeof window.applyLanguage==='function')window.applyLanguage(lang);
    const toggle=document.getElementById('langToggle');
    const menu=document.getElementById('languageMenu');
    if(menu)menu.classList.remove('open');
    if(toggle)toggle.setAttribute('aria-expanded','false');
  };
  document.addEventListener('DOMContentLoaded',()=>{
    const menu=document.getElementById('languageMenu');
    if(!menu)return;
    menu.addEventListener('click',event=>{
      const item=event.target.closest('[data-lang]');
      if(!item||!menu.contains(item))return;
      const lang=item.dataset.lang;
      if(!LANGS.includes(lang))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(routeLang()!==lang)setRoute(lang);
      apply(lang);
    },true);
    window.addEventListener('popstate',()=>apply(routeLang()));
  },{once:true});
})();