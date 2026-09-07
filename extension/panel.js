let leads = [];
let toastTimer = null;
let cityTags = [];
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
  bind();
  const access=await send({type:"GET_LICENSE"});
  document.getElementById("licenseKey").value=access.licenseKey||"";
  document.getElementById("saveLicense").onclick=async()=>{const r=await send({type:"SET_LICENSE",licenseKey:document.getElementById("licenseKey").value});toast(r.ok?"License saved":r.error||"Could not validate license");};
  bindTabs();
  const state = await send({ type: "GET_STATE" });
  renderState(state || {});

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "STATE_UPDATE") renderState(message.state || {});
  });
}

function bindTabs() {
  document.querySelectorAll(".tab[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const pageId = button.dataset.page;
      document.querySelectorAll(".tab[data-page]").forEach(item => item.classList.toggle("active", item === button));
      document.querySelectorAll(".page").forEach(page => page.classList.toggle("active", page.id === pageId));
    });
  });
}

function bind() {
  document.getElementById("startBtn").addEventListener("click", start);
  document.getElementById("stopBtn").addEventListener("click", () => send({ type: "STOP_SCAN" }));
  document.getElementById("skipScanBtn").addEventListener("click", skipScanCity);
  document.getElementById("skipCityBtn").addEventListener("click", skipCity);
  document.getElementById("clearBtn").addEventListener("click", async () => {
    await send({ type: "CLEAR_RESULTS" });
    renderState({ leads: [], status: "Results cleared.", phase: "Ready" });
  });
  document.getElementById("csvBtn").addEventListener("click", () => openExportPage("csv"));
  document.getElementById("excelBtn").addEventListener("click", () => openExportPage("excel"));
  document.getElementById("jsonBtn").addEventListener("click", () => openExportPage("json"));
  document.getElementById("openSheetBtn").addEventListener("click", () => openExportPage("sheet"));
  bindCityTags();
}

function openExportPage(action) {
  const url = new URL(chrome.runtime.getURL("data.html"));
  if (action && action !== "sheet") url.searchParams.set("export", action);
  chrome.tabs.create({ url: url.toString() });
}

async function start() {
  const keyword = document.getElementById("keyword").value.trim();
  const cities = getCities();

  if (!keyword) return toast("Type a search keyword first.");
  if (!cities.length) return toast("Add at least one city.");

  setBusy(true);
  const maxWorkers = Number(document.getElementById("workerCount")?.value || 6);
  const scanFirst = document.getElementById("scanFirst")?.checked !== false;
  const searchCountry=document.getElementById("searchCountry").value;
  const res = await send({ type: "START_SCAN", keyword, cities, maxWorkers, scanFirst, searchCountry });
  if (!res?.ok) {
    setBusy(false);
    toast(res?.error || "Could not start search.");
  }
}

function bindCityTags() {
  const input = document.getElementById("cityInput");
  const box = document.getElementById("cityTagsBox");
  if (!input || !box) return;

  box.addEventListener("click", () => input.focus());
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addCityTag(input.value);
      input.value = "";
    }
    if (event.key === "Backspace" && !input.value && cityTags.length) {
      cityTags.pop();
      renderCityTags();
    }
  });
  input.addEventListener("paste", event => {
    const text = event.clipboardData?.getData("text") || "";
    if (/[\n,;،]/.test(text)) {
      event.preventDefault();
      addCityTag(text);
      input.value = "";
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim()) {
      addCityTag(input.value);
      input.value = "";
    }
  });
}

function addCityTag(value) {
  const parts = String(value || "")
    .split(/[\n,;،]+/)
    .map(item => item.trim().replace(/,$/, ""))
    .filter(Boolean);
  let changed = false;
  for (const city of parts) {
    if (cityTags.some(item => item.toLowerCase() === city.toLowerCase())) continue;
    cityTags.push(city);
    changed = true;
  }
  if (changed) renderCityTags();
}

function getCities() {
  const input = document.getElementById("cityInput");
  if (input?.value.trim()) {
    addCityTag(input.value);
    input.value = "";
  }
  return cityTags.slice();
}

function renderCityTags() {
  const box = document.getElementById("cityTagsBox");
  const input = document.getElementById("cityInput");
  if (!box || !input) return;

  box.querySelectorAll(".city-tag").forEach(tag => tag.remove());
  cityTags.forEach((city, index) => {
    const tag = document.createElement("span");
    tag.className = "city-tag";
    tag.innerHTML = `${html(city)} <button type="button" data-index="${index}" aria-label="Remove ${html(city)}">×</button>`;
    box.insertBefore(tag, input);
  });
  box.querySelectorAll(".city-tag button").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      cityTags.splice(Number(button.dataset.index), 1);
      renderCityTags();
      input.focus();
    });
  });
}

