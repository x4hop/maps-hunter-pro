importScripts("license-client.js");
const state = {
  running: false,
  phase: "Ready",
  status: "Ready.",
  keyword: "",
  cities: [],
  cityIndex: 0,
  activeTabId: null,
  leads: [],
  queued: 0,
  processed: 0,
  maxWorkers: 6,
  scanFirst: true,
  enrichWebsites: false,
  paused: false
};

let queue = [];
let queuedKeys = new Set();
let processedKeys = new Set();
let workerTabs = new Set();
let activeWorkers = 0;
let maxWorkers = 6;
let collectionDone = false;
let scanRunId = 0;
let collectorSessionId = 0;
let inFlightItems = new Map();
let lastCollectorMessageAt = 0;
let pendingEnrichment = new Set();
let licenseState = null;
const backgroundReady = initializeState();

chrome.runtime.onInstalled.addListener(async () => {
  await backgroundReady;
  try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }); } catch (e) {}
  await broadcast(true);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      await backgroundReady;
      if (message?.type === "SET_LICENSE") return sendResponse(await MHPAccess.save(message.licenseKey));
      if (message?.type === "GET_LICENSE") return sendResponse(await MHPAccess.status());
      if (message?.type === "GET_STATE") return sendResponse({ ...state });
      if (message?.type === "START_SCAN") return sendResponse(await startScan(message));
      if (message?.type === "RESUME_SCAN") return sendResponse(await resumeScan());
      if (message?.type === "STOP_SCAN") return sendResponse(await stopScan("Stopped by user."));
      if (message?.type === "SKIP_SCAN_CITY") return sendResponse(await skipScanCity());
      if (message?.type === "SKIP_CITY") return sendResponse(await skipCity());
      if (message?.type === "CLEAR_RESULTS") return sendResponse(await clearResults());
      if (message?.type === "PLACES_BATCH") {
        if (message.sessionId !== collectorSessionId) return sendResponse({ ok: true, ignored: true });
        lastCollectorMessageAt = Date.now();
        enqueuePlaces(message.places || []);
        await persistRuntime();
        if (!state.scanFirst) runWorkers();
        else state.status = `Scanning ${state.cities[state.cityIndex] || "city"} first: ${state.queued} links collected.`;
        await broadcast();
        return sendResponse({ ok: true });
      }
      if (message?.type === "COLLECT_PROGRESS") {
        if (message.sessionId !== collectorSessionId) return sendResponse({ ok: true, ignored: true });
        lastCollectorMessageAt = Date.now();
        state.queued = queuedKeys.size;
        state.status = `Collecting links: ${state.queued}`;
        await broadcast();
        return sendResponse({ ok: true });
      }
      if (message?.type === "CONTENT_STATUS") {
        if (message.sessionId && message.sessionId !== collectorSessionId) return sendResponse({ ok: true, ignored: true });
        lastCollectorMessageAt = Date.now();
        state.status = message.status || state.status;
        await broadcast();
        return sendResponse({ ok: true });
      }
      if (message?.type === "COLLECT_DONE") {
        if (message.sessionId !== collectorSessionId) return sendResponse({ ok: true, ignored: true });
        lastCollectorMessageAt = Date.now();
        collectionDone = true;
        state.phase = "Extracting";
        state.status = `Final scan wait completed. Extracting ${queue.length} pending places.`;
        runWorkers();
        await maybeNextCity();
        await broadcast();
        return sendResponse({ ok: true });
      }
      sendResponse({ ok: false, error: "Unknown message type" });
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();
  return true;
});

async function startScan(message) {
  licenseState = await MHPAccess.validate();
  await stopScan("Restarting.", true);
  state.running = true;
  state.phase = "Opening Maps";
  state.status = "Opening Google Maps search...";
  state.keyword = clean(message.keyword);
  state.cities = Array.isArray(message.cities) ? message.cities.map(clean).filter(Boolean) : [];
  state.searchCountry = clean(message.searchCountry);
  state.cityIndex = 0;
  state.leads = [];
  state.queued = 0;
  state.processed = 0;
  state.scanFirst = message.scanFirst !== false;
  state.enrichWebsites = message.enrichWebsites === true;
  state.paused = false;
  queue = [];
  queuedKeys = new Set();
  processedKeys = new Set();
  inFlightItems = new Map();
  maxWorkers = Math.max(1, Math.min(8, Number(message.maxWorkers || 6)));
  state.maxWorkers = maxWorkers;
  await broadcast(true);

  if (!state.keyword || !state.cities.length) throw new Error("Keyword and city are required.");
  await openCitySearch();
  return { ok: true };
}

