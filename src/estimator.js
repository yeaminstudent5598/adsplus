// AdPulse BD - estimator
// IMPORTANT: Meta Ad Library BD commercial ad er real spend/revenue deyna.
// Ekhane shob number MODELED ESTIMATE (benchmark dhore funnel calculation).
// Each file is wrapped in an IIFE: content scripts share one global scope,
// so top-level const/let would clash between files.
(function () {
const AdPulse = (globalThis.AdPulse = globalThis.AdPulse || {});

AdPulse.DEFAULT_SETTINGS = {
  enabled: true,
  v: 2, // settings version (purono saved showEstimates reset korar jonno)
  showEstimates: true, // true = competitor ad e model ESTIMATE dekhabe ("Estimated" label shoho); false = shudhu real facts
  fx: 120, // 1 USD = ? BDT
  defaultPriceBDT: 1000, // price detect na hole eta dhorbe
  cpm: 1.0, // USD
  ctrPct: 2.4, // %
  cvrPct: 2.16, // click -> order %
  frequency: 1.45,
  hookPct: 34.1, // 3-sec plays / impressions
  holdPct: 39.1, // ThruPlays / 3-sec plays
  avgWatchSec: 5.2, // video avg watch time
  reactPct: 0.9, // reactions / impressions
  commentPct: 0.06,
  sharePct: 0.05,
  // campaign type onujayi click -> result rate (shudhu model/estimate e lage)
  msgPct: 15,   // link click -> messaging conversation
  leadPct: 8,   // link click -> lead
  appPct: 12,   // link click -> app install
  callPct: 5,   // link click -> call
  lpvPct: 75,   // link click -> landing page view
};

AdPulse.CONFIG = {};

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

AdPulse.applySettings = function (s) {
  const D = AdPulse.DEFAULT_SETTINGS;
  const v = Object.assign({}, D, s || {});
  if (s && s.v !== D.v) v.showEstimates = D.showEstimates; // purono version e save kora false ke ignore
  AdPulse.CONFIG = {
    enabled: v.enabled !== false,
    showEstimates: v.showEstimates === true,
    fx: num(v.fx, D.fx),
    defaultPriceBDT: num(v.defaultPriceBDT, D.defaultPriceBDT),
    bench: {
      cpm: num(v.cpm, D.cpm),
      ctr: num(v.ctrPct, D.ctrPct) / 100,
      cvr: num(v.cvrPct, D.cvrPct) / 100,
      frequency: num(v.frequency, D.frequency),
      hook: num(v.hookPct, D.hookPct) / 100,
      hold: num(v.holdPct, D.holdPct) / 100,
      avgWatch: num(v.avgWatchSec, D.avgWatchSec),
      react: num(v.reactPct, D.reactPct) / 100,
      comment: num(v.commentPct, D.commentPct) / 100,
      share: num(v.sharePct, D.sharePct) / 100,
      msg: num(v.msgPct, D.msgPct) / 100,
      lead: num(v.leadPct, D.leadPct) / 100,
      app: num(v.appPct, D.appPct) / 100,
      call: num(v.callPct, D.callPct) / 100,
      lpv: num(v.lpvPct, D.lpvPct) / 100,
    },
  };
};
AdPulse.applySettings();

// Joto beshi din cholche, dhora hocche toto profitable ar budget beshi (survivorship heuristic)
function guessDailyBudget(ad) {
  let d = 5;
  if (ad.days >= 30) d = 8;
  if (ad.days >= 90) d = 12;
  d *= 1 + Math.min(ad.variants || 1, 5) * 0.1;
  return d;
}

// Nijer ad account er real data thakle model er jaygay seta boshai
function realOverlay(ad, m) {
  const r = ad.real;
  const fx = AdPulse.CONFIG.fx;
  const k = r.currency === "BDT" ? 1 / fx : 1; // BDT account hole USD te convert
  const spend = r.spend * k;
  const impressions = r.impressions;
  const reach = r.reach;
  const clicks = r.clicks;
  const orders = r.purchases;
  const daily = r.dailyBudget > 0 ? r.dailyBudget * k : spend / Math.max(1, ad.days);
  const revenue = r.revenue > 0 ? r.revenue * k : orders * m.priceUSD;
  const engagements = r.reactions + r.comments + r.shares;
  const cpa = orders > 0 ? spend / orders : 0;
  return {
    real: true,
    realName: r.name,
    acts: r.actions || {},
    daily, weekly: daily * 7, monthly: daily * 30,
    spend, impressions, reach, clicks,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    ctr: impressions > 0 ? clicks / impressions : 0,
    frequency: reach > 0 ? impressions / reach : 0,
    orders, cpa, cpaBDT: cpa * fx, revenue,
    roas: spend > 0 ? revenue / spend : 0,
    plays3s: r.plays3s, thruPlays: r.thruPlays,
    hook: impressions > 0 ? r.plays3s / impressions : 0,
    hold: r.plays3s > 0 ? r.thruPlays / r.plays3s : 0,
    avgWatch: r.avgWatch,
    costPerThruPlay: r.thruPlays > 0 ? spend / r.thruPlays : 0,
    reactions: r.reactions, comments: r.comments, shares: r.shares, engagements,
    engagementRate: impressions > 0 ? engagements / impressions : 0,
    costPerEngagement: engagements > 0 ? spend / engagements : 0,
  };
}

const PURCHASE = ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "purchase"];
const LEAD = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
const MSG = ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"];
const APPI = ["mobile_app_install", "omni_app_install", "app_install"];
const CALL = ["click_to_call_native_call_placed", "click_to_call_call_confirm"];

function pick(acts, list) {
  for (const k of list) if (acts[k] > 0) return acts[k];
  return 0;
}

// Campaign type onujayi "result" ki hobe: Sales=orders, Messages=conversations, Leads=leads ...
function buildResult(ad, e, t) {
  const b = AdPulse.CONFIG.bench;
  const acts = e.acts || null; // real data hole action map thake
  const A = (list) => (acts ? pick(acts, list) : 0);
  const clicks = e.clicks;
  const rate = (n) => (clicks > 0 ? n / clicks : 0);
  let count = 0;
  let extras = [];
  let nounO = null;
  let costO = null;

  switch (t.key) {
    case "sales": {
      count = e.orders;
      extras = [["Revenue", e.revenue, "usd"], ["ROAS", e.roas, "x"], ["Avg. order value", e.orders > 0 ? e.revenue / e.orders : 0, "usd"]];
      if (acts) extras.push(["Add to cart", A(["omni_add_to_cart", "offsite_conversion.fb_pixel_add_to_cart"]), "n"], ["Checkouts started", A(["omni_initiated_checkout", "offsite_conversion.fb_pixel_initiate_checkout"]), "n"]);
      break;
    }
    case "messages": {
      count = acts ? A(MSG) : clicks * b.msg;
      extras = [["Link clicks", clicks, "n"], ["Click → conversation", rate(count), "pct"]];
      if (acts) extras.push(["First replies", A(["onsite_conversion.messaging_first_reply"]), "n"], ["New messaging contacts", A(["onsite_conversion.total_messaging_connection"]), "n"], ["Purchases via message", A(PURCHASE), "n"]);
      break;
    }
    case "leads": {
      count = acts ? A(LEAD) : clicks * b.lead;
      extras = [["Link clicks", clicks, "n"], ["Click → lead", rate(count), "pct"]];
      break;
    }
    case "traffic": {
      const lpv = acts ? acts.landing_page_view || 0 : clicks * b.lpv;
      const lpvGoal = acts && /LANDING_PAGE/i.test((ad.real && ad.real.optimizationGoal) || "");
      count = lpvGoal ? lpv : clicks;
      if (lpvGoal) { nounO = "Landing page views"; costO = "Cost per landing page view"; }
      extras = [["Link clicks", clicks, "n"], ["Landing page views", lpv, "n"], ["LP view rate", rate(lpv), "pct"], ["CPC", e.cpc, "usd"]];
      break;
    }
    case "engagement": {
      count = (acts ? A(["post_engagement", "page_engagement"]) : 0) || e.engagements;
      extras = [["Reactions", e.reactions, "n"], ["Comments", e.comments, "n"], ["Shares", e.shares, "n"]];
      if (acts) extras.push(["Saves", A(["onsite_conversion.post_save"]), "n"], ["Page likes", A(["like"]), "n"]);
      break;
    }
    case "awareness": {
      count = e.reach;
      extras = [["Impressions", e.impressions, "n"], ["Frequency", e.frequency, "x"], ["CPM", e.cpm, "usd"]];
      if (e.thruPlays > 0) extras.push(["ThruPlays", e.thruPlays, "n"]);
      break;
    }
    case "video": {
      count = e.thruPlays;
      extras = [["3-sec plays", e.plays3s, "n"], ["Hook rate", e.hook, "pct"], ["Hold rate", e.hold, "pct"], ["Avg. watch time", e.avgWatch, "s"]];
      break;
    }
    case "app": {
      count = acts ? A(APPI) : clicks * b.app;
      extras = [["Link clicks", clicks, "n"], ["Click → install", rate(count), "pct"]];
      break;
    }
    case "calls": {
      count = acts ? A(CALL) : clicks * b.call;
      extras = [["Link clicks", clicks, "n"], ["Click → call", rate(count), "pct"]];
      break;
    }
    case "page_likes": {
      count = A(["like"]);
      extras = [["Reach", e.reach, "n"], ["Impressions", e.impressions, "n"]];
      break;
    }
    case "events": {
      count = A(["rsvp"]);
      extras = [["Reach", e.reach, "n"]];
      break;
    }
    case "profile": {
      count = A(["instagram_profile_visits", "profile_visit"]);
      extras = [["Reach", e.reach, "n"]];
      break;
    }
  }

  const cost = t.key === "awareness" ? (e.reach > 0 ? (e.spend / e.reach) * 1000 : 0) : count > 0 ? e.spend / count : 0;
  const allActions = acts ? Object.entries(acts).sort((x, y) => y[1] - x[1]).slice(0, 12) : null;
  return {
    key: t.key, source: t.source, def: t.def, noun: nounO || t.def.noun, label: t.def.label, costLabel: costO || t.def.costLabel, title: t.def.title,
    objective: t.objective, goal: t.goal, destination: t.destination, cta: t.cta,
    count, cost, extras, allActions,
  };
}

AdPulse.estimate = function (ad) {
  const m = modelEstimate(ad);
  const e = ad.real ? Object.assign({}, m, realOverlay(ad, m)) : m;
  const t = AdPulse.resolveType
    ? AdPulse.resolveType(ad)
    : { key: "sales", def: { noun: "Orders", label: "Sales", costLabel: "Cost per purchase", title: "Sales" }, source: "inferred" };
  e.res = buildResult(ad, e, t);
  if (t.key !== "sales") {
    // "order / revenue" shudhu Sales campaign e. Baki type e eta dekhano hobe na.
    e.orders = 0; e.revenue = 0; e.cpa = 0; e.cpaBDT = 0; e.roas = 0;
  }
  return e;
};

function modelEstimate(ad) {
  const { bench, fx, defaultPriceBDT } = AdPulse.CONFIG;
  const priceBDT = ad.priceBDT || defaultPriceBDT;
  const priceUSD = priceBDT / fx;

  const daily = guessDailyBudget(ad);
  const spend = daily * ad.days;
  const impressions = (spend / bench.cpm) * 1000;
  const reach = impressions / bench.frequency;
  const clicks = impressions * bench.ctr;
  const cpc = bench.cpm / 1000 / bench.ctr;
  const orders = clicks * bench.cvr;
  const cpa = orders > 0 ? spend / orders : 0;
  const revenue = orders * priceUSD;
  const plays3s = impressions * bench.hook;
  const thruPlays = plays3s * bench.hold;
  const reactions = impressions * bench.react;
  const comments = impressions * bench.comment;
  const shares = impressions * bench.share;
  const engagements = reactions + comments + shares;

  return {
    daily, weekly: daily * 7, monthly: daily * 30,
    spend, impressions, reach, clicks, cpc,
    cpm: bench.cpm, ctr: bench.ctr, frequency: bench.frequency,
    orders, cpa, cpaBDT: cpa * fx, revenue, priceBDT, priceUSD,
    roas: spend > 0 ? revenue / spend : 0,
    plays3s, thruPlays, hook: bench.hook, hold: bench.hold,
    avgWatch: bench.avgWatch,
    costPerThruPlay: thruPlays > 0 ? spend / thruPlays : 0,
    reactions, comments, shares, engagements,
    engagementRate: bench.react + bench.comment + bench.share,
    costPerEngagement: engagements > 0 ? spend / engagements : 0,
  };
};
})();
