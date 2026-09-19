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
  // Public website HTML is fetched in the service worker; websites are never opened as visible tabs.
  state.enrichWebsites = true;
} catch (e) {}
