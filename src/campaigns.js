// AdPulse BD - campaign type resolver
// Facebook er sob campaign objective / result type. "Order" shudhu Sales campaign e ashbe.
// - Nijer ad (real data): Marketing API er objective + optimization_goal + destination_type theke.
// - Competitor ad: Ad Library te objective thake na, tai CTA button + landing link theke ANUMAAN kora hoy.
(function () {
  const AdPulse = (globalThis.AdPulse = globalThis.AdPulse || {});

  const TYPES = {
    sales:      { key: "sales",      label: "Sales",           noun: "Orders",         costLabel: "Cost per purchase",      title: "Total Sales & Revenue (সেলস ও রেভিনিউ)" },
    messages:   { key: "messages",   label: "Messages",        noun: "Conversations",  costLabel: "Cost per conversation",  title: "Messaging Results (মেসেজ রেজাল্ট)" },
    leads:      { key: "leads",      label: "Leads",           noun: "Leads",          costLabel: "Cost per lead",          title: "Lead Results (লিড রেজাল্ট)" },
    traffic:    { key: "traffic",    label: "Traffic",         noun: "Link clicks",    costLabel: "Cost per link click",    title: "Traffic Results (ট্রাফিক রেজাল্ট)" },
    engagement: { key: "engagement", label: "Engagement",      noun: "Engagements",    costLabel: "Cost per engagement",    title: "Engagement Results (এনগেজমেন্ট)" },
    awareness:  { key: "awareness",  label: "Awareness",       noun: "People reached", costLabel: "Cost per 1,000 reached", title: "Reach Results (রিচ রেজাল্ট)" },
    video:      { key: "video",      label: "Video views",     noun: "ThruPlays",      costLabel: "Cost per ThruPlay",      title: "Video Results (ভিডিও রেজাল্ট)" },
    app:        { key: "app",        label: "App promotion",   noun: "App installs",   costLabel: "Cost per install",       title: "App Install Results (অ্যাপ ইনস্টল)" },
    calls:      { key: "calls",      label: "Calls",           noun: "Calls",          costLabel: "Cost per call",          title: "Call Results (কল রেজাল্ট)" },
    page_likes: { key: "page_likes", label: "Page likes",      noun: "Page likes",     costLabel: "Cost per like",          title: "Page Like Results (পেজ লাইক)" },
    events:     { key: "events",     label: "Event responses", noun: "Responses",      costLabel: "Cost per response",      title: "Event Results (ইভেন্ট রেসপন্স)" },
    profile:    { key: "profile",    label: "Profile visits",  noun: "Profile visits", costLabel: "Cost per visit",         title: "Profile Visit Results (প্রোফাইল ভিজিট)" },
  };
  AdPulse.RESULT_TYPES = TYPES;

  const OBJECTIVES = {
    OUTCOME_AWARENESS: "Awareness", OUTCOME_TRAFFIC: "Traffic", OUTCOME_ENGAGEMENT: "Engagement",
    OUTCOME_LEADS: "Leads", OUTCOME_APP_PROMOTION: "App promotion", OUTCOME_SALES: "Sales",
    // purono (legacy) objective
    MESSAGES: "Messages", LEAD_GENERATION: "Lead generation", CONVERSIONS: "Conversions", LINK_CLICKS: "Traffic",
    POST_ENGAGEMENT: "Engagement", PAGE_LIKES: "Page likes", VIDEO_VIEWS: "Video views", REACH: "Reach",
    BRAND_AWARENESS: "Brand awareness", APP_INSTALLS: "App installs", PRODUCT_CATALOG_SALES: "Catalog sales",
    EVENT_RESPONSES: "Event responses", STORE_VISITS: "Store visits",
  };
  const DESTINATIONS = {
    WEBSITE: "Website", MESSENGER: "Messenger", WHATSAPP: "WhatsApp", INSTAGRAM_DIRECT: "Instagram Direct",
    ON_AD: "Instant form", ON_POST: "On post", ON_VIDEO: "On video", ON_PAGE: "Facebook Page", ON_EVENT: "On event",
    APP: "App", PHONE_CALL: "Phone call", INSTAGRAM_PROFILE: "Instagram profile", SHOP_AUTOMATIC: "Shop",
    FACEBOOK: "Facebook", MESSAGING_MESSENGER_WHATSAPP: "Messenger + WhatsApp",
    MESSAGING_INSTAGRAM_DIRECT_MESSENGER: "Instagram Direct + Messenger",
    MESSAGING_INSTAGRAM_DIRECT_MESSENGER_WHATSAPP: "Instagram + Messenger + WhatsApp",
    MESSAGING_INSTAGRAM_DIRECT_WHATSAPP: "Instagram Direct + WhatsApp",
  };
  const pretty = (s) => (s ? String(s).toLowerCase().replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

  // ---------- real: objective + goal + destination -> type ----------
  function fromReal(r) {
    const obj = String(r.objective || "").toUpperCase();
    const goal = String(r.optimizationGoal || "").toUpperCase();
    const dest = String(r.destinationType || "").toUpperCase();

    if (goal === "CONVERSATIONS" || obj === "MESSAGES" || /MESSENGER|WHATSAPP|INSTAGRAM_DIRECT|MESSAG/.test(dest)) return "messages";
    if (/LEAD/.test(goal) || obj === "OUTCOME_LEADS" || obj === "LEAD_GENERATION") return "leads";
    if (goal === "QUALITY_CALL" || dest === "PHONE_CALL") return "calls";
    if (/APP_INSTALLS/.test(goal) || obj === "OUTCOME_APP_PROMOTION" || obj === "APP_INSTALLS") return "app";
    if (goal === "PAGE_LIKES" || obj === "PAGE_LIKES") return "page_likes";
    if (goal === "EVENT_RESPONSES" || obj === "EVENT_RESPONSES") return "events";
    if (/PROFILE/.test(goal)) return "profile";
    if (goal === "THRUPLAY" || /VIDEO_VIEWS/.test(goal) || obj === "VIDEO_VIEWS") return "video";
    if (goal === "POST_ENGAGEMENT" || obj === "POST_ENGAGEMENT") return "engagement";
    if (goal === "REACH" || goal === "IMPRESSIONS" || goal === "AD_RECALL_LIFT" || obj === "OUTCOME_AWARENESS" || obj === "REACH" || obj === "BRAND_AWARENESS") return "awareness";
    if (goal === "LINK_CLICKS" || goal === "LANDING_PAGE_VIEWS" || obj === "OUTCOME_TRAFFIC" || obj === "LINK_CLICKS") return "traffic";
    if (goal === "OFFSITE_CONVERSIONS" || goal === "VALUE" || obj === "OUTCOME_SALES" || obj === "CONVERSIONS" || obj === "PRODUCT_CATALOG_SALES") return "sales";
    if (obj === "OUTCOME_ENGAGEMENT") return "engagement";
    return "traffic";
  }

  // ---------- competitor: CTA + landing host -> type (anumaan) ----------
  const CTAS = [
    "Send WhatsApp message", "WhatsApp message", "Send message", "Message us", "Call now", "Call us",
    "Order now", "Shop now", "Buy now", "Buy tickets",
    "Sign up", "Apply now", "Get quote", "Subscribe", "Request time", "Book now", "Contact us", "Get offer",
    "Install now", "Use app", "Play game", "Download",
    "Watch more", "Watch video", "Like Page", "Follow",
    "Learn more", "See more", "Read more", "Explore", "See menu", "Get directions", "Listen now", "Open link",
  ];
  function findCTA(text) {
    const t = String(text || "").toLowerCase();
    let best = null;
    let bestEnd = -1;
    for (const c of CTAS) {
      const i = t.lastIndexOf(c.toLowerCase()); // button ta card er shesh dike thake
      if (i < 0) continue;
      const end = i + c.length;
      // "Send WhatsApp message" er bhitore "WhatsApp message" o ache => same shesh e hole boro ta nao
      if (end > bestEnd || (end === bestEnd && c.length > best.length)) { bestEnd = end; best = c; }
    }
    return best;
  }
  AdPulse.findCTA = findCTA;

  const CTA_TYPE = {
    "send whatsapp message": "messages", "whatsapp message": "messages", "send message": "messages", "message us": "messages",
    "call now": "calls", "call us": "calls",
    "order now": "sales", "shop now": "sales", "buy now": "sales", "buy tickets": "sales",
    "sign up": "leads", "apply now": "leads", "get quote": "leads", "subscribe": "leads", "request time": "leads",
    "book now": "leads", "contact us": "leads", "get offer": "leads",
    "install now": "app", "use app": "app", "play game": "app", "download": "app",
    "watch more": "video", "watch video": "video", "like page": "page_likes", "follow": "page_likes",
  };

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
  }
  function messagingDest(url) {
    const h = hostOf(url);
    if (/(^|\.)(wa\.me|whatsapp\.com|wa\.link)$/.test(h)) return "WhatsApp";
    if (/(^|\.)(m\.me|messenger\.com)$/.test(h)) return "Messenger";
    if (/(^|\.)ig\.me$/.test(h)) return "Instagram Direct";
    return null;
  }
  AdPulse.messagingDest = messagingDest;

  function inferKey(ad, cta) {
    const md = messagingDest(ad.landing);
    if (md) return { key: "messages", destination: md };
    const c = cta ? cta.toLowerCase() : "";
    if (CTA_TYPE[c]) return { key: CTA_TYPE[c], destination: CTA_TYPE[c] === "messages" ? "Messenger / WhatsApp" : null };
    if (c) return { key: "traffic", destination: null }; // Learn more / See more ...
    return { key: ad.landing ? "traffic" : "engagement", destination: null };
  }

  // ---------- public ----------
  AdPulse.resolveType = function (ad) {
    const cta = findCTA(ad.text);
    const r = ad.real;
    if (r && (r.objective || r.optimizationGoal || r.destinationType)) {
      const key = fromReal(r);
      return {
        key, def: TYPES[key], source: "real", cta,
        objective: OBJECTIVES[r.objective] || pretty(r.objective),
        goal: pretty(r.optimizationGoal),
        destination: DESTINATIONS[r.destinationType] || pretty(r.destinationType),
      };
    }
    const inf = inferKey(ad, cta);
    return { key: inf.key, def: TYPES[inf.key], source: "inferred", cta, objective: "", goal: "", destination: inf.destination || "" };
  };
})();
