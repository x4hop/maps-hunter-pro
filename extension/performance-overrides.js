// Maps Hunter Pro v8.4.9 — conservative post-scan extraction tuning.
// Keeps the same extraction depth and data fields while reducing small artificial waits
// and allowing one more website-contact lookup to run in parallel.
(()=>{
  try{
    const baseSleep=sleep;
    sleep=function(ms){
      const n=Number(ms)||0;
      if(n===150)return baseSleep(100);
      if(n===350)return baseSleep(250);
      return baseSleep(n);
    };
  }catch(e){}

  try{
    mhpWithContactSlot=async function(fn){
      const limit=6;
      if(mhpContactActive>=limit){
        await new Promise(resolve=>mhpContactWaiters.push(resolve));
      }
      mhpContactActive+=1;
      try{return await fn();}
      finally{
        mhpContactActive=Math.max(0,mhpContactActive-1);
        const next=mhpContactWaiters.shift();
        if(next)next();
      }
    };
  }catch(e){}
})();
