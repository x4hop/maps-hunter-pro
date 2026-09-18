// Maps Hunter Pro v1.0.0 — Email-first performance tuning.
// Source of truth: the lead is not committed until email discovery has completed.
// Speed comes from ending website crawling as soon as a valid public email is found,
// while preserving the full fallback path when no email is found.
(()=>{
  try{
    const baseSleep=sleep;
    sleep=function(ms){
      const n=Number(ms)||0;
      if(n===150)return baseSleep(90);
      if(n===350)return baseSleep(220);
      return baseSleep(n);
    };
  }catch(e){}

  try{
    enrichFromWebsite=async function(website){
      const root=mhpCleanWebsiteUrl(website);
      if(!root)return{};

      // Keep the roadmap's bounded website-level concurrency via mhpWithContactSlot.
      return mhpWithContactSlot(async()=>{
        const first=await mhpFetchPage(root,5600);
        if(!first.html)return{};

        const canonical=first.url||root;
        let found=mhpMergeSignals({},mhpExtractWebsiteSignals(first.html,canonical),canonical);
        let pagesChecked=1;

        // Email is the primary objective. If the homepage already exposes a valid
        // public email, do not spend extra time crawling merely for secondary fields.
        if(found.email){
          delete found._emails;
          return found;
        }

        const queue=mhpContactCandidates(first.html,canonical).filter(u=>u!==canonical);
        const seen=new Set([canonical]);

        while(queue.length&&pagesChecked<MHP_SITE_PAGE_LIMIT-3){
          if(found.email)break;

          // Slightly wider batches shorten email discovery without reducing the
          // total page ceiling or removing any fallback source.
          const batch=[];
          while(queue.length&&batch.length<4&&pagesChecked+batch.length<MHP_SITE_PAGE_LIMIT-3){
            const u=queue.shift();
            if(!u||seen.has(u))continue;
            seen.add(u);
            batch.push(u);
          }
          if(!batch.length)break;

          const pages=await Promise.all(batch.map(u=>mhpFetchPage(u,4500)));
          pagesChecked+=pages.length;

          for(const page of pages){
            if(!page.html)continue;
            found=mhpMergeSignals(found,mhpExtractWebsiteSignals(page.html,page.url),canonical);

            for(const next of mhpContactCandidates(page.html,page.url)){
              try{
                if(new URL(next).origin===new URL(canonical).origin&&!seen.has(next)&&queue.length<24)queue.push(next);
              }catch{}
            }
          }
        }

        // Preserve the existing deep fallback when ordinary pages did not reveal
        // a public email.
        if(!found.email&&pagesChecked<MHP_SITE_PAGE_LIMIT){
          const siteUrls=await mhpSitemapCandidates(canonical);
          for(const url of siteUrls.slice(0,MHP_SITE_PAGE_LIMIT-pagesChecked)){
            if(seen.has(url))continue;
            seen.add(url);
            const page=await mhpFetchPage(url,4500);
            pagesChecked+=1;
            if(page.html)found=mhpMergeSignals(found,mhpExtractWebsiteSignals(page.html,page.url),canonical);
            if(found.email)break;
          }
        }

        delete found._emails;
        return found;
      });
    };
  }catch(e){}
})();
