let collecting = false;
let stopRequested = false;
let seen = new Set();
let cachedScroller = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "PING_COLLECTOR") {
    sendResponse({ ok: true, collecting, count: seen.size });
    return false;
  }
  if (message?.type === "COLLECT_PLACES") {
    if (collecting) {
      sendResponse({ ok: true, alreadyRunning: true, count: seen.size });
      return false;
    }
    collectPlaces(message).then(result => sendResponse(result));
    return true;
  }
  if (message?.type === "STOP_COLLECTING") {
    stopRequested = true;
    collecting = false;
    sendResponse({ ok: true });
  }
});

async function collectPlaces(options = {}) {
  collecting = true;
  stopRequested = false;
  seen = new Set();
  cachedScroller = null;
  const maxRounds = Number(options.maxRounds || 70);
  const minPlaces = Number(options.minPlaces || 0);
  const sessionId = options.sessionId || 0;

  const mapReady = await waitForMap(25000);
  if (!mapReady) {
    collecting = false;
    sendStatus("Google Maps results did not load in time. Moving on instead of waiting indefinitely.", sessionId);
    chrome.runtime.sendMessage({ type: "COLLECT_DONE", count: 0, sessionId });
    return { ok: false, timeout: true, count: 0 };
  }
  sendStatus("Collecting Google Maps result links...", sessionId);

  let stable = 0;
  let lastCount = 0;

  for (let round = 0; collecting && round < maxRounds; round++) {
    const blockReason = detectMapsBlock();
    if (blockReason) {
      sendStatus(blockReason, sessionId);
      break;
    }

    const batch = captureCards();
    if (batch.length) {
      chrome.runtime.sendMessage({ type: "PLACES_BATCH", places: batch, sessionId });
    }

    if (seen.size === lastCount) stable += 1;
    else stable = 0;
    lastCount = seen.size;

    chrome.runtime.sendMessage({ type: "COLLECT_PROGRESS", count: seen.size, sessionId });
    if (stable >= 10 && seen.size >= minPlaces) break;
    if (isEndVisible() && stable >= 4) break;

    scrollResults();
    await sleep(900);
  }

  if (stopRequested) {
    collecting = false;
    return { ok: true, stopped: true, count: seen.size };
  }

  sendStatus("Scan finished. Waiting 10 seconds for final Maps results before extraction...", sessionId);
  await sleep(10000);
  if (stopRequested || !collecting) {
    collecting = false;
    return { ok: true, stopped: true, count: seen.size };
  }

  const finalBatch = captureCards();
  if (finalBatch.length) {
    chrome.runtime.sendMessage({ type: "PLACES_BATCH", places: finalBatch, sessionId });
  }

  collecting = false;
  chrome.runtime.sendMessage({ type: "COLLECT_DONE", count: seen.size, sessionId });
  return { ok: true, count: seen.size };
}

function captureCards() {
  const places = [];
  const anchors = Array.from(document.querySelectorAll("a.hfpxzc[href], a[href*='/maps/place/'], a[href*='google.com/maps/place']"));

  for (const anchor of anchors) {
    const mapsUrl = normalizeMapsUrl(anchor.href);
    if (!mapsUrl || seen.has(mapsUrl)) continue;
    seen.add(mapsUrl);

    const card = anchor.closest("[role='article'], .Nv2PK, .THOPZb, .bfdHYd") || anchor.parentElement || anchor;
    const place = {
      name: clean(anchor.getAttribute("aria-label")) || pick(card, [".qBF1Pd", ".fontHeadlineSmall", ".NrDZNb", "h3"], true),
      phone: extractPhone(card),
      address: extractAddress(card),
      category: extractCategory(card),
      rating: normalizeRating(pick(card, [".MW4etd", "span.ceNzKf", "[aria-label*='stars']", "[aria-label*='نجمة']"], true)),
      reviews: extractReviews(clean(card.textContent)),
      imageUrl: extractImage(card),
      mapsUrl,
      raw: clean(card.textContent).slice(0, 600)
    };
    places.push(place);
  }

  return places;
}