async function openCitySearch() {
  if (!state.running) return;
  const city = state.cities[state.cityIndex];
  collectorSessionId += 1;
  collectionDone = false;
  state.phase = "Collecting";
  const cityQuery = buildCityQuery(state.keyword, city, state.searchCountry);
  state.status = state.scanFirst
    ? `Scanning ${state.keyword} in ${city} before extraction...`
    : `Searching ${state.keyword} in ${city}...`;
  await broadcast();

  const url = `https://www.google.com/maps/search/${encodeURIComponent(cityQuery)}?hl=en`;
  let tab = await getActiveTab();
  if (!tab?.id) tab = await chromeTabsCreate({ url, active: true });
  else tab = await chromeTabsUpdate(tab.id, { url, active: true });
  state.activeTabId = tab.id;
  await persist();

  await waitForTabComplete(tab.id, 30000);
  await sleep(1200);
  await launchCollector(tab.id, collectorSessionId);
}

async function launchCollector(tabId, sessionId) {
  try {
    const injected = await injectCollector(tabId);
    if (!injected) throw new Error("Could not inject the Maps collector.");
    lastCollectorMessageAt = Date.now();
    withTimeout(
      chromeTabsSendMessage(tabId, { type: "COLLECT_PLACES", maxRounds: 75, sessionId }),
      125000,
      "Maps collector exceeded its safety timeout."
    ).catch(error => handleCollectorFailure(error, sessionId));
  } catch (error) {
    await handleCollectorFailure(error, sessionId);
  }
}

async function handleCollectorFailure(error, sessionId) {
  if (sessionId !== collectorSessionId || !state.running) return;
  collectionDone = true;
  if (state.activeTabId) {
    try { await chromeTabsSendMessage(state.activeTabId, { type: "STOP_COLLECTING" }); } catch (e) {}
  }
  state.phase = "Extracting";
  state.status = `Maps collector stopped unexpectedly. Continuing with ${queue.length} collected places.`;
  await broadcast();
  if (queue.length) runWorkers();
  else await maybeNextCity();
}


function buildCityQuery(keyword, city, countryCode) {
  const safeKeyword = clean(keyword);
  const safeCity = clean(city);
  // Use "near" so Google Maps keeps the search tied to the selected city instead of broadening globally.
  const names={"218":"Libya","49":"Germany","962":"Jordan","968":"Oman","7":"Russia","34":"Spain","1":"United States","44":"United Kingdom","20":"Egypt","966":"Saudi Arabia","971":"United Arab Emirates"};
  const country=names[clean(countryCode)]||"";
  return `${safeKeyword} near ${safeCity}${country&&!safeCity.toLowerCase().includes(country.toLowerCase())?`, ${country}`:""}`;
}

async function maybeNextCity() {
  if (!state.running) return;
  if (queue.length || activeWorkers) return;
  // Never leave the current city while its collector may still deliver more places.
  // This also prevents a race when "Scan links first" is disabled and workers drain the queue early.
  if (!collectionDone) return;
  if (pendingEnrichment.size) { state.phase = "Enriching"; state.status = `Waiting for ${pendingEnrichment.size} website lookups...`; await broadcast(); return; }
  if (state.cityIndex < state.cities.length - 1) {
    state.cityIndex += 1;
    await openCitySearch();
    return;
  }
  state.running = false;
  state.phase = "Completed";
  state.status = `Completed. Saved ${state.leads.length} leads.`;
  await persist();
  await broadcast();
}

function enqueuePlaces(places) {
  for (const raw of Array.isArray(places) ? places : []) {
    const lead = normalizeLead({...raw,searchCity:state.cities[state.cityIndex],searchCountry:state.searchCountry});
    const key = lead.mapsUrl || `${lead.name}|${lead.address}`;
    if (!key || queuedKeys.has(key) || processedKeys.has(key)) continue;
    queuedKeys.add(key);
    queue.push(lead);
  }
  state.queued = queuedKeys.size;
}

