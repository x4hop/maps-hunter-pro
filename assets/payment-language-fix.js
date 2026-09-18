(()=>{
  function apply(){
    if(document.documentElement.lang!=='es')return;
    const card=document.querySelector('[data-payment-method="redotpay"]');
    const helper=card?.querySelector('.pay-brand div span');
    if(helper)helper.textContent='Paga con tu RedotPay ID.';
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,0));
  window.addEventListener('mhp:languagechange',()=>setTimeout(apply,0));
})();
