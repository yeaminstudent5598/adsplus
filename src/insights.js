// AdPulse BD - heuristic insights (category, audience, hooks, confidence)
// Shob INFERRED: ad text + landing page title theke keyword diye anumaan. Meta er real data na.
// Each file is wrapped in an IIFE: content scripts share one global scope,
// so top-level const/let would clash between files.
(function () {
const AdPulse = (globalThis.AdPulse = globalThis.AdPulse || {});

const CATS = [
  { key: "food", short: "Organic Food & Grocery", full: "E-Commerce Product - Organic Food & Pure Grocery",
    re: /অর্গানিক|মধু|ঘি|খেজুর|মসলা|সরিষার তেল|চাল|ডাল|\b(organic|honey|ghee|dates|spice|grocery|tea|oil)\b/i,
    interests: ["Organic Food", "Healthy Eating", "Online Grocery"], age: "25-54", skew: "Women" },
  { key: "fashion", short: "Fashion & Apparel", full: "E-Commerce Product - Fashion & Apparel",
    re: /শাড়ি|থ্রি পিস|পাঞ্জাবি|পোশাক|ড্রেস|শার্ট|\b(saree|dress|shirt|panjabi|fashion|kurti|clothing)\b/i,
    interests: ["Online Shopping", "Fashion", "Clothing"], age: "18-44", skew: "Women" },
  { key: "gadget", short: "Smart Gadgets & Electronics", full: "E-Commerce Product - Smart Gadgets & Electronics",
    re: /গ্যাজেট|ওয়াচ|ইয়ারবাড|হেডফোন|চার্জার|\b(gadget|watch|earbuds|headphone|charger|smart)\b/i,
    interests: ["Smart Gadgets", "Smartwatch", "Consumer Electronics"], age: "18-35", skew: "Men" },
  { key: "beauty", short: "Beauty & Skincare", full: "E-Commerce Product - Beauty & Skincare",
    re: /স্কিন|ক্রিম|সিরাম|লোশন|শ্যাম্পু|কসমেটিক|\b(skin|cream|serum|lotion|shampoo|cosmetic|beauty)\b/i,
    interests: ["Beauty", "Skin Care", "Cosmetics"], age: "18-40", skew: "Women" },
  { key: "home", short: "Home & Kitchen", full: "E-Commerce Product - Home & Kitchen",
    re: /কিচেন|রান্নার|হাঁড়ি|বাসনপত্র|ফার্নিচার|\b(kitchen|cookware|furniture|home decor)\b/i,
    interests: ["Home Improvement", "Kitchen", "Online Shopping"], age: "25-54", skew: "Women" },
  { key: "sports", short: "Sports & Fitness", full: "E-Commerce Product - Sports & Fitness",
    re: /ক্রিকেট|ব্যাট|জিম|ফিটনেস|\b(cricket|bat|gym|fitness|sports)\b/i,
    interests: ["Cricket", "Fitness", "Sports"], age: "16-40", skew: "Men" },
];
const GENERAL = { key: "general", short: "E-Commerce Product", full: "E-Commerce Product",
  interests: ["Online Shopping", "Bangladesh E-Commerce"], age: "18-45", skew: "Mixed" };

function detectCategory(ad) {
  const hay = [ad.text || "", ad.info && ad.info.title ? ad.info.title : ""].join(" ");
  for (const c of CATS) if (c.re.test(hay)) return c;
  return GENERAL;
}

function detectHooks(ad) {
  const t = ad.text || "";
  const h = [];
  if (/অর্ডার করুন|এখনই কিনুন|\b(order now|shop now|buy now)\b/i.test(t)) h.push("Direct Action Offer");
  if (/ফ্রি ডেলিভারি|ক্যাশ অন ডেলিভারি|\b(free delivery|cash on delivery|cod)\b/i.test(t)) h.push("Free / COD Delivery");
  if (/\d+\s?%|ছাড়|ডিসকাউন্ট|অফার|\b(discount|offer|sale)\b/i.test(t)) h.push("Discount Offer");
  if (ad.format === "VIDEO" && ad.days >= 30) h.push("High-Converting Hook");
  return h;
}

function confidence(ad) {
  if (ad.real) return "Real";
  let s = 0;
  if (ad.days >= 30) s++;
  if (ad.infoState === "done") s++;
  if (ad.info && ad.info.price) s++;
  return s >= 3 ? "High" : s === 2 ? "Medium" : "Low";
}

function reason(ad) {
  if (ad.real) return `আপনার Meta Ad Account থেকে আসল ডেটা (${ad.real.name})`;
  const parts = [`${ad.days} দিন ধরে লাইভ`];
  if (ad.variants > 1) parts.push(`${ad.variants}টি ভার্সন`);
  parts.push(ad.info && ad.info.price ? "চেকআউট প্রাইস পাওয়া গেছে" : "ডিফল্ট প্রাইস ধরা হয়েছে");
  return parts.join(", ") + " → বেঞ্চমার্ক ফানেল মডেলে হিসাব";
}

AdPulse.analyze = function (ad) {
  return { cat: detectCategory(ad), hooks: detectHooks(ad), conf: confidence(ad), reason: reason(ad) };
};
})();