function runWorkers() {
  if (state.scanFirst && !collectionDone) return;
  while (state.running && activeWorkers < maxWorkers && queue.length) {
    const item = queue.shift();
    const itemKey = item.mapsUrl || `${item.name}|${item.address}`;
    inFlightItems.set(itemKey, item);
    activeWorkers += 1;
    persistRuntime().catch(() => {});
    const workerRunId = scanRunId;
    processPlace(item, workerRunId).finally(async () => {
      if (workerRunId !== scanRunId) return;
      inFlightItems.delete(itemKey);
      activeWorkers = Math.max(0, activeWorkers - 1);
      state.processed = processedKeys.size;
      await broadcast(true);
      if (queue.length) runWorkers();
      else await maybeNextCity();
    });
  }
}

async function processPlace(preview, workerRunId = scanRunId) {
  let tab = null;
  const key = preview.mapsUrl || `${preview.name}|${preview.address}`;
  try {
    state.phase = "Extracting";
    state.status = `Extracting: ${preview.name || "place"}`;
    await broadcast();

    tab = await chromeTabsCreate({ url: preview.mapsUrl, active: false });
    workerTabs.add(tab.id);
    await persistRuntime();
    await waitForTabComplete(tab.id, 5000);
    await waitForPlaceContent(tab.id, 6500);
    await sleep(150);

    let details = await extractFromMapsTab(tab.id);
    if (!details.phone && !details.website) {
      await sleep(350);
      details = mergeLead(details, await extractFromMapsTab(tab.id));
    }

    if (workerRunId !== scanRunId || !state.running) return;
    const lead = mergeLead(preview, details);
    preview.usageRequestId ||= crypto.randomUUID();
    inFlightItems.set(key,preview);
    await persistRuntime();
    await MHPAccess.consume(preview.usageRequestId);
    if (workerRunId !== scanRunId || !state.running) return;
    addLead(lead);
    processedKeys.add(key);
    state.status = `Saved ${state.leads.length}. Queue ${queue.length}.`;

    if (lead.website && state.enrichWebsites) {
      enrichLeadInBackground(lead, workerRunId);
    }
  } catch (error) {
    if (error.accessError && workerRunId === scanRunId) { await pauseScan(error.message,preview); return; }
    if (workerRunId === scanRunId && state.running) {
      try {preview.usageRequestId ||= crypto.randomUUID();inFlightItems.set(key,preview);await persistRuntime();await MHPAccess.consume(preview.usageRequestId);}
      catch (access) { if (access.accessError) { await pauseScan(access.message,preview); return; } }
      addLead(preview);
      processedKeys.add(key);
      state.status = `Saved preview after detail error. Queue ${queue.length}.`;
    }
  } finally {
    if (tab?.id) {
      try { await chromeTabsRemove(tab.id); } catch (e) {}
      workerTabs.delete(tab.id);
      await persistRuntime();
    }
  }
}

async function extractFromMapsTab(tabId) {
  try {
    const result = await withTimeout(chrome.scripting.executeScript({
      target: { tabId },
      func: extractGoogleMapsPlace
    }), 4500, "Place extraction timed out.");
    return normalizeLead(result?.[0]?.result || {});
  } catch (e) {
    return {};
  }
}

async function waitForPlaceContent(tabId, timeout = 5200) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const result = await withTimeout(chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const root = document.querySelector("div[role='main']") || document.body;
          const text = String(root?.textContent || "");
          const hasTitle = !!document.querySelector("h1, .DUwDvf, .fontHeadlineLarge");
          const hasBusinessSignals = /Website|Phone|Address|Call|Directions|Reviews|stars|الموقع|الهاتف|العنوان|مراجعة/i.test(text);
          return Boolean(hasTitle && hasBusinessSignals);
        }
      }), 1800, "Waiting for place content timed out.");
      if (result?.[0]?.result) return true;
    } catch (e) {}
    await sleep(300);
  }
  return false;
}

function enrichLeadInBackground(lead, workerRunId) {
  const task = enrichFromWebsite(lead.website).then(extra => {
    if (workerRunId !== scanRunId || !extra) return;
    const merged = mergeLead(lead, extra);
    addLead(merged);
    state.status = `Enriched ${merged.name || "lead"}. Saved ${state.leads.length}.`;
    broadcast(true).catch(() => {});
  }).catch(() => {}).finally(async () => { pendingEnrichment.delete(task); if(workerRunId===scanRunId) await maybeNextCity(); });
  pendingEnrichment.add(task);
}

