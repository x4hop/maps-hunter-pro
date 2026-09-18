(()=>{
'use strict';
let state={leads:[],running:false,paused:false,phase:'Ready',status:'Ready.'};
let leads=[];
let toastTimer;
let settings={maxWorkers:6};
const SETTINGS_KEY='mhp_panel_settings',TAG_KEY='mhp_search_tags';
const tags={keywords:[],cities:[]};
const $=id=>document.getElementById(id);
const send=payload=>new Promise(resolve=>{try{chrome.runtime.sendMessage(payload,r=>resolve(r||{}))}catch(e){resolve({ok:false,error:e.message||String(e)})}});

function openPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));document.querySelectorAll('.nav-tab').forEach(b=>b.classList.toggle('active',b.dataset.page===id))}
function toast(msg){const el=$('toast');if(!el)return;el.textContent=String(msg||'');el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function escapeHtml(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function fmtDate(v){if(!v)return 'No expiry';const raw=String(v);const d=new Date(raw.includes('T')?raw:raw.replace(' ','T')+'Z');return Number.isNaN(d.getTime())?raw:d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function errorLabel(code){const map={INVALID_LICENSE:'Invalid activation code.',LICENSE_REVOKED:'This code has been revoked.',LICENSE_EXPIRED:'This code has expired.',DEVICE_LIMIT_REACHED:'This code has reached its device limit.',DEVICE_BLOCKED:'This device is blocked.',ACTIVATION_CODE_REQUIRED:'Enter an activation code first.',DAILY_LIMIT_REACHED:'Daily result limit reached.'};return map[code]||String(code||'Activation failed.')}
function isNetworkError(text){return /fetch|network|abort|failed/i.test(String(text||''))}

function normalizeTag(v){return String(v||'').replace(/\s+/g,' ').trim()}
function splitTags(v){return String(v||'').split(/[\n,;،]+/).map(normalizeTag).filter(Boolean)}
async function persistTags(){try{await chrome.storage.local.set({[TAG_KEY]:{keywords:tags.keywords,cities:tags.cities}})}catch{}}
function comboCount(){return tags.keywords.length*tags.cities.length}
function renderTags(kind){
  const list=$(kind==='keywords'?'keywordTagList':'cityTagList'),values=tags[kind];if(!list)return;
  list.innerHTML=values.map((v,i)=>`<button class="search-tag" type="button" data-kind="${kind}" data-index="${i}" title="Remove ${escapeHtml(v)}"><span>${escapeHtml(v)}</span><b>×</b></button>`).join('');
  if($('comboCount'))$('comboCount').textContent=String(comboCount());
}
function addTags(kind,values){
  const target=tags[kind];
  for(const raw of values){const v=normalizeTag(raw);if(v&&!target.some(x=>x.toLowerCase()===v.toLowerCase()))target.push(v)}
  renderTags(kind);persistTags();
}
function commitInput(kind,input){const values=splitTags(input.value);if(values.length)addTags(kind,values);input.value=''}
function setupTagInput(kind,inputId){
  const input=$(inputId);if(!input)return;
  input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();commitInput(kind,input)}else if(e.key==='Backspace'&&!input.value&&tags[kind].length){tags[kind].pop();renderTags(kind);persistTags()}});
  input.addEventListener('paste',e=>{const text=e.clipboardData?.getData('text')||'';if(/[\n,;،]/.test(text)){e.preventDefault();addTags(kind,splitTags(text));input.value=''}});
  input.addEventListener('blur',()=>{if(input.value.trim())commitInput(kind,input)});
}
async function loadTags(){
  try{const saved=await chrome.storage.local.get(TAG_KEY),raw=saved?.[TAG_KEY]||{};tags.keywords=Array.isArray(raw.keywords)?raw.keywords.map(normalizeTag).filter(Boolean):[];tags.cities=Array.isArray(raw.cities)?raw.cities.map(normalizeTag).filter(Boolean):[]}catch{}
  renderTags('keywords');renderTags('cities');
}

async function loadSettings(){try{const saved=await chrome.storage.local.get(SETTINGS_KEY),raw=saved?.[SETTINGS_KEY]||{};settings.maxWorkers=Math.max(1,Math.min(8,Number(raw.maxWorkers||6)))}catch{settings.maxWorkers=6}renderSettings()}
async function saveSettings(){settings.maxWorkers=Math.max(1,Math.min(8,Number($('workerCount')?.value||6)));try{await chrome.storage.local.set({[SETTINGS_KEY]:settings})}catch{}renderSettings()}
function renderSettings(){if($('workerCount'))$('workerCount').value=String(settings.maxWorkers||6);if($('workerSummary'))$('workerSummary').textContent=`${settings.maxWorkers||6} ${Number(settings.maxWorkers||6)===1?'tab':'tabs'}`}
async function resetSettings(){settings={maxWorkers:6};await saveSettings();toast('Extraction settings reset.')}

