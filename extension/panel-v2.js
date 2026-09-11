(()=>{
const style=document.createElement('style');
style.textContent=`.license-status{margin-top:7px;padding:8px 9px;border:1px solid var(--line);border-radius:9px;background:var(--soft);display:grid;gap:3px}.license-status strong{font-size:10px;color:var(--brown)}.license-status small{font-size:8px;color:var(--muted);line-height:1.35}.license-status.ok{background:#f1faf5;border-color:#cce7d8}.license-status.bad{background:#fff3f1;border-color:#edcdc8}.license-status.wait{opacity:.78}.license-row input{text-transform:uppercase}`;
document.head.appendChild(style);
function ensureBox(){
 const row=document.querySelector('.license-row');if(!row)return null;
 let box=document.getElementById('licenseStatusBox');
 if(!box){box=document.createElement('div');box.id='licenseStatusBox';box.className='license-status wait';box.innerHTML='<strong>Checking activation…</strong><small>Only your activation code is required.</small>';row.insertAdjacentElement('afterend',box)}
 const section=row.closest('section'),head=section?.querySelector('header');if(head){const a=head.querySelector('strong'),b=head.querySelector('span');if(a)a.textContent='Activation code';if(b)b.textContent='Enter your code to activate this device'}
 return box;
}
function fmtDate(v){if(!v)return 'No expiry';try{return new Date(v.endsWith?.('Z')?v:v+'Z').toLocaleDateString()}catch{return String(v)}}
function render(access){
 const box=ensureBox();if(!box)return;const e=access?.entitlement;
 if(e?.valid){const l=e.license||{};box.className='license-status ok';box.innerHTML=l.owner?'<strong>Owner Access · Active</strong><small>No expiry</small>':`<strong>Activated</strong><small>Expires: ${fmtDate(l.expiresAt)}</small>`;return}
 if(access?.licenseKey&&access?.validationError){box.className='license-status bad';const offline=/fetch|network|abort|failed/i.test(access.validationError);box.innerHTML=`<strong>${offline?'Connection unavailable':'Activation problem'}</strong><small>${offline?'Saved results can still be exported. New extraction needs a successful license check.':String(access.validationError)}</small>`;return}
 box.className='license-status bad';box.innerHTML='<strong>Not activated</strong><small>Paste the activation code you received after payment verification.</small>';
}
async function refresh(){const box=ensureBox();if(box){box.className='license-status wait';box.querySelector('strong').textContent='Checking activation…'}try{render(await chrome.runtime.sendMessage({type:'GET_LICENSE'}))}catch(e){render({licenseKey:true,validationError:e?.message||'Connection unavailable'})}}
document.addEventListener('DOMContentLoaded',()=>{ensureBox();setTimeout(refresh,120);const b=document.getElementById('saveLicense');if(b)b.addEventListener('click',()=>setTimeout(refresh,900))});
chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.mhp_license)setTimeout(refresh,100)});
})();