// Maps Hunter Pro v1.0.0 — resilient Google Maps contact extraction.
// Runs after the stable engine and Maps overrides. It never opens or fetches
// business websites; it only waits for and reads data already present in Maps.

async function processPlace(preview, workerRunId = scanRunId) {
  let tab = null;
  const key = preview.mapsUrl || `${preview.name}|${preview.address}`;
  try {
    state.phase = "Extracting";
    state.status = `Extracting Maps details: ${preview.name || "place"}`;
    await broadcast();

    tab = await chromeTabsCreate({ url: preview.mapsUrl, active: false });
    workerTabs.add(tab.id);
    await persistRuntime();

    await waitForTabComplete(tab.id, 9000);

    let details = {};
    let lastFingerprint = "";
    let stableReads = 0;
    const started = Date.now();
    const maxWait = 10000;

    while (Date.now() - started < maxWait) {
      if (workerRunId !== scanRunId || !state.running) return;

      const next = await extractFromMapsTab(tab.id);
      details = mergeLead(details, next);

      const fingerprint = [
        details.name,
        details.phone,
        details.email,
        details.website,
        details.address
      ].join("|");

      if (fingerprint && fingerprint === lastFingerprint) stableReads += 1;
      else stableReads = 0;
      lastFingerprint = fingerprint;

      const hasPrimaryContact = Boolean(details.phone || details.email || details.website);
      const hasUsefulCard = Boolean(details.name && (details.address || details.category || details.rating));
      const elapsed = Date.now() - started;

      if (hasPrimaryContact && stableReads >= 1 && elapsed >= 900) break;
      if (hasUsefulCard && stableReads >= 2 && elapsed >= 3200) break;

      await sleep(420);
    }

    if (workerRunId !== scanRunId || !state.running) return;
    const lead = mergeLead(preview, details);

    preview.usageRequestId ||= crypto.randomUUID();
    inFlightItems.set(key, preview);
    await persistRuntime();
    await MHPAccess.consume(preview.usageRequestId);
    if (workerRunId !== scanRunId || !state.running) return;

    addLead(lead);
    processedKeys.add(key);
    const contactBits = [lead.email ? "email" : "", lead.phone ? "phone" : ""].filter(Boolean).join(" + ");
    state.status = contactBits
      ? `Saved ${state.leads.length} with ${contactBits}. Queue ${queue.length}.`
      : `Saved ${state.leads.length}. No Maps contact exposed. Queue ${queue.length}.`;
  } catch (error) {
    if (error.accessError && workerRunId === scanRunId) {
      await pauseScan(error.message, preview);
      return;
    }
    if (workerRunId === scanRunId && state.running) {
      try {
        preview.usageRequestId ||= crypto.randomUUID();
        inFlightItems.set(key, preview);
        await persistRuntime();
        await MHPAccess.consume(preview.usageRequestId);
      } catch (access) {
        if (access.accessError) {
          await pauseScan(access.message, preview);
          return;
        }
      }
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

function extractGoogleMapsPlace() {
  const cleanLocal = value => String(value || "")
    .replace(/\u200e|\u200f/g, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
  const toEnglishDigits = value => String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const unique = values => Array.from(new Set((values || []).map(cleanLocal).filter(Boolean)));

  const doc = document.documentElement || document.body;
  const root = document.querySelector("div[role='main']") || document.body || doc;
  const text = cleanLocal(root?.textContent || "");
  const fullText = cleanLocal(doc?.textContent || text);
  const fullHtml = String(doc?.innerHTML || "");

  const decodeLoose = value => {
    let source = String(value || "")
      .replace(/\\u002f/gi, "/")
      .replace(/\\u003a/gi, ":")
      .replace(/\\u0040/gi, "@")
      .replace(/\\u002e/gi, ".")
      .replace(/\\x40/gi, "@")
      .replace(/\\x2e/gi, ".")
      .replace(/%40/gi, "@")
      .replace(/%2e/gi, ".")
      .replace(/%3a/gi, ":")
      .replace(/&#64;|&#x40;|&commat;/gi, "@")
      .replace(/&#46;|&#x2e;/gi, ".")
      .replace(/&amp;/gi, "&")
      .replace(/\s*(\[at\]|\(at\))\s*/gi, "@")
      .replace(/\s*(\[dot\]|\(dot\))\s*/gi, ".");
    try { source = decodeURIComponent(source); } catch (e) {}
    return source;
  };

  const findPhones = value => {
    const source = toEnglishDigits(decodeLoose(value))
      .replace(/tel:/gi, " ")
      .replace(/phone:/gi, " ");
    return (source.match(/\+?\d[\d\s().-]{6,}\d/g) || []).filter(candidate => {
      const count = candidate.replace(/\D/g, "").length;
      return count >= 7 && count <= 16;
    });
  };
  const firstPhone = value => cleanLocal(findPhones(value)[0] || "");

  const allNodes = Array.from(doc?.querySelectorAll?.("a[href],button,[data-item-id],[data-href],[data-url],[data-value],[aria-label],[data-tooltip],[title]") || []);

  const phone = (() => {
    const selectors = [
      "[data-item-id^='phone:tel:']",
      "[data-item-id*='phone:tel:']",
      "button[data-item-id*='phone']",
      "a[href^='tel:']",
      ".UsdlK",
      "[aria-label*='Phone']",
      "[aria-label*='phone']",
      "[aria-label*='Call']",
      "[aria-label*='call']",
      "[aria-label*='الهاتف']",
      "[aria-label*='هاتف']",
      "[aria-label*='اتصال']"
    ];
    for (const selector of selectors) {
      for (const node of Array.from(doc?.querySelectorAll?.(selector) || [])) {
        const joined = [
          node.textContent,
          node.getAttribute?.("aria-label"),
          node.getAttribute?.("href"),
          node.getAttribute?.("data-item-id"),
          node.getAttribute?.("data-tooltip"),
          node.getAttribute?.("data-value")
        ].filter(Boolean).join(" ");
        const found = firstPhone(joined);
        if (found) return found;
      }
    }

    const labeled = decodeLoose(fullText).match(/(?:phone|telephone|tel|call|الهاتف|هاتف|اتصال)\s*:?\s*(\+?\d[\d\s().-]{6,}\d)/i);
    if (labeled) return firstPhone(labeled[1]);

    const htmlPhone = decodeLoose(fullHtml).match(/(?:phone:tel:|tel:|phone(?:number)?["']?\s*[:=]\s*["']?)(\+?\d[\d\s().-]{6,}\d)/i);
    return htmlPhone ? firstPhone(htmlPhone[1]) : "";
  })();

  const stripPrefix = (value, words) => {
    let out = cleanLocal(value);
    for (const word of words) {
      const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`^${escaped}:?\\s*`, "i"), "");
    }
    return cleanLocal(out);
  };

  const address = (() => {
    const selectors = [
      "[data-item-id='address']",
      "[data-item-id*='address']",
      "[aria-label*='Address']",
      "[aria-label*='address']",
      "[aria-label*='العنوان']",
      "[data-tooltip*='Copy address']",
      "[data-tooltip*='نسخ العنوان']"
    ];
    for (const selector of selectors) {
      const el = doc?.querySelector?.(selector);
      const value = stripPrefix(el?.getAttribute?.("aria-label") || el?.textContent || "", ["Address", "العنوان"]);
      if (value && !firstPhone(value) && value.length > 5) return value;
    }
    return "";
  })();

  const unwrap = raw => {
    const input = cleanLocal(decodeLoose(raw));
    if (!input) return "";
    if (/^mailto:|^tel:/i.test(input)) return input;
    try {
      const u = new URL(input, location.href);
      if (/google\./i.test(u.hostname)) {
        const redirected = u.searchParams.get("q") || u.searchParams.get("url") || u.searchParams.get("u");
        if (redirected && /^https?:\/\//i.test(redirected)) {
          try { return decodeURIComponent(redirected); } catch (e) { return redirected; }
        }
      }
      return u.href;
    } catch (e) {
      return input;
    }
  };

  const rawUrls = [];
  for (const node of allNodes) {
    for (const attr of ["href", "data-href", "data-url", "data-value"]) {
      const value = node.getAttribute?.(attr);
      if (value) rawUrls.push(value);
    }
  }
  rawUrls.push(...(decodeLoose(fullHtml).match(/https?:\/\/[^\s"'<>]+/gi) || []));
  const outboundUrls = unique(rawUrls.map(unwrap).filter(url => {
    if (!/^https?:\/\//i.test(url)) return false;
    return !/(?:^|\.)google\.|gstatic\.|ggpht\.|googleusercontent\.|schema\.org/i.test(url);
  }));

  const patterns = {
    facebook: /facebook\.com|fb\.com/i,
    instagram: /instagram\.com/i,
    twitter: /twitter\.com|(?:https?:\/\/)?(?:www\.)?x\.com/i,
    linkedin: /linkedin\.com/i,
    youtube: /youtube\.com|youtu\.be/i,
    tiktok: /tiktok\.com/i
  };
  const firstSocial = pattern => outboundUrls.find(url => pattern.test(url) && !/share|intent|plugins|sharer/i.test(url)) || "";
  const facebook = firstSocial(patterns.facebook);
  const instagram = firstSocial(patterns.instagram);
  const twitter = firstSocial(patterns.twitter);
  const linkedin = firstSocial(patterns.linkedin);
  const youtube = firstSocial(patterns.youtube);
  const tiktok = firstSocial(patterns.tiktok);
  const socialLinks = unique([facebook, instagram, twitter, linkedin, youtube, tiktok]).join(" | ");
  const isSocial = url => Object.values(patterns).some(pattern => pattern.test(url));

  const website = (() => {
    const selectors = [
      "a[data-item-id='authority']",
      "a[data-item-id*='authority']",
      "a[aria-label*='Website']",
      "a[aria-label*='website']",
      "a[aria-label*='الموقع']"
    ];
    for (const selector of selectors) {
      for (const a of Array.from(doc?.querySelectorAll?.(selector) || [])) {
        const href = unwrap(a.getAttribute?.("href") || a.href || "");
        if (/^https?:\/\//i.test(href) && !/(?:^|\.)google\.|gstatic\.|ggpht\.|maps\//i.test(href)) return href;
      }
    }
    return outboundUrls.find(url => !isSocial(url)) || "";
  })();

  const emailCandidates = [];
  const addEmails = value => {
    const matches = decodeLoose(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const email of matches) {
      const normalized = email.toLowerCase().replace(/^mailto:/i, "").replace(/[)>;,]+$/g, "");
      if (!/\.(png|jpe?g|gif|webp|svg|js|css)$/i.test(normalized)) emailCandidates.push(normalized);
    }
  };
  addEmails(text);
  addEmails(fullText);
  addEmails(fullHtml);
  for (const node of allNodes) {
    addEmails(node.textContent || "");
    for (const attr of ["href", "data-href", "data-url", "data-value", "aria-label", "data-item-id", "data-tooltip", "title"]) {
      addEmails(node.getAttribute?.(attr) || "");
    }
  }

  const emailList = unique(emailCandidates);
  let websiteHost = "";
  try { websiteHost = new URL(website).hostname.replace(/^www\./, "").toLowerCase(); } catch (e) {}
  const prefixScore = email => /^(info|contact|hello|office|booking|sales|support|admin|reception)@/i.test(email) ? 3 : 0;
  const domainScore = email => websiteHost && email.toLowerCase().endsWith(`@${websiteHost}`) ? 5 : 0;
  emailList.sort((a, b) => (domainScore(b) + prefixScore(b)) - (domainScore(a) + prefixScore(a)) || a.localeCompare(b));
  const selectedEmails = emailList.slice(0, 10);
  const emails = selectedEmails.join(" | ");

  const pick = (selectors, includeAria = false) => {
    for (const selector of selectors) {
      const el = root?.querySelector?.(selector) || doc?.querySelector?.(selector);
      if (!el) continue;
      const bodyText = cleanLocal(el.textContent);
      if (bodyText) return bodyText;
      if (includeAria) {
        const aria = cleanLocal(el.getAttribute?.("aria-label"));
        if (aria) return aria;
      }
    }
    return "";
  };

  const imageUrl = (() => {
    const images = [];
    const add = value => {
      const url = cleanLocal(value);
      if (!/^https?:\/\//i.test(url)) return;
      if (!/(googleusercontent|ggpht|gstatic|lh3\.google|streetviewpixels)/i.test(url)) return;
      if (/icon|marker|sprite|transparent|blank/i.test(url)) return;
      images.push(url.replace(/=w\d+-h\d+[^&\s"')>]*/i, "=w900-h700-k-no"));
    };
    doc?.querySelectorAll?.("img")?.forEach(img => {
      add(img.currentSrc || img.src);
      add(img.getAttribute("data-src"));
      add(img.getAttribute("srcset")?.split(/\s+/)[0]);
    });
    doc?.querySelectorAll?.("[style*='background-image']")?.forEach(el => {
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
    return cleanLocal((match && (match[1] || match[2])) || "").replace(/[^\d]/g, "");
  })();

  const category = pick([".DkEaL", "button[jsaction*='category']", "button.DkEaL"], false);
  const hours = pick(["[aria-label*='Hours']", "[aria-label*='hours']", "[aria-label*='ساعات']", "[aria-label*='Opening']"], true);
  const statusMatch = text.match(/(Open|Closed|Temporarily closed|Permanently closed|مفتوح|مغلق)[^.،]{0,60}/i);

  return {
    name: cleanLocal(document.querySelector("h1")?.textContent) || pick([".DUwDvf", ".fontHeadlineLarge", "h1"], true),
    phone,
    address,
    website,
    imageUrl,
    email: selectedEmails[0] || "",
    emails,
    facebook,
    instagram,
    twitter,
    linkedin,
    youtube,
    tiktok,
    socialLinks,
    category,
    rating,
    reviews,
    hours,
    status: statusMatch ? cleanLocal(statusMatch[0]) : "",
    mapsUrl: location.href,
    raw: text.slice(0, 1800)
  };
}