async function refreshLicense(showChecking=true){const box=$('licenseStatusBox');if(showChecking&&box){box.className='activation-state';box.innerHTML='<strong>Checking activation…</strong><span>Please wait.</span>'}const access=await send({type:'GET_LICENSE'});const input=$('licenseKey');if(input&&access.licenseKey&&!input.value)input.value=access.licenseKey;renderLicense(access);return access}
function renderLicense(access){const box=$('licenseStatusBox'),chip=$('licenseChip'),stateText=$('licenseStateText'),expires=$('expiresText');const ent=access?.entitlement,lic=ent?.license||{};if(ent?.valid){const date=lic.owner?'No expiry':fmtDate(lic.expiresAt);if(box){box.className='activation-state ok';box.innerHTML=`<strong>${lic.owner?'Owner Access active':'Activation successful'}</strong><span>${lic.owner?'Permanent owner access.':`Expires ${date}`}</span>`}if(chip){chip.className='license-chip ok';chip.textContent='Activated'}if(stateText)stateText.textContent='Active';if(expires)expires.textContent=date;return}if(access?.licenseKey&&access?.validationError){const offline=isNetworkError(access.validationError),label=offline?'Cannot reach activation server':errorLabel(access.validationError);if(box){box.className='activation-state bad';box.innerHTML=`<strong>${label}</strong><span>${offline?'Check your internet connection and try again.':'Enter a valid code or contact support.'}</span>`}if(chip){chip.className='license-chip bad';chip.textContent=offline?'Offline':'Not active'}if(stateText)stateText.textContent=offline?'Offline':'Invalid';if(expires)expires.textContent='—';return}if(box){box.className='activation-state bad';box.innerHTML='<strong>Not activated</strong><span>Enter the code you received after payment confirmation.</span>'}if(chip){chip.className='license-chip bad';chip.textContent='Not activated'}if(stateText)stateText.textContent='Inactive';if(expires)expires.textContent='—'}
async function activateCode(){const code=String($('licenseKey')?.value||'').trim().toUpperCase();if(!code)return toast('Enter your activation code.');const btn=$('saveLicense');if(btn)btn.disabled=true;const res=await send({type:'SET_LICENSE',licenseKey:code});if(btn)btn.disabled=false;if(!res?.ok){toast(errorLabel(res?.error));await refreshLicense(false);return}toast('Activation successful.');await refreshLicense(false)}

async function startSearch(){
  if(state.paused){const r=await send({type:'RESUME_SCAN'});if(!r?.ok)return toast(errorLabel(r?.error));return}
  if($('keywordInput')?.value.trim())commitInput('keywords',$('keywordInput'));if($('cityInput')?.value.trim())commitInput('cities',$('cityInput'));
  if(!tags.keywords.length)return toast('Add at least one business type tag.');if(!tags.cities.length)return toast('Add at least one location tag.');
  const access=await refreshLicense(false);if(!access?.entitlement?.valid){openPage('settingsPage');return toast('Activate the tool before starting a search.')}
  const btn=$('startBtn');if(btn)btn.disabled=true;
  const r=await send({type:'START_SCAN',keywords:[...tags.keywords],cities:[...tags.cities],searchCountry:'',maxWorkers:Number(settings.maxWorkers||6),scanFirst:true,enrichWebsites:true});
  if(btn)btn.disabled=false;if(!r?.ok){toast(errorLabel(r?.error));if(/LICENSE|ACTIVATION|DEVICE|LIMIT/i.test(String(r?.error||'')))openPage('settingsPage')}
}
async function stopScanOnly(){const r=await send({type:'STOP_SCAN_ONLY'});if(!r?.ok)toast(r?.error||'Could not stop scan.');else toast(`${r.queued||0} places ready to extract.`)}
async function startExtraction(){const type=state.paused?'RESUME_SCAN':'START_EXTRACTION';const r=await send({type});if(!r?.ok)toast(errorLabel(r?.error));else toast(state.paused?'Extraction resumed.':`Extraction started for ${r.pending||0} places.`)}
async function stopAll(){const r=await send({type:'STOP_ALL'});if(!r?.ok)toast(r?.error||'Could not stop everything.');else toast('All scanning and extraction stopped.')}
async function clearResults(){if(!leads.length)return toast('No saved results.');const r=await send({type:'CLEAR_RESULTS'});if(r?.ok)toast('Results cleared.')}
function exportAction(action){if(!leads.length)return toast('No results to export.');const url=new URL(chrome.runtime.getURL('data.html'));if(action!=='sheet')url.searchParams.set('export',action);chrome.tabs.create({url:url.toString()})}

