(()=>{
  const ADDRESS='TLY5RXDg3waF1W7G5BStX8pp8ATxqaiKJS',NETWORK='TRC20';
  document.documentElement.classList.add('js-scroll');
  let progress=document.querySelector('.scroll-progress');
  if(!progress){progress=document.createElement('div');progress.className='scroll-progress';progress.setAttribute('aria-hidden','true');document.body.prepend(progress)}
  const header=document.querySelector('.site-header');
  const updateScroll=()=>{const max=Math.max(1,document.documentElement.scrollHeight-innerHeight),ratio=Math.min(1,Math.max(0,scrollY/max));progress.style.transform=`scaleX(${ratio})`;header?.classList.toggle('is-scrolled',scrollY>18)};
  updateScroll();addEventListener('scroll',updateScroll,{passive:true});addEventListener('resize',updateScroll,{passive:true});

  const revealTargets=[...document.querySelectorAll('.section-title,.card,.excel-shell,.price-card,.referral,.manual-payments,.manual-payment-flow,.faq details')];
  revealTargets.forEach((el,i)=>{el.classList.add('reveal');el.style.setProperty('--reveal-delay',`${Math.min((i%6)*55,275)}ms`)});
  if('IntersectionObserver'in window){const ro=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');ro.unobserve(e.target)}}),{threshold:.12,rootMargin:'0px 0px -6%'});revealTargets.forEach(el=>ro.observe(el))}else revealTargets.forEach(el=>el.classList.add('is-visible'));

  const nav=[...document.querySelectorAll('.nav-links a[href^="#"]')],sections=nav.map(a=>document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if('IntersectionObserver'in window&&sections.length){const so=new IntersectionObserver(es=>{const v=es.filter(e=>e.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(v)nav.forEach(a=>a.classList.toggle('active',a.getAttribute('href')===`#${v.target.id}`))},{rootMargin:'-24% 0px -58%',threshold:[0,.15,.35,.55]});sections.forEach(s=>so.observe(s))}

  const applyUsdt=()=>{const card=document.querySelector('[data-payment-method="usdt"]'),addr=document.getElementById('usdtAddress'),net=document.getElementById('usdtNetwork'),status=document.getElementById('usdtStatusText');if(!card||!addr)return;const ar=document.documentElement.lang==='ar';if(addr.textContent!==ADDRESS)addr.textContent=ADDRESS;if(net&&net.textContent!==`Network: ${NETWORK}`)net.textContent=`Network: ${NETWORK}`;const msg=ar?'تحويل USDT على شبكة TRC20. تحقق من الشبكة قبل الإرسال.':'USDT transfer on TRC20. Verify the network before sending.';if(status&&status.textContent!==msg)status.textContent=msg;if(card.classList.contains('payment-unavailable'))card.classList.remove('payment-unavailable');card.querySelectorAll('[data-usdt-action]').forEach(b=>{if(b.disabled)b.disabled=false})};
  applyUsdt();setTimeout(applyUsdt,400);setTimeout(applyUsdt,1400);window.addEventListener('mhp:languagechange',()=>setTimeout(applyUsdt,0));
  const pay=document.querySelector('.manual-payments');if(pay&&'MutationObserver'in window){let busy=false;new MutationObserver(()=>{if(busy)return;busy=true;queueMicrotask(()=>{applyUsdt();busy=false})}).observe(pay,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','class']})}
})();