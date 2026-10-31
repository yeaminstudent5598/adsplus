// AdPulse BD - UI (DOM API only, innerHTML use kora hoyni => XSS safe)
// Each file is wrapped in an IIFE: content scripts share one global scope,
// so top-level const/let would clash between files.
(function () {
const AdPulse = (globalThis.AdPulse = globalThis.AdPulse || {});
const AP = AdPulse;

// ---------- helpers ----------
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}
function btn(cls, text, onClick) {
  const b = el("button", cls, text);
  b.type = "button";
  b.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(e);
  });
  return b;
}
// $100 er niche hole cents shoho ($5.18), upore hole round ($1,920)
const usd = (n) => "$" + (Math.abs(n) < 100 ? Number(n).toFixed(2) : Math.round(n).toLocaleString("en-US"));
const usd2 = (n) => "$" + Number(n).toFixed(2);
const bdt = (n) => "৳" + Math.round(n).toLocaleString("en-US");
const short = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "K" : String(Math.round(n));
// real data hole exact number (4,317), estimate hole short (4K)
const big = (est, n) => (est.real ? Math.round(n).toLocaleString("en-US") : short(n));
const pct = (n, d) => (n * 100).toFixed(d === undefined ? 1 : d) + "%";

function confText(meta) {
  return meta.conf === "Real" ? "Real data" : meta.conf + " confidence";
}
function chip(text, cls) {
  return el("span", "ap-chip " + (cls || ""), text);
}
function chips(list) {
  const w = el("div", "ap-chips");
  list.forEach(([t, c]) => w.append(chip(t, c)));
  return w;
}
function sc(label, value, sub) {
  const b = el("div", "ap-sc");
  b.append(el("div", "ap-sc-l", label), el("div", "ap-sc-v", value));
  if (sub) b.append(el("div", "ap-sc-s", sub));
  return b;
}
function grid(cols, ...kids) {
  const g = el("div", "ap-grid ap-g" + cols);
  g.append(...kids);
  return g;
}
function kv(label, value) {
  const r = el("div", "ap-kv");
  const v = typeof value === "string" ? el("span", "ap-kv-v", value) : value;
  r.append(el("span", "ap-kv-l", label), v);
  return r;
}
function box(title, badge, ...kids) {
  const b = el("div", "ap-box");
  if (title) {
    const h = el("div", "ap-box-h");
    h.append(el("span", "", title));
    if (badge) h.append(el("span", "ap-pill", badge));
    b.append(h);
  }
  b.append(...kids);
  return b;
}
function logo() {
  return el("span", "ap-logo", "S");
}
function liveBadge(ad) {
  return el("span", "ap-live " + (ad.active ? "" : "ap-ended"), ad.active ? "● Live" : "Ended");
}

