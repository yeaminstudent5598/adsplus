# AdPulse BD v1.5

Meta Ad Library er upor dark insights UI (compact bar -> details -> right drawer -> page overview).

## Data kothay theke ashe
- **Competitor er ad:** Meta Spend/impressions/orders/messages deyna, tai number gulo benchmark-based ESTIMATE ("Est." / "Estimated" label shoho) - default ON.
  Popup e "Competitor এডের estimate (model) দেখাও" off korle shudhu REAL FACTS (running days, status, versions, CTA, landing page platform/pixel/price, active ad count) dekhabe.
- **Tomar nijer ad:** Marketing API (ads_read) diye tomar Ad Account er REAL data (spend, orders, CPA, reach, impressions, thruplays, reactions...).
  Library card er sathe auto-match hoy ad er primary text diye; na hole drawer theke manually Link kora jay.

## Install
1. Zip extract koro, jeikhane `manifest.json` ache sheta-i Chrome e select korbe.
2. `chrome://extensions` -> Developer mode -> Load unpacked.
3. Update korle: reload icon + Facebook tab `Ctrl+Shift+R`.
4. Facebook UI English rakho.

## Real data setup (nijer ad er jonno)
1. https://developers.facebook.com/tools/explorer kholo.
2. Meta App select koro (nijer app), permission e `ads_read` add koro, **Generate Access Token**.
   (Short-lived token ~1-2 ghonta cholbe. Besi din chaile long-lived token baniye nao, ~60 din.)
3. Extension icon -> Real data: Access Token + Ad Account ID (`act_123...` ba shudhu number) -> Save -> Test connection.
4. Ad Library te nijer ad khuje dekho: bar e `REAL` tag, number gulo Ads Manager er sathe milbe.
- Token shudhu `chrome.storage.local` e thake (Google sync e jay na) ar shudhu background.js use kore.
- "Calibrate from my ads" tomar real data theke benchmark (CPM, CTR, CVR...) fill kore dey, estimate gulo aro bhalo korte.

## Folder
- manifest.json, background.js (landing fetch, HD download, Marketing API)
- src/estimator.js (model + real overlay), src/insights.js, src/parser.js, src/ui.js, src/content.js, src/panel.css
- popup/ (settings), fonts/ (Hind Siliguri, OFL license), icons/

## Notes
- Audience tab shobshomoy inferred (category theke anumaan).
- HD download: onner creative reuse korle copyright / Meta Terms mathay rakho.
- Facebook DOM bodlale src/parser.js fix lagte pare.

## Fonts
English = Red Hat Display, Bangla = Hind Siliguri (dutoi OFL license). Facebook er CSP CSS font block kore, tai font gulo
`src/fonts-data.js` e embed kora ar content.js `FontFace` API diye load kore (background message er upor nirbhor na).
Toolbar (niche daan e) e `Aa ✓` = duto font load hoyeche, `Aa ✗ ...` = fail (karon likha thake).
Console check: `document.fonts.check('16px "AP Hind Siliguri"')` ar `document.fonts.check('16px "AP Red Hat Display"')` -> true.

## Campaign type (v1.4): "order" shudhu Sales campaign e
Prottek ad er result oi campaign er type onujayi:

| Type | Result | Cost |
|---|---|---|
| Sales | Orders + Revenue + ROAS (+ add to cart, checkout) | Cost per purchase |
| Messages (WhatsApp/Messenger/Instagram) | Conversations started (+ first replies, new contacts) | Cost per conversation |
| Leads (instant form/website) | Leads | Cost per lead |
| Traffic | Link clicks / Landing page views | Cost per click / LP view |
| Engagement | Post engagements (reactions, comments, shares, saves) | Cost per engagement |
| Awareness | Reach (+ impressions, frequency, CPM) | Cost per 1,000 reached |
| Video views | ThruPlays (+ hook/hold rate, watch time) | Cost per ThruPlay |
| App promotion | App installs | Cost per install |
| Calls / Page likes / Event responses / Profile visits | oi result | Cost per result |

- **Nijer ad (Real data):** Marketing API er campaign objective + optimization goal + destination_type theke type thik hoy (shob Facebook objective, notun ODAX o purono o). Drawer e "All actions (Meta API)" e API er deya shob action dekha jay.
- **Competitor ad:** objective Ad Library te nai. CTA button (Send message / Order now / Learn more / Sign up...) ar landing link (wa.me, m.me...) theke ANUMAAN kora hoy, "(CTA থেকে অনুমান)" label shoho.
- Settings e click->message / lead / install / call / landing-page-view rate ache (estimate er jonno); "Calibrate from my ads" tomar real data theke fill kore.