function extractGoogleMapsPlace() {
  const clean = value => String(value || "").replace(/\u200e|\u200f/g, "").replace(/\s+/g, " ").trim();
  const toEnglishDigits = value => String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const root = document.querySelector("div[role='main']") || document.body;
  const text = clean(root.textContent);

  const pick = (selectors, includeAria = false) => {
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      if (!el) continue;
      const bodyText = clean(el.textContent);
      if (bodyText) return bodyText;
      if (includeAria) {
        const aria = clean(el.getAttribute("aria-label"));
        if (aria) return aria;
      }
    }
    return "";
  };

  const findPhone = value => {
    const match = toEnglishDigits(String(value || ""))
      .replace(/tel:/gi, " ")
      .replace(/phone:/gi, " ")
      .match(/\+?\d[\d\s().-]{6,}\d/g);
    return match ? clean(match[0]) : "";
  };

  const stripPrefix = (value, words) => {
    let out = clean(value);
    for (const word of words) out = out.replace(new RegExp(`^${word}:?\\s*`, "i"), "");
    return clean(out);
  };

  const phone = (() => {
    const selectors = [
      "button[data-item-id^='phone:tel:']",
      "button[data-item-id*='phone']",
      "a[href^='tel:']",
      ".UsdlK",
      "button[aria-label*='Phone']",
      "button[aria-label*='phone']",
      "button[aria-label*='الهاتف']"
    ];
    for (const selector of selectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        const value = clean([node.textContent, node.getAttribute("aria-label"), node.getAttribute("href"), node.getAttribute("data-item-id")].filter(Boolean).join(" "));
        const found = findPhone(value);
        if (found) return found;
      }
    }
    return findPhone(text);
  })();

  const address = (() => {
    const selectors = [
      "button[data-item-id='address']",
      "button[data-item-id*='address']",
      "button[aria-label*='Address']",
      "button[aria-label*='العنوان']",
      "[data-tooltip*='Copy address']"
    ];
    for (const selector of selectors) {
      const el = root.querySelector(selector);
      const value = stripPrefix(el?.getAttribute("aria-label") || el?.textContent || "", ["Address", "العنوان"]);
      if (value && !findPhone(value) && value.length > 6) return value;
    }
    return "";
  })();

  const website = (() => {
    const selectors = [
      "a[data-item-id='authority']",
      "a[data-item-id*='authority']",
      "a[aria-label*='Website']",
      "a[aria-label*='الموقع']",
      "a[href^='http']"
    ];
    for (const selector of selectors) {
      for (const a of Array.from(root.querySelectorAll(selector))) {
        const href = clean(a.href);
        if (!href) continue;
        if (/google\.|gstatic\.|ggpht\.|maps\/|schema\.org/i.test(href)) continue;
        return href;
      }
    }
    return "";
  })();

  const imageUrl = (() => {
    const images = [];
    const add = value => {
      const url = clean(value);
      if (!/^https?:\/\//i.test(url)) return;
      if (!/(googleusercontent|ggpht|gstatic|lh3\.google|streetviewpixels)/i.test(url)) return;
      if (/icon|marker|sprite|transparent|blank/i.test(url)) return;
      images.push(url.replace(/=w\d+-h\d+[^&\s"')>]*/i, "=w900-h700-k-no"));
    };
    root.querySelectorAll("img").forEach(img => {
      add(img.currentSrc || img.src);
      add(img.getAttribute("data-src"));
      add(img.getAttribute("srcset")?.split(/\s+/)[0]);
    });
    root.querySelectorAll("[style*='background-image']").forEach(el => {
      const match = String(el.getAttribute("style") || "").match(/url\((['"]?)(.*?)\1\)/i);
      if (match) add(match[2]);
    });
    return images[0] || "";
  })();

  const rating = (() => {
    const value = pick([".F7nice span[aria-hidden='true']", ".MW4etd", "span.ceNzKf", "[aria-label*='stars']", "[aria-label*='نجمة']"], true);
    const match = String(value || "").replace(",", ".").match(/\d+(\.\d+)?/);
    return match ? match[0] : "";
  })();

  const reviews = (() => {
    const match = text.match(/\(([\d,.\s]+)\)|([\d,.\s]+)\s*(reviews|review|مراجعة)/i);
    return clean((match && (match[1] || match[2])) || "").replace(/[^\d]/g, "");
  })();

  const emails = Array.from(new Set((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map(x => x.toLowerCase()))).join(" | ");
  const category = pick([".DkEaL", "button[jsaction*='category']", "button.DkEaL"], false);
  const hours = pick(["[aria-label*='Hours']", "[aria-label*='ساعات']"], true);
  const statusMatch = text.match(/(Open|Closed|مفتوح|مغلق)[^.،]{0,50}/i);

  return {
    name: clean(document.querySelector("h1")?.textContent) || pick([".DUwDvf", ".fontHeadlineLarge", "h1"], true),
    phone,
    address,
    website,
    imageUrl,
    emails,
    email: emails.split(" | ")[0] || "",
    category,
    rating,
    reviews,
    hours,
    status: statusMatch ? clean(statusMatch[0]) : "",
    mapsUrl: location.href,
    raw: text.slice(0, 1200)
  };
}

async function enrichFromWebsite(website) {
  website = clean(website);
  if (!safePublicUrl(website)) return {};

  const pages = [website];
  try {
    const u = new URL(website);
    pages.push(`${u.origin}/contact`, `${u.origin}/contact-us`);
  } catch (e) {}

  const htmlParts = await Promise.all(pages.map(page => fetchText(page, 3500)));
  const found = {};
  for (const html of htmlParts) {
    if (!html) continue;
    Object.assign(found, mergeLead(found, extractWebsiteSignals(html)));
    if (found.emails && (found.facebook || found.instagram || found.socialLinks)) break;
  }
  return found;
}

async function fetchText(url, timeoutMs = 3500) {
  if(!safePublicUrl(url))return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.3" }
    });
    const type = String(res.headers.get("content-type") || "");
    if(res.status>=300&&res.status<400){const next=res.headers.get("location");if(!next)return "";const redirected=new URL(next,url).href;return safePublicUrl(redirected)?fetchText(redirected,timeoutMs):"";}
    const declared=Number(res.headers.get("content-length")||0);
    if (!res.ok || declared>300000 || !/html|text|xml|json/i.test(type)) return "";
    const reader=res.body?.getReader();if(!reader)return "";let total=0,out="";const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>300000){await reader.cancel();return "";}out+=decoder.decode(value,{stream:true});}return out+decoder.decode();
  } catch (e) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function safePublicUrl(value){try{const u=new URL(value);if(u.protocol!=="https:")return false;const h=u.hostname.toLowerCase();if(h==="localhost"||h.endsWith(".local")||h==="0.0.0.0"||h==="127.0.0.1"||h==="::1")return false;if(/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h))return false;return true;}catch{return false;}}

function extractWebsiteSignals(html) {
  const text = String(html || "")
    .replace(/&#64;|&#x40;|&commat;/gi, "@")
    .replace(/\s*(\[at\]|\(at\))\s*/gi, "@")
    .replace(/\s*(\[dot\]|\(dot\))\s*/gi, ".");
  const emails = unique((text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [])
    .map(x => x.toLowerCase())
    .filter(x => !/\.(png|jpe?g|gif|webp|svg)$/i.test(x))).slice(0, 10);
  const urls = unique(Array.from(text.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi), m => cleanUrl(m[0])));
  const social = {
    facebook: first(urls, /facebook\.com|fb\.com/i),
    instagram: first(urls, /instagram\.com/i),
    twitter: first(urls, /twitter\.com|x\.com/i),
    linkedin: first(urls, /linkedin\.com/i),
    youtube: first(urls, /youtube\.com|youtu\.be/i),
    tiktok: first(urls, /tiktok\.com/i)
  };
  const socialLinks = unique(Object.values(social).filter(Boolean)).join(" | ");
  return {
    email: emails[0] || "",
    emails: emails.join(" | "),
    socialLinks,
    ...social
  };
}

function addLead(raw) {
  const lead = normalizeLead({ ...(raw || {}), searchCity: raw?.searchCity || state.cities[state.cityIndex] || "" });
  if (!lead.name && !lead.phone && !lead.address && !lead.website && !lead.mapsUrl) return false;
  const index = state.leads.findIndex(item =>
    (item.mapsUrl && lead.mapsUrl && item.mapsUrl === lead.mapsUrl) ||
    (item.name && lead.name && item.address && lead.address && item.name === lead.name && item.address === lead.address)
  );
  if (index === -1) {
    state.leads.push(lead);
  } else {
    state.leads[index] = mergeLead(state.leads[index], lead);
  }
  return true;
}

function normalizeLead(lead) {
  const rawPhone=clean(lead?.phoneRaw||lead?.phone);
  const phone=clean(lead?.phone);
  return {
    name: clean(lead?.name),
    phone,
    phoneRaw: rawPhone,
    phoneStatus: phone?/\d{7,16}/.test(phone.replace(/[^\d]/g,''))?'plausible':'unverified':'missing',
    address: clean(lead?.address),
    website: clean(lead?.website),
    imageUrl: clean(lead?.imageUrl),
    email: clean(lead?.email),
    emails: clean(lead?.emails),
    facebook: clean(lead?.facebook),
    instagram: clean(lead?.instagram),
    twitter: clean(lead?.twitter),
    linkedin: clean(lead?.linkedin),
    youtube: clean(lead?.youtube),
    tiktok: clean(lead?.tiktok),
    socialLinks: clean(lead?.socialLinks),
    category: clean(lead?.category),
    rating: clean(lead?.rating),
    reviews: clean(lead?.reviews),
    mapsUrl: clean(lead?.mapsUrl),
    hours: clean(lead?.hours),
    status: clean(lead?.status),
    searchCity: clean(lead?.searchCity),
    searchCountry: clean(lead?.searchCountry),
    usageRequestId: clean(lead?.usageRequestId),
    raw: clean(lead?.raw)
  };
}

function mergeLead(a, b) {
  a = normalizeLead(a || {});
  b = normalizeLead(b || {});
  const out = {};
  for (const key of Object.keys(a)) out[key] = b[key] || a[key] || "";
  return out;
}

async function stopScan(status = "Stopped.", silent = false) {
  scanRunId += 1;
  pendingEnrichment = new Set();
  collectorSessionId += 1;
  state.running = false;
  state.phase = "Stopped";
  state.status = status;
  queue = [];
  inFlightItems = new Map();
  collectionDone = false;
  state.queued = processedKeys.size;
  state.processed = processedKeys.size;

  if (state.activeTabId) {
    try { await chromeTabsSendMessage(state.activeTabId, { type: "STOP_COLLECTING" }); } catch (e) {}
  }
  for (const tabId of Array.from(workerTabs)) {
    try { await chromeTabsRemove(tabId); } catch (e) {}
  }
  workerTabs.clear();
  activeWorkers = 0;
  if (!silent) {
    await persist();
    await broadcast();
  }
  return { ok: true };
}

async function pauseScan(status, currentItem) {
  state.running=false;
  state.paused=true;
  state.phase="Paused";
  state.status=`${status} Work is saved; retry when access is available.`;
  if(currentItem){const key=currentItem.mapsUrl||`${currentItem.name}|${currentItem.address}`;if(!processedKeys.has(key)&&!queue.some(x=>(x.mapsUrl||`${x.name}|${x.address}`)===key))queue.unshift(currentItem);}
  for(const tabId of Array.from(workerTabs)){try{await chromeTabsRemove(tabId);}catch(e){}}
  workerTabs.clear();
  await persistRuntime();
  await broadcast(true);
}

async function resumeScan(){
  if(!state.paused)return {ok:false,error:"No paused search."};
  await MHPAccess.validate();
  state.paused=false;state.running=true;state.phase="Extracting";state.status=`Resuming ${queue.length} saved places...`;
  await persistRuntime();await broadcast(true);runWorkers();return {ok:true};
}

async function skipScanCity() {
  if (!state.running) return { ok: false, error: "No active scan." };

  const currentCity = state.cities[state.cityIndex] || "current city";
  collectionDone = true;
  state.phase = "Extracting";
  state.status = `Skipped scanning ${currentCity}. Extracting ${queue.length} collected places now...`;

  if (state.activeTabId) {
    try { await chromeTabsSendMessage(state.activeTabId, { type: "STOP_COLLECTING" }); } catch (e) {}
  }

  await persist();
  await broadcast();

  if (queue.length) {
    runWorkers();
  } else if (!activeWorkers) {
    await maybeNextCity();
  }

  return { ok: true, city: currentCity, queued: queue.length, extracting: true };
}

async function skipCity() {
  if (!state.running) return { ok: false, error: "No active scan." };

  const skippedCity = state.cities[state.cityIndex] || "current city";
  scanRunId += 1;
  pendingEnrichment = new Set();
  collectorSessionId += 1;
  queue = [];
  inFlightItems = new Map();
  collectionDone = false;
  state.phase = "Skipping City";
  state.status = `Stopping ${skippedCity} and moving to next city...`;
  state.queued = processedKeys.size;
  state.processed = processedKeys.size;

  if (state.activeTabId) {
    try { await chromeTabsSendMessage(state.activeTabId, { type: "STOP_COLLECTING" }); } catch (e) {}
  }
  for (const tabId of Array.from(workerTabs)) {
    try { await chromeTabsRemove(tabId); } catch (e) {}
  }
  workerTabs.clear();
  activeWorkers = 0;

  if (state.cityIndex < state.cities.length - 1) {
    state.cityIndex += 1;
    state.phase = "Opening Maps";
    state.status = `Skipped ${skippedCity}. Opening ${state.cities[state.cityIndex]}...`;
    await persist();
    await broadcast();
    await openCitySearch();
    return { ok: true, skipped: skippedCity, next: state.cities[state.cityIndex] };
  }

  state.running = false;
  state.phase = "Completed";
  state.status = `Skipped ${skippedCity}. No more cities. Saved ${state.leads.length} leads.`;
  await persist();
  await broadcast();
  return { ok: true, skipped: skippedCity, done: true };
}

async function clearResults() {
  await stopScan("Results cleared.", true);
  state.leads = [];
  state.queued = 0;
  state.processed = 0;
  queue = [];
  queuedKeys = new Set();
  processedKeys = new Set();
  inFlightItems = new Map();
  await broadcast(true);
  return { ok: true };
}

async function injectCollector(tabId) {
  try {
    const existing = await chromeTabsSendMessage(tabId, { type: "PING_COLLECTOR" });
    if (existing?.ok) return true;
  } catch (e) {}

  try {
    await withTimeout(
      chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] }),
      5000,
      "Collector injection timed out."
    );
    return true;
  } catch (e) {
    return false;
  }
}