let toastEl = null;
function toast(msg) {
  if (!toastEl) {
    toastEl = el("div", "ap-toast");
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add("ap-show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toastEl && toastEl.classList.remove("ap-show"), 2400);
}

// competitor ad + estimate off => shudhu real tothyo (Ad Library + landing page) dekhai
function factsOnly(ad) {
  return !ad.real && !AP.CONFIG.showEstimates;
}
function confLabel(ad, meta) {
  return ad.real ? "Real data" : factsOnly(ad) ? "Real facts" : meta.conf + " confidence";
}
function confCls(ad, meta) {
  return ad.real || factsOnly(ad) ? "real" : meta.conf.toLowerCase();
}
function landingLink(ad) {
  if (!ad.landing) return el("span", "ap-kv-v", "not found");
  let host = ad.landing;
  try { host = new URL(ad.landing).hostname; } catch (_) {}
  const a = el("a", "ap-link", host + " ↗");
  a.href = ad.landing;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function storeFacts(ad) {
  let platform = "—", pixel = "—";
  if (ad.infoState === "pending") platform = pixel = "checking…";
  else if (ad.infoState === "error") platform = pixel = "could not load";
  else if (ad.info) {
    platform = ad.info.platform || "Custom";
    pixel = ad.info.pixel ? "Installed" : "Not found";
  }
  const price = ad.priceBDT ? `${bdt(ad.priceBDT)} (${usd2(ad.priceBDT / AP.CONFIG.fx)})` : "not detected";
  return { platform, pixel, price };
}
function factsRows(ad) {
  const t = AP.resolveType(ad);
  const f = storeFacts(ad);
  const rows = [
    kv("Campaign type", t.def.label + " (CTA/লিংক থেকে অনুমান)"),
    kv("CTA button", t.cta || "—"),
    kv("Status", ad.active ? "Active" : "Inactive"),
    kv("Format", ad.format),
    kv("Started", ad.startStr || "unknown"),
    kv("Running", ad.days + " days"),
    kv("Versions (copies)", String(ad.variants)),
  ];
  if (t.key === "messages") {
    rows.push(kv("Message destination", t.destination || AP.messagingDest(ad.landing) || "Messaging app"));
  } else {
    rows.push(kv("Landing", landingLink(ad)), kv("Platform", f.platform), kv("Meta Pixel", f.pixel), kv("Product price", f.price));
  }
  return rows;
}

// result value formatter (campaign type onujayi alada alada metric)
function fmtVal(v, kind) {
  if (kind === "usd") return usd2(v);
  if (kind === "pct") return pct(v, 1);
  if (kind === "x") return Number(v).toFixed(2) + "x";
  if (kind === "s") return Number(v).toFixed(1) + "s";
  return Math.round(v).toLocaleString("en-US");
}
function srcBadge(est) {
  return est.real ? "Real" : est.res.source === "inferred" ? "Inferred type" : "Modeled";
}
// Sales hole Total sales/Revenue, baki type e oi campaign er nijer result
function resultCards(est) {
  const r = est.res;
  if (r.key === "sales") {
    return grid(2,
      sc("Total sales", `${Math.round(est.orders).toLocaleString("en-US")} orders`, est.real ? `CPA ${usd2(est.cpa)}` : null),
      sc("Revenue", usd(est.revenue), est.real ? `ROAS ${est.roas.toFixed(1)}x` : null));
  }
  return grid(2,
    sc("Total " + r.noun.toLowerCase(), big(est, r.count), est.real ? "real result" : "estimated"),
    sc(r.costLabel, r.cost > 0 ? usd2(r.cost) : "—", est.real ? "real" : "estimated"));
}

function productChips(ad, meta, est) {
  const r = est.res;
  const list = [
    ["ক্যাম্পেইন: " + r.label + (r.source === "inferred" ? " (অনুমান)" : ""), "ap-c-lime"],
    ["ক্যাটাগরি: " + meta.cat.short, "ap-c-cyan"],
  ];
  if (r.key === "sales") list.push([`✓ Price from Checkout Sale: ${bdt(est.priceBDT)} (${usd2(est.priceUSD)})`, "ap-c-lime"]);
  return chips(list);
}

function downloadMedia(ad) {
  const m = AP.findMedia(ad.card);
  if (!m) return toast("এই কার্ডে ডাউনলোডযোগ্য মিডিয়া পাওয়া যায়নি");
  chrome.runtime
    .sendMessage({ type: "AP_DOWNLOAD", url: m.url, filename: `adpulse/${ad.id}.${m.ext}` })
    .then((r) =>
      toast(r && r.ok ? (m.kind === "video-thumbnail" ? "ভিডিও থাম্বনেইল ডাউনলোড শুরু হয়েছে" : "ডাউনলোড শুরু হয়েছে") : "ডাউনলোড করা গেল না")
    )
    .catch(() => toast("ডাউনলোড করা গেল না"));
}

// =====================================================================
// 1) Card er upore compact bar + details
// =====================================================================
const openIds = new Set();

AP.mountCard = function (card, ad) {
  const root = el("div", "ap-wrap");
  root.addEventListener("click", (e) => e.stopPropagation());

  function bar(est, meta) {
    const b = el("div", "ap-bar");
    b.setAttribute("role", "button");
    b.tabIndex = 0;
    const mid = el("div", "ap-bar-mid");
    const chev = el("span", "ap-chev", openIds.has(ad.id) ? "▴" : "▾");
    if (factsOnly(ad)) {
      mid.append(
        el("div", "ap-bar-t", `Running ${ad.days}d · ${ad.variants} ${ad.variants > 1 ? "versions" : "version"}`),
        el("div", "ap-bar-s", `▣ ${ad.format} · Ad Library facts`)
      );
      b.append(logo(), mid, el("span", "ap-facttag", "REAL FACTS"), liveBadge(ad), chev);
    } else {
      mid.append(el("div", "ap-bar-t", `${est.real ? "Spend" : "Est. Spend"} - ${usd2(est.daily)}/day`), el("div", "ap-bar-s", "▣ " + meta.cat.short + " · " + est.res.label));
      b.append(logo(), mid);
      if (est.real) b.append(el("span", "ap-realtag", "REAL"));
      b.append(liveBadge(ad), el("span", "ap-bar-total", usd(est.spend)), chev);
    }
    const toggle = () => {
      if (openIds.has(ad.id)) openIds.delete(ad.id);
      else openIds.add(ad.id);
      draw();
    };
    b.addEventListener("click", toggle);
    b.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggle();
      }
    });
    return b;
  }

  function factsDetails(meta) {
    const d = el("div", "ap-detail");
    const h = el("div", "ap-d-head");
    h.append(el("span", "ap-d-title", "AD LIBRARY FACTS (REAL)"), el("span", "ap-conf ap-conf-real", "● Real facts"));
    const foot = el("div", "ap-d-foot");
    const open = btn("ap-open", "", () => AP.openDrawer(ad, "campaign"));
    open.append(el("span", "ap-open-l", "Full ad insights"), el("span", "ap-open-r", "Open →"));
    foot.append(open, btn("ap-hd", "↓ HD", () => downloadMedia(ad)));
    d.append(
      h,
      ...factsRows(ad),
      el("div", "ap-note", "Spend, orders, revenue Meta প্রতিযোগীর এডের জন্য দেয় না, তাই দেখানো হচ্ছে না। নিজের এড হলে Real data setup করুন।"),
      foot
    );
    return d;
  }

  function details(est, meta) {
    if (factsOnly(ad)) return factsDetails(meta);
    const d = el("div", "ap-detail");
    const h = el("div", "ap-d-head");
    h.append(
      el("span", "ap-d-title", est.real ? "SPEND OVERVIEW (REAL · YOUR AD ACCOUNT)" : "SPEND OVERVIEW (V1.5 MODELED)"),
      el("span", "ap-conf ap-conf-" + confCls(ad, meta), "● " + confLabel(ad, meta))
    );

    const lines = el("div", "ap-lines");
    const l1 = el("div", "ap-line");
    l1.append(
      ...[
        ["Running", ad.days + "d"], ["Variants", String(ad.variants)],
        ["CPM", usd2(est.cpm)], ["CTR", pct(est.ctr)],
      ].flatMap(([k, v]) => [el("span", "ap-lk", k + " "), el("b", "", v), document.createTextNode("  ")])
    );
    const l2 = el("div", "ap-line");
    l2.append(
      el("span", "ap-lk", "Status "), el("b", "", ad.active ? "Active" : "Inactive"),
      document.createTextNode("   "), el("span", "ap-lk", "Format: "), el("b", "", ad.format)
    );
    const l3 = el("div", "ap-line");
    l3.append(el("span", "ap-lk", "Runs on "), el("b", "", "Meta platforms"));
    lines.append(l1, l2, l3);

    const why = el("div", "ap-why");
    why.append(el("span", "ap-why-k", "💡 কারণ: "), document.createTextNode(meta.reason));

    const salesBtn = btn("ap-sales", est.res.title, () => {
      ad._salesClosed = !ad._salesClosed;
      draw();
    });
    salesBtn.append(el("span", "ap-sales-arrow", ad._salesClosed ? "▾" : "▴"));

    const parts = [
      h,
      grid(3, sc(est.real ? "Daily budget" : "Day spend", usd2(est.daily), est.real ? "ad set budget" : `Today ≈ ${usd2(est.daily)}`), sc("Total spend", usd(est.spend), `${ad.days} days`), sc("Views", big(est, est.impressions), est.real ? `${big(est, est.reach)} reach` : "impressions")),
      lines,
      productChips(ad, meta, est),
      why,
      salesBtn,
    ];
    if (!ad._salesClosed) parts.push(resultCards(est));
    const foot = el("div", "ap-d-foot");
    const open = btn("ap-open", "", () => AP.openDrawer(ad, "performance"));
    open.append(el("span", "ap-open-l", "Full ad insights"), el("span", "ap-open-r", "Open →"));
    foot.append(open, btn("ap-hd", "↓ HD", () => downloadMedia(ad)));
    parts.push(foot, el("div", "ap-note", est.real ? "✓ আপনার Ad Account এর আসল ডেটা (Meta Marketing API)।" : "Modeled from benchmarks — Meta র আসল সেলস ডেটা নয়।"));
    d.append(...parts);
    return d;
  }

  function draw() {
    const est = AP.estimate(ad);
    ad._est = est;
    const meta = AP.analyze(ad);
    const kids = [bar(est, meta)];
    if (openIds.has(ad.id)) kids.push(details(est, meta));
    root.replaceChildren(...kids);
  }

  card.insertBefore(root, card.firstChild);
  draw();
  return { root, draw };
};

