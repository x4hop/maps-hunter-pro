// Load the stable worker first, then replace only extraction/normalization hooks.
importScripts("background.js");
importScripts("maps-page-overrides.js");
importScripts("country-query-overrides.js");
importScripts("location-phone-overrides.js");

try {
  state.enrichWebsites = false;
} catch (e) {}
