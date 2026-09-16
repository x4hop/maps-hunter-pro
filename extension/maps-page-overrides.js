// Maps Hunter Pro — direct Google Maps extraction overrides.
// This file is loaded after background.js so these global function declarations
// intentionally replace the older implementations without changing the stable
// queue / worker orchestration.

function mhpNormalizePhone(value, countryCode) {
  let text = String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/(?:tel|phone|الهاتف)\s*:?/gi, " ")
    .trim();
  if (!text) return "";

  const candidates = text.split(/[|,;\n\r•·]+/).map(x => x.trim()).filter(Boolean);
  let one = candidates.find(part => {
    const n = part.replace(/\D/g, "").length;
    return n >= 7 && n <= 16;
  }) || text;

  let digits = one.replace(/\D/g, "");
  if (digits.length < 7) return clean(one);
  if (/^\s*\+/.test(one)) return `+${digits}`;
  if (digits.startsWith("00") && digits.length > 8) return `+${digits.slice(2)}`;

  const code = String(countryCode || "").replace(/\D/g, "");
  if (!code) return clean(one);
  if (digits.startsWith(code) && digits.length >= code.length + 7) return `+${digits}`;

  // Italy keeps the trunk zero in international format. NANP has no trunk zero.
  if (code !== "39" && code !== "1") digits = digits.replace(/^0+/, "");
  if (!digits) return clean(one);
  return `+${code}${digits}`;
}

function normalizeLead(lead) {
  const rawPhone = clean(lead?.phoneRaw || lead?.phone);
  const countryCode = clean(lead?.searchCountry || state?.searchCountry);
  const phone = mhpNormalizePhone(lead?.phone, countryCode);
  return {
    name: clean(lead?.name),
    phone,
    phoneRaw: rawPhone,
    phoneStatus: phone ? /\d{7,16}/.test(phone.replace(/[^\d]/g, "")) ? "plausible" : "unverified" : "missing",
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
    searchCountry: countryCode,
    usageRequestId: clean(lead?.usageRequestId),
    raw: clean(lead?.raw)
  };
}

// Website crawling is intentionally disabled. Maps Hunter Pro now only saves
// contact data present on the Google Maps result/detail page itself.
function enrichLeadInBackground() {
  return undefined;
}

