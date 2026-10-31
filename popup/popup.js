const D = globalThis.AdPulse.DEFAULT_SETTINGS;
const FIELDS = ["fx", "defaultPriceBDT", "cpm", "ctrPct", "cvrPct", "frequency", "hookPct", "holdPct", "avgWatchSec", "reactPct", "commentPct", "sharePct", "msgPct", "leadPct", "appPct", "callPct", "lpvPct"];
const $ = (id) => document.getElementById(id);

function flash(id, text, ms) {
  $(id).textContent = text;
  if (ms) setTimeout(() => ($(id).textContent = ""), ms);
}

// ---------- benchmark settings ----------
function fill(s) {
  const v = Object.assign({}, D, s || {});
  if (s && s.v !== D.v) v.showEstimates = D.showEstimates;
  $("enabled").checked = v.enabled !== false;
  $("showEstimates").checked = v.showEstimates === true;
  FIELDS.forEach((k) => ($(k).value = v[k]));
}

chrome.storage.sync.get("settings").then(({ settings }) => fill(settings));

$("save").addEventListener("click", async () => {
  const s = { v: D.v, enabled: $("enabled").checked, showEstimates: $("showEstimates").checked };
  FIELDS.forEach((k) => {
    const n = Number($(k).value);
    s[k] = Number.isFinite(n) && n > 0 ? n : D[k];
  });
  await chrome.storage.sync.set({ settings: s });
  fill(s);
  flash("msg", "Saved. Ad Library page auto update hobe.", 2200);
});

$("reset").addEventListener("click", async () => {
  await chrome.storage.sync.set({ settings: D });
  fill(D);
  flash("msg", "Reset to defaults.", 2200);
});

$("calibrate").addEventListener("click", async () => {
  flash("msg", "Ad Account theke data ante hocche…");
  const r = await chrome.runtime.sendMessage({ type: "AP_REAL_CALIBRATE" });
  if (!r || !r.ok) return flash("msg", "Hoyni: " + ((r && r.error) || "unknown error"));
  Object.keys(r.suggestion).forEach((k) => {
    if ($(k)) $(k).value = r.suggestion[k];
  });
  const warn = r.sample.purchases < 30 ? " ⚠ purchase kom (" + r.sample.purchases + "), reliable na." : "";
  flash("msg", `${r.sample.ads} ta ad, ${r.sample.purchases} purchase theke fill hoyeche. Save chapo.` + warn);
});

// ---------- real data credentials (chrome.storage.local, sync na) ----------
chrome.storage.local.get(["fbToken", "fbAccount"]).then((o) => {
  $("fbAccount").value = o.fbAccount || "";
  if (o.fbToken) $("fbToken").placeholder = "•••••• saved (notun dile replace hobe)";
});

$("saveReal").addEventListener("click", async () => {
  const upd = { fbAccount: $("fbAccount").value.trim() };
  const t = $("fbToken").value.trim();
  if (t) upd.fbToken = t;
  await chrome.storage.local.set(upd);
  $("fbToken").value = "";
  if (t) $("fbToken").placeholder = "•••••• saved (notun dile replace hobe)";
  flash("realMsg", "Saved. 'Test connection' chapo.", 2500);
});

$("clearReal").addEventListener("click", async () => {
  await chrome.storage.local.remove(["fbToken", "realCache"]);
  $("fbToken").value = "";
  $("fbToken").placeholder = "EAAB… (saved thakle khali rakhun)";
  flash("realMsg", "Token muche felechi.", 2500);
});

$("testReal").addEventListener("click", async () => {
  flash("realMsg", "Connecting…");
  const r = await chrome.runtime.sendMessage({ type: "AP_REAL_TEST" });
  if (r && r.ok) flash("realMsg", `✓ Connected: ${r.accountName} (${r.currency}) · ${r.count} ads`);
  else flash("realMsg", "✗ " + ((r && r.error) || "unknown error") + (r && r.code === 190 ? " — token expire/invalid, notun token dao" : ""));
});
