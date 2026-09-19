// Maps Hunter Pro v1.1.0 — robust Maps extraction + asynchronous website contact enrichment.
// Maps data is saved first. Public business websites are then checked in the service worker
// without opening visible website tabs. Completion waits for pending enrichment tasks.

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

    await waitForTabComplete(tab.id, 9000);

    let details = {};
    let lastFingerprint = "";
    let stableReads = 0;
    const started = Date.now();
    const maxWait = 10000;

    while (Date.now() - started < maxWait) {
      if (workerRunId !== scanRunId || !state.running) return;

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

      const hasEmail = Boolean(details.email || details.emails);
      const hasPhone = Boolean(details.phone);
      const hasWebsite = Boolean(details.website);
      const hasUsefulCard = Boolean(
        details.name &&
        (details.address || hasWebsite || details.category || details.rating)
      );
      const elapsed = Date.now() - started;

      // A direct Maps email is already the strongest readiness signal.
      if (hasEmail && stableReads >= 1 && elapsed >= 900) break;
      // When a website exists, it is enough to start the independent enrichment pass.
      if (hasWebsite && hasUsefulCard && stableReads >= 2 && elapsed >= 2200) break;
      if (hasPhone && hasUsefulCard && stableReads >= 2 && elapsed >= 2800) break;
      if (hasUsefulCard && stableReads >= 3 && elapsed >= 4600) break;

      await sleep(420);
    }

    if (workerRunId !== scanRunId || !state.running) return;
    const lead = mergeLead(preview, details);

    // Preserve licensing semantics: consume exactly one unit for the accepted Maps lead.
    preview.usageRequestId ||= crypto.randomUUID();
    inFlightItems.set(key, preview);
    await persistRuntime();
    await MHPAccess.consume(preview.usageRequestId);
    if (workerRunId !== scanRunId || !state.running) return;

    // Save Maps data immediately so website lookup never blocks the Maps worker queue.
    addLead(lead);
    processedKeys.add(key);

    const contactBits = [
      lead.email || lead.emails ? "email" : "",
      lead.phone ? "phone" : ""
    ].filter(Boolean).join(" + ");

    state.status = contactBits
      ? `Saved ${state.leads.length} with ${contactBits}. Queue ${queue.length}.`
      : `Saved ${state.leads.length}. Checking website contacts when available. Queue ${queue.length}.`;

    // Restore the proven legacy behavior: enrich independently after the Maps lead is saved.
    // contact-enrichment.js tracks the promise in pendingEnrichment, so final completion waits for it.
    if (lead.website && state.enrichWebsites && typeof enrichLeadInBackground === "function") {
      enrichLeadInBackground(lead, workerRunId);
    }
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
