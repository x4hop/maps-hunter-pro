// Maps Hunter Pro v1.0.0 — faster post-scan pipeline.
// Maps tabs are released as soon as Maps data is captured; email/social discovery
// continues in the extension worker without blocking the next Maps place.
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

  // Website contact discovery is network-bound, so it can safely run with more
  // concurrency than visible Maps detail tabs.
  try{
    mhpWithContactSlot=async function(fn){
      const limit=8;
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

  // Replace the legacy email-first blocking worker. The Maps result is committed
  // immediately; deep contact lookup is attached as a background enrichment task.
  try{
    processPlace=async function(preview,workerRunId=scanRunId){
      let tab=null;
      const key=preview.mapsUrl||`${preview.name}|${preview.address}`;
      try{
        state.phase='Extracting';
        state.status=`Extracting: ${preview.name||'place'}`;
        await broadcast();

        tab=await chromeTabsCreate({url:preview.mapsUrl,active:false});
        workerTabs.add(tab.id);
        await persistRuntime();
        await waitForTabComplete(tab.id,3000);
        await waitForPlaceContent(tab.id,4200);
        await sleep(150);

        let details=await extractFromMapsTab(tab.id);
        if(!details.phone&&!details.website){
          await sleep(350);
          details=mergeLead(details,await extractFromMapsTab(tab.id));
        }

        if(workerRunId!==scanRunId||!state.running)return;
        const lead=mergeLead(preview,details);

        // The Maps tab is no longer needed once the detail DOM has been read.
        // Close it before usage accounting/contact crawling so browser resources
        // are released immediately.
        if(tab?.id){
          try{await chromeTabsRemove(tab.id)}catch(e){}
          workerTabs.delete(tab.id);
          tab=null;
          await persistRuntime();
        }

        preview.usageRequestId||=crypto.randomUUID();
        inFlightItems.set(key,preview);
        await persistRuntime();
        await MHPAccess.consume(preview.usageRequestId);
        if(workerRunId!==scanRunId||!state.running)return;

        addLead(lead);
        processedKeys.add(key);

        if(lead.website&&state.enrichWebsites){
          enrichLeadInBackground(lead,workerRunId);
          state.status=`Saved ${state.leads.length}. Finding email in background. Queue ${queue.length}.`;
        }else{
          state.status=`Saved ${state.leads.length}. Queue ${queue.length}.`;
        }
      }catch(error){
        if(error.accessError&&workerRunId===scanRunId){await pauseScan(error.message,preview);return}
        if(workerRunId===scanRunId&&state.running){
          try{
            preview.usageRequestId||=crypto.randomUUID();
            inFlightItems.set(key,preview);
            await persistRuntime();
            await MHPAccess.consume(preview.usageRequestId);
          }catch(access){
            if(access.accessError){await pauseScan(access.message,preview);return}
          }
          addLead(preview);
          processedKeys.add(key);
          state.status=`Saved preview after detail error. Queue ${queue.length}.`;
        }
      }finally{
        if(tab?.id){
          try{await chromeTabsRemove(tab.id)}catch(e){}
          workerTabs.delete(tab.id);
          await persistRuntime();
        }
      }
    };
  }catch(e){}
})();