// =====================================================================
// 2) Right side drawer (Full ad insights)
// =====================================================================
let drawerEl = null;
let drawerState = null; // { ad, tab }

const TABS = [
  ["performance", "Performance"],
  ["audience", "Audience"],
  ["campaign", "Campaign"],
  ["engagement", "Engagement"],
  ["store", "Store"],
];

function tabPerformance(ad, est, meta) {
  const w = el("div", "ap-tabbody");
  w.append(
    grid(2,
      sc("CTR", pct(est.ctr), "click-through rate"),
      sc("CPC", usd2(est.cpc), "per click ($)"),
      sc("CPM", usd2(est.cpm), "per 1,000 views"),
      sc(est.res.costLabel, est.res.cost > 0 ? usd2(est.res.cost) : "—", est.res.key === "sales" ? `per purchase (${bdt(est.cpaBDT)})` : "per " + est.res.noun.toLowerCase().replace(/s$/, ""))
    ),
    box("Reach & impressions", null,
      kv("Impressions", big(est, est.impressions)),
      kv("Reach (unique people)", big(est, est.reach)),
      kv("Frequency", est.frequency.toFixed(2) + "x")
    ),
    box("Results · " + est.res.label, srcBadge(est),
      kv(est.res.noun, big(est, est.res.count)),
      ...est.res.extras.map(([l, v, k]) => kv(l, fmtVal(v, k)))
    )
  );
  if (est.res.allActions && est.res.allActions.length) {
    w.append(box("All actions (Meta API)", "Real", ...est.res.allActions.map(([k, v]) => kv(k.replace(/^onsite_conversion\./, "").replace(/^offsite_conversion\./, ""), Math.round(v).toLocaleString("en-US")))));
  }
  if (ad.format === "VIDEO") {
    w.append(
      box("Video", est.real ? "Real" : "Modeled",
        grid(2,
          sc("Hook rate", pct(est.hook), "3-sec plays ÷ impressions"),
          sc("Hold rate", pct(est.hold), "ThruPlays ÷ 3-sec plays"),
          sc("ThruPlays", big(est, est.thruPlays), `${big(est, est.plays3s)} 3-sec plays`),
          sc("Avg. watch time", est.avgWatch.toFixed(1) + "s", `${usd2(est.costPerThruPlay)} per ThruPlay`)
        )
      )
    );
  }
  w.append(productChips(ad, meta, est));
  return w;
}

