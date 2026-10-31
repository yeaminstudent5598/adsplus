// AdPulse BD - service worker
// Kaj: landing page fetch kore price / platform / Meta Pixel detect kora.
// Content script CORS e atke, tai fetch ta ekhane hoy.

const TTL_MS = 24 * 60 * 60 * 1000; // 24 ghonta cache
const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML = 600000; // prothom ~600KB porbo

function isSafeUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || h.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false;
    return true;
  } catch (_) {
    return false;
  }
}

function pick(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function parseLanding(html, url) {
  const h = html.slice(0, MAX_HTML);
  const out = { url, platform: "Custom", pixel: false, price: null, currency: null, title: null };

  if (/cdn\.shopify\.com|Shopify\.theme|myshopify\.com/i.test(h)) out.platform = "Shopify";
  else if (/woocommerce/i.test(h)) out.platform = "WooCommerce";
  else if (/wp-content|wp-includes/i.test(h)) out.platform = "WordPress";
  else if (/static\.wixstatic\.com|wix\.com/i.test(h)) out.platform = "Wix";
  else if (/_next\/static/i.test(h)) out.platform = "Next.js";

  out.pixel = /fbq\s*\(|connect\.facebook\.net\/[^"']*fbevents\.js/i.test(h);

  const priceRaw = pick(h, [
    /property=["']product:price:amount["'][^>]*content=["']([\d.,]+)["']/i,
    /content=["']([\d.,]+)["'][^>]*property=["']product:price:amount["']/i,
    /property=["']og:price:amount["'][^>]*content=["']([\d.,]+)["']/i,
    /itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i,
    /"price"\s*:\s*"([\d.,]+)"/i,
  ]);
  if (priceRaw) {
    const n = Number(priceRaw.replace(/,/g, ""));
    if (Number.isFinite(n) && n > 0 && n < 500000) out.price = n;
  }

  out.currency = pick(h, [
    /property=["']product:price:currency["'][^>]*content=["']([A-Za-z]{3})["']/i,
    /property=["']og:price:currency["'][^>]*content=["']([A-Za-z]{3})["']/i,
    /"priceCurrency"\s*:\s*"([A-Za-z]{3})"/i,
  ]);
  if (out.currency) out.currency = out.currency.toUpperCase();

  const t = pick(h, [/<title[^>]*>([^<]{1,120})/i]);
  if (t) out.title = t.trim().replace(/\s+/g, " ");

  return out;
}

async function getLanding(url) {
  if (!isSafeUrl(url)) return { error: "unsafe_url" };

  const key = "lp:" + url;
  const cached = (await chrome.storage.local.get(key))[key];
  if (cached && Date.now() - cached.t < TTL_MS) return cached.v;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: "omit", redirect: "follow" });
    if (!res.ok) return { error: "http_" + res.status };
    const html = await res.text();
    const v = parseLanding(html, res.url || url);
    await chrome.storage.local.set({ [key]: { t: Date.now(), v } });
    return v;
  } catch (e) {
    return { error: String((e && e.name) || e) };
  } finally {
    clearTimeout(timer);
  }
}

// =====================================================================
// REAL DATA: user er NIJER Meta Ad Account (Marketing API, ads_read)
// Competitor er ad er real data pawa jay na. Shudhu nijer account er ad.
// Token ekhane (background) thake, content script e kokhono pathano hoy na.
// =====================================================================
const GRAPH_VERSION = "v26.0";
const GRAPH = "https://graph.facebook.com/" + GRAPH_VERSION;
const REAL_TTL_MS = 5 * 60 * 1000;
const AD_FIELDS = [
  "id", "name", "effective_status", "created_time",
  "creative{body,title,object_story_spec,asset_feed_spec{bodies,titles}}",
  "campaign{objective}",
  "adset{daily_budget,lifetime_budget,optimization_goal,destination_type}",
  "insights.date_preset(maximum){spend,impressions,reach,frequency,cpm,ctr,cpc,inline_link_clicks,actions,action_values,cost_per_action_type,video_avg_time_watched_actions,video_thruplay_watched_actions}",
].join(",");
const PURCHASE_TYPES = ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"];

function normAccount(v) {
  const d = String(v || "").replace(/\D/g, "");
  return d ? "act_" + d : "";
}

async function getCreds() {
  const o = await chrome.storage.local.get(["fbToken", "fbAccount"]);
  return { token: String(o.fbToken || "").trim(), account: normAccount(o.fbAccount) };
}

async function graphGet(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: "omit" });
    const j = await res.json().catch(() => ({}));
    if (j && j.error) {
      const e = new Error(j.error.message || "graph_error");
      e.code = j.error.code;
      throw e;
    }
    if (!res.ok) throw new Error("http_" + res.status);
    return j;
  } finally {
    clearTimeout(timer);
  }
}

function actVal(arr, types) {
  if (!Array.isArray(arr)) return 0;
  for (const t of types) {
    const a = arr.find((x) => x && x.action_type === t);
    if (a) return Number(a.value) || 0;
  }
  return 0;
}
function toMap(arr) {
  const m = {};
  (Array.isArray(arr) ? arr : []).forEach((x) => {
    if (x && x.action_type) m[x.action_type] = Number(x.value) || 0;
  });
  return m;
}
function firstVal(arr) {
  return Array.isArray(arr) && arr[0] ? Number(arr[0].value) || 0 : 0;
}

function normAd(a, currency) {
  const n = (x) => Number(x) || 0;
  const ins = (a.insights && a.insights.data && a.insights.data[0]) || {};
  const c = a.creative || {};
  const spec = c.object_story_spec || {};
  const bodies = [];
  const push = (t) => { if (t && typeof t === "string") bodies.push(t); };
  push(c.body);
  push(spec.link_data && spec.link_data.message);
  push(spec.video_data && spec.video_data.message);
  push(spec.photo_data && spec.photo_data.caption);
  push(spec.text_data && spec.text_data.message);
  if (c.asset_feed_spec && Array.isArray(c.asset_feed_spec.bodies)) c.asset_feed_spec.bodies.forEach((b) => push(b && b.text));

  const impressions = n(ins.impressions);
  const clicks = ins.inline_link_clicks !== undefined ? n(ins.inline_link_clicks) : (n(ins.ctr) / 100) * impressions;
  const adset = a.adset || {};
  return {
    id: String(a.id),
    name: a.name || "Ad " + a.id,
    status: a.effective_status || "",
    created: Date.parse(a.created_time) || 0,
    bodies,
    currency: currency || "USD",
    spend: n(ins.spend),
    impressions,
    reach: n(ins.reach),
    clicks,
    purchases: actVal(ins.actions, PURCHASE_TYPES),
    revenue: actVal(ins.action_values, PURCHASE_TYPES),
    plays3s: actVal(ins.actions, ["video_view"]),
    thruPlays: firstVal(ins.video_thruplay_watched_actions),
    avgWatch: firstVal(ins.video_avg_time_watched_actions),
    reactions: actVal(ins.actions, ["post_reaction"]),
    comments: actVal(ins.actions, ["comment"]),
    shares: actVal(ins.actions, ["post"]),
    dailyBudget: n(adset.daily_budget) / 100, // minor unit -> major unit
    objective: (a.campaign && a.campaign.objective) || "",
    optimizationGoal: adset.optimization_goal || "",
    destinationType: adset.destination_type || "",
    actions: toMap(ins.actions), // shob action type (messaging, lead, link_click ...)
    actionValues: toMap(ins.action_values),
    hasInsights: !!(a.insights && a.insights.data && a.insights.data.length),
  };
}

async function fetchRealAds() {
  const { token, account } = await getCreds();
  if (!token || !account) return { ok: false, code: "no_creds", error: "Access Token / Ad Account ID set kora nai" };
  const tk = encodeURIComponent(token);

  const acc = await graphGet(`${GRAPH}/${account}?fields=name,currency&access_token=${tk}`);
  let url = `${GRAPH}/${account}/ads?fields=${encodeURIComponent(AD_FIELDS)}&limit=50&access_token=${tk}`;
  const ads = [];
  for (let i = 0; i < 6 && url; i++) {
    const j = await graphGet(url);
    (j.data || []).forEach((a) => ads.push(normAd(a, acc.currency)));
    const next = j.paging && j.paging.next;
    url = next && new URL(next).hostname === "graph.facebook.com" ? next : null; // token onno host e jete debo na
  }
  return { ok: true, ads, currency: acc.currency, accountName: acc.name || account, account };
}

async function getRealAds(force) {
  const { account } = await getCreds();
  if (!force) {
    const { realCache } = await chrome.storage.local.get("realCache");
    if (realCache && realCache.account === account && Date.now() - realCache.t < REAL_TTL_MS) return realCache.v;
  }
  try {
    const v = await fetchRealAds();
    if (v.ok) await chrome.storage.local.set({ realCache: { t: Date.now(), account: v.account, v } });
    return v;
  } catch (e) {
    return { ok: false, code: e.code || "error", error: String((e && e.message) || e) };
  }
}

// Nijer ads er real data diye benchmark suggest kora (popup e "Calibrate")
async function calibrate() {
  const r = await getRealAds(true);
  if (!r.ok) return r;
  const { settings } = await chrome.storage.sync.get("settings");
  const fx = Number(settings && settings.fx) > 0 ? Number(settings.fx) : 120;
  const k = r.currency === "BDT" ? 1 / fx : 1;
  const used = r.ads.filter((a) => a.impressions > 0);
  const T = { spend: 0, imp: 0, reach: 0, clicks: 0, purch: 0, vImp: 0, p3: 0, thru: 0, react: 0, com: 0, sh: 0,
    pC: 0, msgN: 0, msgC: 0, leadN: 0, leadC: 0, appN: 0, appC: 0, callN: 0, callC: 0 };
  const firstPos = (a, list) => { for (const k of list) if (a.actions && a.actions[k] > 0) return a.actions[k]; return 0; };
  used.forEach((a) => {
    T.spend += a.spend * k; T.imp += a.impressions; T.reach += a.reach; T.clicks += a.clicks; T.purch += a.purchases;
    T.react += a.reactions; T.com += a.comments; T.sh += a.shares;
    if (a.plays3s > 0) { T.vImp += a.impressions; T.p3 += a.plays3s; T.thru += a.thruPlays; }
    // campaign type onujayi click -> result rate (shudhu oi type er ad gulo diye)
    if (a.purchases > 0) T.pC += a.clicks;
    const m = firstPos(a, ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"]);
    if (m > 0) { T.msgN += m; T.msgC += a.clicks; }
    const l = firstPos(a, ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]);
    if (l > 0) { T.leadN += l; T.leadC += a.clicks; }
    const ap = firstPos(a, ["mobile_app_install", "omni_app_install", "app_install"]);
    if (ap > 0) { T.appN += ap; T.appC += a.clicks; }
    const c = firstPos(a, ["click_to_call_native_call_placed", "click_to_call_call_confirm"]);
    if (c > 0) { T.callN += c; T.callC += a.clicks; }
  });
  if (!T.imp) return { ok: false, error: "Insights data pawa jay ni (ads e impression nai)" };
  const f2 = (x) => Math.round(x * 100) / 100;
  const s = { cpm: f2((T.spend / T.imp) * 1000), ctrPct: f2((T.clicks / T.imp) * 100) };
  if (T.reach > 0) s.frequency = f2(T.imp / T.reach);
  if (T.pC > 0 && T.purch > 0) s.cvrPct = f2((T.purch / T.pC) * 100);
  if (T.msgC > 0) s.msgPct = f2((T.msgN / T.msgC) * 100);
  if (T.leadC > 0) s.leadPct = f2((T.leadN / T.leadC) * 100);
  if (T.appC > 0) s.appPct = f2((T.appN / T.appC) * 100);
  if (T.callC > 0) s.callPct = f2((T.callN / T.callC) * 100);
  if (T.vImp > 0) { s.hookPct = f2((T.p3 / T.vImp) * 100); if (T.p3 > 0) s.holdPct = f2((T.thru / T.p3) * 100); }
  s.reactPct = f2((T.react / T.imp) * 100);
  s.commentPct = f2((T.com / T.imp) * 100);
  s.sharePct = f2((T.sh / T.imp) * 100);
  Object.keys(s).forEach((key) => { if (!(s[key] > 0)) delete s[key]; });
  return { ok: true, suggestion: s, sample: { ads: used.length, purchases: Math.round(T.purch), spendUSD: Math.round(T.spend) } };
}

// ---- HD download (creative image / video thumbnail) ----
const DL_HOST = /(^|\.)(fbcdn\.net|facebook\.com|fbsbx\.com)$/i;

function safeName(n) {
  return String(n || "adpulse/file")
    .replace(/\.\./g, "_")
    .replace(/[^a-zA-Z0-9._\-\/]/g, "_")
    .slice(0, 120);
}

function download(url, filename) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" || !DL_HOST.test(u.hostname)) return resolve({ ok: false, error: "host_not_allowed" });
      chrome.downloads.download({ url, filename: safeName(filename), conflictAction: "uniquify" }, (id) => {
        if (chrome.runtime.lastError || !id) resolve({ ok: false, error: chrome.runtime.lastError && chrome.runtime.lastError.message });
        else resolve({ ok: true });
      });
    } catch (e) {
      resolve({ ok: false, error: String(e) });
    }
  });
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg) return;
  if (msg.type === "AP_LANDING") {
    getLanding(msg.url)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: String(e) }));
    return true;
  }
  if (msg.type === "AP_REAL_LIST") {
    getRealAds(!!msg.force).then(sendResponse);
    return true;
  }
  if (msg.type === "AP_REAL_TEST") {
    getRealAds(true).then((r) =>
      sendResponse(r.ok ? { ok: true, accountName: r.accountName, currency: r.currency, count: r.ads.length } : r)
    );
    return true;
  }
  if (msg.type === "AP_REAL_CALIBRATE") {
    calibrate().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "AP_DOWNLOAD") {
    download(msg.url, msg.filename).then(sendResponse);
    return true;
  }
});
