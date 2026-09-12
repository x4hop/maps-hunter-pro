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
  enrichWebsites: true,
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
let enrichmentTabs = new Set();
let enrichmentActive = 0;
let enrichmentTabActive = 0;
const ENRICHMENT_MAX_CONCURRENT = 5;
const ENRICHMENT_TAB_MAX_CONCURRENT = 2;
const enrichmentWaiters = [];
const enrichmentTabWaiters = [];
let enrichmentCache = new Map();
let enrichmentJobs = new Map();
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
      if (message?.type === "GET_EXPORT_DATA") {
        await persist(true);
        return sendResponse({
          ok: true,
          leads: Array.isArray(state.leads) ? state.leads.map(item => ({ ...item })) : [],
          meta: {
            keyword: state.keyword || "",
            cities: Array.isArray(state.cities) ? [...state.cities] : [],
            phase: state.phase || "",
            exportedAt: new Date().toISOString()
          }
        });
      }
      if (message?.type === "START_SCAN") return sendResponse(await startScan(message));
      if (message?.type === "RESUME_SCAN") return sendResponse(await resumeScan());
      if (message?.type === "STOP_SCAN") return sendResponse(await stopScan("Stopped by user."));
      if (message?.type === "STOP_ALL") return sendResponse(await stopAll());
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
  state.enrichWebsites = true;
  state.paused = false;
  queue = [];
  queuedKeys = new Set();
  processedKeys = new Set();
  inFlightItems = new Map();
  resetEnrichmentRuntime();
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
    if (!key) continue;

    if (processedKeys.has(key)) {
      // Late card hydration can still add Website / Email / Social after the
      // lead was saved. Merge only richer data; never create a duplicate row.
      addLead(lead);
      continue;
    }

    if (queuedKeys.has(key)) {
      const index = queue.findIndex(item => (item.mapsUrl || `${item.name}|${item.address}`) === key);
      if (index >= 0) queue[index] = mergeLead(queue[index], lead);
      const inflight = inFlightItems.get(key);
      if (inflight) inFlightItems.set(key, mergeLead(inflight, lead));
    } else {
      queuedKeys.add(key);
      queue.push(lead);
    }

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
    state.status = `Extracting Maps data: ${preview.name || "place"}`;
    await broadcast();

    // Always inspect the real Google Maps place page after the fast scan.
    // Email can exist in Maps data even when the business has no website, so
    // skipping the detail page because the result card already has phone/site
    // would lose one of the extension's most important fields.
    tab = await chromeTabsCreate({ url: preview.mapsUrl, active: false });
    workerTabs.add(tab.id);
    await persistRuntime();
    await waitForTabComplete(tab.id, 4200);
    await waitForPlaceContent(tab.id, 4200);
    await sleep(90);

    let details = await extractFromMapsTab(tab.id);
    // Google Maps hydrates contact fields progressively. Retry only when a
    // priority field is still absent; keep this short so extraction stays fast.
    if (!details.phone || !details.email) {
      await sleep(220);
      details = mergeLead(details, await extractFromMapsTab(tab.id));
    }

    if (workerRunId !== scanRunId || !state.running) return;
    let lead = mergeLead(preview, details);

    preview.usageRequestId ||= crypto.randomUUID();
    inFlightItems.set(key, preview);
    await persistRuntime();
    await MHPAccess.consume(preview.usageRequestId);
    if (workerRunId !== scanRunId || !state.running) return;

    addLead(lead);
    processedKeys.add(key);
    state.status = `Saved ${state.leads.length}. Queue ${queue.length}.`;

    // Website lookup is only a fallback. Google Maps is the primary source for
    // email/phone; visit the business site only when Maps did not provide email.
    if (lead.website && !(lead.email || lead.emails)) scheduleEnrichment(lead, workerRunId);
  } catch (error) {
    if (error.accessError && workerRunId === scanRunId) { await pauseScan(error.message,preview); return; }
    if (workerRunId === scanRunId && state.running) {
      try {preview.usageRequestId ||= crypto.randomUUID();inFlightItems.set(key,preview);await persistRuntime();await MHPAccess.consume(preview.usageRequestId);}
      catch (access) { if (access.accessError) { await pauseScan(access.message,preview); return; } }
      addLead(preview);
      processedKeys.add(key);
      if (preview.website && !(preview.email || preview.emails)) scheduleEnrichment(preview, workerRunId);
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
      world: "MAIN",
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
          const detail = document.querySelector("div[role='main']");
          const text = String(detail?.textContent || document.body?.textContent || "");
          const hasTitle = !!document.querySelector("h1, .DUwDvf, .fontHeadlineLarge");
          const structured = !!document.querySelector("[data-item-id='address'],[data-item-id='authority'],[data-item-id^='phone:tel:'],a[href^='tel:']");
          const hasBusinessSignals = structured || /Website|Phone|Address|Call|Directions|Reviews|stars|الموقع|الهاتف|هاتف|العنوان|مراجعة/i.test(text);
          return Boolean(hasTitle && hasBusinessSignals);
        }
      }), 1800, "Waiting for place content timed out.");
      if (result?.[0]?.result) return true;
    } catch (e) {}
    await sleep(300);
  }
  return false;
}

function enrichmentKey(lead) {
  return clean(lead?.mapsUrl || lead?.website || `${lead?.name || ""}|${lead?.address || ""}`);
}

function scheduleEnrichment(lead, workerRunId = scanRunId) {
  const website = normalizeWebsiteUrl(lead?.website);
  if (!website || !safePublicUrl(website) || lead?.email || lead?.emails) return;
  const key = enrichmentKey(lead);
  if (!key || enrichmentJobs.has(key) || enrichmentCache.has(key)) return;

  const task = (async () => {
    const extra = await enrichFromWebsite(website, workerRunId);
    if (!extra || workerRunId !== scanRunId || !state.running) return;
    enrichmentCache.set(key, extra);
    enrichmentCache.set(website, extra);

    // Only update the visible lead after its normal usage/save path completed.
    if (processedKeys.has(key)) {
      const merged = mergeLead(lead, extra);
      addLead(merged);
      const found = [merged.email || merged.emails ? "email" : "", merged.facebook ? "Facebook" : "", merged.instagram ? "Instagram" : ""].filter(Boolean).join(", ");
      state.status = found ? `Updated ${merged.name || "lead"}: ${found}.` : `Checked website for ${merged.name || "lead"}.`;
      await broadcast(true);
    }
  })().catch(() => {}).finally(async () => {
    enrichmentJobs.delete(key);
    pendingEnrichment.delete(task);
    if (workerRunId === scanRunId) await maybeNextCity();
  });

  enrichmentJobs.set(key, task);
  pendingEnrichment.add(task);
}

async function acquireEnrichmentSlot(workerRunId) {
  while (enrichmentActive >= ENRICHMENT_MAX_CONCURRENT) {
    await new Promise(resolve => enrichmentWaiters.push(resolve));
    if (workerRunId !== scanRunId || !state.running) return false;
  }
  if (workerRunId !== scanRunId || !state.running) return false;
  enrichmentActive += 1;
  return true;
}