function tabAudience(ad, est, meta) {
  const w = el("div", "ap-tabbody");
  w.append(
    box("Audience (inferred)", "Not Meta data",
      kv("Age range", meta.cat.age + " years"),
      kv("Gender skew", meta.cat.skew),
      kv("Location", "Bangladesh"),
      kv("Language", /[\u0980-\u09FF]/.test(ad.text || "") ? "Bangla" : "English / Mixed")
    ),
    box("Likely interests", null, chips(meta.cat.interests.map((t) => [t, "ap-c-cyan"]))),
    el("div", "ap-note", "Ad text আর প্রোডাক্ট ক্যাটাগরি থেকে অনুমান করা। Meta Ad Library BD-র কমার্শিয়াল এডের অডিয়েন্স ডেটা দেয় না।")
  );
  return w;
}

function tabFacts(ad, meta) {
  const w = el("div", "ap-tabbody");
  w.append(
    box("Ad Library facts", "Real", ...factsRows(ad)),
    box("Offer & hooks (এডের লেখা থেকে)", null, chips((meta.hooks.length ? meta.hooks : ["No clear hook detected"]).map((t) => [t, "ap-c-lime"]))),
    box("Meta দেয় না (প্রতিযোগীর এড)", null,
      kv("Spend / Budget", "N/A"), kv("Impressions / Reach", "N/A"), kv("Orders / Revenue", "N/A"), kv("Audience", "N/A")
    ),
    el("div", "ap-note", "নিজের এডের এই সব আসল ডেটা পেতে extension icon → Real data setup করুন।")
  );
  return w;
}

