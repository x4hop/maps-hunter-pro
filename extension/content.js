let collecting = false;
let stopRequested = false;
let seen = new Set();
let cardSnapshots = new Map();
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
  cardSnapshots = new Map();
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
  sendStatus("Collecting Google Maps result cards...", sessionId);

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
    if (stable >= 7 && seen.size >= minPlaces) break;
    if (isEndVisible() && stable >= 3) break;

    scrollResults();
    await sleep(650);
  }

  if (stopRequested) {
    collecting = false;
    return { ok: true, stopped: true, count: seen.size };
  }

  // One short settle pass is enough. The old 10-second final wait made the
  // extension feel frozen even though useful result cards were already ready.
  sendStatus("Final Maps card pass...", sessionId);
  await sleep(1800);
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
    if (!mapsUrl) continue;

    const card = anchor.closest("[role='article'], .Nv2PK, .THOPZb, .bfdHYd") || anchor.parentElement || anchor;
    const emailData = extractEmail(card);
    const socials = extractSocialLinks(card);
    const place = {
      name: clean(anchor.getAttribute("aria-label")) || pick(card, [".qBF1Pd", ".fontHeadlineSmall", ".NrDZNb", "h3"], true),
      phone: extractPhone(card),
      address: extractAddress(card),
      website: extractWebsite(card),
      email: emailData.email,
      emails: emailData.emails,
      facebook: socials.facebook,
      instagram: socials.instagram,
      twitter: socials.twitter,
      linkedin: socials.linkedin,
      youtube: socials.youtube,
      tiktok: socials.tiktok,
      socialLinks: socials.socialLinks,
      category: extractCategory(card),
      rating: normalizeRating(pick(card, [".MW4etd", "span.ceNzKf", "[aria-label*='stars']", "[aria-label*='نجمة']"], true)),
      reviews: extractReviews(clean(card.textContent)),
      imageUrl: extractImage(card),
      mapsUrl,
      raw: clean(card.textContent).slice(0, 900)
    };

    // Google Maps hydrates card controls progressively. Do not permanently
    // ignore a card after the first sighting: resend only when useful fields
    // become richer (phone / website / email / social / address).
    const previous = cardSnapshots.get(mapsUrl);
    seen.add(mapsUrl);
    if (!previous || hasUsefulCardUpdate(previous, place)) {
      cardSnapshots.set(mapsUrl, place);
      places.push(place);
    }
  }

  return places;
}

