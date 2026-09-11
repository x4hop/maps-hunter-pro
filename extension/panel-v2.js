(()=>{
const style=document.createElement('style');
style.textContent=`.license-status{margin-top:7px;padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:var(--soft);display:grid;gap:3px}.license-status strong{font-size:10px;color:var(--brown)}.license-status small{font-size:8px;color:var(--muted);line-height:1.35}.license-status.ok{background:#f1faf5;border-color:#cce7d8}.license-status.bad{background:#fff3f1;border-color:#edcdc8}.license-status.wait{opacity:.78}.license-renew{display:inline-block;margin-top:3px;font-size:8px}.license-row input{text-transform:uppercase}`;
document.head.appendChild(style);
const accountUrl='https://maps-hunter-pro-preview.anas98gha.workers.dev/#account';
function ensureBox(){
 const row=document.querySelector('.license-row');if(!row)return null;
 let box=document.getElementById('licenseStatusBox');
 if(!box){box=document.createElement('div');box.id='licenseStatusBox';box.className='license-status wait';box.innerHTML='<strong>Checking activation…</strong><small>Your activation code is verified by the Maps Hunter Pro server.</small>';row.insertAdjacentElement('afterend',box);}
 const section=row.closest('section'),head=section?.querySelector('header');if(head){const a=head.querySelector('strong'),b=head.querySelector('span');if(a)a.textContent='Activation code';if(b)b.textContent='Code only — no account login inside the extension';}
 return box;
}
function fmtDate(v){if(!v)return 'No expiry';try{return new Date(v).toLocaleDateString()}catch{return String(v)}}
function render(access){
 const box=ensureBox();if(!box)return;
 const e=access?.entitlement;
 if(e?.valid){const l=e.license||{},owner=l.owner||l.planId==='owner',limit=l.dailyLeadLimit==null?'No daily platform limit':`${e.usedToday||0} / ${l.dailyLeadLimit} used today`;box.className='license-status ok';box.innerHTML=`<strong>${owner?'Owner Access':`${String(l.planId||'Active').replace(/^./,x=>x.toUpperCase())} plan`} · Active</strong><small>${limit}${owner?'':' · Expires '+fmtDate(l.expiresAt)}</small><a class="license-renew" href="${accountUrl}" target="_blank">${owner?'Manage platform':'Renew / manage subscription'}</a>`;return;}
 if(access?.licenseKey&&access?.validationError){box.className='license-status bad';const offline=/fetch|network|abort|failed/i.test(access.validationError);box.innerHTML=`<strong>${offline?'Connection unavailable':'Activation needs attention'}</strong><small>${offline?'Your saved results remain on this device and can still be exported. New extraction will resume after access can be verified.':String(access.validationError)}</small><a class="license-renew" href="${accountUrl}" target="_blank">Manage subscription</a>`;return;}
 box.className='license-status bad';box.innerHTML=`<strong>Not activated</strong><small>Paste your activation code above. No email or account login is required inside the extension.</small>`;
}
async function refresh(){const box=ensureBox();if(box){box.className='license-status wait';box.querySelector('strong').textContent='Checking activation…';}try{render(await chrome.runtime.sendMessage({type:'GET_LICENSE'}))}catch(e){render({licenseKey:true,validationError:e?.message||'Connection unavailable'})}}
document.addEventListener('DOMContentLoaded',()=>{ensureBox();setTimeout(refresh,120);const b=document.getElementById('saveLicense');if(b)b.addEventListener('click',()=>setTimeout(refresh,900));});
chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.mhp_license)setTimeout(refresh,100)});
})();