function extractGoogleMapsPlace() {
  const cleanLocal = value => String(value || "")
    .replace(/\u200e|\u200f/g, "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  const toEnglishDigits = value => String(value || "")
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
  const uniqueLocal = values => Array.from(new Set((values || []).map(cleanLocal).filter(Boolean)));
  const root = document.querySelector("div[role='main']") || document.body;
  const text = cleanLocal(root?.textContent || "");

  const pick = (selectors, includeAria = false) => {
    for (const selector of selectors) {
      const el = root?.querySelector?.(selector);
      if (!el) continue;
      const bodyText = cleanLocal(el.textContent);
      if (bodyText) return bodyText;
      if (includeAria) {
        const aria = cleanLocal(el.getAttribute("aria-label"));
        if (aria) return aria;
      }
    }
    return "";
  };

  const stripPrefix = (value, words) => {
    let out = cleanLocal(value);
    for (const word of words) {
      const escaped = String(word).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(`^${escaped}:?\\s*`, "i"), "");
    }
    return cleanLocal(out);
  };

  const unwrapOutbound = raw => {
    const href = cleanLocal(raw);
    if (!href) return "";
    if (/^mailto:/i.test(href) || /^tel:/i.test(href)) return href;
    try {
      const u = new URL(href, location.href);
      const host = u.hostname.toLowerCase();
      if (/^(www\.)?google\./i.test(host) || host.endsWith(".google.com")) {
        const redirected = u.searchParams.get("q") || u.searchParams.get("url") || u.searchParams.get("u");
        if (redirected && /^https?:\/\//i.test(redirected)) return cleanLocal(decodeURIComponent(redirected));
      }
      return u.href;
    } catch (e) {
      return href;
    }
  };

  const allAnchors = Array.from(root?.querySelectorAll?.("a[href]") || []);
  const outboundUrls = uniqueLocal(allAnchors.map(a => unwrapOutbound(a.getAttribute("href") || a.href)).filter(url => {
    if (!/^https?:\/\//i.test(url)) return false;
    return !/(?:^|\.)google\.|gstatic\.|ggpht\.|googleusercontent\.|schema\.org/i.test(url);
  }));

  const socialPatterns = {
    facebook: /(?:^|\.)facebook\.com|(?:^|\.)fb\.com/i,
    instagram: /(?:^|\.)instagram\.com/i,
    twitter: /(?:^|\.)(?:twitter\.com|x\.com)/i,
    linkedin: /(?:^|\.)linkedin\.com/i,
    youtube: /(?:^|\.)(?:youtube\.com|youtu\.be)/i,
    tiktok: /(?:^|\.)tiktok\.com/i
  };
  const isSocial = url => Object.values(socialPatterns).some(pattern => pattern.test(url));
  const firstSocial = pattern => outboundUrls.find(url => pattern.test(url) && !/share|intent|plugins|sharer/i.test(url)) || "";
  const social = {
    facebook: firstSocial(socialPatterns.facebook),
    instagram: firstSocial(socialPatterns.instagram),
    twitter: firstSocial(socialPatterns.twitter),
    linkedin: firstSocial(socialPatterns.linkedin),
    youtube: firstSocial(socialPatterns.youtube),
    tiktok: firstSocial(socialPatterns.tiktok)
  };
  const socialLinks = uniqueLocal(Object.values(social).filter(Boolean)).join(" | ");

  const findPhone = value => {
    const source = toEnglishDigits(String(value || ""))
      .replace(/tel:/gi, " ")
      .replace(/phone:/gi, " ");
    const matches = source.match(/\+?\d[\d\s().-]{6,}\d/g) || [];
    for (const match of matches) {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 16) return cleanLocal(match);
    }
    return "";
  };

  const phone = (() => {
    const selectors = [
      "button[data-item-id^='phone:tel:']",
      "button[data-item-id*='phone']",
      "a[href^='tel:']",
      ".UsdlK",
      "button[aria-label*='Phone']",
      "button[aria-label*='phone']",
      "button[aria-label*='الهاتف']",
      "button[aria-label*='هاتف']"
    ];
    for (const selector of selectors) {
      for (const node of Array.from(root?.querySelectorAll?.(selector) || [])) {
        const value = [
          node.textContent,
          node.getAttribute("aria-label"),
          node.getAttribute("href"),
          node.getAttribute("data-item-id")
        ].filter(Boolean).join(" ");
        const found = findPhone(value);
        if (found) return found;
      }
    }
    const labeled = text.match(/(?:phone|telephone|tel|call|الهاتف|هاتف|اتصال)\s*:?\s*(\+?\d[\d\s().-]{6,}\d)/i);
    return labeled ? findPhone(labeled[1]) : "";
  })();

  const address = (() => {
    const selectors = [
      "button[data-item-id='address']",
      "button[data-item-id*='address']",
      "button[aria-label*='Address']",
      "button[aria-label*='العنوان']",
      "[data-tooltip*='Copy address']",
      "[data-tooltip*='نسخ العنوان']"
    ];
    for (const selector of selectors) {
      const el = root?.querySelector?.(selector);
      const value = stripPrefix(el?.getAttribute?.("aria-label") || el?.textContent || "", ["Address", "العنوان"]);
      if (value && !findPhone(value) && value.length > 5) return value;
    }
    return "";
  })();

  const website = (() => {
    const preferred = [
      "a[data-item-id='authority']",
      "a[data-item-id*='authority']",
      "a[aria-label*='Website']",
      "a[aria-label*='website']",
      "a[aria-label*='الموقع']"
    ];
    for (const selector of preferred) {
      for (const a of Array.from(root?.querySelectorAll?.(selector) || [])) {
        const href = unwrapOutbound(a.getAttribute("href") || a.href);
        if (/^https?:\/\//i.test(href) && !/(?:^|\.)google\.|gstatic\.|ggpht\.|maps\//i.test(href)) return href;
      }
    }
    return outboundUrls.find(url => !isSocial(url)) || outboundUrls[0] || "";
  })();

  const emailCandidates = [];
  const addEmails = value => {
    const source = String(value || "")
      .replace(/&#64;|&#x40;|&commat;/gi, "@")
      .replace(/\s*(\[at\]|\(at\))\s*/gi, "@")
      .replace(/\s*(\[dot\]|\(dot\))\s*/gi, ".");
    const matches = source.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    for (const email of matches) {
      const valueClean = email.toLowerCase().replace(/^mailto:/i, "");
      if (!/\.(png|jpe?g|gif|webp|svg)$/i.test(valueClean)) emailCandidates.push(valueClean);
    }
  };
  addEmails(text);
  for (const a of allAnchors) {
    const href = a.getAttribute("href") || "";
    if (/^mailto:/i.test(href)) addEmails(decodeURIComponent(href));
    addEmails(a.getAttribute("aria-label") || "");
    addEmails(a.textContent || "");
  }
  for (const node of Array.from(root?.querySelectorAll?.("[aria-label],[data-item-id],[data-tooltip]") || [])) {
    addEmails(node.getAttribute("aria-label") || "");
    addEmails(node.getAttribute("data-item-id") || "");
    addEmails(node.getAttribute("data-tooltip") || "");
  }
  const emailList = uniqueLocal(emailCandidates).slice(0, 10);
  const emails = emailList.join(" | ");

  const imageUrl = (() => {
    const images = [];
    const add = value => {
      const url = cleanLocal(value);
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
  const hours = pick(["[aria-label*='Hours']", "[aria-label*='hours']", "[aria-label*='ساعات']"], true);
  const statusMatch = text.match(/(Open|Closed|Temporarily closed|Permanently closed|مفتوح|مغلق)[^.،]{0,60}/i);

  return {
    name: cleanLocal(document.querySelector("h1")?.textContent) || pick([".DUwDvf", ".fontHeadlineLarge", "h1"], true),
    phone,
    address,
    website,
    imageUrl,
    email: emailList[0] || "",
    emails,
    ...social,
    socialLinks,
    category,
    rating,
    reviews,
    hours,
    status: statusMatch ? cleanLocal(statusMatch[0]) : "",
    mapsUrl: location.href,
    raw: text.slice(0, 1600)
  };
}