async function persist(includeLeads = false) {
  try {
    const stateMeta = { ...state };
    delete stateMeta.leads;
    await storageSet("state", stateMeta);
    if (includeLeads) await storageSet("leads", state.leads);
  } catch (e) {
    console.warn("Maps Hunter: could not persist state", e);
  }
  await persistRuntime();
}

async function persistRuntime() {
  try {
    await storageSet("runtime", {
      scanRunId,
      collectorSessionId,
      collectionDone,
      queue,
      inFlight: Array.from(inFlightItems.values()),
      queuedKeys: Array.from(queuedKeys),
      processedKeys: Array.from(processedKeys),
      workerTabs: Array.from(workerTabs),
      lastCollectorMessageAt
    });
  } catch (e) {
    console.warn("Maps Hunter: could not persist runtime", e);
  }
}

async function initializeState() {
  try {
    const storedState = await storageGet("state");
    const storedLeads = await storageGet("leads");
    const runtime = await storageGet("runtime");

    if (storedState && typeof storedState === "object") {
      Object.assign(state, storedState);
    }
    state.leads = Array.isArray(storedLeads)
      ? storedLeads
      : (Array.isArray(storedState?.leads) ? storedState.leads : []);

    if (runtime && typeof runtime === "object") {
      scanRunId = Number(runtime.scanRunId || 0);
      collectorSessionId = Number(runtime.collectorSessionId || scanRunId || 0);
      collectionDone = Boolean(runtime.collectionDone);
      queuedKeys = new Set(Array.isArray(runtime.queuedKeys) ? runtime.queuedKeys : []);
      processedKeys = new Set(Array.isArray(runtime.processedKeys) ? runtime.processedKeys : []);
      lastCollectorMessageAt = Number(runtime.lastCollectorMessageAt || 0);

      const recovered = [
        ...(Array.isArray(runtime.inFlight) ? runtime.inFlight : []),
        ...(Array.isArray(runtime.queue) ? runtime.queue : [])
      ];
      queue = [];
      const recoverySeen = new Set();
      for (const item of recovered) {
        const lead = normalizeLead(item);
        const key = lead.mapsUrl || `${lead.name}|${lead.address}`;
        if (!key || processedKeys.has(key) || recoverySeen.has(key)) continue;
        recoverySeen.add(key);
        queuedKeys.add(key);
        queue.push(lead);
      }

      const orphanTabs = Array.isArray(runtime.workerTabs) ? runtime.workerTabs.filter(Number.isInteger) : [];
      for (const tabId of orphanTabs) {
        try { await chromeTabsRemove(tabId); } catch (e) {}
      }
    }

    workerTabs = new Set();
    inFlightItems = new Map();
    activeWorkers = 0;
    maxWorkers = Math.max(1, Math.min(8, Number(state.maxWorkers || 6)));
    state.maxWorkers = maxWorkers;
    state.queued = queuedKeys.size;
    state.processed = processedKeys.size;

    if (state.running) {
      setTimeout(() => resumeInterruptedScan().catch(() => {}), 250);
    }
  } catch (e) {
    state.running = false;
    state.phase = "Ready";
    state.status = "Ready.";
  }
}

