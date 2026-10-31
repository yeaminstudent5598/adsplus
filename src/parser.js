// AdPulse BD - Ad Library DOM parser
// Facebook class name obfuscated + bodlay, tai text anchor ("Library ID") use kora hoyeche.
// Facebook UI language English rakhte hobe.
// Each file is wrapped in an IIFE: content scripts share one global scope,
// so top-level const/let would clash between files.
(function () {
const AdPulse = (globalThis.AdPulse = globalThis.AdPulse || {});

function countLib(el) {
  return (el.textContent.match(/Library ID/g) || []).length;
}

AdPulse.findCards = function () {
  const cards = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue || !node.nodeValue.includes("Library ID")) continue;
    let el = node.parentElement;
    if (!el) continue;
    let guard = 0;
    while (el.parentElement && countLib(el.parentElement) <= 1 && guard++ < 15) {
      el = el.parentElement;
    }
    cards.add(el);
  }
  return [...cards];
};

function advertiserName(text) {
  const before = text.split(/\bSponsored\b/)[0] || "";
  const lines = before
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  return lines.length ? lines[lines.length - 1].slice(0, 80) : "";
}

AdPulse.parseCard = function (card) {
  const text = card.innerText || "";
  const id = (text.match(/Library ID:\s*(\d+)/) || [])[1];
  if (!id) return null;

  const startStr = (text.match(/Started running on\s+(\d{1,2}\s+\w+\s+\d{4})/) || [])[1] || "";
  const start = startStr ? new Date(startStr) : null;
  const validStart = start && !isNaN(start.getTime());
  const days = validStart ? Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000)) : 1;

  const variantsMatch = text.match(/(\d+)\s+ads?\s+use this creative/i);
  const priceMatch = text.match(/(?:৳|Tk\.?|BDT)\s?([\d,]+)/i);

  let landing = null;
  const a = card.querySelector('a[href*="l.facebook.com/l.php"]');
  if (a) {
    try {
      const u = new URL(a.href).searchParams.get("u");
      if (u && /^https?:\/\//i.test(u)) landing = u;
    } catch (_) {}
  }

  return {
    id,
    advertiser: advertiserName(text),
    active: !/\bInactive\b/.test(text),
    days,
    startStr,
    variants: variantsMatch ? Number(variantsMatch[1]) : 1,
    multiVersion: /multiple versions/i.test(text),
    format: card.querySelector("video") ? "VIDEO" : "IMAGE",
    priceBDT: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
    landing,
    text: text.slice(0, 3000),
    info: null, // background theke landing info ashbe
    infoState: landing ? "pending" : "none", // pending | done | error | none
    card: null,
  };
};

// HD download er jonno creative khuje bar kora (click korar somoy call hoy)
AdPulse.findMedia = function (card) {
  if (!card) return null;
  const wrap = card.querySelector(".ap-wrap");
  const inOurs = (n) => wrap && wrap.contains(n);

  const v = [...card.querySelectorAll("video")].find((x) => !inOurs(x));
  if (v) {
    const src = v.currentSrc || v.src || "";
    if (/^https:/i.test(src)) return { url: src, ext: "mp4", kind: "video" };
    if (v.poster && /^https:/i.test(v.poster)) return { url: v.poster, ext: "jpg", kind: "video-thumbnail" };
  }
  let best = null;
  let bestArea = -1;
  card.querySelectorAll("img").forEach((img) => {
    if (inOurs(img) || !/^https:/i.test(img.src || "")) return;
    const r = img.getBoundingClientRect();
    const area = r.width * r.height;
    if (area > bestArea) {
      bestArea = area;
      best = img;
    }
  });
  return best ? { url: best.src, ext: "jpg", kind: "image" } : null;
};

// Page header er "~80 results" text
AdPulse.totalResults = function () {
  const t = document.body.innerText || "";
  const m = t.match(/~?([\d,]+)\+?\s+results?/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
};
})();