function renderState(state) {
  exportState = state || exportState;
  leads = Array.isArray(state.leads) ? state.leads : leads;
  document.getElementById("phaseText").textContent = state.phase || "Ready";
  document.getElementById("statusText").textContent = state.status || "Ready";

  const total = leads.length;
  const phones = leads.filter(x => x.phone).length;
  const emails = leads.filter(x => x.email || x.emails).length;
  const socials = leads.filter(x => x.socialLinks || x.facebook || x.instagram).length;
  document.getElementById("leadCount").textContent = total;
  const tabLeadCount = document.getElementById("tabLeadCount");
  if (tabLeadCount) tabLeadCount.textContent = total;
  document.getElementById("phoneCount").textContent = phones;
  document.getElementById("emailCount").textContent = emails;
  document.getElementById("socialCount").textContent = socials;

  const queued = Number(state.queued || 0);
  const processed = Number(state.processed || 0);
  const currentCity = Array.isArray(state.cities) ? (state.cities[state.cityIndex] || "-") : "-";
  const workerSelect = document.getElementById("workerCount");
  const scanFirstToggle = document.getElementById("scanFirst");
  if (workerSelect && state.maxWorkers) workerSelect.value = String(state.maxWorkers);
  if (scanFirstToggle && typeof state.scanFirst === "boolean") scanFirstToggle.checked = state.scanFirst;
  document.getElementById("currentCityText").textContent = currentCity;
  document.getElementById("queuedText").textContent = String(queued);
  document.getElementById("processedText").textContent = String(processed);
  document.getElementById("tabsText").textContent = String(state.maxWorkers || document.getElementById("workerCount")?.value || 3);
  const pct = queued > 0 ? Math.min(100, Math.round((processed / queued) * 100)) : (state.running ? 15 : 0);
  document.getElementById("progressBar").style.width = `${pct}%`;
  setBusy(Boolean(state.running));
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById("resultsBody");
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">No results yet</td></tr>`;
    return;
  }

  tbody.innerHTML = leads.map((lead, index) => `
    <tr>
      <td>${index + 1}</td>
      <td title="${html(lead.name)}">${html(lead.name) || "-"}</td>
      <td title="${html(lead.phone)}">${html(lead.phone) || "-"}</td>
      <td title="${html(lead.address)}">${html(lead.address) || "-"}</td>
      <td>${lead.website ? `<a href="${html(lead.website)}" target="_blank">Website</a>` : "-"}</td>
      <td>${lead.imageUrl ? `<a href="${html(lead.imageUrl)}" target="_blank">Image</a>` : "-"}</td>
      <td title="${html(lead.emails || lead.email)}">${html(lead.email || lead.emails) || "-"}</td>
      <td>${lead.facebook ? `<a href="${html(lead.facebook)}" target="_blank">Facebook</a>` : "-"}</td>
      <td>${lead.instagram ? `<a href="${html(lead.instagram)}" target="_blank">Instagram</a>` : "-"}</td>
      <td title="${html(lead.socialLinks)}">${html(lead.socialLinks) || "-"}</td>
      <td>${lead.mapsUrl ? `<a href="${html(lead.mapsUrl)}" target="_blank">Maps</a>` : "-"}</td>
    </tr>
  `).join("");
}

async function skipScanCity() {
  const res = await send({ type: "SKIP_SCAN_CITY" });
  if (!res?.ok) return toast(res?.error || "Could not skip scan.");
  toast(`Scan skipped. Extracting ${res.queued || 0} collected places now.`);
}

async function skipCity() {
  const res = await send({ type: "SKIP_CITY" });
  if (!res?.ok) return toast(res?.error || "Could not skip city.");
  toast(res.done ? "City skipped. No more cities." : `City skipped. Opening ${res.next || "next city"}.`);
}

function setBusy(isBusy) {
  document.getElementById("startBtn").disabled = isBusy;
  document.getElementById("stopBtn").disabled = !isBusy;
  document.getElementById("skipScanBtn").disabled = !isBusy;
  document.getElementById("skipCityBtn").disabled = !isBusy;
}

function send(payload) {
  return new Promise(resolve => chrome.runtime.sendMessage(payload, response => resolve(response || {})));
}

function html(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csv(value) {
  return `"${String(value || "").replace(/"/g, '""')}"`;
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
}

function toast(text) {
  const el = document.getElementById("toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
