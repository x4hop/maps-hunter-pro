// Maps Hunter Pro v1.0.0 — readiness-only extraction fix.
// IMPORTANT: this file must never scan the whole Google page for contacts.
// Contact parsing stays in maps-page-overrides.js, scoped to the Maps place panel.

async function processPlace(preview, workerRunId = scanRunId) {
  let tab = null;
  const key = preview.mapsUrl || `${preview.name}|${preview.address}`;
  try {
    state.phase = "Extracting";
    state.status = `Extracting Maps details: ${preview.name || "place"}`;
    await broadcast();

    tab = await chromeTabsCreate({ url: preview.mapsUrl, active: false });
    workerTabs.add(tab.id);
    await persistRuntime();

    // Give Chrome a real chance to finish the background Maps navigation.
    await waitForTabComplete(tab.id, 9000);

    let details = {};
    let lastFingerprint = "";
    let stableReads = 0;
    const started = Date.now();
    const maxWait = 10000;

    while (Date.now() - started < maxWait) {
      if (workerRunId !== scanRunId || !state.running) return;

      // Uses extractGoogleMapsPlace() from maps-page-overrides.js.
      // That extractor is intentionally scoped to div[role="main"].
      const next = await extractFromMapsTab(tab.id);
      details = mergeLead(details, next);

      const fingerprint = [
        details.name,
        details.phone,
        details.email,
        details.website,
        details.address
      ].join("|");

      if (fingerprint && fingerprint === lastFingerprint) stableReads += 1;
      else stableReads = 0;
      lastFingerprint = fingerprint;

      const hasContact = Boolean(details.phone || details.email);
      const hasUsefulCard = Boolean(
        details.name &&
        (details.address || details.website || details.category || details.rating)
      );
      const elapsed = Date.now() - started;

      // Exit quickly once contact data is stable, otherwise allow the place card
      // a little longer to finish rendering before committing an empty contact.
      if (hasContact && stableReads >= 1 && elapsed >= 900) break;
      if (hasUsefulCard && stableReads >= 2 && elapsed >= 3600) break;

      await sleep(420);
    }

    if (workerRunId !== scanRunId || !state.running) return;
    const lead = mergeLead(preview, details);

    preview.usageRequestId ||= crypto.randomUUID();
    inFlightItems.set(key, preview);
    await persistRuntime();
    await MHPAccess.consume(preview.usageRequestId);
    if (workerRunId !== scanRunId || !state.running) return;

    addLead(lead);
    processedKeys.add(key);

    const contactBits = [
      lead.email ? "email" : "",
      lead.phone ? "phone" : ""
    ].filter(Boolean).join(" + ");

    state.status = contactBits
      ? `Saved ${state.leads.length} with ${contactBits}. Queue ${queue.length}.`
      : `Saved ${state.leads.length}. No contact exposed by Maps. Queue ${queue.length}.`;
  } catch (error) {
    if (error.accessError && workerRunId === scanRunId) {
      await pauseScan(error.message, preview);
      return;
    }

    if (workerRunId === scanRunId && state.running) {
      try {
        preview.usageRequestId ||= crypto.randomUUID();
        inFlightItems.set(key, preview);
        await persistRuntime();
        await MHPAccess.consume(preview.usageRequestId);
      } catch (access) {
        if (access.accessError) {
          await pauseScan(access.message, preview);
          return;
        }
      }

      addLead(preview);
      processedKeys.add(key);
      state.status = `Saved preview after detail error. Queue ${queue.length}.`;
    }
  } finally {
    if (tab?.id) {
      try { await chromeTabsRemove(tab.id); } catch (e) {}
      workerTabs.delete(tab.id);
      await persistRuntime();
    }
  }
}
