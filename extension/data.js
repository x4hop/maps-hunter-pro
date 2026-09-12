let leads = [];
let filtered = [];
let toastTimer = null;
let exportState = {};

const fields = [
  ["name", "Name"],
  ["phone", "Phone"],
  ["address", "Address"],
  ["website", "Website"],
  ["imageUrl", "Image"],
  ["email", "Email"],
  ["emails", "Emails"],
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["twitter", "Twitter/X"],
  ["linkedin", "LinkedIn"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["socialLinks", "Social Links"],
  ["category", "Category"],
  ["rating", "Rating"],
  ["reviews", "Reviews"],
  ["mapsUrl", "Google Maps"],
  ["hours", "Hours"],
  ["status", "Status"]
];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  document.getElementById("refreshBtn").addEventListener("click", load);
  document.getElementById("closeBtn").addEventListener("click", closeSheet);
  document.getElementById("searchInput").addEventListener("input", applyFilter);
  document.getElementById("csvBtn").addEventListener("click", exportCsv);
  document.getElementById("excelBtn").addEventListener("click", exportExcel);
  document.getElementById("jsonBtn").addEventListener("click", exportJson);
  await load();
  chrome.runtime.onMessage.addListener(msg => {
    if (msg?.type !== "STATE_UPDATE") return;
    exportState = msg.state || exportState;
    leads = Array.isArray(msg.state?.leads) ? msg.state.leads : leads;
    applyFilter();
  });

  const action = new URLSearchParams(location.search).get("export");
  if (action) {
    setTimeout(() => {
      if (action === "csv") exportCsv();
      else if (action === "excel") exportExcel();
      else if (action === "json") exportJson();
    }, 80);
  }
}

async function load() {
  const payload = await send({ type: "GET_EXPORT_DATA" });
  exportState = payload?.meta || {};
  leads = Array.isArray(payload?.leads) ? payload.leads : [];
  applyFilter();
  toast(`Refreshed ${leads.length} leads`);
}

function applyFilter() {
  const q = document.getElementById("searchInput").value.trim().toLowerCase();
  filtered = !q ? leads : leads.filter(lead => fields.some(([key]) => String(lead[key] || "").toLowerCase().includes(q)));
  render();
}

