# Atol Fingerprint SDK

Browser device fingerprinting for [Atol](https://atol.sh). Collects 30 client-side signals, submits to the control plane Device Intelligence Engine, returns server-computed smart signals (`bot`, `vpn`, `proxy`, `tor`, `incognito`, `tampered`, `emulator`, `rooted`, `geo_mismatch`, `anomaly_score`). These feed into OPA policies via `input.device.*` for step-up auth and fraud detection.

- **Package:** `@atol-sh/fingerprint`
- **License:** Apache 2.0, TypeScript, zero production deps
- **Build:** tsup (ESM + CJS + dts, minified)

## Output Control

- Answer starts on line 1. No openers ("Sure!", "Great question!", "Absolutely!").
- No closings ("Hope this helps!", "Let me know!"). Stop when done.
- No restating the question. Execute immediately.
- No "As an AI..." framing. No unnecessary disclaimers.
- No unsolicited suggestions beyond requested scope.
- Corrections from user become ground truth. Never agree with incorrect statements.
- ASCII only. No em dashes, smart quotes, or Unicode bullets. Plain hyphens and straight quotes.
- If unsure: say so. Never guess file paths, function names, or API endpoints.
- User instructions override this file.

## Workflow

- Read before writing. Understand existing code before modifying.
- No redundant file reads. Read each file once per session.
- One focused coding pass. No write-delete-rewrite cycles.
- Test once, fix if needed, verify once.
- Prefer editing over rewriting whole files.

## Related Projects

| Project | Repo |
|---------|------|
| Control plane | `atol-sh/atol` |
| Go SDK | `atol-sh/atol-sdk-go` |
| React SDK | `atol-sh/atol-sdk-react` (npm: `@atol-sh/react`) |
| Proto (DeviceService) | `atol-sh/atol` -> `proto/atol/device/v1/device.proto` |

## Architecture

```
AtolFingerprint.load()
  └─ Collect 30 browser signals (canvas, WebGL, audio, fonts, bot markers, etc.)

AtolFingerprint.identify()
  └─ POST /api/v1/devices/identify → control plane
      └─ Server returns: device_id, confidence, SmartSignals

SmartSignals flow downstream:
  React SDK → X-Atol-Device-Id header → Go SDK middleware → OPA input.device.*
```

**Signal categories:** canvas hash, WebGL renderer/vendor/extensions, AudioContext fingerprint, font detection (30 fonts), codec support, media device counts, CSS preferences, math fingerprint (22 functions), bot/automation markers (webdriver, phantom, selenium, playwright, puppeteer, headless indicators, incognito detection), high-entropy UA data, screen/hardware info, timezone.

## Code Principles

1. **Zero production deps.** Pure TypeScript + DOM APIs. Nothing to audit.
2. **Signals are raw, analysis is server-side.** Never make trust decisions in the browser.
3. **Graceful degradation.** Each collector catches its own errors. One failing signal never blocks others.
4. **No PII collection.** Fingerprints identify devices, not users. No cookies, no localStorage.
5. **Minified output.** tsup minifies the bundle -- signal collection code should not be easily readable.

## File Organization

```
src/
├─ index.ts      # AtolFingerprint class: load() → identify()
├─ types.ts      # ClientSignals, SmartSignals, FingerprintConfig, IdentifyResult
├─ collect.ts    # 30 signal collectors (canvas, WebGL, audio, fonts, bot, etc.)
└─ submit.ts     # HTTP POST to /api/v1/devices/identify
```

## TypeScript Standards

- Strict mode. No `any`.
- All collectors are pure functions returning a signal value or null on failure.
- Types mirror the control plane Go structs (`signals.RawClientSignals`, `intelligence.SignalsToMap`, `DeviceHandler.Identify` response). Keep in sync manually.
- No async collectors unless unavoidable (AudioContext, StorageManager).

## Running

```bash
npm run build        # tsup -> dist/ (ESM + CJS + dts, minified)
npm run typecheck    # tsc --noEmit
npm test             # vitest run (happy-dom)
```

## Needs

- No linting configured. Add ESLint + Prettier.
