// Load the stable Google Maps extraction engine and Maps-only overrides.
importScripts("background.js");
importScripts("maps-page-overrides.js");
importScripts("country-query-overrides.js");
importScripts("location-phone-overrides.js");
importScripts("performance-overrides.js");
importScripts("contact-extraction-fix.js");

try {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
} catch (e) {}

try {
  // Product rule: never fetch or open business websites for contact enrichment.
  state.enrichWebsites = false;
} catch (e) {}
