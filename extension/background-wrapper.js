// Load the stable engine, Maps extraction overrides, then background contact enrichment.
importScripts("background.js");
importScripts("maps-page-overrides.js");
importScripts("country-query-overrides.js");
importScripts("location-phone-overrides.js");
importScripts("contact-enrichment.js");

// Keep the toolbar action wired to the Side Panel on every service-worker start,
// not only on the initial install/update event.
try {
  chrome.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: true }).catch(() => {});
} catch (e) {}

try {
  state.enrichWebsites = true;
} catch (e) {}
