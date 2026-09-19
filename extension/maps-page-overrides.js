// Maps Hunter Pro v8.4.1 — legacy fast Maps extraction engine.
// Principle restored from the older successful build:
// 1) scan only result links, 2) open Maps place detail pages in parallel,
// 3) extract the complete visible Maps detail card, 4) never open business website tabs.

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
  if (code !== "39" && code !== "1") digits = digits.replace(/^0+/, "");
  return digits ? `+${code}${digits}` : clean(one);
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
    searchKeyword: clean(lead?.searchKeyword),
    searchCity: clean(lead?.searchCity),
    searchCountry: countryCode,
    usageRequestId: clean(lead?.usageRequestId),
    raw: clean(lead?.raw)
  };
}

// Website enrichment is intentionally disabled. All data comes from Google Maps.
async function enrichFromWebsite() { return {}; }
function enrichLeadInBackground() { return undefined; }

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

  const findPhone = value => {
    const matches = toEnglishDigits(String(value || ""))
      .replace(/tel:/gi, " ")
      .replace(/phone:/gi, " ")
      .match(/\+?\d[\d\s().-]{6,}\d/g) || [];
    for (const match of matches) {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 7 && digits.length <= 16) return cleanLocal(match);
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
          node.getAttribute?.("aria-label"),
          node.getAttribute?.("href"),
          node.getAttribute?.("data-item-id")
        ].filter(Boolean).join(" ");
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
      "[data-tooltip*='Copy address']",
      "[data-tooltip*='نسخ العنوان']"
    ];
    for (const selector of selectors) {
      const el = root?.querySelector?.(selector);
      const value = stripPrefix(el?.getAttribute?.("aria-label") || el?.textContent || "", ["Address", "العنوان"]);
      if (value && !findPhone(value) && value.length > 6) return value;
    }
    return "";
  })();

  const unwrap = raw => {
    const input = cleanLocal(raw);
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

  const allContactNodes = Array.from(root?.querySelectorAll?.("a[href],[data-href],[data-url],[data-value],[aria-label],[data-item-id],[data-tooltip],[title]") || []);
  const rawUrls = [];
  for (const node of allContactNodes) {
    for (const attr of ["href", "data-href", "data-url", "data-value"]) {
      const value = node.getAttribute?.(attr);
      if (value) rawUrls.push(value);
    }
  }
  const decodedHtml = String(root?.innerHTML || "")
    .replace(/\\u002f/gi, "/")
    .replace(/\\u003a/gi, ":")
    .replace(/&amp;/gi, "&");
  rawUrls.push(...(decodedHtml.match(/https?:\/\/[^\s"'<>]+/gi) || []));
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
      for (const a of Array.from(root?.querySelectorAll?.(selector) || [])) {
        const href = unwrap(a.getAttribute?.("href") || a.href || "");
        if (/^https?:\/\//i.test(href) && !/(?:^|\.)google\.|gstatic\.|ggpht\.|maps\//i.test(href)) return href;
      }
    }
    return outboundUrls.find(url => !isSocial(url)) || "";
  })();

  const decodeEmailText = value => {
    let source = String(value || "")
      .replace(/[\u200b\u200c\u200d\ufeff]/g, "");

    for (let i = 0; i < 2; i += 1) {
      try {
        const decoded = decodeURIComponent(source);
        if (decoded === source) break;
        source = decoded;
      } catch (e) { break; }
    }

    return source
      .replace(/\\u0040|\\x40/gi, "@")
      .replace(/\\u002e|\\x2e/gi, ".")
      .replace(/&#64;|&#x40;|&commat;/gi, "@")
      .replace(/&#46;|&#x2e;/gi, ".")
      .replace(/[＠﹫]/g, "@")
      .replace(/[｡。．﹒]/g, ".")
      .replace(/\s*(?:\[at\]|\(at\)|\{at\}|<at>)\s*/gi, "@")
      .replace(/\s+(?:at)\s+/gi, "@")
      .replace(/\s*(?:\[dot\]|\(dot\)|\{dot\}|<dot>)\s*/gi, ".")
      .replace(/\s+(?:dot)\s+/gi, ".")
      .replace(/\s*@\s*/g, "@")
      .replace(/\s*\.\s*/g, ".");
  };

  const emailCandidates = new Map();
  let websiteHost = "";
  try { websiteHost = new URL(website).hostname.replace(/^www\./i, "").toLowerCase(); } catch (e) {}

  const validEmail = email => {
    const value = String(email || "").toLowerCase().replace(/^mailto:/i, "").replace(/[)>;,]+$/g, "");
    if (!value || value.length > 254) return "";
    const parts = value.split("@");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return "";
    if (parts[0].length > 64 || !parts[1].includes(".")) return "";
    if (/\.(png|jpe?g|gif|webp|svg|js|css|woff2?|ttf|map)$/i.test(value)) return "";
    if (/(^|\.)google(?:apis|usercontent)?\.com$|(^|\.)gstatic\.com$|(^|\.)doubleclick\.net$/i.test(parts[1])) return "";
    return value;
  };

  const scoreEmail = (email, sourceScore) => {
    const [local, domain] = email.split("@");
    let score = Number(sourceScore || 0);
    if (websiteHost && (domain === websiteHost || domain.endsWith(`.${websiteHost}`))) score += 120;
    if (/^(info|contact|hello|office|booking|sales|support|reception|admin|enquiries|inquiries|mail)\b/i.test(local)) score += 25;
    if (/^(noreply|no-reply|donotreply|do-not-reply)\b/i.test(local)) score -= 30;
    return score;
  };

  const addEmails = (value, sourceScore = 0) => {
    const matches = decodeEmailText(value).match(/[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi) || [];
    for (const raw of matches) {
      const email = validEmail(raw);
      if (!email) continue;
      const score = scoreEmail(email, sourceScore);
      const previous = emailCandidates.get(email);
      if (!previous || score > previous.score) emailCandidates.set(email, { email, score });
    }
  };

  for (const link of Array.from(root?.querySelectorAll?.("a[href^='mailto:']") || [])) {
    addEmails(link.getAttribute("href") || "", 90);
    addEmails(link.textContent || "", 85);
    addEmails(link.getAttribute("aria-label") || "", 85);
  }

  addEmails(text, 70);

  for (const node of allContactNodes) {
    addEmails(node.textContent || "", 55);
    for (const attr of ["href", "data-href", "data-url", "data-value", "aria-label", "data-item-id", "data-tooltip", "title"]) {
      addEmails(node.getAttribute?.(attr) || "", 50);
    }
  }

  for (const node of Array.from(root?.querySelectorAll?.("*") || [])) {
    for (const attr of Array.from(node.attributes || [])) {
      if (!/(mail|email|contact|href|label|title|tooltip|value|data)/i.test(attr.name)) continue;
      addEmails(attr.value || "", 35);
    }
  }

  addEmails(root?.innerHTML || "", 20);

  const emailList = Array.from(emailCandidates.values())
    .sort((a, b) => b.score - a.score || a.email.localeCompare(b.email))
    .map(item => item.email)
    .slice(0, 10);
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
  const hours = pick(["[aria-label*='Hours']", "[aria-label*='ساعات']", "[aria-label*='Opening']"], true);
  const statusMatch = text.match(/(Open|Closed|مفتوح|مغلق)[^.،]{0,50}/i);

  return {
    name: cleanLocal(document.querySelector("h1")?.textContent) || pick([".DUwDvf", ".fontHeadlineLarge", "h1"], true),
    phone,
    address,
    website,
    imageUrl,
    email: emailList[0] || "",
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
    raw: text.slice(0, 1600)
  };
}