function tabCampaign(ad, est, meta) {
  const w = el("div", "ap-tabbody");
  w.append(
    box(null, null,
      ...(est.res.key === "sales" ? [kv("Checkout Product", meta.cat.short)] : []),
      kv("Category", meta.cat.short),
      kv("Objective", est.res.source === "real" ? (est.res.objective || est.res.label) : est.res.label + " (CTA থেকে অনুমান)"),
      ...(est.res.goal ? [kv("Optimization goal", est.res.goal)] : []),
      ...(est.res.destination ? [kv("Conversion location", est.res.destination)] : []),
      ...(est.res.cta ? [kv("CTA button", est.res.cta)] : []),
      kv("Creative Format", ad.format)
    ),
    box("Budget & spend", est.real ? "Real" : "Modeled",
      grid(2,
        sc("Daily budget (Ad Share)", usd2(est.daily), usd2(est.daily * 0.9) + " – " + usd2(est.daily * 1.15)),
        sc("Weekly spend", usd(est.weekly), "7-day pace"),
        sc("Monthly run-rate", usd(est.monthly), "at today's pace"),
        sc("Active duplicates", String(ad.variants), "creative copies")
      )
    ),
    box("Offer & hooks", null,
      chips((meta.hooks.length ? meta.hooks : ["No clear hook detected"]).map((t) => [t, "ap-c-lime"]))
    )
  );
  return w;
}

function tabEngagement(ad, est) {
  const w = el("div", "ap-tabbody");
  w.append(
    grid(2,
      sc("Reactions", big(est, est.reactions), pct(est.reactions / est.impressions, 2) + " of views"),
      sc("Comments", big(est, est.comments), pct(est.comments / est.impressions, 2) + " of views"),
      sc("Shares", big(est, est.shares), pct(est.shares / est.impressions, 2) + " of views"),
      sc("Engagement rate", pct(est.engagementRate, 2), `${usd2(est.costPerEngagement)} per engagement`)
    ),
    el("div", "ap-note", est.real ? "আপনার Ad Account এর আসল রিঅ্যাকশন/কমেন্ট/শেয়ার।" : "Benchmark rate × impressions থেকে হিসাব। Settings থেকে rate বদলাতে পারবে।")
  );
  return w;
}

