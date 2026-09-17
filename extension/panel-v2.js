(()=>{
'use strict';
let state={leads:[],running:false,paused:false,phase:'Ready',status:'Ready.'};
let leads=[];
let toastTimer;
let settings={maxWorkers:6};
const SETTINGS_KEY='mhp_panel_settings';
const $=id=>document.getElementById(id);
const send=payload=>new Promise(resolve=>{try{chrome.runtime.sendMessage(payload,r=>resolve(r||{}))}catch(e){resolve({ok:false,error:e.message||String(e)})}});

function openPage(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
}
function toast(msg){const el=$('toast');if(!el)return;el.textContent=String(msg||'');el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function parseCities(){return [...new Set(String($('citiesInput')?.value||'').split(/[\n;،]+/).map(x=>x.trim()).filter(Boolean))]}
function fmtDate(v){if(!v)return 'No expiry';const raw=String(v);const d=new Date(raw.includes('T')?raw:raw.replace(' ','T')+'Z');return Number.isNaN(d.getTime())?raw:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function errorLabel(code){const map={INVALID_LICENSE:'Invalid activation code.',LICENSE_REVOKED:'This code has been revoked.',LICENSE_EXPIRED:'This code has expired.',DEVICE_LIMIT_REACHED:'This code has reached its device limit.',DEVICE_BLOCKED:'This device is blocked.',ACTIVATION_CODE_REQUIRED:'Enter an activation code first.',DAILY_LIMIT_REACHED:'Daily result limit reached.'};return map[code]||String(code||'Activation failed.')}
function isNetworkError(text){return /fetch|network|abort|failed/i.test(String(text||''))}

async function loadSettings(){
  try{
    const saved=await chrome.storage.local.get(SETTINGS_KEY);
    const raw=saved?.[SETTINGS_KEY]||{};
    settings.maxWorkers=Math.max(1,Math.min(8,Number(raw.maxWorkers||6)));
  }catch(e){settings.maxWorkers=6}
  renderSettings();
}
async function saveSettings(){
  settings.maxWorkers=Math.max(1,Math.min(8,Number($('workerCount')?.value||6)));
  try{await chrome.storage.local.set({[SETTINGS_KEY]:settings})}catch(e){}
  renderSettings();
}
function renderSettings(){
  if($('workerCount'))$('workerCount').value=String(settings.maxWorkers||6);
  if($('workerSummary'))$('workerSummary').textContent=`${settings.maxWorkers||6} ${Number(settings.maxWorkers||6)===1?'TAB':'TABS'}`;
}
async function resetSettings(){settings={maxWorkers:6};await saveSettings();toast('Extraction settings reset.');}

async function refreshLicense(showChecking=true){
  const box=$('licenseStatusBox');
  if(showChecking&&box){box.className='activation-state';box.innerHTML='<strong>Checking activation…</strong><span>Please wait.</span>'}
  const access=await send({type:'GET_LICENSE'});
  const input=$('licenseKey');if(input&&access.licenseKey&&!input.value)input.value=access.licenseKey;
  renderLicense(access);return access;
}
function renderLicense(access){
  const box=$('licenseStatusBox'),chip=$('licenseChip'),stateText=$('licenseStateText'),expires=$('expiresText');const ent=access?.entitlement,lic=ent?.license||{};
  if(ent?.valid){const date=lic.owner?'No expiry':fmtDate(lic.expiresAt);if(box){box.className='activation-state ok';box.innerHTML=`<strong>${lic.owner?'Owner Access active':'Activation successful'}</strong><span>${lic.owner?'Permanent owner access.':`Expires ${date}`}</span>`}if(chip){chip.className='license-chip ok';chip.textContent='Activated'}if(stateText)stateText.textContent='Active';if(expires)expires.textContent=date;return;}
  if(access?.licenseKey&&access?.validationError){const offline=isNetworkError(access.validationError),label=offline?'Cannot reach activation server':errorLabel(access.validationError);if(box){box.className='activation-state bad';box.innerHTML=`<strong>${label}</strong><span>${offline?'Check your internet connection and try again.':'Enter a valid code or contact support.'}</span>`}if(chip){chip.className='license-chip bad';chip.textContent=offline?'Offline':'Not active'}if(stateText)stateText.textContent=offline?'Offline':'Invalid';if(expires)expires.textContent='—';return;}
  if(box){box.className='activation-state bad';box.innerHTML='<strong>Not activated</strong><span>Enter the code you received after payment confirmation.</span>'}if(chip){chip.className='license-chip bad';chip.textContent='Not activated'}if(stateText)stateText.textContent='Inactive';if(expires)expires.textContent='—';
}
async function activateCode(){const code=String($('licenseKey')?.value||'').trim().toUpperCase();if(!code)return toast('Enter your activation code.');const btn=$('saveLicense');if(btn)btn.disabled=true;const res=await send({type:'SET_LICENSE',licenseKey:code});if(btn)btn.disabled=false;if(!res?.ok){toast(errorLabel(res?.error));await refreshLicense(false);return}toast('Activation successful.');await refreshLicense(false);}

async function startSearch(){
  if(state.paused){const r=await send({type:'RESUME_SCAN'});if(!r?.ok)return toast(errorLabel(r?.error));return}
  const keyword=String($('keyword')?.value||'').trim(),cities=parseCities();
  if(!keyword)return toast('Enter a business keyword.');
  if(!cities.length)return toast('Add at least one location.');
  const access=await refreshLicense(false);
  if(!access?.entitlement?.valid){openPage('licensePage');return toast('Activate the tool before starting a search.')}
  const btn=$('startBtn');if(btn)btn.disabled=true;
  const r=await send({type:'START_SCAN',keyword,cities,searchCountry:'',maxWorkers:Number(settings.maxWorkers||6),scanFirst:true,enrichWebsites:false});
  if(btn)btn.disabled=false;
  if(!r?.ok){toast(errorLabel(r?.error));if(/LICENSE|ACTIVATION|DEVICE|LIMIT/i.test(String(r?.error||'')))openPage('licensePage');}
}
async function stopSearch(){const r=await send({type:'STOP_SCAN'});if(!r?.ok)toast(r?.error||'Could not stop search.')}
async function skipCity(){const r=await send({type:'SKIP_CITY'});if(!r?.ok)toast(r?.error||'Could not skip location.');else toast(r.done?'No more locations.':`Opening ${r.next||'next location'}…`)}
async function clearResults(){if(!leads.length)return toast('No saved results.');const r=await send({type:'CLEAR_RESULTS'});if(r?.ok)toast('Results cleared.');}
function exportAction(action){if(!leads.length)return toast('No results to export.');const url=new URL(chrome.runtime.getURL('data.html'));if(action!=='sheet')url.searchParams.set('export',action);chrome.tabs.create({url:url.toString()})}

function renderState(next){
  state=next||state;leads=Array.isArray(state.leads)?state.leads:leads;
  const total=leads.length,phones=leads.filter(x=>x.phone).length,emails=leads.filter(x=>x.email||x.emails).length,social=leads.filter(x=>x.facebook||x.instagram||x.twitter||x.linkedin||x.youtube||x.tiktok||x.socialLinks).length;
  if($('leadCount'))$('leadCount').textContent=total;if($('tabLeadCount'))$('tabLeadCount').textContent=total;if($('resultTotal'))$('resultTotal').textContent=total;if($('phoneCount'))$('phoneCount').textContent=phones;if($('emailCount'))$('emailCount').textContent=emails;if($('socialCount'))$('socialCount').textContent=social;
  const running=Boolean(state.running),paused=Boolean(state.paused);document.body.classList.toggle('is-running',running);
  if($('phaseBadge'))$('phaseBadge').textContent=state.phase||'Ready';
  if($('statusTitle'))$('statusTitle').textContent=running?(state.phase||'Working…'):paused?'Search paused':total?'Search complete':'Ready to search';
  if($('statusText'))$('statusText').textContent=state.status||'Enter a keyword and at least one location.';
  const queued=Number(state.queued||0),processed=Number(state.processed||0);if($('progressBar'))$('progressBar').style.width=`${queued?Math.min(100,Math.round(processed/queued*100)):running?12:0}%`;
  if($('startBtn')){$('startBtn').disabled=running;$('startBtn').querySelector('span').textContent=paused?'Resume Search':'Start Search'}
  if($('stopBtn'))$('stopBtn').disabled=!running;if($('skipCityBtn'))$('skipCityBtn').disabled=!running;
  renderRecent();
}
function renderRecent(){const box=$('recentResults');if(!box)return;const rows=leads.slice(-5).reverse();if(!rows.length){box.innerHTML='<div class="empty-state">Your latest businesses will appear here.</div>';return}box.innerHTML=rows.map(x=>`<div class="recent-item"><div><strong>${escapeHtml(x.name||'Unnamed business')}</strong><span>${escapeHtml(x.address||x.category||'Google Maps result')}</span></div><b>${escapeHtml(x.phone||'—')}</b></div>`).join('')}
function escapeHtml(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

async function init(){
  document.querySelectorAll('.nav-tab').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
  $('startBtn')?.addEventListener('click',startSearch);$('stopBtn')?.addEventListener('click',stopSearch);$('skipCityBtn')?.addEventListener('click',skipCity);$('clearBtn')?.addEventListener('click',clearResults);$('saveLicense')?.addEventListener('click',activateCode);
  $('excelBtn')?.addEventListener('click',()=>exportAction('excel'));$('csvBtn')?.addEventListener('click',()=>exportAction('csv'));$('jsonBtn')?.addEventListener('click',()=>exportAction('json'));$('openSheetBtn')?.addEventListener('click',()=>exportAction('sheet'));
  $('licenseKey')?.addEventListener('keydown',e=>{if(e.key==='Enter')activateCode()});
  $('workerCount')?.addEventListener('change',saveSettings);$('resetSettings')?.addEventListener('click',resetSettings);
  await loadSettings();
  const current=await send({type:'GET_STATE'});renderState(current||{});await refreshLicense();
  chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='STATE_UPDATE')renderState(msg.state||{})});
  chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.mhp_license)refreshLicense(false);if(area==='local'&&changes[SETTINGS_KEY])loadSettings()});
}
document.addEventListener('DOMContentLoaded',init);
})();