function renderState(next){
  state=next||state;leads=Array.isArray(state.leads)?state.leads:leads;
  const total=leads.length,queued=Number(state.queued||0),processed=Number(state.processed||0),pending=Math.max(0,queued-processed);const phase=String(state.phase||'Ready'),running=Boolean(state.running),paused=Boolean(state.paused);const scanning=running&&/Opening Maps|Collecting|Scanning/i.test(phase),extracting=running&&/Extracting|Enriching|Paused/i.test(phase),readyToExtract=!running&&pending>0;const phones=leads.filter(x=>x.phone).length,emails=leads.filter(x=>x.email||x.emails).length,social=leads.filter(x=>x.facebook||x.instagram||x.twitter||x.linkedin||x.youtube||x.tiktok||x.socialLinks).length;
  const liveValue=(scanning||readyToExtract)?queued:total;if($('leadCount'))$('leadCount').textContent=liveValue;if($('tabLeadCount'))$('tabLeadCount').textContent=total;if($('resultTotal'))$('resultTotal').textContent=total;if($('phoneCount'))$('phoneCount').textContent=phones;if($('emailCount'))$('emailCount').textContent=emails;if($('socialCount'))$('socialCount').textContent=social;if($('liveMetricLabel'))$('liveMetricLabel').textContent=(scanning||readyToExtract)?'FOUND':'LEADS';if($('liveMetricSub'))$('liveMetricSub').textContent=(scanning||readyToExtract)?'links':'saved';
  document.body.classList.toggle('is-running',running);if($('phaseBadge'))$('phaseBadge').textContent=phase;if($('statusTitle'))$('statusTitle').textContent=scanning?'Scanning Google Maps':extracting?'Extracting + finding contacts':readyToExtract?'Ready to extract':paused?'Search paused':total?'Process complete':'Ready to scan';if($('statusText'))$('statusText').textContent=state.status||'Add tags and start scanning.';if($('progressBar'))$('progressBar').style.width=extracting&&queued?`${Math.min(100,Math.round(processed/queued*100))}%`:scanning?'18%':readyToExtract?'100%':'0%';
  if($('startBtn'))$('startBtn').disabled=running||paused;if($('stopScanBtn'))$('stopScanBtn').disabled=!scanning;if($('extractBtn')){$('extractBtn').disabled=running||(!paused&&pending<=0);const span=$('extractBtn').querySelector('span');if(span)span.textContent=paused?'Resume Extract':pending>0?`Start Extract · ${pending}`:'Start Extract'}if($('stopAllBtn'))$('stopAllBtn').disabled=!running&&pending<=0;renderRecent()
}
function renderRecent(){const box=$('recentResults');if(!box)return;const rows=leads.slice(-3).reverse();if(!rows.length){box.innerHTML='<div class="empty-state">Your latest businesses will appear here.</div>';return}box.innerHTML=rows.map(x=>{const contacts=[x.phone?'TEL':'',x.email||x.emails?'MAIL':'',x.facebook||x.instagram||x.twitter||x.linkedin||x.youtube||x.tiktok||x.socialLinks?'SOCIAL':''].filter(Boolean).join(' · ')||'MAPS';return `<div class="recent-item"><div><strong>${escapeHtml(x.name||'Unnamed business')}</strong><span>${escapeHtml([x.searchKeyword,x.searchCity].filter(Boolean).join(' · ')||x.address||x.category||'Google Maps result')}</span></div><b>${contacts}</b></div>`}).join('')}

async function init(){
  document.querySelectorAll('.nav-tab').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.page)));
  document.addEventListener('click',e=>{const chip=e.target.closest('.search-tag');if(!chip)return;const kind=chip.dataset.kind,index=Number(chip.dataset.index);if(!tags[kind]||!Number.isInteger(index))return;tags[kind].splice(index,1);renderTags(kind);persistTags()});
  setupTagInput('keywords','keywordInput');setupTagInput('cities','cityInput');
  $('startBtn')?.addEventListener('click',startSearch);$('stopScanBtn')?.addEventListener('click',stopScanOnly);$('extractBtn')?.addEventListener('click',startExtraction);$('stopAllBtn')?.addEventListener('click',stopAll);$('clearBtn')?.addEventListener('click',clearResults);$('saveLicense')?.addEventListener('click',activateCode);
  $('excelBtn')?.addEventListener('click',()=>exportAction('excel'));$('csvBtn')?.addEventListener('click',()=>exportAction('csv'));$('jsonBtn')?.addEventListener('click',()=>exportAction('json'));$('openSheetBtn')?.addEventListener('click',()=>exportAction('sheet'));
  $('licenseKey')?.addEventListener('keydown',e=>{if(e.key==='Enter')activateCode()});$('workerCount')?.addEventListener('change',saveSettings);$('resetSettings')?.addEventListener('click',resetSettings);
  await Promise.all([loadSettings(),loadTags()]);const current=await send({type:'GET_STATE'});renderState(current||{});await refreshLicense();chrome.runtime.onMessage.addListener(msg=>{if(msg?.type==='STATE_UPDATE')renderState(msg.state||{})});chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes.mhp_license)refreshLicense(false);if(area==='local'&&changes[SETTINGS_KEY])loadSettings()})
}
document.addEventListener('DOMContentLoaded',init);
})();