function tabStore(ad, est, meta) {
  const w = el("div", "ap-tabbody");
  const info = ad.info;
  let landingNode;
  if (ad.landing) {
    let host = ad.landing;
    try { host = new URL(ad.landing).hostname; } catch (_) {}
    landingNode = el("a", "ap-link", host + " ↗");
    landingNode.href = ad.landing;
    landingNode.target = "_blank";
    landingNode.rel = "noopener noreferrer";
  } else {
    landingNode = el("span", "ap-kv-v", "not found");
  }
  let platform = "—", pixel = "—", badge = null;
  if (ad.infoState === "pending") platform = pixel = "checking…";
  else if (ad.infoState === "error") platform = pixel = "could not load";
  else if (info) {
    platform = info.platform || "Custom";
    pixel = info.pixel ? "Installed" : "Not found";
    badge = "Checkout Scraped ✓";
  }
  if (est.res.key === "messages") {
    w.append(
      box("Message destination", est.res.source === "real" ? "Real" : "Inferred",
        kv("Destination", est.res.destination || AP.messagingDest(ad.landing) || "Messaging app"),
        kv("Link", landingLink(ad)),
        kv("Meta Pixel", "N/A (messaging)")
      ),
      el("div", "ap-note", "Message campaign এ checkout/price থাকে না, তাই সেটা দেখানো হচ্ছে না।")
    );
    return w;
  }
  w.append(
    box("Landing Page & Checkout Details", badge,
      kv("CTA Landing Link", landingNode),
      kv("Funnel / Platform", platform),
      kv("Meta Pixel", pixel)
    ),
    box("Exact Checkout Product & Use-Case", info && info.price ? "Price detected ✓" : factsOnly(ad) ? "Not detected" : "Default price",
      kv("Checkout Product Name", info && info.title ? info.title.slice(0, 38) : meta.cat.short),
      kv("Exact Category", meta.cat.short),
      kv("Price (অর্ডার প্রাইস)", factsOnly(ad) ? storeFacts(ad).price : `${bdt(est.priceBDT)} (${usd2(est.priceUSD)})`)
    )
  );
  return w;
}

// "Real data link" box: nijer ad account er ad er sathe card ta milano
function linkBox(ad) {
  const R = AP.real;
  const b = el("div", "ap-link-box");
  if (!R || !R.connected) {
    b.append(el("div", "ap-note", "নিজের এডের আসল ডেটা দেখতে: extension icon → Real data অংশে Access Token ও Ad Account ID দিন।"));
    return b;
  }
  if (ad.real) {
    const r = el("div", "ap-lb-row");
    r.append(
      el("span", "ap-lb-ok", `✓ Real: ${ad.real.name.slice(0, 34)} (${ad.realMatch === "auto" ? "auto-match" : "linked"})`),
      btn("ap-lb-btn", "Unlink", () => AP.unlinkAd(ad))
    );
    b.append(r);
    return b;
  }
  b.append(el("div", "ap-note", "এই এড আপনার Ad Account এ পাওয়া যায়নি। প্রতিযোগীর এড হলে আসল ডেটা নেই। নিজের এড হলে নিচ থেকে বেছে Link করুন:"));
  const r = el("div", "ap-lb-row");
  const sel = el("select", "ap-sel");
  sel.addEventListener("click", (e) => e.stopPropagation());
  sel.append(el("option", "", "— আপনার এড বেছে নিন —"));
  sel.firstChild.value = "";
  R.ads.forEach((a) => {
    const o = el("option", "", `${a.name.slice(0, 36)} · $${(a.spend / (a.currency === "BDT" ? AP.CONFIG.fx : 1)).toFixed(2)}`);
    o.value = a.id;
    sel.append(o);
  });
  r.append(sel, btn("ap-lb-btn", "Link", () => sel.value && AP.linkAd(ad, sel.value)));
  b.append(r);
  return b;
}

