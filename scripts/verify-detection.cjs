/**
 * TerraCart Detection Logic Verification Script
 * Tests: isBlocklistedUrl, isKnownShoppingSite, isEcommerceSite
 * Run with: node scripts/verify-detection.cjs
 */

// ---- Inline the detection functions from site-gate.ts ----
const KNOWN_SHOPPING_HOSTS = [
  'amazon.com', 'amazon.ae', 'amazon.co.uk', 'amazon.de', 'amazon.fr',
  'amazon.co.jp', 'amazon.in', 'amazon.ca', 'amazon.com.au', 'amazon.sa',
  'amazon.eg', 'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com', 'etsy.com',
  'aliexpress.com', 'costco.com', 'homedepot.com',
  'noon.com', 'souq.com', 'namshi.com', 'centrepoint.com', '6thstreet.com',
  'ounass.ae', 'shein.com', 'hm.com', 'zara.com', 'pullandbear.com',
  'bershka.com', 'stradivarius.com', 'massimodutti.com', 'mango.com',
  'nike.com', 'adidas.ae', 'adidas.com', 'puma.com', 'newbalance.com',
  'asos.com', 'splashfashion.com', 'maxfashion.com',
  'marksandspencer.com', 'next.ae', 'lcwaikiki.com',
  'sivvi.com', 'levelshoes.com', 'levelkids.com',
  'bloomingdales.ae', 'harveynichols.com', 'americaneagle.me',
  'faces.ae', 'sephora.ae', 'kikomilano.ae',
  'thebodyshop.ae', 'bathandbodyworks.com', 'rituals.com', 'lookfantastic.com',
  'carrefouruae.com', 'luluhypermarket.com', 'spinneys.com',
  'waitrose.ae', 'boots.ae', 'lifepharmacy.com',
  'sharafdg.com', 'jumbo.ae', 'emax.ae',
  'danubehome.com', 'ikea.ae', 'ikea.com', 'aceuae.com',
  'mumzworld.com', 'firstcry.ae', 'virginmegastore.me',
  'iherb.com', 'sephora.com', 'nordstrom.com', 'uniqlo.com',
  'decathlon.com', 'decathlon.ae', 'luluhypermarket.com',
  'samsung.com', 'apple.com', 'store.apple.com',
  'sharafdg.com', 'jumbo.ae',
]

const HARD_BLOCK_HOSTS = [
  'google.com', 'gemini.google.com', 'aistudio.google.com', 'bard.google.com',
  'gmail.com', 'docs.google.com', 'drive.google.com', 'calendar.google.com',
  'maps.google.com', 'meet.google.com', 'news.google.com', 'photos.google.com',
  'translate.google.com', 'classroom.google.com', 'mail.google.com',
  'chatgpt.com', 'chat.openai.com', 'openai.com', 'claude.ai', 'anthropic.com',
  'perplexity.ai', 'copilot.microsoft.com', 'bing.com',
  'youtube.com', 'youtu.be', 'gmail.com',
  'github.com', 'gitlab.com', 'bitbucket.org',
  'reddit.com', 'wikipedia.org', 'instagram.com', 'facebook.com', 'fb.com',
  'x.com', 'twitter.com', 'linkedin.com', 'tiktok.com', 'snapchat.com',
  'pinterest.com', 'threads.net',
  'slack.com', 'discord.com', 'notion.so', 'figma.com', 'canva.com',
  'stackoverflow.com', 'medium.com', 'substack.com',
  'netflix.com', 'spotify.com', 'twitch.tv',
]

const GOOGLE_HOST_RE = /(^|\.)google(\.[a-z]{2,})+$/i

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

function hostMatches(hostname, domain) {
  const d = domain.replace(/^www\./i, '').toLowerCase()
  return hostname === d || hostname.endsWith('.' + d)
}

function isHardBlockedHost(url) {
  const hostname = hostnameFromUrl(url)
  if (!hostname) return true
  if (GOOGLE_HOST_RE.test(hostname)) return true
  return HARD_BLOCK_HOSTS.some(d => hostMatches(hostname, d))
}

function isKnownShoppingHost(url) {
  if (isHardBlockedHost(url)) return false
  const hostname = hostnameFromUrl(url)
  if (!hostname) return false
  return KNOWN_SHOPPING_HOSTS.some(d => hostMatches(hostname, d))
}

function isEcommerceSite(url, detection) {
  if (isHardBlockedHost(url)) return false
  if (isKnownShoppingHost(url)) return true
  if (detection?.isECommerce && (detection.confidence ?? 0) >= 55) return true
  return false
}

