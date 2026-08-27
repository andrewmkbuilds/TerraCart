# AGENTS.md — TerraCart Project Learnings

## Chrome Extension Architecture

- **Background `onMessage` MUST NOT be async.** Chrome MV3 requires the listener callback to be synchronous. If `async`, `return true` becomes `Promise<true>` and Chrome closes the message channel before `sendResponse` is called. This silently breaks ALL messaging (scan, research, chat, tab queries). Use `.then()` chains for async work inside a sync callback.

- **`chrome.runtime.sendMessage` from service worker produces errors when no extension page is listening.** Wrap in `.catch(() => {})` to suppress "Could not establish connection" noise.

- **Content script injection timing on SPA sites is unreliable.** DOM elements may not render at `document_idle` on Amazon, Noon, etc. Schedule delayed re-scans (300ms, 1000ms, 2500ms) after initial detection to catch async-loaded products.

- **`chrome.scripting.executeScript` callback never fires on error.** Use Promise-based `.then().catch()` for injection, not the callback form. The callback silently swallows failures.

## CSP and Permissions

- **CSP blocks CSS `@import` for Google Fonts.** Even with `fonts.googleapis.com` in `style-src`, the `@import url()` directive is blocked. Load fonts via JavaScript `document.createElement('link')` instead.

- **Manifest `exclude_matches` only prevents content script injection.** The code-level blocklist still runs as a safety net. These can (and did) drift out of sync — maintain both or extract to shared module.

## E-Commerce Detection

- **Blocklist exists in 3 independent places:** `src/content/index.ts`, `src/background/index.ts`, and `src/retailers/site-gate.ts`. Adding a new blocked domain requires updating all 3. Extract to a shared module to prevent drift.

- **`isShoppingTab` has a race condition.** `tabScanData` is populated asynchronously by content script, but `isShoppingTab` reads it synchronously in `chrome.action.onClicked`. On slow-loading pages, the data may not exist yet, causing the toolbar click to silently fail.

- **SPA navigation triggers auto-open re-fire.** Every `pushState`/`replaceState` on a shopping site triggers `CONTENT_SCRIPT_READY`, which re-runs the auto-open logic. Add a guard to prevent repeated side panel opens for the same tab.

## Tavily API

- **Rate limiting (429) should be retried with exponential backoff**, respecting the `Retry-After` header. But aggressive retry (4 attempts) can block UI for 15+ seconds on user-initiated actions. Use 2-3 attempts for user-facing calls.

- **Research runs through the server only.** Keep `TAVILY_API_KEY` in the backend environment and never add it to the extension bundle.
- **Research requests must preserve source URLs.** Do not construct product URLs from names or retailers.

## Build and Testing

- **Run `node scripts/verify-detection.cjs`** to validate blocklist and detection logic (40 tests). Not in package.json — run directly.

- **After modifying `manifest.json`, remove and re-add the extension** (not just reload). Chrome caches the old manifest, especially CSP policies.

- **Vite build output hashes change on every build.** The sidepanel JS filename (e.g., `sidepanel-B3cfjgLE.js`) is different each time. Don't hardcode filenames in tests.

## State Management

- **`handleUrlChange` in content script resets `isActive = false` before checking.** This means every SPA navigation temporarily deactivates TerraCart, then re-activates. The floating button persists (not removed), but `CONTENT_SCRIPT_READY` is re-sent on every navigation.

- **`clearTabActivation` disables the side panel** via `chrome.sidePanel?.setOptions({ tabId, enabled: false })`. Only call it for blocklisted URLs, not for all page loads — detected shops need the side panel to remain available.