function hasUsefulCardUpdate(previous, next) {
  if (!previous) return true;
  const keys = ["name", "phone", "address", "website", "email", "emails", "facebook", "instagram", "twitter", "linkedin", "youtube", "tiktok", "category", "rating", "reviews"];
  return keys.some(key => !clean(previous[key]) && clean(next[key]));
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

function normalizeExternalHref(value) {
  try {
    const u = new URL(value, location.href);
    if (!/^https?:$/.test(u.protocol)) return "";
    const h = u.hostname.toLowerCase();
    if (/^(www\.)?google\./.test(h)) {
      const target = u.searchParams.get("q") || u.searchParams.get("url");
      if (target) return normalizeExternalHref(target);
      return "";
    }
    if (/googleusercontent|gstatic|ggpht|streetviewpixels/i.test(h)) return "";
    return u.href;
  } catch (e) {
    return "";
  }
}

function extractWebsite(root) {
  const labelled = [
    "a[data-value='Website'][href]",
    "a[data-item-id='authority'][href]",
    "a[aria-label*='Website'][href]",
    "a[aria-label*='website'][href]",
    "a[aria-label*='الموقع'][href]",
    "a[aria-label*='Site web'][href]",
    "a[aria-label*='Webseite'][href]"
  ];
  for (const selector of labelled) {
    for (const a of Array.from(root?.querySelectorAll?.(selector) || [])) {
      const href = normalizeExternalHref(a.href || a.getAttribute("href"));
      if (href && !isSocialUrl(href)) return href;
    }
  }

  for (const a of Array.from(root?.querySelectorAll?.("a[href^='http']") || [])) {
    const href = normalizeExternalHref(a.href || a.getAttribute("href"));
    if (!href || isSocialUrl(href) || /google\.com\/maps|\/maps\//i.test(href)) continue;
    const label = clean(`${a.textContent || ""} ${a.getAttribute("aria-label") || ""}`);
    if (/website|site web|webseite|sitio web|sito web|الموقع|موقع إلكتروني/i.test(label)) return href;
  }
  return "";
}

function extractEmail(root) {
  const candidates = [];
  for (const a of Array.from(root?.querySelectorAll?.("a[href^='mailto:']") || [])) {
    const value = String(a.getAttribute("href") || "").replace(/^mailto:/i, "").split(/[?&,;]/)[0].trim();
    if (value) candidates.push(value);
  }
  const text = clean(root?.textContent || "")
    .replace(/\s*(\[at\]|\(at\)|\{at\})\s*/gi, "@")
    .replace(/\s*(\[dot\]|\(dot\)|\{dot\})\s*/gi, ".");
  candidates.push(...(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || []));
  const emails = Array.from(new Set(candidates.map(v => v.toLowerCase()).filter(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))));
  return { email: emails[0] || "", emails: emails.join(" | ") };
}

function extractSocialLinks(root) {
  const urls = Array.from(root?.querySelectorAll?.("a[href]") || [])
    .map(a => normalizeExternalHref(a.href || a.getAttribute("href")))
    .filter(Boolean);
  const firstMatch = re => urls.find(url => re.test(url) && !/share|intent|sharer/i.test(url)) || "";
  const social = {
    facebook: firstMatch(/facebook\.com|fb\.com/i),
    instagram: firstMatch(/instagram\.com/i),
    twitter: firstMatch(/twitter\.com|x\.com/i),
    linkedin: firstMatch(/linkedin\.com/i),
    youtube: firstMatch(/youtube\.com|youtu\.be/i),
    tiktok: firstMatch(/tiktok\.com/i)
  };
  social.socialLinks = Array.from(new Set(Object.values(social).filter(Boolean))).join(" | ");
  return social;
}

function isSocialUrl(url) {
  return /facebook\.com|fb\.com|instagram\.com|twitter\.com|x\.com|linkedin\.com|youtube\.com|youtu\.be|tiktok\.com/i.test(String(url || ""));
}

function scrollResults() {
  const scroller = getScroller();
  if (scroller && scroller !== document.documentElement && scroller !== document.body) {
    scroller.scrollBy({ top: Math.max(700, scroller.clientHeight * .95), behavior: "auto" });
  } else {
    window.scrollBy({ top: Math.max(700, window.innerHeight * .95), behavior: "auto" });
  }
}

function getScroller() {
  if (cachedScroller?.isConnected && cachedScroller.scrollHeight > cachedScroller.clientHeight + 100) return cachedScroller;
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
  return text.includes("you've reached the end") || text.includes("no more results") || text.includes("وصلت إلى نهاية القائمة") || text.includes("لا توجد نتائج أخرى");
}

function detectMapsBlock() {
  const text = clean(document.body?.textContent || "").toLowerCase();
  if (/unusual traffic|automated queries|verify you are human|our systems have detected/i.test(text)) return "Google Maps requested verification. Extraction stopped for this city to avoid getting stuck.";
  if (/captcha|recaptcha/i.test(text) && document.querySelector("iframe[src*='recaptcha'], [class*='captcha'], #captcha")) return "Google Maps verification page detected. Extraction stopped for this city to avoid getting stuck.";
  return "";
}

async function waitForMap(timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (document.querySelector("a.hfpxzc[href], a[href*='/maps/place/'], div[role='feed']")) return true;
    await sleep(300);
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
  const toPhone = value => {
    const source = toEnglishDigits(String(value || "")).replace(/\u2060/g, " ").trim();
    const candidates = source.match(/(?:\+|00)?\d[\d\s().-]{5,}\d/g) || [];
    for (const candidate of candidates) {
      const digits = candidate.replace(/\D/g, "");
      if (digits.length < 7 || digits.length > 15) continue;
      if (/^(\d)\1{6,}$/.test(digits)) continue;
      if (/^\s*00/.test(candidate)) return `+${digits.slice(2)}`;
      if (/^\s*\+/.test(candidate)) return `+${digits}`;
      return clean(candidate);
    }
    return "";
  };

  const selectors = ["a[href^='tel:']", "[data-item-id*='phone']", "[aria-label*='Phone']", "[aria-label*='phone']", "[aria-label*='الهاتف']", "[aria-label*='هاتف']"];
  for (const selector of selectors) {
    for (const node of Array.from(root?.querySelectorAll?.(selector) || [])) {
      const values = [node.getAttribute?.("data-item-id"), node.getAttribute?.("href"), node.getAttribute?.("aria-label"), node.textContent].filter(Boolean);
      for (const value of values) { const phone = toPhone(value); if (phone && phone.startsWith("+")) return phone; }
      for (const value of values) { const phone = toPhone(value); if (phone) return phone; }
    }
  }

  // Conservative card-text fallback: only accept a full phone-sized run,
  // never short review/rating/address fragments.
  const lines = String(root?.innerText || "").split(/\n+/).map(clean).filter(Boolean);
  for (const line of lines) {
    if (/reviews?|stars?|مراجعة|نجمة/i.test(line)) continue;
    const candidate = toPhone(line);
    if (!candidate) continue;
    const digits = candidate.replace(/\D/g, "");
    if (digits.length >= 9 || candidate.startsWith("+")) return candidate;
  }
  return "";
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