function releaseEnrichmentSlot() {
  enrichmentActive = Math.max(0, enrichmentActive - 1);
  const next = enrichmentWaiters.shift();
  if (next) next();
}

async function acquireEnrichmentTabSlot(workerRunId) {
  while (enrichmentTabActive >= ENRICHMENT_TAB_MAX_CONCURRENT) {
    await new Promise(resolve => enrichmentTabWaiters.push(resolve));
    if (workerRunId !== scanRunId || !state.running) return false;
  }
  if (workerRunId !== scanRunId || !state.running) return false;
  enrichmentTabActive += 1;
  return true;
}

function releaseEnrichmentTabSlot() {
  enrichmentTabActive = Math.max(0, enrichmentTabActive - 1);
  const next = enrichmentTabWaiters.shift();
  if (next) next();
}
async function collectWebsiteDom(tabId) {
  try {
    const result = await withTimeout(chrome.scripting.executeScript({
      target: { tabId },
      func: extractWebsiteDomSignals
    }), 5000, "Website extraction timed out.");
    return result?.[0]?.result || {};
  } catch (e) {
    return {};
  }
}

function extractWebsiteDomSignals() {
  const clean = value => String(value || "").replace(/\u200e|\u200f/g, "").replace(/\s+/g, " ").trim();
  const decodeCf = hex => {
    try {
      const value = String(hex || "").replace(/[^0-9a-f]/gi, "");
      if (value.length < 6 || value.length % 2) return "";
      const key = parseInt(value.slice(0, 2), 16);
      let out = "";
      for (let i = 2; i < value.length; i += 2) out += String.fromCharCode(parseInt(value.slice(i, i + 2), 16) ^ key);
      return out;
    } catch { return ""; }
  };
  const decodeEntities = value => {
    try {
      const ta = document.createElement("textarea");
      ta.innerHTML = String(value || "");
      return ta.value;
    } catch { return String(value || ""); }
  };
  const emails = new Set();
  const urls = new Set();
  const contacts = new Set();
  const contactWords = /(contact(?:-us|s)?|get-in-touch|reach-us|write-to-us|write-us|email-us|support|customer-service|about(?:-us)?|team|kontakt(?:e)?|impressum|imprint|kontaktieren|contacto(?:s)?|contato|contatti|contatto|contactez|nous-contacter|ilet[iİ]şim|iletisim|контакт(?:ы)?|связаться|اتصل|تواصل|راسلنا|اتصل-بنا|تواصل-معنا|من-نحن|عن-الموقع|حولنا)/i;

  const addEmail = raw => {
    let value = decodeEntities(String(raw || ""))
      .replace(/^mailto:/i, "")
      .replace(/\u200e|\u200f/g, " ")
      .replace(/\\u0*040/gi, "@")
      .replace(/\\x40/gi, "@")
      .replace(/\\u0*02e/gi, ".")
      .trim();
    try { value = decodeURIComponent(value); } catch {}
    if (!value) return;
    const normal = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || [];
    for (const item of normal) {
      const email = item.toLowerCase().replace(/[),.;:]+$/g, "");
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|css|js)$/i.test(email)) emails.add(email);
    }
    for (const m of value.matchAll(/([A-Z0-9._%+-]{1,64})\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*([A-Z0-9.-]{1,190})\s*(?:\[dot\]|\(dot\)|\{dot\}|\s+dot\s+)\s*([A-Z]{2,24})/gi)) {
      const email = `${m[1]}@${m[2]}.${m[3]}`.toLowerCase();
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) emails.add(email);
    }
  };

  const addUrl = (raw, label = "") => {
    try {
      const decoded = decodeEntities(String(raw || "")).replace(/\\\//g, "/").trim();
      const url = new URL(decoded, location.href);
      if (!/^https?:$/.test(url.protocol)) return;
      urls.add(url.href);
      if (url.origin === location.origin && contactWords.test(`${url.pathname} ${url.hash} ${label}`)) contacts.add(url.href);
    } catch {}
  };

  const bodyText = clean(document.body?.innerText || document.body?.textContent || "");
  addEmail(bodyText);

  for (const a of Array.from(document.querySelectorAll("a[href]"))) {
    const href = a.getAttribute("href") || "";
    const label = clean([a.textContent, a.getAttribute("aria-label"), a.getAttribute("title")].filter(Boolean).join(" "));
    if (/^mailto:/i.test(href)) { addEmail(href); continue; }
    const cfMatch = href.match(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/i);
    if (cfMatch) addEmail(decodeCf(cfMatch[1]));
    if (/^(tel:|javascript:|#)/i.test(href)) continue;
    addUrl(href, label);
  }

  for (const node of Array.from(document.querySelectorAll("[data-cfemail]"))) addEmail(decodeCf(node.getAttribute("data-cfemail") || ""));
  for (const node of Array.from(document.querySelectorAll("[data-email],[data-mail],[data-contact]"))) addEmail(node.getAttribute("data-email") || node.getAttribute("data-mail") || node.getAttribute("data-contact") || "");
  for (const meta of Array.from(document.querySelectorAll("meta[content]"))) addEmail(meta.getAttribute("content") || "");
  for (const script of Array.from(document.querySelectorAll("script[type='application/ld+json'],script[type='application/json']"))) addEmail(script.textContent || "");

  const html = decodeEntities(String(document.documentElement?.innerHTML || ""));
  addEmail(html);
  for (const m of html.matchAll(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/gi)) addEmail(decodeCf(m[1]));
  for (const m of html.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]{6,})["']/gi)) addEmail(decodeCf(m[1]));
  for (const m of html.matchAll(/https?:\\?\/\\?\/[^\s"'<>\\)]+/gi)) addUrl(m[0].replace(/\\\//g, "/").replace(/&amp;/gi, "&"));

  const socialUrls = Array.from(urls);
  const pick = (pattern, reject) => socialUrls.find(url => pattern.test(url) && !(reject && reject.test(url))) || "";
  const emailScore = email => {
    const value = String(email || "").toLowerCase();
    const domain = value.split("@")[1] || "";
    const host = String(location.hostname || "").toLowerCase().replace(/^www\./, "");
    if (!domain || /^(example\.(com|org|net)|test\.com|localhost)$/.test(domain)) return -1000;
    let score = 0;
    if (domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`)) score += 100;
    if (/^(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|protonmail\.com)$/.test(domain)) score += 25;
    if (/^(info|hello|contact|office|sales|support|booking|reservations?|admin|mail)@/i.test(value)) score += 15;
    if (/^(noreply|no-reply|donotreply|do-not-reply)@/i.test(value)) score -= 50;
    return score;
  };
  const facebook = pick(/https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)\//i, /\/tr\/?|\/plugins\/?|\/sharer|\/share|\/dialog|\/login/i);
  const instagram = pick(/https?:\/\/(?:www\.)?instagram\.com\//i, /\/accounts\/|\/developer|\/about\//i);
  const twitter = pick(/https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\//i, /\/intent\//i);
  const linkedin = pick(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\//i, /\/shareArticle|\/sharing\//i);
  const youtube = pick(/https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\//i, /\/watch\?v=$/i);
  const tiktok = pick(/https?:\/\/(?:www\.)?tiktok\.com\//i, /\/login/i);
  const emailList = Array.from(emails)
    .filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && emailScore(x) > -1000)
    .sort((a,b) => emailScore(b) - emailScore(a))
    .slice(0, 12);
  const socialLinks = [facebook, instagram, twitter, linkedin, youtube, tiktok].filter(Boolean).join(" | ");
  return {
    email: emailList[0] || "",
    emails: emailList.join(" | "),
    facebook, instagram, twitter, linkedin, youtube, tiktok, socialLinks,
    contactPages: Array.from(contacts).slice(0, 8),
    pageUrl: location.href
  };
}

function extractGoogleMapsPlace() {
  const clean = value => String(value || "").replace(/\u200e|\u200f/g, "").replace(/\s+/g, " ").trim();
  const toEnglishDigits = value => String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const detailRoot = document.querySelector("div[role='main']");
  // Google Maps renders structured business controls outside div[role="main"]
  // on some layouts. Search structured controls across the document while
  // keeping text parsing scoped to the detail panel when possible.
  const root = (detailRoot && detailRoot.querySelector("[data-item-id='address'],[data-item-id='authority'],[data-item-id*='phone'],a[href^='tel:']")) ? detailRoot : document;
  const textRoot = detailRoot || document.body;
  const text = clean(textRoot?.textContent || document.body?.textContent || "");

  const pick = (selectors, includeAria = false) => {
    const scopes = [detailRoot, document].filter(Boolean);
    for (const scope of scopes) {
      for (const selector of selectors) {
        const el = scope.querySelector(selector);
        if (!el) continue;
        const bodyText = clean(el.textContent);
        if (bodyText) return bodyText;
        if (includeAria) {
          const aria = clean(el.getAttribute("aria-label"));
          if (aria) return aria;
        }
      }
    }
    return "";
  };

  const phoneDigits = value => toEnglishDigits(String(value || "")).replace(/\D/g, "");

  const findPhone = value => {
    const source = toEnglishDigits(String(value || ""))
      .replace(/\u2060/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!source) return "";

    const candidates = source.match(/(?:\+|00)?\d[\d\s().-]{5,}\d/g) || [];
    for (const candidate of candidates) {
      const digits = phoneDigits(candidate);
      if (digits.length < 7 || digits.length > 15) continue;
      if (/^(\d)\1{6,}$/.test(digits)) continue;
      if (!/[\s().+-]/.test(candidate) && digits.length < 8) continue;
      return clean(candidate);
    }
    return "";
  };

  const phoneWords = /phone|telephone|teléfono|telefono|telefon|téléphone|telefone|телефон|الهاتف|هاتف|رقم الهاتف|call|اتصال/i;

  const nodePhoneValues = node => [
    node?.getAttribute?.("data-item-id"),
    node?.getAttribute?.("href"),
    node?.getAttribute?.("data-phone-number"),
    node?.getAttribute?.("data-value"),
    node?.getAttribute?.("aria-label"),
    node?.getAttribute?.("title"),
    node?.textContent
  ].filter(Boolean).map(clean);

  const bestPhoneFromValues = values => {
    for (const value of values) {
      const found = findPhone(value);
      if (!found) continue;
      const digits = phoneDigits(found);
      if (/^\s*\+/.test(found) || /^\s*00/.test(found) || /(?:tel:|phone:tel:)\s*\+/i.test(value)) {
        return /^\s*00/.test(found) ? `+${digits.slice(2)}` : `+${digits}`;
      }
    }
    for (const value of values) {
      const found = findPhone(value);
      if (found) return found;
    }
    return "";
  };

  const structuredInternationalPhone = localValue => {
    const localDigits = phoneDigits(localValue);
    if (localDigits.length < 7) return "";
    try {
      const source = JSON.stringify(window.APP_INITIALIZATION_STATE || "");
      if (!source) return "";
      let index = source.indexOf(localDigits);
      if (index < 0) {
        const compact = clean(localValue);
        if (compact) index = source.indexOf(compact);
      }
      if (index < 0) return "";
      const segment = source.slice(Math.max(0, index - 600), index + 1500);
      const candidates = toEnglishDigits(segment).match(/\+\d[\d\s().-]{6,}\d/g) || [];
      const tail = localDigits.slice(-Math.min(7, localDigits.length));
      for (const candidate of candidates) {
        const digits = phoneDigits(candidate);
        if (digits.length < 8 || digits.length > 15) continue;
        if (tail && !digits.endsWith(tail)) continue;
        return `+${digits}`;
      }
    } catch (e) {}
    return "";
  };

  const stripPrefix = (value, words) => {
    let out = clean(value);
    for (const word of words) out = out.replace(new RegExp(`^${word}:?\\s*`, "i"), "");
    return clean(out);
  };

  const phone = (() => {
    const selectors = [
      "button[data-item-id^='phone:tel:']",
      "[data-item-id*='phone:tel:']",
      "[data-item-id*='phone']",
      "a[href^='tel:']",
      ".UsdlK",
      "button[aria-label*='Phone']",
      "button[aria-label*='phone']",
      "button[aria-label*='الهاتف']",
      "[data-tooltip*='phone']",
      "[data-tooltip*='Phone']"
    ];

    const seenNodes = new Set();
    for (const selector of selectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        if (seenNodes.has(node)) continue;
        seenNodes.add(node);
        const found = bestPhoneFromValues(nodePhoneValues(node));
        if (found) return structuredInternationalPhone(found) || found;
      }
    }

    const candidates = Array.from(root.querySelectorAll("[data-item-id],[aria-label],[data-tooltip],a[href],button,[role='button']"));
    for (const node of candidates) {
      const metadata = clean([
        node.getAttribute?.("data-item-id"),
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("data-tooltip"),
        node.getAttribute?.("href"),
        node.getAttribute?.("title")
      ].filter(Boolean).join(" "));
      if (!phoneWords.test(metadata)) continue;
      let found = bestPhoneFromValues(nodePhoneValues(node));
      if (found) return structuredInternationalPhone(found) || found;
      const parent = node.parentElement;
      if (parent) {
        found = bestPhoneFromValues(nodePhoneValues(parent));
        if (found) return structuredInternationalPhone(found) || found;
      }
    }

    const labelled = toEnglishDigits(text).match(/(?:phone|telephone|teléfono|telefono|telefon|téléphone|telefone|телефон|الهاتف|هاتف|رقم الهاتف)\s*:?\s*((?:\+|00)?\d[\d\s().-]{5,}\d)/i);
    if (!labelled) return "";
    const found = findPhone(labelled[1]);
    return found ? (structuredInternationalPhone(found) || found) : "";
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
      "[data-item-id='authority']",
      "[data-item-id*='authority']",
      "a[aria-label*='Website']",
      "a[aria-label*='website']",
      "a[aria-label*='الموقع']",
      "a[aria-label*='الموقع الإلكتروني']"
    ];
    for (const selector of selectors) {
      for (const node of Array.from(root.querySelectorAll(selector))) {
        const link = node.matches?.("a[href]") ? node : node.querySelector?.("a[href]");
        const href = clean(link?.href || node.href || node.getAttribute?.("href") || "");
        if (!/^https?:\/\//i.test(href)) continue;
        if (/google\.|gstatic\.|ggpht\.|maps\/|schema\.org/i.test(href)) continue;
        return href;
      }
    }
    return "";
  })();

  const socialProfiles = (() => {
    const out = { facebook: "", instagram: "", twitter: "", linkedin: "", youtube: "", tiktok: "" };
    const classify = raw => {
      try {
        const href = new URL(raw, location.href).href;
        if (/facebook\.com|fb\.com/i.test(href) && !/sharer|share|dialog|login/i.test(href)) out.facebook ||= href;
        else if (/instagram\.com/i.test(href) && !/accounts\/|developer/i.test(href)) out.instagram ||= href;
        else if (/twitter\.com|x\.com/i.test(href) && !/intent\//i.test(href)) out.twitter ||= href;
        else if (/linkedin\.com/i.test(href) && !/sharing|shareArticle/i.test(href)) out.linkedin ||= href;
        else if (/youtube\.com|youtu\.be/i.test(href)) out.youtube ||= href;
        else if (/tiktok\.com/i.test(href) && !/login/i.test(href)) out.tiktok ||= href;
      } catch {}
    };
    if (website) classify(website);
    for (const a of Array.from(root.querySelectorAll("a[href]"))) classify(a.href || a.getAttribute("href") || "");
    return out;
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

  const mapsEmailData = (() => {
    const trusted = new Set();
    const addEmails = (raw, target = trusted) => {
      let value = String(raw || "")
        .replace(/\u200e|\u200f/g, " ")
        .replace(/&#64;|&#x40;|&commat;/gi, "@")
        .replace(/&#46;|&#x2e;/gi, ".")
        .replace(/\\u0*040/gi, "@")
        .replace(/\\x40/gi, "@")
        .replace(/\\u0*02e/gi, ".")
        .replace(/\\x2e/gi, ".")
        .replace(/\\\//g, "/");
      try { value = decodeURIComponent(value); } catch (e) {}
      for (const m of value.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi)) {
        const email = String(m[0] || "").toLowerCase().replace(/[),.;:]+$/g, "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
        if (/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|css|js)$/i.test(email)) continue;
        if (/^(example|test)@|@example\.(com|org|net)$/i.test(email)) continue;
        if (/@(?:google|gstatic|googleusercontent)\.com$/i.test(email)) continue;
        target.add(email);
      }
      for (const m of value.matchAll(/([A-Z0-9._%+-]{1,64})\s*(?:\[at\]|\(at\)|\{at\}|\s+at\s+)\s*([A-Z0-9.-]{1,190})\s*(?:\[dot\]|\(dot\)|\{dot\}|\s+dot\s+)\s*([A-Z]{2,24})/gi)) {
        const email = `${m[1]}@${m[2]}.${m[3]}`.toLowerCase();
        if (!/@(?:google|gstatic|googleusercontent)\.com$/i.test(email)) target.add(email);
      }
    };

    // Restore the original Maps-first behavior: email can exist in the Maps
    // place page even when the listing has no Website button.
    addEmails(document.body?.innerText || "");
    addEmails(document.body?.textContent || "");

    // Contact data may be present in attributes but not rendered as visible text.
    for (const node of Array.from(document.querySelectorAll("a[href], [aria-label], [title], [data-item-id], [data-value], [data-email], [data-tooltip]"))) {
      const href = node.getAttribute?.("href") || "";
      if (/^mailto:/i.test(href)) addEmails(href.replace(/^mailto:/i, "").split("?")[0]);
      addEmails([
        href,
        node.getAttribute?.("aria-label"),
        node.getAttribute?.("title"),
        node.getAttribute?.("data-item-id"),
        node.getAttribute?.("data-value"),
        node.getAttribute?.("data-email"),
        node.getAttribute?.("data-tooltip")
      ].filter(Boolean).join(" "));
    }

    for (const script of Array.from(document.querySelectorAll("script[type='application/ld+json'],script[type='application/json']"))) {
      addEmails(script.textContent || "");
    }

    // Only consult Maps' large internal payload if normal Maps DOM extraction
    // found nothing. Require a nearby business identity signal so an unrelated
    // signed-in account email is not mistaken for the business email.
    if (!trusted.size) {
      try {
        const source = JSON.stringify(window.APP_INITIALIZATION_STATE || "");
        const rawEmails = Array.from(new Set(source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || []));
        const placeName = clean(document.querySelector("h1")?.textContent || "").toLowerCase();
        const nameTokens = placeName.split(/\s+/).filter(x => x.length >= 4).slice(0, 5);
        const pDigits = phoneDigits(phone).slice(-7);
        let siteHost = "";
        try { siteHost = new URL(website).hostname.toLowerCase().replace(/^www\./, ""); } catch (e) {}
        for (const raw of rawEmails.slice(0, 30)) {
          const email = raw.toLowerCase();
          const idx = source.toLowerCase().indexOf(email);
          if (idx < 0) continue;
          const segment = source.slice(Math.max(0, idx - 900), idx + 900).toLowerCase();
          const nearName = nameTokens.some(token => segment.includes(token));
          const nearPhone = pDigits && segment.replace(/\D/g, "").includes(pDigits);
          const nearSite = siteHost && segment.includes(siteHost);
          if (nearName || nearPhone || nearSite) addEmails(email);
        }
      } catch (e) {}
    }

    const list = Array.from(trusted);
    return { email: list[0] || "", emails: list.join(" | ") };
  })();
  const category = pick([".DkEaL", "button[jsaction*='category']", "button.DkEaL"], false);
  const hours = pick(["[aria-label*='Hours']", "[aria-label*='ساعات']"], true);
  const statusMatch = text.match(/(Open|Closed|مفتوح|مغلق)[^.،]{0,50}/i);

  return {
    name: clean(document.querySelector("h1")?.textContent) || pick([".DUwDvf", ".fontHeadlineLarge", "h1"], true),
    phone,
    address,
    website,
    imageUrl,
    emails: mapsEmailData.emails,
    email: mapsEmailData.email,
    ...socialProfiles,
    socialLinks: [socialProfiles.facebook, socialProfiles.instagram, socialProfiles.twitter, socialProfiles.linkedin, socialProfiles.youtube, socialProfiles.tiktok].filter(Boolean).join(" | "),
    category,
    rating,
    reviews,
    hours,
    status: statusMatch ? clean(statusMatch[0]) : "",
    mapsUrl: location.href,
    raw: text.slice(0, 1200)
  };
}

function splitEmails(value) {
  return unique(String(value || "").split(/\s*\|\s*|[,;\n\r]+/).map(x => clean(x).toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)));
}

function mergeWebsiteSignals(a = {}, b = {}) {
  const emailList = unique([...splitEmails(a.emails || a.email), ...splitEmails(b.emails || b.email)]).slice(0, 12);
  const out = {
    email: emailList[0] || clean(b.email || a.email),
    emails: emailList.join(" | "),
    facebook: clean(b.facebook || a.facebook),
    instagram: clean(b.instagram || a.instagram),
    twitter: clean(b.twitter || a.twitter),
    linkedin: clean(b.linkedin || a.linkedin),
    youtube: clean(b.youtube || a.youtube),
    tiktok: clean(b.tiktok || a.tiktok),
    contactPages: unique([...(Array.isArray(a.contactPages) ? a.contactPages : []), ...(Array.isArray(b.contactPages) ? b.contactPages : [])]),
    pageUrl: clean(b.pageUrl || a.pageUrl)
  };
  out.socialLinks = unique([out.facebook, out.instagram, out.twitter, out.linkedin, out.youtube, out.tiktok]).join(" | ");
  return out;
}

async function collectWebsiteDomStable(tabId, workerRunId, maxMs = 3000) {
  const started = Date.now();
  let found = {};
  for (const wait of [250, 650, 1100]) {
    if (workerRunId !== scanRunId || !state.running) break;
    await sleep(wait);
    found = mergeWebsiteSignals(found, await collectWebsiteDom(tabId));
    const hasContactPath = Array.isArray(found.contactPages) && found.contactPages.length > 0;
    if ((found.emails || found.email) && (found.facebook || found.instagram || hasContactPath)) break;
    if (Date.now() - started >= maxMs) break;
  }
  return found;
}

function sameSiteHost(a, b) {
  try {
    const ah = new URL(a).hostname.toLowerCase().replace(/^www\./, "");
    const bh = new URL(b).hostname.toLowerCase().replace(/^www\./, "");
    return ah === bh || ah.endsWith(`.${bh}`) || bh.endsWith(`.${ah}`);
  } catch { return false; }
}

function sitemapUrls(xml, baseUrl) {
  const out = [];
  for (const m of String(xml || "").matchAll(/<loc[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const raw = decodeHtmlEntities(m[1]).trim();
    try {
      const url = new URL(raw, baseUrl).href;
      if (safePublicUrl(url)) out.push(url);
    } catch {}
  }
  return unique(out);
}

function rankWebsitePages(urls, siteUrl) {
  const score = url => {
    let path = "";
    try { path = decodeURIComponent(new URL(url).pathname).toLowerCase(); } catch { return -999; }
    let s = 0;
    if (/(contact|contact-us|contacts|kontakt|impressum|imprint|contacto|contactos|contato|contatti|contatto|contactez|nous-contacter|iletisim|iletişim|контакт|اتصل|تواصل)/i.test(path)) s += 120;
    if (/(home|homepage|index|about|about-us|team|support|من-نحن|الرئيس)/i.test(path)) s += 70;
    if (/privacy|terms|cookie|product|shop|cart|checkout|blog|news|menu|food-menu/i.test(path)) s -= 45;
    const depth = path.split("/").filter(Boolean).length;
    s += Math.max(0, 20 - depth * 4);
    return s;
  };
  return unique(urls).filter(url => sameSiteHost(url, siteUrl) && !/\.(xml|pdf|jpg|jpeg|png|gif|webp|svg)(?:$|\?)/i.test(url)).sort((a,b) => score(b)-score(a));
}

async function discoverWebsitePages(siteUrl, workerRunId) {
  let origin;
  try { origin = new URL(siteUrl).origin; } catch { return []; }
  const roots = [`${origin}/sitemap.xml`, `${origin}/wp-sitemap.xml`, `${origin}/sitemap_index.xml`];
  try {
    const robots = await fetchText(`${origin}/robots.txt`, 3500);
    for (const m of String(robots || "").matchAll(/^\s*Sitemap:\s*(\S+)/gmi)) {
      try { const u = new URL(m[1], origin).href; if (safePublicUrl(u)) roots.push(u); } catch {}
    }
  } catch {}
  let discovered = [];
  let nested = [];
  for (const sitemap of roots) {
    if (workerRunId !== scanRunId || !state.running) break;
    const xml = await fetchText(sitemap, 4500);
    if (!xml || !/<(?:urlset|sitemapindex|loc)\b/i.test(xml)) continue;
    const urls = sitemapUrls(xml, sitemap);
    nested.push(...urls.filter(url => /\.xml(?:$|\?)/i.test(url)).slice(0, 3));
    discovered.push(...urls.filter(url => !/\.xml(?:$|\?)/i.test(url)));
    if (discovered.length >= 10) break;
  }
  for (const nestedMap of unique(nested).slice(0, 3)) {
    if (workerRunId !== scanRunId || !state.running) break;
    const xml = await fetchText(nestedMap, 4500);
    if (!xml) continue;
    discovered.push(...sitemapUrls(xml, nestedMap).filter(url => !/\.xml(?:$|\?)/i.test(url)));
    if (discovered.length >= 30) break;
  }
  return rankWebsitePages(discovered, siteUrl).slice(0, 6);
}

function fallbackWebsitePages(siteUrl) {
  try {
    const origin = new URL(siteUrl).origin;
    return [
      `${origin}/contact`, `${origin}/contact-us`, `${origin}/home/`, `${origin}/home`, `${origin}/about`, `${origin}/about-us`,
      `${origin}/kontakt`, `${origin}/impressum`, `${origin}/contacts`, `${origin}/support`, `${origin}/imprint`,
      `${origin}/contacto`, `${origin}/contatti`, `${origin}/contato`, `${origin}/iletisim`,
      `${origin}/en/contact`, `${origin}/en/home`, `${origin}/en/home-en`, `${origin}/ar/contact`, `${origin}/ar/home`
    ];
  } catch { return []; }
}

async function enrichFromWebsite(website, workerRunId = scanRunId) {
  website = normalizeWebsiteUrl(website);
  if (!safePublicUrl(website)) return {};
  const acquired = await acquireEnrichmentSlot(workerRunId);
  if (!acquired) return {};

  try {
    if (workerRunId !== scanRunId || !state.running) return {};

    // FAST PATH: extension fetch is much cheaper than opening a browser tab.
    // Start with the homepage, then a few high-value contact pages in parallel.
    let found = {};
    const homeHtml = await fetchText(website, 3200);
    if (homeHtml) found = mergeWebsiteSignals(found, extractWebsiteSignals(homeHtml, website));

    const linked = rankWebsitePages(found.contactPages || [], website);
    const fallbacks = fallbackWebsitePages(website);
    const quickPages = unique([...linked, ...fallbacks])
      .filter(url => safePublicUrl(url) && sameSiteHost(url, website) && url !== website)
      .slice(0, 4);

    if (!(found.email || found.emails) || !(found.facebook || found.instagram)) {
      const htmlResults = await Promise.all(quickPages.slice(0, 3).map(async url => [url, await fetchText(url, 3000)]));
      for (const [url, html] of htmlResults) {
        if (!html) continue;
        found = mergeWebsiteSignals(found, extractWebsiteSignals(html, url));
        if ((found.email || found.emails) && (found.facebook || found.instagram)) break;
      }
    }

    if (found.email || found.emails) return found;

    // One compact sitemap pass can find /home or /impressum when the homepage
    // hides its contact page. Keep it bounded so it never blocks the main scan.
    const sitemapPages = await discoverWebsitePagesFast(website, workerRunId);
    for (const url of sitemapPages.slice(0, 2)) {
      if (workerRunId !== scanRunId || !state.running) break;
      const html = await fetchText(url, 3000);
      if (!html) continue;
      found = mergeWebsiteSignals(found, extractWebsiteSignals(html, url));
      if (found.email || found.emails) return found;
    }

    // JS / anti-fetch fallback: at most two real website tabs globally.
    const tabAcquired = await acquireEnrichmentTabSlot(workerRunId);
    if (!tabAcquired) return found;
    let tab = null;
    try {
      tab = await chromeTabsCreate({ url: website, active: false });
      enrichmentTabs.add(tab.id);
      await waitForTabComplete(tab.id, 6500);
      let dom = await collectWebsiteDomStable(tab.id, workerRunId, 1800);
      found = mergeWebsiteSignals(found, dom);
      if (found.email || found.emails) return found;

      const domPages = rankWebsitePages(unique([...(dom.contactPages || []), ...quickPages, ...sitemapPages]), dom.pageUrl || website).slice(0, 2);
      for (const page of domPages) {
        if (workerRunId !== scanRunId || !state.running) break;
        try {
          await chromeTabsUpdate(tab.id, { url: page, active: false });
          await waitForTabComplete(tab.id, 5500);
          dom = await collectWebsiteDomStable(tab.id, workerRunId, 1600);
          found = mergeWebsiteSignals(found, dom);
          if (found.email || found.emails) break;
        } catch (e) {}
      }
      return found;
    } catch (e) {
      return found;
    } finally {
      if (tab?.id) {
        try { await chromeTabsRemove(tab.id); } catch (e) {}
        enrichmentTabs.delete(tab.id);
      }
      releaseEnrichmentTabSlot();
    }
  } finally {
    releaseEnrichmentSlot();
  }
}

async function discoverWebsitePagesFast(siteUrl, workerRunId) {
  let origin;
  try { origin = new URL(siteUrl).origin; } catch { return []; }
  const roots = [`${origin}/sitemap.xml`, `${origin}/wp-sitemap.xml`];
  let discovered = [];
  for (const sitemap of roots) {
    if (workerRunId !== scanRunId || !state.running) break;
    const xml = await fetchText(sitemap, 2500);
    if (!xml || !/<(?:urlset|sitemapindex|loc)\b/i.test(xml)) continue;
    discovered.push(...sitemapUrls(xml, sitemap).filter(url => !/\.xml(?:$|\?)/i.test(url)));
    if (discovered.length) break;
  }
  return rankWebsitePages(discovered, siteUrl).slice(0, 4);
}
async function fetchText(url, timeoutMs = 4500, redirects = 0) {
  url = normalizeWebsiteUrl(url);
  if (!safePublicUrl(url) || redirects > 4) return "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      headers: { "Accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.2" }
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return "";
      const redirected = new URL(next, url).href;
      return safePublicUrl(redirected) ? fetchText(redirected, timeoutMs, redirects + 1) : "";
    }
    const type = String(res.headers.get("content-type") || "");
    const declared = Number(res.headers.get("content-length") || 0);
    if (!res.ok || declared > 450000 || (type && !/html|text|xml|json/i.test(type))) return "";
    const reader = res.body?.getReader();
    if (!reader) return "";
    let total = 0, out = "";
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 450000) { await reader.cancel(); return ""; }
      out += decoder.decode(value, { stream: true });
    }
    return out + decoder.decode();
  } catch (e) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function normalizeWebsiteUrl(value) {
  let text = clean(value);
  if (!text) return "";
  if (!/^https?:\/\//i.test(text)) text = `https://${text.replace(/^\/+/, "")}`;
  try { return new URL(text).href; } catch { return ""; }
}

function safePublicUrl(value) {
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h === "0.0.0.0" || h === "127.0.0.1" || h === "::1") return false;
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    return true;
  } catch { return false; }
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function decodeCloudflareEmail(hex) {
  try {
    const key = parseInt(hex.slice(0, 2), 16);
    let out = "";
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key);
    return out;
  } catch { return ""; }
}

function extractHrefValues(html) {
  const out = [];
  const re = /\bhref\s*=\s*(["'])(.*?)\1/gi;
  let m;
  while ((m = re.exec(String(html || ""))) && out.length < 500) out.push(decodeHtmlEntities(m[2]));
  return out;
}

function extractContactPages(html, baseUrl) {
  const pages = [];
  const keyword = /(contact|contact-us|contacts|about|about-us|support|reach-us|get-in-touch|write-us|email-us|kontakt|kontakte|impressum|imprint|contacto|contactos|contato|contatti|contatto|contactez|nous-contacter|iletişim|iletisim|контакт|контакты|связаться|اتصل|تواصل|راسلنا|من-نحن)/i;
  const source = String(html || "");
  const anchorRe = /<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(source)) && pages.length < 50) {
    const href = decodeHtmlEntities(m[2]);
    const label = decodeHtmlEntities(m[3]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href) || !keyword.test(`${href} ${label}`)) continue;
    try {
      const url = new URL(href, baseUrl).href;
      if (safePublicUrl(url) && sameSiteHost(url, baseUrl)) pages.push(url);
    } catch (e) {}
  }
  return unique(pages);
}
function extractWebsiteSignals(html, baseUrl = "") {
  const source = decodeHtmlEntities(String(html || ""))
    .replace(/&#64;|&#x40;|&commat;/gi, "@")
    .replace(/\s*(\[at\]|\(at\)|\{at\})\s*/gi, "@")
    .replace(/\s*(\[dot\]|\(dot\)|\{dot\})\s*/gi, ".");

  const emailCandidates = [];
  emailCandidates.push(...(source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || []));
  for (const match of source.matchAll(/([A-Z0-9._%+-]{1,64})\s+at\s+([A-Z0-9.-]{1,190})\s+dot\s+([A-Z]{2,24})/gi)) emailCandidates.push(`${match[1]}@${match[2]}.${match[3]}`);
  for (const href of extractHrefValues(source)) {
    if (/^mailto:/i.test(href)) emailCandidates.push(href.replace(/^mailto:/i, "").split(/[?&,;]/)[0]);
    const cf = href.match(/\/cdn-cgi\/l\/email-protection#([0-9a-f]+)/i);
    if (cf) { const decoded = decodeCloudflareEmail(cf[1]); if (decoded) emailCandidates.push(decoded); }
  }
  for (const match of source.matchAll(/data-cfemail\s*=\s*["']([0-9a-f]{6,})["']/gi)) {
    const decoded = decodeCloudflareEmail(match[1]);
    if (decoded) emailCandidates.push(decoded);
  }
  const siteHost = (() => { try { return new URL(baseUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } })();
  const scoreEmail = email => {
    const value = String(email || "").toLowerCase();
    const domain = value.split("@")[1] || "";
    if (!domain || /^(example\.(com|org|net)|test\.com|localhost)$/.test(domain)) return -1000;
    let score = 0;
    if (siteHost && (domain === siteHost || siteHost.endsWith(`.${domain}`) || domain.endsWith(`.${siteHost}`))) score += 100;
    if (/^(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|protonmail\.com)$/.test(domain)) score += 25;
    if (/^(info|hello|contact|office|sales|support|booking|reservations?|admin|mail)@/i.test(value)) score += 15;
    if (/^(noreply|no-reply|donotreply|do-not-reply)@/i.test(value)) score -= 50;
    return score;
  };
  const emails = unique(emailCandidates.map(x => x.toLowerCase().trim())
    .filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) && !/\.(png|jpe?g|gif|webp|svg|woff2?|ttf|css|js)$/i.test(x) && scoreEmail(x) > -1000))
    .sort((a,b) => scoreEmail(b) - scoreEmail(a))
    .slice(0, 12);

  const urls = [];
  for (const href of extractHrefValues(source)) {
    if (!href || /^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    try {
      const absolute = new URL(href, baseUrl || undefined).href;
      if (/^https?:\/\//i.test(absolute)) urls.push(cleanUrl(absolute));
    } catch (e) {}
  }
  urls.push(...Array.from(source.matchAll(/https?:\/\/[^\s"'<>\\)]+/gi), m => cleanUrl(m[0])));
  const uniqueUrls = unique(urls);
  const social = {
    facebook: first(uniqueUrls, /facebook\.com|fb\.com/i),
    instagram: first(uniqueUrls, /instagram\.com/i),
    twitter: first(uniqueUrls, /twitter\.com|x\.com/i),
    linkedin: first(uniqueUrls, /linkedin\.com/i),
    youtube: first(uniqueUrls, /youtube\.com|youtu\.be/i),
    tiktok: first(uniqueUrls, /tiktok\.com/i)
  };
  const socialLinks = unique(Object.values(social).filter(Boolean)).join(" | ");
  return {
    email: emails[0] || "",
    emails: emails.join(" | "),
    socialLinks,
    ...social,
    contactPages: extractContactPages(source, baseUrl)
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

const PHONE_COUNTRY_RULES = [
  { code: "218", aliases: ["libya", "ليبيا"] },
  { code: "49", aliases: ["germany", "deutschland", "ألمانيا", "المانيا"] },
  { code: "20", aliases: ["egypt", "مصر"] },
  { code: "216", aliases: ["tunisia", "تونس"] },
  { code: "213", aliases: ["algeria", "الجزائر"] },
  { code: "212", aliases: ["morocco", "المغرب"] },
  { code: "966", aliases: ["saudi arabia", "saudi", "السعودية", "المملكة العربية السعودية"] },
  { code: "971", aliases: ["united arab emirates", "uae", "الإمارات", "الامارات"] },
  { code: "974", aliases: ["qatar", "قطر"] },
  { code: "965", aliases: ["kuwait", "الكويت"] },
  { code: "973", aliases: ["bahrain", "البحرين"] },
  { code: "968", aliases: ["oman", "عمان"] },
  { code: "962", aliases: ["jordan", "الأردن", "الاردن"] },
  { code: "961", aliases: ["lebanon", "لبنان"] },
  { code: "963", aliases: ["syria", "سوريا"] },
  { code: "964", aliases: ["iraq", "العراق"] },
  { code: "970", aliases: ["palestine", "فلسطين"] },
  { code: "90", aliases: ["turkey", "türkiye", "turkiye", "تركيا"] },
  { code: "44", aliases: ["united kingdom", "uk", "england", "scotland", "wales", "britain", "المملكة المتحدة", "بريطانيا"] },
  { code: "33", aliases: ["france", "فرنسا"] },
  { code: "39", aliases: ["italy", "italia", "إيطاليا", "ايطاليا"], keepTrunkZero: true },
  { code: "34", aliases: ["spain", "españa", "espana", "إسبانيا", "اسبانيا"] },
  { code: "31", aliases: ["netherlands", "holland", "هولندا"] },
  { code: "32", aliases: ["belgium", "بلجيكا"] },
  { code: "41", aliases: ["switzerland", "سويسرا"] },
  { code: "43", aliases: ["austria", "النمسا"] },
  { code: "46", aliases: ["sweden", "السويد"] },
  { code: "47", aliases: ["norway", "النرويج"] },
  { code: "45", aliases: ["denmark", "الدنمارك"] },
  { code: "358", aliases: ["finland", "فنلندا"] },
  { code: "48", aliases: ["poland", "بولندا"] },
  { code: "420", aliases: ["czech republic", "czechia", "التشيك"] },
  { code: "421", aliases: ["slovakia", "سلوفاكيا"] },
  { code: "36", aliases: ["hungary", "المجر"] },
  { code: "40", aliases: ["romania", "رومانيا"] },
  { code: "359", aliases: ["bulgaria", "بلغاريا"] },
  { code: "30", aliases: ["greece", "اليونان"] },
  { code: "351", aliases: ["portugal", "البرتغال"] },
  { code: "353", aliases: ["ireland", "أيرلندا", "ايرلندا"] },
  { code: "385", aliases: ["croatia", "كرواتيا"] },
  { code: "381", aliases: ["serbia", "صربيا"] },
  { code: "386", aliases: ["slovenia", "سلوفينيا"] },
  { code: "387", aliases: ["bosnia and herzegovina", "bosnia", "البوسنة"] },
  { code: "355", aliases: ["albania", "ألبانيا", "البانيا"] },
  { code: "389", aliases: ["north macedonia", "macedonia", "مقدونيا"] },
  { code: "380", aliases: ["ukraine", "أوكرانيا", "اوكرانيا"] },
  { code: "7", aliases: ["russia", "russian federation", "روسيا"] },
  { code: "1", aliases: ["united states", "usa", "u.s.a", "canada", "الولايات المتحدة", "أمريكا", "امريكا", "كندا"], noTrunk: true },
  { code: "52", aliases: ["mexico", "méxico", "المكسيك"] },
  { code: "55", aliases: ["brazil", "البرازيل"] },
  { code: "54", aliases: ["argentina", "الأرجنتين", "الارجنتين"] },
  { code: "56", aliases: ["chile", "تشيلي"] },
  { code: "57", aliases: ["colombia", "كولومبيا"] },
  { code: "51", aliases: ["peru", "بيرو"] },
  { code: "61", aliases: ["australia", "أستراليا", "استراليا"] },
  { code: "64", aliases: ["new zealand", "نيوزيلندا"] },
  { code: "86", aliases: ["china", "الصين"] },
  { code: "81", aliases: ["japan", "اليابان"] },
  { code: "82", aliases: ["south korea", "korea", "كوريا الجنوبية"] },
  { code: "91", aliases: ["india", "الهند"] },
  { code: "92", aliases: ["pakistan", "باكستان"] },
  { code: "880", aliases: ["bangladesh", "بنغلاديش"] },
  { code: "62", aliases: ["indonesia", "إندونيسيا", "اندونيسيا"] },
  { code: "60", aliases: ["malaysia", "ماليزيا"] },
  { code: "65", aliases: ["singapore", "سنغافورة"] },
  { code: "66", aliases: ["thailand", "تايلاند"] },
  { code: "84", aliases: ["vietnam", "فيتنام"] },
  { code: "63", aliases: ["philippines", "الفلبين"] },
  { code: "27", aliases: ["south africa", "جنوب أفريقيا", "جنوب افريقيا"] },
  { code: "234", aliases: ["nigeria", "نيجيريا"] },
  { code: "254", aliases: ["kenya", "كينيا"] },
  { code: "251", aliases: ["ethiopia", "إثيوبيا", "اثيوبيا"] },
  { code: "233", aliases: ["ghana", "غانا"] }
];

function phoneAliasMatches(text, alias) {
  const source = String(text || "").toLowerCase();
  const needle = String(alias || "").toLowerCase();
  if (!needle) return false;
  if (/^[a-z.]{1,3}$/.test(needle)) {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i").test(source);
  }
  return source.includes(needle);
}

function detectPhoneCountryRule(lead) {
  const selected = clean(lead?.searchCountry);
  if (selected) {
    const direct = PHONE_COUNTRY_RULES.find(rule => rule.code === selected);
    if (direct) return direct;
  }
  const haystack = `${clean(lead?.address)} ${clean(lead?.searchCity)} ${clean(lead?.raw)}`;
  let best = null;
  for (const rule of PHONE_COUNTRY_RULES) {
    for (const alias of rule.aliases) {
      if (!phoneAliasMatches(haystack, alias)) continue;
      if (!best || alias.length > best.alias.length) best = { rule, alias };
    }
  }
  return best?.rule || null;
}

function normalizeInternationalPhone(value, lead = {}) {
  let text = String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/\u2060/g, " ")
    .trim();
  if (!text) return "";

  // Use only the first phone-looking run from a dedicated phone element.
  const candidates = text.match(/(?:\+|00)?\d[\d\s().-]{5,}\d/g) || [];
  let raw = "";
  for (const candidate of candidates) {
    const d = candidate.replace(/\D/g, "");
    if (d.length >= 7 && d.length <= 15 && !/^(\d)\1{6,}$/.test(d)) { raw = candidate.trim(); break; }
  }
  if (!raw) return "";

  let digits = raw.replace(/\D/g, "");
  if (/^\s*\+/.test(raw)) {
    if (digits.length < 8 || digits.length > 15) return "";
    return `+${digits}`;
  }
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    if (digits.length < 8 || digits.length > 15) return "";
    return `+${digits}`;
  }

  const rule = detectPhoneCountryRule(lead);
  if (!rule) return ""; // Never guess a country code.
  if (digits.startsWith(rule.code) && digits.length >= rule.code.length + 7 && digits.length <= 15) return `+${digits}`;

  let national = digits;
  if (!rule.noTrunk && !rule.keepTrunkZero) national = national.replace(/^0+/, "");
  // Precision-first validation: reject obviously short codes / IDs.
  if (national.length < 7 || national.length > 12) return "";
  const international = `${rule.code}${national}`;
  if (international.length < 8 || international.length > 15) return "";
  return `+${international}`;
}

function normalizeLead(lead) {
  const rawPhone=clean(lead?.phoneRaw||lead?.phone);
  const phone=normalizeInternationalPhone(rawPhone, lead);
  return {
    name: clean(lead?.name),
    phone,
    phoneRaw: rawPhone,
    phoneStatus: phone?'international_valid':rawPhone?'rejected':'missing',
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

function resetEnrichmentRuntime() {
  pendingEnrichment = new Set();
  enrichmentCache = new Map();
  enrichmentJobs = new Map();
  enrichmentActive = 0;
  enrichmentTabActive = 0;
  for (const resolve of enrichmentWaiters.splice(0)) { try { resolve(); } catch (e) {} }
  for (const resolve of enrichmentTabWaiters.splice(0)) { try { resolve(); } catch (e) {} }
}

async function stopScan(status = "Stopped.", silent = false) {
  scanRunId += 1;
  resetEnrichmentRuntime();
  collectorSessionId += 1;
  state.running = false;
  state.paused = false;
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
  for (const tabId of Array.from(enrichmentTabs)) {
    try { await chromeTabsRemove(tabId); } catch (e) {}
  }
  enrichmentTabs.clear();
  activeWorkers = 0;
  if (!silent) {
    await persist();
    await broadcast();
  }
  return { ok: true };
}


async function stopAll() {
  const saved = state.leads.length;
  await stopScan(`Stopped all work. Kept ${saved} completed lead${saved === 1 ? "" : "s"}.`, true);
  state.phase = "Stopped";
  state.status = `Stopped all work. Kept ${saved} completed lead${saved === 1 ? "" : "s"}.`;
  await persist(true);
  await broadcast(true);
  return { ok: true, saved };
}

async function pauseScan(status, currentItem) {
  state.running=false;
  state.paused=true;
  state.phase="Paused";
  state.status=`${status} Work is saved; retry when access is available.`;
  if(currentItem){const key=currentItem.mapsUrl||`${currentItem.name}|${currentItem.address}`;if(!processedKeys.has(key)&&!queue.some(x=>(x.mapsUrl||`${x.name}|${x.address}`)===key))queue.unshift(currentItem);}
  for(const tabId of Array.from(workerTabs)){try{await chromeTabsRemove(tabId);}catch(e){}}
  workerTabs.clear();
  for(const tabId of Array.from(enrichmentTabs)){try{await chromeTabsRemove(tabId);}catch(e){}}
  enrichmentTabs.clear();
  resetEnrichmentRuntime();
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
  resetEnrichmentRuntime();
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
  for (const tabId of Array.from(enrichmentTabs)) {
    try { await chromeTabsRemove(tabId); } catch (e) {}
  }
  enrichmentTabs.clear();
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
      enrichmentTabs: Array.from(enrichmentTabs),
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
    state.leads = (Array.isArray(storedLeads)
      ? storedLeads
      : (Array.isArray(storedState?.leads) ? storedState.leads : []))
      .map(item => normalizeLead(item));

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

      const orphanTabs = [
        ...(Array.isArray(runtime.workerTabs) ? runtime.workerTabs : []),
        ...(Array.isArray(runtime.enrichmentTabs) ? runtime.enrichmentTabs : [])
      ].filter(Number.isInteger);
      for (const tabId of orphanTabs) {
        try { await chromeTabsRemove(tabId); } catch (e) {}
      }
    }

    workerTabs = new Set();
    enrichmentTabs = new Set();
    resetEnrichmentRuntime();
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
