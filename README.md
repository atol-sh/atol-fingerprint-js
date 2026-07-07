# @atol-sh/fingerprint

[![npm version](https://img.shields.io/npm/v/@atol-sh/fingerprint.svg)](https://www.npmjs.com/package/@atol-sh/fingerprint)
[![license](https://img.shields.io/npm/l/@atol-sh/fingerprint.svg)](./LICENSE)
[![CI](https://github.com/atol-sh/atol-fingerprint-js/actions/workflows/ci.yml/badge.svg)](https://github.com/atol-sh/atol-fingerprint-js/actions/workflows/ci.yml)

Browser device-signal collection for the [Atol](https://atol.sh) Device
Intelligence Engine. Collects raw browser signals, submits them to the Atol
control plane, and returns a server-assigned device ID plus server-computed
smart signals (bot, VPN, tamper, anomaly score). All analysis happens
server-side; the browser never makes trust decisions.

- Zero production dependencies. Pure TypeScript + DOM APIs.
- ESM + CJS + type declarations.
- Apache-2.0.

This package is a standalone SDK, but it's also an optional companion to
[`@atol-sh/js`](https://www.npmjs.com/package/@atol-sh/js) and
[`@atol-sh/react`](https://www.npmjs.com/package/@atol-sh/react) — install it
alongside either to enable device intelligence (bot/VPN/tamper signals) in
those SDKs.

## Install

```bash
npm install @atol-sh/fingerprint
```

## Quick start

```ts
import { AtolFingerprint, isCollectionDisabled } from "@atol-sh/fingerprint";

// Collect signals once at load time.
const fp = await AtolFingerprint.load({
  endpoint: "https://api.atol.sh", // default
  apiKey: "<bearer token>",        // or pass per-call via identify({ token })
});

// Submit to the control plane.
const result = await fp.identify();

if (isCollectionDisabled(result)) {
  // User opted out (config) or browser sent Global Privacy Control (gpc).
  console.log("collection disabled:", result.reason);
} else {
  console.log(result.device_id, result.confidence, result.signals?.anomaly_score);
}

// Inspect raw signals without submitting:
const signals = fp.getSignals();
```

`identify({ token })` overrides the configured bearer token per call, e.g.
with an OIDC access token from the Atol React SDK.

## Server contract

`identify()` performs `POST {endpoint}/api/v1/devices/identify` with body:

```json
{
  "client_platform": "browser",
  "client_signals": { /* ClientSignals, see below */ }
}
```

The control plane handler (`atol` repo, `internal/api/device_handler.go`) is
the canonical contract. Its response, typed as `IdentifyResult`:

```ts
interface IdentifyResult {
  device_id: string;     // server-assigned; never generated client-side
  known: boolean;
  confidence: number;
  new_device: boolean;
  platform: string;
  browser: string;
  os_version: string;
  signals: SmartSignals | null;
}

interface SmartSignals {
  bot: boolean;
  vpn: boolean;
  proxy: boolean;
  tor: boolean;
  incognito: boolean;
  tampered: boolean;
  emulator: boolean;
  rooted: boolean;
  geo_mismatch: boolean;
  anomaly_score: number; // [0, 1]; 0 = clean, 1 = highly suspicious
}
```

Non-2xx responses make `identify()` throw an `Error` containing the HTTP
status and response body. There is no silent fallback.

All types (`ClientSignals`, `SmartSignals`, `IdentifyResult`,
`FingerprintConfig`, `CollectionDisabled`) and the `isCollectionDisabled`
type guard are exported from the package root for downstream SDKs.

## What is collected

Everything below is read once at `AtolFingerprint.load()` and only leaves the
browser when you call `identify()`.

| Signal | Detail |
|--------|--------|
| Canvas rendering | A small test scene (text, gradient, arcs) rendered to an offscreen canvas, exported as a data URL. Hashed server-side. |
| WebGL | Unmasked renderer and vendor strings (`WEBGL_debug_renderer_info`), supported extension names. |
| Audio | A short numeric hash of an `OfflineAudioContext` oscillator+compressor render. Raw audio never leaves the device. |
| Fonts | Presence/absence of a fixed list of 30 common fonts (width-measurement technique). Names only. |
| Screen metrics | `screen.width`, `screen.height`, `devicePixelRatio`, `colorDepth`. |
| Hardware | `navigator.hardwareConcurrency`, `navigator.deviceMemory`. |
| Locale | `navigator.languages`, `navigator.platform`, IANA timezone. |
| UA Client Hints | High-entropy values: `architecture`, `bitness`, `fullVersionList`, `model`, `platformVersion`, `uaFullVersion`, `wow64` (falls back to `brands`/`mobile`/`platform`, then to the plain user-agent string). |
| Touch | `navigator.maxTouchPoints`. |
| Codecs | Which of 10 fixed codec strings `MediaSource.isTypeSupported` accepts. |
| Media devices | The COUNT of devices from `enumerateDevices()`. Never labels or device IDs. |
| CSS preferences | `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, `pointer`, `hover`, `prefers-reduced-transparency`, `forced-colors`. |
| Math fingerprint | Results of 22 `Math` functions (engine/libm variations). |
| API availability | Booleans for `bluetooth`, `usb`, `webgpu`, `speechSynthesis`, `webxr`, `serial`, `hid`, `credentials`, `PaymentRequest`. |
| Incognito heuristic | Boolean derived from `navigator.storage.estimate()` quota (< 500 MB suggests private browsing). |
| Automation markers | Booleans: `navigator.webdriver`, PhantomJS/Nightmare/Selenium/Playwright/Puppeteer/CDP injected globals, `domAutomation`, and headless indicators (zero plugins, zero outer window size, `connection.rtt === 0`, notification permission inconsistency, missing languages). |

The mobile-only fields in the wire format (`mobile_id`, `app_attest`,
`play_integrity`, `sensor_data`, `build_props`) are always empty strings from
this browser SDK.

## What is NOT collected

- No geolocation (no Geolocation API; any geo analysis is server-side from IP).
- No persistent client-side identifiers: the device ID is assigned by the
  server. Nothing is written to cookies, localStorage, IndexedDB, or any
  other client storage.
- No media device labels or device IDs - only the count.
- No keystrokes, form contents, page contents, or browsing history.
- No raw audio or microphone/camera access.

## Data flow

1. `load()` reads the signals above in the browser. No network traffic.
2. `identify()` POSTs them to `https://api.atol.sh/api/v1/devices/identify`
   (or your configured `endpoint`) with a bearer token.
3. The control plane hashes the signals, matches them against known devices
   for your tenant, evaluates smart signals, and returns `IdentifyResult`.
4. The returned `device_id` and `signals` feed OPA policies
   (`input.device.*`) for step-up auth and fraud decisions.

This SDK is collect-and-submit only: it keeps nothing across calls. Every durable
device record - the profile, its fingerprint history, and the session binding -
lives server-side in the Atol control plane, retained per Atol's device-data
retention policy, never in the browser.

## Privacy & compliance

Device fingerprinting reads information from the user's terminal equipment.
Under GDPR and the ePrivacy Directive this generally requires prior user
disclosure and, depending on your legal basis (e.g. consent vs. legitimate
interest for fraud prevention), user consent. You are responsible for
disclosing fingerprinting in your privacy policy and obtaining any required
consent before calling `AtolFingerprint.load()`.

See the Atol privacy documentation: https://atol.sh/docs/privacy (placeholder).

### Consent and opt-out API

```ts
// Explicit opt-out: collection never runs, nothing is read or sent.
const fp = await AtolFingerprint.load({ disabled: !userHasConsented });

const result = await fp.identify();
// result = { collection_disabled: true, reason: "config" }
```

When collection is disabled:

- `load()` reads no browser APIs at all.
- `identify()` performs no network request and resolves to
  `{ collection_disabled: true, reason: "config" | "gpc" }`.
- `getSignals()` returns the same `CollectionDisabled` object.
- No fake or placeholder data is ever produced.

Use the exported `isCollectionDisabled(result)` type guard to narrow results,
or check `fp.disabled`.

### Global Privacy Control

If the browser advertises [Global Privacy Control](https://globalprivacycontrol.org/)
(`navigator.globalPrivacyControl === true`), the SDK disables collection by
default and behaves exactly as if `disabled: true` was passed (with
`reason: "gpc"`). If you have an independent legal basis to ignore GPC (e.g.
fraud prevention required to provide the service), you may override:

```ts
const fp = await AtolFingerprint.load({ respectGPC: false });
```

## Troubleshooting

- **`identify()` throws with a 401/403** - the bearer token is missing, expired,
  or wrong for the target tenant. Pass a fresh token via `identify({ token })`
  or the `apiKey` config option.
- **`identify()` throws with the HTTP status and body in the message** - this is
  by design; there is no silent fallback. Inspect the body for the control
  plane's error detail.
- **`getSignals()` / `identify()` return `{ collection_disabled: true }`
  unexpectedly** - check `reason`. `"gpc"` means the browser sent Global
  Privacy Control; pass `respectGPC: false` if you have an independent legal
  basis to collect anyway. `"config"` means `disabled: true` was passed to
  `load()`.
- **Signals look incomplete in a headless/automated browser** - expected.
  Several collectors (WebGL, fonts, media devices) return sparse data or
  automation markers under headless Chrome/Playwright/Puppeteer by design.

## Development

```bash
npm ci
npm run typecheck
npm test          # vitest, happy-dom environment
npm run build     # tsup -> dist/ (ESM + CJS + d.ts)
npm run verify:pack # publint + are-the-types-wrong
```

## License

Apache-2.0. Copyright 2026 Atol.
