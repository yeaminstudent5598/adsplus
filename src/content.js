// AdPulse BD - content script (Meta Ad Library page e cholbe)
(function () {
  const AP = globalThis.AdPulse;
  let entries = new WeakMap(); // cardElement -> { ad, panel }
  const rows = new Map(); // libraryId -> { ad, panel }
  let scanTimer = null;

  // ---------- settings ----------
  async function loadSettings() {
    try {
      const { settings } = await chrome.storage.sync.get("settings");
      AP.applySettings(settings);
    } catch (_) {
      AP.applySettings();
    }
  }

  // ---------- fonts (Hind Siliguri = Bangla, Red Hat Display = English) ----------
  // Facebook CSP CSS font block kore, tai embedded data theke FontFace API (ArrayBuffer) diye load kori.
  AP.fontStatus = "Aa …";
  async function loadFonts() {
    const data = globalThis.AdPulseFonts;
    if (typeof FontFace === "undefined" || !document.fonts || !Array.isArray(data)) {
      AP.fontStatus = "Aa ✗ (FontFace API nai)";
      return refreshAll();
    }
    const failed = [];
    for (const f of data) {
      try {
        const bin = atob(f.b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const face = new FontFace(f.family, bytes.buffer, { weight: f.weight, style: "normal", display: "swap" });
        await face.load();
        document.fonts.add(face);
      } catch (e) {
        failed.push(f.family + " " + f.weight + ": " + String((e && e.message) || e).slice(0, 60));
        console.warn("[AdPulse] font load failed:", f.family, f.weight, e);
      }
    }
    AP.fontStatus = failed.length ? "Aa ✗ " + failed[0] : "Aa ✓";
    refreshAll();
  }

  // ---------- landing fetch (max 3 ek shathe) ----------
  const landingCache = new Map();
  const pending = [];
  let running = 0;

  function pump() {
    while (running < 3 && pending.length) {
      const job = pending.shift();
      running++;
      job().finally(() => {
        running--;
        pump();
      });
    }
  }

  function getLanding(url) {
    if (landingCache.has(url)) return landingCache.get(url);
    const p = new Promise((resolve) => {
      pending.push(() =>
        chrome.runtime
          .sendMessage({ type: "AP_LANDING", url })
          .then(resolve)
          .catch(() => resolve({ error: "message_failed" }))
      );
      pump();
    });
    landingCache.set(url, p);
    return p;
  }

  function toBDT(info) {
    if (!info || !info.price) return null;
    const cur = info.currency || "BDT";
    if (cur === "BDT") return info.price;
    if (cur === "USD") return info.price * AP.CONFIG.fx;
    return null;
  }

  // ---------- real data (nijer ad account) ----------
  let links = {}; // libraryId -> real ad id | "none"
  AP.real = { connected: false, ads: [], currency: "" };

  const norm = (t) => String(t || "").toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");

  function autoMatch(ad) {
    const hay = norm(ad.text);
    const cands = AP.real.ads.filter((a) =>
      a.bodies.some((b) => {
        const n = norm(b).slice(0, 40);
        return n.length >= 12 && hay.includes(n);
      })
    );
    if (!cands.length) return null;
    if (cands.length === 1) return cands[0];
    const start = ad.startStr ? Date.parse(ad.startStr) : NaN;
    if (!isNaN(start)) cands.sort((x, y) => Math.abs(x.created - start) - Math.abs(y.created - start));
    return cands[0];
  }

  function attachReal(ad) {
    ad.real = null;
    ad.realMatch = null;
    if (!AP.real.connected) return;
    const linked = links[ad.id];
    if (linked === "none") return;
    let hit = linked ? AP.real.ads.find((a) => a.id === linked) : null;
    if (hit) ad.realMatch = "manual";
    else if ((hit = autoMatch(ad))) ad.realMatch = "auto";
    if (hit) ad.real = Object.assign({}, hit, { currency: AP.real.currency || hit.currency });
  }

  function redrawAd(ad) {
    const e = rows.get(ad.id);
    if (e) e.panel.draw();
    AP.refreshDrawer(ad);
    refreshAll();
  }

  AP.linkAd = async function (ad, realId) {
    links[ad.id] = realId;
    await chrome.storage.local.set({ links });
    attachReal(ad);
    redrawAd(ad);
  };
  AP.unlinkAd = async function (ad) {
    links[ad.id] = "none";
    await chrome.storage.local.set({ links });
    attachReal(ad);
    redrawAd(ad);
  };

  async function loadReal(force) {
    try {
      const r = await chrome.runtime.sendMessage({ type: "AP_REAL_LIST", force: !!force });
      AP.real = r && r.ok
        ? { connected: true, ads: r.ads, currency: r.currency, accountName: r.accountName }
        : { connected: false, ads: [], currency: "", error: r && r.error, code: r && r.code };
    } catch (_) {
      AP.real = { connected: false, ads: [], currency: "" };
    }
    try {
      links = (await chrome.storage.local.get("links")).links || {};
    } catch (_) {}
    rows.forEach(({ ad, panel }) => {
      attachReal(ad);
      panel.draw();
      AP.refreshDrawer(ad);
    });
    refreshAll();
  }

  // ---------- page overview (dominant advertiser) ----------
  function computeOverview() {
    const list = [...rows.values()].map((r) => r.ad);
    if (!list.length) return null;

    const by = new Map();
    list.forEach((a) => {
      const k = a.advertiser || "Unknown";
      if (!by.has(k)) by.set(k, []);
      by.get(k).push(a);
    });
    let top = null;
    by.forEach((arr, name) => {
      if (!top || arr.length > top.arr.length) top = { name, arr };
    });

    const arr = top.arr;
    const act = arr.filter((a) => a.active);
    let monthly = 0, spend = 0, impressions = 0;
    let realCount = 0, realSpend = 0, realImpr = 0;
    const realResults = {};
    let dayTotal = 0, maxDays = 0;
    arr.forEach((a) => {
      const e = a._est || AP.estimate(a);
      spend += e.spend;
      impressions += e.impressions;
      if (a.active) monthly += e.monthly;
      dayTotal += a.days;
      if (a.days > maxDays) maxDays = a.days;
      if (a.real) {
        realCount++;
        realSpend += e.spend;
        const rr = e.res;
        realResults[rr.noun] = (realResults[rr.noun] || 0) + rr.count; // type onujayi alada (orders / conversations / leads ...)
        realImpr += e.impressions;
      }
    });

    const catCount = new Map();
    const hostCount = new Map();
    arr.forEach((a) => {
      const c = AP.analyze(a).cat;
      catCount.set(c.key, { c, n: ((catCount.get(c.key) || {}).n || 0) + 1 });
      if (a.landing) {
        try {
          const h = new URL(a.landing).hostname;
          hostCount.set(h, (hostCount.get(h) || 0) + 1);
        } catch (_) {}
      }
    });
    let category = null;
    catCount.forEach((v) => {
      if (!category || v.n > category.n) category = v;
    });
    let host = "";
    let hn = 0;
    hostCount.forEach((n, h) => {
      if (n > hn) { hn = n; host = h; }
    });

    return {
      name: top.name,
      scanned: arr.length,
      active: act.length,
      totalResults: AP.totalResults(),
      monthly, spend, impressions,
      avgDays: Math.round(dayTotal / arr.length),
      maxDays,
      realCount, realSpend, realResults, realImpr,
      category: category.c,
      host,
    };
  }

  function refreshAll() {
    AP.updateToolbar({ scanned: rows.size, totalResults: AP.totalResults() });
    AP.updateOverview(computeOverview());
  }

  // ---------- CSV export ----------
  function csvCell(v) {
    let s = v === null || v === undefined ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // formula injection roke
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function exportCSV() {
    const head = [
      "library_id", "advertiser", "active", "started", "days", "copies", "format",
      "landing", "platform", "meta_pixel", "price_bdt",
      "data_source", "campaign_type", "daily_usd", "total_spend_usd", "results", "cost_per_result_usd", "revenue_usd", "roas",
    ];
    const lines = [head.map(csvCell).join(",")];
    rows.forEach(({ ad }) => {
      const shown = ad.real || AP.CONFIG.showEstimates;
      const e = shown ? ad._est || {} : {}; // competitor ad + estimate off => number faka
      lines.push(
        [
          ad.id, ad.advertiser, ad.active, ad.startStr, ad.days, ad.variants, ad.format,
          ad.landing || "",
          ad.info ? ad.info.platform : "",
          ad.info ? (ad.info.pixel ? "yes" : "no") : "",
          e.priceBDT ? Math.round(e.priceBDT) : "",
          e.real ? "real" : shown ? "estimate" : "facts_only",
          e.res ? e.res.key : AP.resolveType(ad).key,
          e.daily ? e.daily.toFixed(2) : "",
          e.spend ? Math.round(e.spend) : "",
          e.res && e.res.count ? Math.round(e.res.count) : "",
          e.res && e.res.cost ? e.res.cost.toFixed(2) : "",
          e.revenue ? Math.round(e.revenue) : "",
          e.roas ? e.roas.toFixed(2) : "",
        ]
          .map(csvCell)
          .join(",")
      );
    });
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "adpulse-bd-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ---------- scan ----------
  function scan() {
    if (!AP.CONFIG.enabled) return;
    AP.ensureToolbar(exportCSV);

    AP.findCards().forEach((card) => {
      const existing = entries.get(card);
      if (existing) {
        // Facebook re-render korle amader node uriye dite pare, abar boshai
        if (!existing.panel.root.isConnected) card.insertBefore(existing.panel.root, card.firstChild);
        return;
      }
      const ad = AP.parseCard(card);
      if (!ad) return;
      ad.card = card;
      if (ad.landing && AP.messagingDest(ad.landing)) ad.infoState = "none"; // WhatsApp/Messenger link e price/pixel nai
      attachReal(ad);

      const panel = AP.mountCard(card, ad);
      const entry = { ad, panel };
      entries.set(card, entry);
      rows.set(ad.id, entry);

      if (ad.landing && ad.infoState === "pending") {
        getLanding(ad.landing).then((info) => {
          if (!info || info.error) {
            ad.infoState = "error";
          } else {
            ad.info = info;
            ad.infoState = "done";
            ad.priceBDT = toBDT(info) || ad.priceBDT;
          }
          panel.draw();
          AP.refreshDrawer(ad);
          refreshAll();
        });
      }
    });
    refreshAll();
  }

  function schedule() {
    clearTimeout(scanTimer);
    scanTimer = setTimeout(scan, 600);
  }

  function clearAll() {
    rows.forEach(({ panel }) => panel.root.remove());
    rows.clear();
    entries = new WeakMap();
    AP.closeDrawer();
    AP.updateOverview(null);
  }

  // ---------- boot ----------
  loadSettings().then(() => {
    const obs = new MutationObserver(schedule); // infinite scroll er jonno
    obs.observe(document.body, { childList: true, subtree: true });
    loadFonts(); // age font, tarpor scan (font swap hoye jabe)
    scan();
    loadReal(false);
  });

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && (changes.fbToken || changes.fbAccount)) {
        loadReal(true);
        return;
      }
      if (area !== "sync" || !changes.settings) return;
      loadSettings().then(() => {
        clearAll();
        if (AP.CONFIG.enabled) scan();
        else AP.removeToolbar();
      });
    });
  } catch (_) {}
})();