function render() {
  const body = document.getElementById("body");
  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="11" class="empty">No data yet</td></tr>`;
    return;
  }
  body.innerHTML = filtered.map((lead, index) => `
    <tr>
      <td>${index + 1}</td>
      <td title="${html(lead.name)}">${html(lead.name) || "-"}</td>
      <td title="${html(internationalizePhone(lead.phone, lead))}">${html(internationalizePhone(lead.phone, lead)) || "-"}</td>
      <td title="${html(lead.address)}">${html(lead.address) || "-"}</td>
      <td>${link(lead.website, "Website")}</td>
      <td>${link(lead.imageUrl, "Image")}</td>
      <td title="${html(lead.emails || lead.email)}">${html(lead.email || lead.emails) || "-"}</td>
      <td>${link(lead.facebook, "Facebook")}</td>
      <td>${link(lead.instagram, "Instagram")}</td>
      <td title="${html(lead.socialLinks)}">${html(lead.socialLinks) || "-"}</td>
      <td>${link(lead.mapsUrl, "Maps")}</td>
    </tr>
  `).join("");
}

function exportCsv() {
  if (!filtered.length) return toast("No data to export");
  const rows = [fields.map(x => x[1]), ...filtered.map(lead => fields.map(([key]) => key === "phone" ? internationalizePhone(lead[key], lead) : (lead[key] || "")))];
  download("\uFEFF" + rows.map(row => row.map(csv).join(",")).join("\n"), `maps_hunter_${stamp()}.csv`, "text/csv;charset=utf-8;");
}

function exportJson() {
  if (!filtered.length) return toast("No data to export");
  const exportLeads = filtered.map(lead => ({ ...lead, phone: internationalizePhone(lead.phone, lead) }));
  download(JSON.stringify(exportLeads, null, 2), `maps_hunter_${stamp()}.json`, "application/json;charset=utf-8;");
}

async function exportExcel() {
  if (!filtered.length) return toast("No data to export.");
  try {
    const result = await MHPExport.xlsx(filtered.map(lead=>({...lead,phone:internationalizePhone(lead.phone,lead)})), `maps_hunter_${stamp()}.xlsx`, { search: [exportState?.keyword, ...(Array.isArray(exportState?.cities) ? exportState.cities : [])].filter(Boolean).join(' — ') });
    toast(`Excel downloaded: ${Number(result?.rows||0)} leads`);
  } catch (e) { console.error(e); toast("Excel export failed."); }
}

function excelXmlCell(lead, field, rowIndex) {
  const isAlt = rowIndex % 2 === 1;
  const base = isAlt ? "AltCell" : "Cell";
  const left = isAlt ? "AltLeft" : "Left";
  const wrapLeft = isAlt ? "AltWrapLeft" : "WrapLeft";
  const strong = isAlt ? "AltStrong" : "Strong";
  const phoneStyle = isAlt ? "AltPhone" : "Phone";
  const linkStyle = isAlt ? "AltLink" : "Link";
  const numberStyle = isAlt ? "AltNumber" : "Number";
  const ratingStyle = isAlt ? "AltRating" : "Rating";
  const emptyStyle = isAlt ? "AltEmpty" : "Empty";

  if (field.type === "index") {
    return `<Cell ss:StyleID="${numberStyle}"><Data ss:Type="Number">${rowIndex + 1}</Data></Cell>`;
  }

  let raw = String(lead[field.key] || "").trim();
  if (field.key === "email" && !raw) raw = String(lead.emails || "").trim();
  if (field.key === "phone") raw = internationalizePhone(raw, lead);

  if (!raw) {
    return `<Cell ss:StyleID="${emptyStyle}"><Data ss:Type="String"></Data></Cell>`;
  }

  if (field.type === "rating") {
    const n = Number(String(raw).replace(",", ".").match(/\d+(?:\.\d+)?/)?.[0]);
    if (Number.isFinite(n)) return `<Cell ss:StyleID="${ratingStyle}"><Data ss:Type="Number">${n}</Data></Cell>`;
  }

  if (field.type === "reviews") {
    const n = Number(String(raw).replace(/[^\d]/g, ""));
    if (Number.isFinite(n)) return `<Cell ss:StyleID="${numberStyle}"><Data ss:Type="Number">${n}</Data></Cell>`;
  }

  if (field.type === "status") {
    const value = cleanExcelText(raw);
    const low = value.toLowerCase();
    const style = /open|opened|working|متاح|مفتوح/.test(low)
      ? "StatusOpen"
      : /closed|temporarily closed|permanently closed|مغلق/.test(low)
        ? "StatusClosed"
        : "StatusNeutral";
    return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xml(value)}</Data></Cell>`;
  }

  if (field.email) {
    const email = cleanExcelText(raw).split(/[|,;\s]+/).find(v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) || cleanExcelText(raw);
    const href = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? `mailto:${email}` : "";
    if (href) return `<Cell ss:StyleID="${linkStyle}" ss:HRef="${xml(href)}"><Data ss:Type="String">${xml(email)}</Data></Cell>`;
    return `<Cell ss:StyleID="${left}"><Data ss:Type="String">${xml(email)}</Data></Cell>`;
  }

  const urls = extractUrls(raw);
  if (urls.length) {
    const href = urls[0];
    const label = field.linkText || linkLabel(field.key);
    return `<Cell ss:StyleID="${linkStyle}" ss:HRef="${xml(href)}"><Data ss:Type="String">${xml(label)}</Data></Cell>`;
  }

  const text = cleanExcelText(raw);
  let style = base;
  if (field.phone) style = phoneStyle;
  else if (field.strong) style = strong;
  else if (field.wrap) style = wrapLeft;
  else if (field.align === "left") style = left;

  return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xml(text)}</Data></Cell>`;
}

function cleanExcelText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}


function normalizePhoneText(value) {
  let text = String(value || "").trim();
  if (!text) return "";

  // Keep export-only cleanup safe: never erase a phone value.
  text = text
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/(?:tel|phone|الهاتف)\s*:?/gi, " ")
    .trim();

  // First try explicit separators used when several candidates were stored.
  const parts = text.split(/[|,;\n\r•·]+/).map(v => v.trim()).filter(Boolean);
  for (const part of parts) {
    const digits = part.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 16) return cleanExcelText(part);
  }

  const allDigits = text.replace(/\D/g, "");

  // If the exact same phone was concatenated 2/3+ times, collapse it.
  if (allDigits.length > 16) {
    for (let size = 7; size <= 16; size++) {
      if (allDigits.length % size !== 0) continue;
      const unit = allDigits.slice(0, size);
      if (unit.repeat(allDigits.length / size) === allDigits) {
        return (text.trim().startsWith("+") ? "+" : "") + unit;
      }
    }
  }

  // Prefer a normal contiguous phone number when present.
  const contiguous = text.match(/\+?\d{7,16}/);
  if (contiguous) return contiguous[0];

  // Formatted number: take the first plausible run, capped to one phone.
  const runs = text.match(/\+?\d[\d\s().-]*\d/g) || [];
  for (const run of runs) {
    const digits = run.replace(/\D/g, "");
    if (digits.length >= 7 && digits.length <= 16) return cleanExcelText(run);
  }

  // Final safety fallback: preserve the first phone-sized digit sequence
  // instead of exporting a blank cell.
  if (allDigits.length >= 7) {
    const first = allDigits.slice(0, Math.min(16, allDigits.length));
    return (text.trim().startsWith("+") ? "+" : "") + first;
  }

  return cleanExcelText(text);
}


const COUNTRY_PHONE_RULES = [
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

function detectCountryPhoneRule(lead) {
  // 1) The search location is authoritative. Every lead now carries the city/search area it came from.
  if(lead?.searchCountry) { const chosen=COUNTRY_PHONE_RULES.find(r=>r.code===lead.searchCountry); if(chosen)return chosen; }
  const searchCity = cleanExcelText(lead?.searchCity || "");
  if (searchCity) {
    const candidates=COUNTRY_PHONE_RULES.flatMap(rule=>rule.aliases.filter(alias=>phoneAliasMatches(searchCity,alias)).map(alias=>({rule,score:alias.length}))).sort((a,b)=>b.score-a.score);
    const explicit=candidates[0]?.rule;
    if (explicit) return explicit;

    // Resolve a city-only search (e.g. "Berlin") from any result collected in that SAME city.
    // Once one address says Germany, all local numbers from Berlin use +49.
    const sameCityLeads = (Array.isArray(leads) ? leads : []).filter(item => cleanExcelText(item?.searchCity || "").toLowerCase() === searchCity.toLowerCase());
    const evidence = new Map();
    for (const item of sameCityLeads) {
      const text = `${item?.address || ""} ${item?.category || ""}`;
      for (const rule of COUNTRY_PHONE_RULES) {
        if (rule.aliases.some(alias => phoneAliasMatches(text, alias))) evidence.set(rule.code, rule);
      }
    }
    if (evidence.size === 1) return [...evidence.values()][0];
  }

  // 2) For old saved results that predate searchCity, use the result's address.
  const leadText = `${lead?.address || ""} ${lead?.category || ""}`;
  const direct = COUNTRY_PHONE_RULES.find(rule => rule.aliases.some(alias => phoneAliasMatches(leadText, alias)));
  if (direct) return direct;

  // 3) Final compatibility fallback: only when the whole scan resolves to one country.
  const stateCities = (typeof exportState !== "undefined" && Array.isArray(exportState?.cities)) ? exportState.cities.join(" ") : "";
  const matches = COUNTRY_PHONE_RULES.filter(rule => rule.aliases.some(alias => phoneAliasMatches(stateCities, alias)));
  if (matches.length === 1) return matches[0];

  const allEvidence = new Map();
  for (const item of (Array.isArray(leads) ? leads : [])) {
    const text = `${item?.address || ""} ${item?.category || ""}`;
    for (const rule of COUNTRY_PHONE_RULES) {
      if (rule.aliases.some(alias => phoneAliasMatches(text, alias))) allEvidence.set(rule.code, rule);
    }
  }
  return allEvidence.size === 1 ? [...allEvidence.values()][0] : null;
}

function internationalizePhone(value, lead) {
  const onePhone = normalizePhoneText(value);
  if (!onePhone) return "";

  let text = String(onePhone)
    .replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .trim();
  let digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return "";
  if (/^(\d)\1{6,}$/.test(digits)) return "";

  // Already international: normalize 00CC... to +CC... and preserve +CC....
  if (/^\s*\+/.test(text)) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : "";
  }

  const rule = detectCountryPhoneRule(lead);
  if (!rule) return ""; // Never invent a country code when the country cannot be resolved.

  // Number already contains this country's calling code, only missing the plus.
  if (digits.startsWith(rule.code) && digits.length >= rule.code.length + 7 && digits.length <= 15) return `+${digits}`;

  let national = digits;
  if (!rule.noTrunk && !rule.keepTrunkZero) national = national.replace(/^0+/, "");
  if (national.length < 7 || national.length > 12) return "";
  const international = `${rule.code}${national}`;
  return international.length >= 8 && international.length <= 15 ? `+${international}` : "";
}

function extractUrls(value) {
  return Array.from(new Set(String(value || "").match(/https?:\/\/[^\s|,]+/gi) || []));
}

function linkLabel(key) {
  const labels = {
    website: "Website",
    imageUrl: "Image",
    mapsUrl: "Map",
    facebook: "Facebook",
    instagram: "Instagram",
    twitter: "X",
    linkedin: "LinkedIn",
    youtube: "YouTube",
    tiktok: "TikTok",
    socialLinks: "Social"
  };
  return labels[key] || "Link";
}

function xml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}


async function closeSheet() {
  try {
    const tab = await chrome.tabs.getCurrent();
    if (tab?.id) return chrome.tabs.remove(tab.id);
  } catch (e) {}
  window.close();
}

function link(url, label) {
  return url ? `<a href="${html(url)}" target="_blank">${label}</a>` : "-";
}

function send(payload) {
  return new Promise(resolve => chrome.runtime.sendMessage(payload, response => resolve(response || {})));
}

function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function html(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function csv(value) {
  const text=String(value ?? "");
  const safe=/^[\s]*[=+@-]/.test(text)?"\'"+text:text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 1800);
}
