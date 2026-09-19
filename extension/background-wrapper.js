// Load Google Maps extraction plus public-website contact enrichment.
importScripts("background.js");
importScripts("maps-page-overrides.js");
importScripts("country-query-overrides.js");
importScripts("location-phone-overrides.js");
importScripts("performance-overrides.js");
importScripts("contact-enrichment.js");
importScripts("contact-extraction-fix.js");

try {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
} catch (e) {}

try {
  // Product rule: enrich from public business websites in the service worker; never open them as visible tabs.
  state.enrichWebsites = true;
} catch (e) {}
