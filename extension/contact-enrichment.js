// Maps Hunter Pro v8.4.7 — stronger background email/social discovery.
// Business websites are NEVER opened as tabs. Public HTML is fetched in the extension worker.
let mhpContactActive = 0;
const mhpContactWaiters = [];
const MHP_CONTACT_CONCURRENCY = 5;
const MHP_SITE_PAGE_LIMIT = 12;

async function mhpWithContactSlot(fn){
  if(mhpContactActive >= MHP_CONTACT_CONCURRENCY){
    await new Promise(resolve => mhpContactWaiters.push(resolve));
  }
  mhpContactActive += 1;
  try { return await fn(); }
  finally {
    mhpContactActive = Math.max(0, mhpContactActive - 1);
    const next = mhpContactWaiters.shift();
    if(next) next();
  }
}

function mhpDecodeCfEmail(hex){
  try{
    const value=String(hex||'').replace(/[^0-9a-f]/gi,'');
    if(value.length<4||value.length%2) return '';
    const key=parseInt(value.slice(0,2),16);let out='';
    for(let i=2;i<value.length;i+=2) out+=String.fromCharCode(parseInt(value.slice(i,i+2),16)^key);
    return out;
  }catch{return ''}
}

function mhpDecodeText(value){
  let s=String(value||'').replace(/[\u200B-\u200D\uFEFF]/g,'');
  s=s.replace(/\\x40|\\u0040/gi,'@').replace(/\\x2e|\\u002e/gi,'.');
  s=s.replace(/&#x40;|&#64;|&commat;/gi,'@').replace(/&#x2e;|&#46;/gi,'.');
  s=s.replace(/&#(\d+);/g,(_,n)=>{try{return String.fromCharCode(Number(n))}catch{return _}});
  s=s.replace(/&#x([0-9a-f]+);/gi,(_,n)=>{try{return String.fromCharCode(parseInt(n,16))}catch{return _}});
  s=s.replace(/&nbsp;|&ensp;|&emsp;/gi,' ');
  s=s.replace(/\s*(?:\[at\]|\(at\)|\{at\}|\sat\s|\[ät\]|\(ät\)|\sät\s|\[arroba\]|\(arroba\)|\sarroba\s)\s*/gi,'@');
  s=s.replace(/\s*(?:\[dot\]|\(dot\)|\{dot\}|\sdot\s|\[punkt\]|\(punkt\)|\spunkt\s|\[punto\]|\(punto\)|\spunto\s|\[point\]|\(point\)|\spoint\s)\s*/gi,'.');
  s=s.replace(/\s*@\s*/g,'@');
  s=s.replace(/([a-z0-9])\s*\.\s*([a-z]{2,})(?=\b|[\/?#])/gi,'$1.$2');
  try{ if(/%40|%2e|%5b|%5d/i.test(s)) s=decodeURIComponent(s); }catch{}
  // Common JavaScript string concatenation: "info" + "@" + "domain.com".
  s=s.replace(/(["'])\s*\+\s*\1/g,'');
  s=s.replace(/(["'])\s*\+\s*(["'])/g,'');
  return s;
}

function mhpUnique(values){return Array.from(new Set((values||[]).map(v=>String(v||'').trim()).filter(Boolean)))}
function mhpNormalizeEmail(value){
  return String(value||'').trim().toLowerCase().replace(/^mailto:/i,'').replace(/[?&#].*$/,'').replace(/^[<({\[]+|[>)}\],.;:]+$/g,'');
}
function mhpValidEmail(value){
  const e=mhpNormalizeEmail(value);
  if(!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(e)) return false;
  if(/\.(png|jpe?g|gif|webp|svg|css|js|woff2?|ttf|ico)$/i.test(e)) return false;
  if(/^(example|test|user|name)@example\./i.test(e)) return false;
  if(/^(?:no-?reply|do-?not-?reply|mailer-daemon)@/i.test(e)) return false;
  if(/(?:sentry|wixpress|cloudflare|schema\.org|wordpress\.com)$/i.test(e.split('@')[1]||'')) return false;
  return true;
}
function mhpHostRelated(email, pageUrl){
  try{
    const host=new URL(pageUrl).hostname.replace(/^www\./i,'').toLowerCase();
    const domain=String(email).split('@')[1]?.toLowerCase()||'';
    return Boolean(domain && (host===domain || host.endsWith('.'+domain) || domain.endsWith('.'+host)));
  }catch{return false}
}
function mhpEmailScore(email, pageUrl){
  const e=mhpNormalizeEmail(email), local=e.split('@')[0]||'';
  let score=mhpHostRelated(e,pageUrl)?40:0;
  if(/^(info|contact|hello|office|mail|sales|support|service|booking|reserv|reception|praxis|team|admin|enquir|inquir)/i.test(local)) score+=16;
  if(/(noreply|no-reply|donotreply|do-not-reply|mailer-daemon)/i.test(local)) score-=100;
  if(/(privacy|dpo|datenschutz|legal)/i.test(local)) score-=3;
  return score;
}

function mhpCleanWebsiteUrl(input){
  let value=String(input||'').trim();
  if(!value) return '';
  try{
    let u=new URL(value);
    if(/(^|\.)google\./i.test(u.hostname)){
      const candidate=u.searchParams.get('url')||u.searchParams.get('q')||u.searchParams.get('u');
      if(candidate && /^https?:\/\//i.test(candidate)) u=new URL(candidate);
    }
    u.hash='';
    return u.href;
  }catch{return /^https?:\/\//i.test(value)?value:''}
}

async function mhpFetchPage(url, timeoutMs=5000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch(url,{redirect:'follow',signal:controller.signal,cache:'no-store',credentials:'omit',headers:{Accept:'text/html,application/xhtml+xml,text/plain,application/xml;q=0.9,*/*;q=0.2'}});
    const type=String(res.headers.get('content-type')||'');
    if(!res.ok||!/html|text|xml|json/i.test(type)) return {html:'',url:res.url||url};
    return {html:(await res.text()).slice(0,800000),url:res.url||url};
  }catch{return {html:'',url}}
  finally{clearTimeout(timer)}
}

function mhpExtractWebsiteSignals(html, baseUrl=''){
  const raw=String(html||'');
  const decoded=mhpDecodeText(raw);
  const candidates=[];
  const addEmail=v=>{const e=mhpNormalizeEmail(v);if(mhpValidEmail(e))candidates.push(e)};

  for(const m of decoded.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) addEmail(m[0]);
  for(const m of decoded.matchAll(/mailto:([^\s"'<>?#]+)/gi)) { try{addEmail(decodeURIComponent(m[1]))}catch{addEmail(m[1])} }
  for(const m of raw.matchAll(/data-cfemail=["']([0-9a-f]+)["']/gi)) addEmail(mhpDecodeCfEmail(m[1]));
  for(const m of raw.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) addEmail(mhpDecodeCfEmail(m[1]));

  // JavaScript char-code obfuscation such as String.fromCharCode(105,110,102,111,64,...).
  for(const m of raw.matchAll(/String\.(?:fromCharCode|fromCodePoint)\(\s*([0-9,\s]{8,500})\s*\)/gi)){
    try{
      const nums=m[1].split(',').map(x=>Number(x.trim())).filter(n=>Number.isFinite(n)&&n>=0&&n<=1114111);
      if(nums.length>=5){
        const text=String.fromCodePoint(...nums);
        for(const em of mhpDecodeText(text).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))addEmail(em[0]);
      }
    }catch{}
  }

  // Some templates store mail addresses as short base64 strings in data/script attributes.
  for(const m of raw.matchAll(/["']([A-Za-z0-9+/]{16,180}={0,2})["']/g)){
    try{
      const decoded=atob(m[1]);
      if(decoded.length>5&&decoded.length<140&&decoded.includes('@')){
        for(const em of mhpDecodeText(decoded).matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))addEmail(em[0]);
      }
    }catch{}
  }

  // data-user="info" data-domain="domain.com" patterns (either order).
  for(const m of raw.matchAll(/data-(?:user|name)=["']([^"']+)["'][^>]{0,220}data-(?:domain|host)=["']([^"']+)["']/gi)) addEmail(`${m[1]}@${m[2]}`);
  for(const m of raw.matchAll(/data-(?:domain|host)=["']([^"']+)["'][^>]{0,220}data-(?:user|name)=["']([^"']+)["']/gi)) addEmail(`${m[2]}@${m[1]}`);

  // Common reversed-string protection. Only inspect short quoted tokens to avoid noise.
  for(const m of raw.matchAll(/["']([^"'\r\n]{6,100})["']/g)){
    const token=m[1];
    if(!token.includes('@') && !token.includes('ta]') && !token.includes('ta)')) continue;
    const rev=mhpDecodeText(token.split('').reverse().join(''));
    for(const em of rev.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) addEmail(em[0]);
  }

  const emails=mhpUnique(candidates).sort((a,b)=>mhpEmailScore(b,baseUrl)-mhpEmailScore(a,baseUrl));
  const urls=[];
  const addUrl=v=>{
    let x=String(v||'').trim().replace(/&amp;/gi,'&');
    if(!x||/^(javascript:|mailto:|tel:|#)/i.test(x))return;
    try{x=new URL(x,baseUrl||undefined).href}catch{return}
    if(/^https?:\/\//i.test(x))urls.push(x);
  };
  for(const m of decoded.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) addUrl(m[1]);
  for(const m of decoded.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi)) addUrl(m[0]);
  const uniqueUrls=mhpUnique(urls);
  const pick=re=>uniqueUrls.find(u=>re.test(u)&&!/share|intent|sharer|plugins|dialog|oauth/i.test(u))||'';
  const facebook=pick(/facebook\.com|fb\.com/i);
  const instagram=pick(/instagram\.com/i);
  const twitter=pick(/(?:twitter\.com|x\.com)/i);
  const linkedin=pick(/linkedin\.com/i);
  const youtube=pick(/youtube\.com|youtu\.be/i);
  const tiktok=pick(/tiktok\.com/i);
  const socialLinks=mhpUnique([facebook,instagram,twitter,linkedin,youtube,tiktok]).join(' | ');
  return {email:emails[0]||'',emails:emails.slice(0,12).join(' | '),facebook,instagram,twitter,linkedin,youtube,tiktok,socialLinks,urls:uniqueUrls};
}

const MHP_CONTACT_WORDS=/(contact|contact-us|contacts|kontakt|impressum|imprint|legal-notice|legal|mentions-legales|aviso-legal|about|about-us|team|support|help|customer-service|contatti|contatto|contacto|contactos|contato|fale-conosco|iletisim|nous-contacter|ueber-uns|uber-uns|quienes-somos|chi-siamo|company|empresa|اتصل|تواصل|من-نحن)/i;
function mhpContactCandidates(html, rootUrl){
  const scored=[];
  const decoded=mhpDecodeText(html);
  for(const m of decoded.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,220}?)<\/a>/gi)){
    const href=m[1], label=String(m[2]||'').replace(/<[^>]+>/g,' ');
    if(!MHP_CONTACT_WORDS.test(href+' '+label)) continue;
    try{
      const u=new URL(href,rootUrl); if(u.origin!==new URL(rootUrl).origin) continue;
      let score=1;
      if(/contact|kontakt|contacto|contatti|contato|iletisim|اتصل|تواصل/i.test(href+' '+label))score+=8;
      if(/impressum|imprint|legal-notice/i.test(href+' '+label))score+=6;
      if(/about|team|ueber|uber|quienes/i.test(href+' '+label))score+=3;
      scored.push([u.href,score]);
    }catch{}
  }
  try{
    const u=new URL(rootUrl),origin=u.origin;
    const common=['/contact','/contact-us','/contacts','/kontakt','/impressum','/imprint','/legal-notice','/mentions-legales','/aviso-legal','/about','/about-us','/team','/support','/help','/contacto','/contactos','/contatti','/contatto','/contato','/fale-conosco','/iletisim','/nous-contacter','/ueber-uns','/uber-uns','/quienes-somos'];
    common.forEach((path,i)=>scored.push([origin+path,Math.max(1,7-Math.floor(i/3))]));
  }catch{}
  const best=new Map();
  for(const [url,score] of scored)best.set(url,Math.max(score,best.get(url)||0));
  return [...best].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
}

function mhpMergeSignals(all, next, pageUrl){
  const emailPool=mhpUnique([...(all._emails||[]),...String(next?.emails||next?.email||'').split('|').map(x=>x.trim())]).filter(mhpValidEmail);
  emailPool.sort((a,b)=>mhpEmailScore(b,pageUrl)-mhpEmailScore(a,pageUrl));
  all._emails=emailPool;
  all.email=emailPool[0]||all.email||'';
  all.emails=emailPool.slice(0,12).join(' | ');
  for(const key of ['facebook','instagram','twitter','linkedin','youtube','tiktok']) if(!all[key]&&next?.[key])all[key]=next[key];
  all.socialLinks=mhpUnique([all.facebook,all.instagram,all.twitter,all.linkedin,all.youtube,all.tiktok]).join(' | ');
  return all;
}

async function mhpSitemapCandidates(rootUrl){
  try{
    const origin=new URL(rootUrl).origin;
    const sitemapSeeds=[origin+'/sitemap.xml',origin+'/sitemap_index.xml'];
    const robots=await mhpFetchPage(origin+'/robots.txt',3000);
    for(const m of String(robots.html||'').matchAll(/^\s*Sitemap:\s*(https?:\/\/\S+)/gim))sitemapSeeds.push(m[1].trim());
    const seenMaps=new Set(), found=[];
    const queue=mhpUnique(sitemapSeeds).slice(0,5);
    while(queue.length && seenMaps.size<6 && found.length<8){
      const mapUrl=queue.shift();if(seenMaps.has(mapUrl))continue;seenMaps.add(mapUrl);
      const {html}=await mhpFetchPage(mapUrl,3500);if(!html)continue;
      for(const m of html.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)){
        const url=mhpDecodeText(m[1]).trim();if(!/^https?:\/\//i.test(url))continue;
        if(/\.xml(?:$|\?)/i.test(url)){if(queue.length<8)queue.push(url);continue}
        if(MHP_CONTACT_WORDS.test(url))found.push(url);
      }
    }
    return mhpUnique(found).slice(0,6);
  }catch{return[]}
}

enrichFromWebsite = async function(website){
  const root=mhpCleanWebsiteUrl(website);
  if(!root)return{};
  return mhpWithContactSlot(async()=>{
    const first=await mhpFetchPage(root,5600);
    if(!first.html)return{};
    const canonical=first.url||root;
    let found=mhpMergeSignals({},mhpExtractWebsiteSignals(first.html,canonical),canonical);
    let pagesChecked=1;

    // Breadth-first contact discovery. Contact pages often link to imprint/team pages that hold the actual email.
    const queue=mhpContactCandidates(first.html,canonical).filter(u=>u!==canonical);
    const seen=new Set([canonical]);
    while(queue.length && pagesChecked<MHP_SITE_PAGE_LIMIT-3){
      if(found.email && found.socialLinks)break;
      const batch=[];
      while(queue.length && batch.length<3 && pagesChecked+batch.length<MHP_SITE_PAGE_LIMIT-3){
        const u=queue.shift();if(!u||seen.has(u))continue;seen.add(u);batch.push(u);
      }
      if(!batch.length)break;
      const pages=await Promise.all(batch.map(u=>mhpFetchPage(u,4500)));
      pagesChecked+=pages.length;
      for(const page of pages){
        if(!page.html)continue;
        found=mhpMergeSignals(found,mhpExtractWebsiteSignals(page.html,page.url),canonical);
        for(const next of mhpContactCandidates(page.html,page.url)){
          try{if(new URL(next).origin===new URL(canonical).origin&&!seen.has(next)&&queue.length<24)queue.push(next)}catch{}
        }
      }
    }

    // Final fallback: robots.txt + sitemap indexes can reveal contact/legal pages hidden from navigation.
    if(!found.email && pagesChecked<MHP_SITE_PAGE_LIMIT){
      const siteUrls=await mhpSitemapCandidates(canonical);
      for(const url of siteUrls.slice(0,MHP_SITE_PAGE_LIMIT-pagesChecked)){
        if(seen.has(url))continue;seen.add(url);
        const page=await mhpFetchPage(url,4500);pagesChecked+=1;
        if(page.html)found=mhpMergeSignals(found,mhpExtractWebsiteSignals(page.html,page.url),canonical);
        if(found.email)break;
      }
    }
    delete found._emails;
    return found;
  });
};

enrichLeadInBackground = function(lead, workerRunId){
  if(!lead?.website)return undefined;
  const task=enrichFromWebsite(lead.website).then(extra=>{
    if(workerRunId!==scanRunId||!extra)return;
    const merged=mergeLead(lead,extra);
    addLead(merged);
    if(extra.email||extra.emails) state.status=`Email found for ${merged.name||'business'}. Saved ${state.leads.length}.`;
    else state.status=`Contact pages checked for ${merged.name||'business'}; no public email found.`;
    broadcast(true).catch(()=>{});
  }).catch(()=>{}).finally(async()=>{
    pendingEnrichment.delete(task);
    if(workerRunId===scanRunId)await maybeNextCity();
  });
  pendingEnrichment.add(task);
  return task;
};