function drawDrawer() {
  if (!drawerState) {
    if (drawerEl) {
      drawerEl.remove();
      drawerEl = null;
    }
    return;
  }
  const prevScroll = drawerEl ? drawerEl.scrollTop : 0;
  if (!drawerEl) {
    drawerEl = el("div", "ap-drawer");
    drawerEl.addEventListener("click", (e) => e.stopPropagation());
    document.body.appendChild(drawerEl);
  }
  const ad = drawerState.ad;
  const tabsList = factsOnly(ad) ? [["campaign", "Facts"], ["store", "Store"]] : TABS;
  if (!tabsList.some((t) => t[0] === drawerState.tab)) drawerState.tab = tabsList[0][0];
  const tab = drawerState.tab;
  const est = AP.estimate(ad);
  ad._est = est;
  const meta = AP.analyze(ad);

  const head = el("div", "ap-dh");
  const title = el("div", "ap-dh-title");
  title.append(el("span", "", "AdPulse BD v1.5"), el("span", "ap-pill ap-pill-green", "Business"));
  const right = el("div", "ap-dh-right");
  right.append(btn("ap-hd", "↓ HD", () => downloadMedia(ad)), btn("ap-x", "✕", () => AP.closeDrawer()));
  const top = el("div", "ap-dh-top");
  top.append(logo(), title, right);

  const sub = el("div", "ap-dsub");
  sub.append(
    document.createTextNode(`ID: ${ad.id} · ${ad.days}d running · `),
    liveBadge(ad),
    document.createTextNode(" · "),
    el("span", "ap-conf ap-conf-" + confCls(ad, meta), confLabel(ad, meta))
  );
  head.append(top, sub, linkBox(ad));

  const tabs = el("div", "ap-dtabs");
  tabsList.forEach(([key, label]) => {
    tabs.append(
      btn("ap-dtab" + (key === tab ? " ap-on" : ""), label, () => {
        drawerState.tab = key;
        drawDrawer();
      })
    );
  });

  const body =
    tab === "audience" ? tabAudience(ad, est, meta)
    : tab === "campaign" ? (factsOnly(ad) ? tabFacts(ad, meta) : tabCampaign(ad, est, meta))
    : tab === "engagement" ? tabEngagement(ad, est)
    : tab === "store" ? tabStore(ad, est, meta)
    : tabPerformance(ad, est, meta);

  const foot = el("div", "ap-note ap-dfoot", est.real ? "✓ Spend, results, cost per result, reach — আপনার Ad Account এর আসল ডেটা। Audience অংশ অনুমান।" : factsOnly(ad) ? "✓ সব তথ্য Ad Library ও landing page থেকে আসল। Spend/orders Meta প্রতিযোগীর এডের জন্য দেয় না।" : "সব নম্বর মডেল্ড অনুমান (Estimated) — Meta র আসল স্পেন্ড/সেলস নয়। প্রতিযোগীর এডের আসল ডেটা Meta দেয় না।");
  drawerEl.replaceChildren(head, tabs, body, foot);
  drawerEl.scrollTop = prevScroll;
}

AP.openDrawer = function (ad, tab) {
  drawerState = { ad, tab: tab || (drawerState && drawerState.tab) || "performance" };
  drawDrawer();
};
AP.closeDrawer = function () {
  drawerState = null;
  drawDrawer();
};
AP.refreshDrawer = function (ad) {
  if (drawerState && drawerState.ad === ad) drawDrawer();
};

// =====================================================================
// 3) Page-level overview (results count er niche)
// =====================================================================
let overviewEl = null;

function findAnchor() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode;
    if (/^\s*~?[\d,]+\+?\s+results?\s*$/i.test(n.nodeValue || "")) return n.parentElement;
  }
  return null;
}

function line(label, text) {
  const d = el("div", "ap-ov-line");
  d.append(el("b", "", label + " "), document.createTextNode(text));
  return d;
}