async function resumeInterruptedScan() {
  if (!state.running) return;

  if (!collectionDone) {
    const tab = await chromeTabsGet(state.activeTabId).catch(() => null);
    if (tab?.id && /google\.[^/]+\/maps|google\.com\/maps/i.test(String(tab.url || ""))) {
      let ping = null;
      try { ping = await chromeTabsSendMessage(tab.id, { type: "PING_COLLECTOR" }); } catch (e) {}

      state.status = ping?.collecting
        ? `Maps collection is still running for ${state.cities[state.cityIndex] || "current city"}.`
        : `Resuming Maps collection for ${state.cities[state.cityIndex] || "current city"}...`;
      await broadcast();

      if (!ping?.collecting) await launchCollector(tab.id, collectorSessionId);
      if (!state.scanFirst && queue.length) runWorkers();
      return;
    }
    collectionDone = true;
  }

  if (queue.length) {
    state.phase = "Extracting";
    state.status = `Recovered interrupted scan. Resuming ${queue.length} pending places...`;
    await broadcast();
    runWorkers();
    return;
  }

  await maybeNextCity();
}


async function broadcast(includeLeads = false) {
  await persist(includeLeads);
  try {
    const snapshot = { ...state };
    if (!includeLeads) delete snapshot.leads;
    chrome.runtime.sendMessage({ type: "STATE_UPDATE", state: snapshot }, () => {});
  } catch (e) {}
}

