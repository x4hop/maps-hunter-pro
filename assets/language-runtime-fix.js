(()=>{
  const LANGS=['en','ar','ru','de','es'];
  const ROUTES=['en','us','uk','ca','au','ar','ru','de','es'];
  const ROUTE_LANG={us:'en',uk:'en',ca:'en',au:'en'};
  const ARIA={
    en:'Change language. Current: English',
    ar:'تغيير اللغة. الحالية: العربية',
    ru:'Сменить язык. Текущий: Русский',
    de:'Sprache ändern. Aktuell: Deutsch',
    es:'Cambiar idioma. Actual: Español'
  };
  const routeCode=()=>{
    const code=location.pathname.replace(/\/$/,'').split('/').pop();
    return ROUTES.includes(code)?code:'en';
  };
  const uiLang=route=>ROUTE_LANG[route]||route;
  const setRoute=lang=>{
    const url=new URL(location.href);
    url.pathname=`/${lang}`;
    history.pushState({mhpLang:lang},'',`${url.pathname}${url.search}${url.hash}`);
  };
  const apply=route=>{
    if(!ROUTES.includes(route))route='en';
    const lang=uiLang(route);
    if(typeof window.applyLanguage==='function')window.applyLanguage(route);
    const toggle=document.getElementById('langToggle');
    const menu=document.getElementById('languageMenu');
    if(menu)menu.classList.remove('open');
    if(toggle){
      toggle.setAttribute('aria-expanded','false');
      toggle.setAttribute('aria-label',ARIA[lang]||ARIA.en);
    }
  };
  document.addEventListener('DOMContentLoaded',()=>{
    apply(routeCode());
    const menu=document.getElementById('languageMenu');
    if(!menu)return;
    menu.addEventListener('click',event=>{
      const item=event.target.closest('[data-lang]');
      if(!item||!menu.contains(item))return;
      const lang=item.dataset.lang;
      if(!LANGS.includes(lang))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if(routeCode()!==lang)setRoute(lang);
      apply(lang);
    },true);
    window.addEventListener('popstate',()=>apply(routeCode()));
  },{once:true});
})();