// ---- Test Cases ----
const tests = [
  // BLOCKED: Google services
  { url: 'https://gemini.google.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },
  { url: 'https://www.google.com/search?q=test', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },
  { url: 'https://mail.google.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },
  { url: 'https://docs.google.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },
  { url: 'https://drive.google.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },
  { url: 'https://aistudio.google.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },
  { url: 'https://www.google.ae/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Google' },

  // BLOCKED: AI assistants
  { url: 'https://chatgpt.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-AI' },
  { url: 'https://claude.ai/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-AI' },
  { url: 'https://perplexity.ai/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-AI' },

  // BLOCKED: Social media
  { url: 'https://www.facebook.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Social' },
  { url: 'https://www.instagram.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Social' },
  { url: 'https://x.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Social' },
  { url: 'https://www.reddit.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Social' },

  // BLOCKED: Video/Dev/Productivity
  { url: 'https://www.youtube.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Video' },
  { url: 'https://github.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Dev' },
  { url: 'https://www.notion.so/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Productivity' },
  { url: 'https://www.slack.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Productivity' },

  // BLOCKED: Non-shopping travel/entertainment
  { url: 'https://www.wikipedia.org/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Reference' },
  { url: 'https://www.netflix.com/', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Streaming' },

  // SHOPPING: Amazon
  { url: 'https://www.amazon.ae/dp/B08N5WRWNW', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Amazon' },
  { url: 'https://www.amazon.com/dp/B08N5WRWNW', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Amazon' },
  { url: 'https://www.amazon.co.uk/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Amazon' },

  // SHOPPING: Noon
  { url: 'https://www.noon.com/uae-en/some-product-123/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Noon' },

  // SHOPPING: UAE Fashion
  { url: 'https://www.namshi.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-UAE' },
  { url: 'https://www.6thstreet.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-UAE' },
  { url: 'https://www.shein.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Fashion' },
  { url: 'https://www.zara.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Fashion' },
  { url: 'https://www.hm.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Fashion' },
  { url: 'https://www.nike.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Fashion' },
  { url: 'https://www.adidas.ae/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Fashion' },

  // SHOPPING: Electronics
  { url: 'https://www.sharafdg.com/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Electronics' },
  { url: 'https://www.ikea.ae/', expected: { blocked: false, shopping: true }, category: 'SHOPPING-Home' },

  // NON-SHOPPING (not blocked but also not shopping): random sites
  { url: 'https://www.bbc.com/news', expected: { blocked: false, shopping: false }, category: 'NOT-SHOPPING-News' },
  { url: 'https://news.ycombinator.com/', expected: { blocked: false, shopping: false }, category: 'NOT-SHOPPING-Tech' },
  { url: 'https://www.stackoverflow.com/questions', expected: { blocked: true, shopping: false }, category: 'BLOCKED-Dev' },

  // Edge cases: www prefix handling
  { url: 'https://www.amazon.ae/', expected: { blocked: false, shopping: true }, category: 'EDGE-www' },
  { url: 'https://amazon.ae/', expected: { blocked: false, shopping: true }, category: 'EDGE-no-www' },

  // Edge case: subdomains
  { url: 'https://subdomain.gemini.google.com/', expected: { blocked: true, shopping: false }, category: 'EDGE-subdomain' },
  { url: 'https://translate.google.com/', expected: { blocked: true, shopping: false }, category: 'EDGE-subdomain' },
]

console.log('=== TerraCart Detection Logic Verification ===\n')

let passed = 0
let failed = 0
const failures = []

for (const test of tests) {
  const blocked = isHardBlockedHost(test.url)
  const shopping = isKnownShoppingHost(test.url)
  const ecommerce = isEcommerceSite(test.url, null)

  const blockedOk = blocked === test.expected.blocked
  const shoppingOk = shopping === test.expected.shopping
  const allOk = blockedOk && shoppingOk

  if (allOk) {
    passed++
  } else {
    failed++
    const msg = `FAIL [${test.category}] ${test.url}\n` +
      `  Expected: blocked=${test.expected.blocked}, shopping=${test.expected.shopping}\n` +
      `  Got:      blocked=${blocked}, shopping=${shopping}`
    failures.push(msg)
    console.log(msg)
  }
}

console.log(`\n=== Results: ${passed}/${tests.length} passed, ${failed} failed ===`)

if (failures.length > 0) {
  console.log('\n--- FAILURES ---')
  failures.forEach(f => console.log(f))
  process.exit(1)
} else {
  console.log('\n✅ All detection logic tests passed!')

  // Additional: test isEcommerceSite with detection data
  console.log('\n--- Testing isEcommerceSite with detection data ---')
  const test1 = isEcommerceSite('https://random-shop.com/product/123', { isECommerce: true, confidence: 70 })
  console.log(`Unknown shop with detection (70%): ${test1 ? 'PASS' : 'FAIL'}`)
  if (!test1) { console.log('  Expected: true'); process.exit(1) }

  const test2 = isEcommerceSite('https://gemini.google.com/', { isECommerce: true, confidence: 100 })
  console.log(`Blocked host even with detection (100%): ${test2 ? 'FAIL' : 'PASS'}`)
  if (test2) { console.log('  Expected: false'); process.exit(1) }

  const test3 = isEcommerceSite('https://random-blog.com/', { isECommerce: true, confidence: 30 })
  console.log(`Low-confidence detection (30%): ${test3 ? 'FAIL' : 'PASS'}`)
  if (test3) { console.log('  Expected: false'); process.exit(1) }

  console.log('\n✅ All isEcommerceSite tests passed!')
  console.log('\n🎉 VERIFICATION COMPLETE — All detection logic works correctly.')
}
