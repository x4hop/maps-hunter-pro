// Load the stable worker first, then replace only the extraction/normalization hooks.
importScripts("background.js");
importScripts("maps-page-overrides.js");

try {
  state.enrichWebsites = false;
} catch (e) {}
