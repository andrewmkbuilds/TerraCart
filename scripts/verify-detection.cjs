/**
 * Detection contract — verifies site-gate.ts behavior.
 * Table-driven: each row = [url, blocked, shopping].
 * Run: node scripts/verify-detection.cjs
 */

// ── Inlined from site-gate.ts (keep in sync) ──
const BLOCKED = new Set([
  'google.com','gemini.google.com','aistudio.google.com','bard.google.com',
  'gmail.com','docs.google.com','drive.google.com','calendar.google.com',
  'maps.google.com','meet.google.com','news.google.com','photos.google.com',
  'translate.google.com','classroom.google.com','mail.google.com',
  'chatgpt.com','chat.openai.com','openai.com','claude.ai','anthropic.com',
  'perplexity.ai','copilot.microsoft.com','bing.com',
  'youtube.com','youtu.be','github.com','gitlab.com','bitbucket.org',
  'reddit.com','wikipedia.org','instagram.com','facebook.com','fb.com',
  'x.com','twitter.com','linkedin.com','tiktok.com','snapchat.com',
  'pinterest.com','threads.net','slack.com','discord.com','notion.so',
  'figma.com','canva.com','stackoverflow.com','medium.com','substack.com',
  'netflix.com','spotify.com','twitch.tv',
])
const SHOPPING = new Set([
  'amazon.com','amazon.ae','amazon.co.uk','amazon.de','amazon.fr',
  'amazon.co.jp','amazon.in','amazon.ca','amazon.com.au','amazon.sa','amazon.eg',
  'walmart.com','target.com','bestbuy.com','ebay.com','etsy.com',
  'aliexpress.com','costco.com','homedepot.com',
  'noon.com','souq.com','namshi.com','centrepoint.com','6thstreet.com',
  'ounass.ae','shein.com','hm.com','zara.com','pullandbear.com',
  'bershka.com','stradivarius.com','massimodutti.com','mango.com',
  'nike.com','adidas.ae','adidas.com','puma.com','newbalance.com',
  'asos.com','splashfashion.com','maxfashion.com',
  'marksandspencer.com','next.ae','lcwaikiki.com',
  'sivvi.com','levelshoes.com','levelkids.com',
  'bloomingdales.ae','harveynichols.com','americaneagle.me',
  'faces.ae','sephora.ae','kikomilano.ae',
  'thebodyshop.ae','bathandbodyworks.com','rituals.com','lookfantastic.com',
  'carrefouruae.com','luluhypermarket.com','spinneys.com',
  'waitrose.ae','boots.ae','lifepharmacy.com',
  'sharafdg.com','jumbo.ae','emax.ae',
  'danubehome.com','ikea.ae','ikea.com','aceuae.com',
  'mumzworld.com','firstcry.ae','virginmegastore.me',
  'iherb.com','sephora.com','nordstrom.com','uniqlo.com',
  'decathlon.com','decathlon.ae','samsung.com','apple.com','store.apple.com',
])
const GOOGLE_RE = /(^|\.)google(\.[a-z]{2,})+$/i

function host(u) { try { return new URL(u).hostname.replace(/^www\./i,'').toLowerCase() } catch { return '' } }
function blocked(u) { const h=host(u); if(!h) return true; if(GOOGLE_RE.test(h)) return true; return BLOCKED.has(h)||[...BLOCKED].some(d=>h.endsWith('.'+d)) }
function shopping(u) { if(blocked(u)) return false; const h=host(u); return h?SHOPPING.has(h)||[...SHOPPING].some(d=>h.endsWith('.'+d)):false }
function ecommerce(u,d) { if(blocked(u)) return false; if(shopping(u)) return true; return !!(d?.isECommerce&&(d.confidence??0)>=55) }

// ── Contract: [url, blocked, shopping] ──
const C = [
  // Google (regex)
  ['https://gemini.google.com/',true,false], ['https://www.google.com/search',true,false],
  ['https://www.google.ae/',true,false], ['https://sub.gemini.google.com/',true,false],
  ['https://translate.google.com/',true,false],
  // AI
  ['https://chatgpt.com/',true,false], ['https://claude.ai/',true,false], ['https://perplexity.ai/',true,false],
  // Social/video/dev
  ['https://www.facebook.com/',true,false], ['https://www.instagram.com/',true,false],
  ['https://x.com/',true,false], ['https://www.reddit.com/',true,false],
  ['https://www.youtube.com/',true,false], ['https://github.com/',true,false],
  ['https://www.notion.so/',true,false], ['https://www.slack.com/',true,false],
  ['https://www.wikipedia.org/',true,false], ['https://www.netflix.com/',true,false],
  ['https://stackoverflow.com/questions',true,false],
  // Shopping
  ['https://www.amazon.ae/dp/B08',false,true], ['https://amazon.com/',false,true],
  ['https://www.noon.com/uae-en/p',false,true], ['https://www.namshi.com/',false,true],
  ['https://www.shein.com/',false,true], ['https://www.zara.com/',false,true],
  ['https://www.hm.com/',false,true], ['https://www.nike.com/',false,true],
  ['https://www.adidas.ae/',false,true], ['https://www.sharafdg.com/',false,true],
  ['https://www.ikea.ae/',false,true],
  // Non-shopping, not blocked
  ['https://www.bbc.com/news',false,false], ['https://news.ycombinator.com/',false,false],
  // Edge: www
  ['https://www.amazon.ae/',false,true], ['https://amazon.ae/',false,true],
]

let p=0,f=0
for (const [u,wB,wS] of C) {
  const b=blocked(u), s=shopping(u)
  if (b===wB&&s===wS) { p++ } else { f++; console.log(`FAIL ${u} want b=${wB} s=${wS} got b=${b} s=${s}`) }
}

// ── isEcommerceSite: detection overrides ──
const E = [
  ['https://shop.example.com/',{isECommerce:true,confidence:70},true],
  ['https://gemini.google.com/',{isECommerce:true,confidence:100},false],
  ['https://blog.example.com/',{isECommerce:true,confidence:30},false],
  ['https://amazon.ae/',null,true],
]
for (const [u,d,w] of E) { const g=ecommerce(u,d); g===w?p++:f++; if(g!==w)console.log(`FAIL ecommerce(${u}) want=${w} got=${g}`) }

console.log(`${p+f} cases, ${f} failures`)
if (f) process.exit(1)
