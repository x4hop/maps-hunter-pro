// Maps Hunter Pro v1.0.0 — conservative Maps-only speed tuning.
// No business website fetches. These changes only shorten small waits after
// Google Maps detail content has already started rendering.
(()=>{
  try{
    const baseSleep=sleep;
    sleep=function(ms){
      const n=Number(ms)||0;
      if(n===150)return baseSleep(80);
      if(n===350)return baseSleep(180);
      return baseSleep(n);
    };
  }catch(e){}
})();