function getActiveTab() {
  return new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, tabs => resolve(tabs?.[0] || null)));
}

function chromeTabsUpdate(tabId, options) {
  return new Promise((resolve, reject) => chrome.tabs.update(tabId, options, tab => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve(tab);
  }));
}

function chromeTabsCreate(options) {
  return new Promise((resolve, reject) => chrome.tabs.create(options, tab => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve(tab);
  }));
}

function chromeTabsRemove(tabId) {
  return new Promise(resolve => chrome.tabs.remove(tabId, () => resolve()));
}

function chromeTabsSendMessage(tabId, message) {
  return new Promise((resolve, reject) => chrome.tabs.sendMessage(tabId, message, response => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve(response);
  }));
}

function chromeTabsGet(tabId) {
  return new Promise((resolve, reject) => {
    if (!Number.isInteger(tabId)) return reject(new Error("Invalid tab id"));
    chrome.tabs.get(tabId, tab => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(tab);
    });
  });
}

function waitForTabComplete(tabId, timeout = 25000) {
  return new Promise(resolve => {
    const timer = setTimeout(done, timeout);
    function done() {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }
    function listener(id, info) {
      if (id === tabId && info.status === "complete") done();
    }
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId, tab => {
      if (chrome.runtime.lastError || tab?.status === "complete") done();
    });
  });
}

function storageGet(key) {
  return new Promise(resolve => chrome.storage.local.get(key, result => resolve(result?.[key])));
}

function storageSet(key, value) {
  return new Promise((resolve, reject) => chrome.storage.local.set({ [key]: value }, () => {
    const error = chrome.runtime.lastError;
    if (error) reject(new Error(error.message));
    else resolve();
  }));
}

function withTimeout(promise, timeoutMs, message = "Operation timed out.") {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    Promise.resolve(promise).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clean(value) {
  return String(value || "").replace(/\u200e|\u200f/g, "").replace(/\s+/g, " ").trim();
}

function unique(values) {
  return Array.from(new Set((values || []).map(clean).filter(Boolean)));
}

function first(values, pattern) {
  return (values || []).find(url => pattern.test(url) && !/share|intent|plugins/i.test(url)) || "";
}

function cleanUrl(url) {
  return clean(String(url || "").replace(/[),.;]+$/g, ""));
}