function normalizeMapsUrl(url) {
  try {
    const u = new URL(url, location.href);
    if (!/\/maps\/place\//.test(u.href) && !/google\.[^/]+\/maps\/place/.test(u.href)) return "";
    u.hash = "";
    u.search = "";
    return u.href;
  } catch (e) {
    return "";
  }
}

function scrollResults() {
  const scroller = getScroller();
  if (scroller && scroller !== document.documentElement && scroller !== document.body) {
    scroller.scrollBy({ top: Math.max(650, scroller.clientHeight * .85), behavior: "auto" });
  } else {
    window.scrollBy({ top: Math.max(650, window.innerHeight * .85), behavior: "auto" });
  }
}

function getScroller() {
  if (cachedScroller?.isConnected && cachedScroller.scrollHeight > cachedScroller.clientHeight + 100) {
    return cachedScroller;
  }
  const direct = document.querySelector("div[role='feed']") || document.querySelector(".m6QErb[aria-label]");
  if (direct && direct.scrollHeight > direct.clientHeight + 100) {
    cachedScroller = direct;
    return cachedScroller;
  }
  const candidates = Array.from(document.querySelectorAll("div")).filter(el => {
    const style = getComputedStyle(el);
    return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 200;
  });
  cachedScroller = candidates.sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || document.scrollingElement || document.documentElement;
  return cachedScroller;
}

function isEndVisible() {
  const text = clean(document.body.textContent).toLowerCase();
  return text.includes("you've reached the end") ||
    text.includes("no more results") ||
    text.includes("وصلت إلى نهاية القائمة") ||
    text.includes("لا توجد نتائج أخرى");
}

function detectMapsBlock() {
  const text = clean(document.body?.textContent || "").toLowerCase();
  if (/unusual traffic|automated queries|verify you are human|our systems have detected/i.test(text)) {
    return "Google Maps requested verification. Extraction stopped for this city to avoid getting stuck.";
  }
  if (/captcha|recaptcha/i.test(text) && document.querySelector("iframe[src*='recaptcha'], [class*='captcha'], #captcha")) {
    return "Google Maps verification page detected. Extraction stopped for this city to avoid getting stuck.";
  }
  return "";
}

async function waitForMap(timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (document.querySelector("a.hfpxzc[href], a[href*='/maps/place/'], div[role='feed']")) return true;
    await sleep(350);
  }
  return false;
}

function sendStatus(status, sessionId = 0) {
  chrome.runtime.sendMessage({ type: "CONTENT_STATUS", status, sessionId });
}

function pick(root, selectors, includeAria = false) {
  for (const selector of selectors) {
    const el = root?.querySelector?.(selector);
    if (!el) continue;
    const text = clean(el.textContent);
    if (text) return text;
    if (includeAria) {
      const aria = clean(el.getAttribute("aria-label"));
      if (aria) return aria;
    }
  }
  return "";
}

function extractPhone(root) {
  const text = clean(root?.textContent || "");
  const match = toEnglishDigits(text).match(/\+?\d[\d\s().-]{6,}\d/g);
  return match ? clean(match[0]) : "";
}

function extractAddress(root) {
  const text = clean(root?.textContent || "");
  const parts = text.split("·").map(clean).filter(Boolean);
  return parts.find(part => part.length > 8 && !findPhone(part) && !/stars|reviews|open|closed/i.test(part)) || "";
}

function extractCategory(root) {
  const text = clean(root?.textContent || "");
  const parts = text.split("·").map(clean).filter(Boolean);
  return parts.find(part => part.length > 2 && part.length < 45 && !findPhone(part) && !/\d/.test(part)) || "";
}

function extractReviews(text) {
  const match = String(text || "").match(/\(([\d,.\s]+)\)|([\d,.\s]+)\s*(reviews|review|مراجعة)/i);
  return clean((match && (match[1] || match[2])) || "").replace(/[^\d]/g, "");
}

function extractImage(root) {
  const images = [];
  const add = value => {
    const url = clean(value);
    if (!/^https?:\/\//i.test(url)) return;
    if (!/(googleusercontent|ggpht|gstatic|lh3\.google|streetviewpixels)/i.test(url)) return;
    if (/icon|marker|sprite|transparent|blank/i.test(url)) return;
    images.push(url.replace(/=w\d+-h\d+[^&\s"')>]*/i, "=w900-h700-k-no"));
  };
  root?.querySelectorAll?.("img")?.forEach(img => {
    add(img.currentSrc || img.src);
    add(img.getAttribute("data-src"));
    add(img.getAttribute("srcset")?.split(/\s+/)[0]);
  });
  root?.querySelectorAll?.("[style*='background-image']")?.forEach(el => {
    const match = String(el.getAttribute("style") || "").match(/url\((['"]?)(.*?)\1\)/i);
    if (match) add(match[2]);
  });
  return images[0] || "";
}

function findPhone(text) {
  const match = toEnglishDigits(String(text || "")).match(/\+?\d[\d\s().-]{6,}\d/g);
  return match ? match[0] : "";
}

function normalizeRating(text) {
  const match = String(text || "").replace(",", ".").match(/\d+(\.\d+)?/);
  return match ? match[0] : "";
}

function clean(value) {
  return String(value || "").replace(/\u200e|\u200f/g, "").replace(/\s+/g, " ").trim();
}

function toEnglishDigits(value) {
  return String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