AP.updateOverview = function (s) {
  if (!s) {
    if (overviewEl) {
      overviewEl.remove();
      overviewEl = null;
    }
    return;
  }
  if (!overviewEl || !overviewEl.isConnected) {
    const a = findAnchor();
    if (!a) return;
    overviewEl = el("div", "ap-overview");
    overviewEl.addEventListener("click", (e) => e.stopPropagation());
    (a.parentElement || a).insertAdjacentElement("afterend", overviewEl);
  }

  const head = el("div", "ap-ov-head");
  head.append(logo(), el("span", "", "মনিটরিত বিজনেস পেজ — " + s.name + " — বিজনেস পেজ ও মোট এডস স্পেন্ড ওভারভিউ (v1.5)"));

  const showEst = AP.CONFIG.showEstimates;
  const strip = el("div", "ap-ov-strip", showEst
    ? `✓ মডেল্ড বাজেট ও স্পেন্ড হিসাব সম্পন্ন: ${s.scanned}টি এড স্ক্যান করা হয়েছে (সক্রিয় ${s.active}টি)`
    : `✓ Ad Library থেকে আসল তথ্য: ${s.scanned}টি এড স্ক্যান করা হয়েছে (সক্রিয় ${s.active}টি)`);

  const sec3 = el("div", "ap-ov-sec");
  sec3.append(el("span", "", showEst ? "৩. লাইভ এডস স্পেন্ড ও বাজেট (MODELED)" : "৩. এড অ্যাক্টিভিটি (AD LIBRARY — REAL)"));
  if (s.totalResults) sec3.append(el("span", "ap-pill ap-pill-green", `~${s.totalResults} RESULTS`));

  const statGrid = showEst
    ? grid(3,
        sc("মান্থলি বাজেট", usd(s.monthly), "active ads, modeled"),
        sc("টোটাল স্পেন্ড", usd(s.spend), "scanned ads"),
        sc("ইম্প্রেশন", short(s.impressions), "estimated"))
    : grid(3,
        sc("সক্রিয় এড", s.totalResults ? "~" + s.totalResults : String(s.active), "Ad Library"),
        sc("গড় চলার দিন", s.avgDays + " দিন", "স্ক্যান করা এড"),
        sc("সবচেয়ে পুরোনো এড", s.maxDays + " দিন", "স্ক্যান করা এড"));
  const realBlock = s.realCount > 0
    ? box("আপনার Ad Account (REAL)", "Real",
        kv("মিলে যাওয়া এড", String(s.realCount) + "টি"),
        kv("স্পেন্ড", usd(s.realSpend)),
        ...Object.entries(s.realResults || {}).map(([k, v]) => kv(k, Math.round(v).toLocaleString("en-US"))),
        kv("ইম্প্রেশন", Math.round(s.realImpr).toLocaleString("en-US")))
    : null;

  overviewEl.replaceChildren(
    head,
    strip,
    line("১. বিজনেসের ধরন ও পরিচিতি:", `ক্যাটাগরি (অনুমান): ${s.category.full}${s.host ? " · ওয়েবসাইট: " + s.host : ""}`),
    ...(showEst ? [line("২. টার্গেট অডিয়েন্স (অনুমান):", `ইন্টারেস্ট: ${s.category.interests.join(", ")} · ডেমোগ্রাফিক্স: বয়স ${s.category.age} বছর · বিহেভিয়ার: অনলাইন শপার`)] : []),
    sec3,
    statGrid,
    ...(realBlock ? [realBlock] : []),
    el("div", "ap-note", showEst
      ? "এটি বেঞ্চমার্ক-ভিত্তিক অনুমান — Meta র আসল ডেটা নয়। নম্বর শুধু স্ক্রল করে লোড হওয়া এডগুলোর যোগফল।"
      : "চলার দিন, এডের সংখ্যা, landing page — সব আসল। Spend/ইম্প্রেশন Meta প্রতিযোগীর এডের জন্য দেয় না।")
  );
};

// =====================================================================
// 4) Floating toolbar (bottom-right)
// =====================================================================
let toolbar = null;
AP.ensureToolbar = function (onExport) {
  if (toolbar) return toolbar;
  const bar = el("div", "ap-toolbar");
  const txt = el("span", "ap-toolbar-txt", "AdPulse BD");
  const b = btn("ap-btn", "Export CSV", onExport);
  bar.append(txt, b);
  document.body.appendChild(bar);
  toolbar = { bar, txt };
  return toolbar;
};
AP.updateToolbar = function (s) {
  if (!toolbar) return;
  const parts = [`AdPulse BD · ${s.scanned} ads scanned`];
  if (s.totalResults) parts.push(`~${s.totalResults} results`);
  if (AP.fontStatus) parts.push(AP.fontStatus);
  toolbar.txt.textContent = parts.join(" · ");
};
AP.removeToolbar = function () {
  if (toolbar) {
    toolbar.bar.remove();
    toolbar = null;
  }
};
})();
