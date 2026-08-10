# Changelog

All notable changes to `@atol-sh/fingerprint` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - Staged, unpublished

This staged release contains a breaking authentication-contract correction.
It has no publication date or release tag because registry publication and
integrity verification have not completed.

### Changed

- Device identification now binds only to the session of the authenticating
  tenant access token. The SDK no longer accepts a caller-supplied session ID.
- `identify()` now accepts an operation-scoped authorization callback instead
  of a token value. It acquires either an exact Bearer credential or an
  inseparable DPoP token/proof pair for the final request URL; the regional
  endpoint does not accept machine API keys.

### Security

- Identify failures expose a typed, closed diagnostic containing only a stable
  code and optional HTTP status. Raw response bodies, status text, request
  URLs, parser details, and caught browser values are discarded.
- Identify responses are validated against the exact wire contract; malformed
  or drifted success payloads fail closed instead of being cast or coerced.
- The exact response requires a non-null 13-field smart-signal evaluation;
  missing or null risk data cannot be interpreted as a clean device.
- `AtolFingerprint` retains only the normalized endpoint string from caller
  configuration. Unknown or legacy credential-bearing fields are discarded
  before the agent is constructed.
- Type checking covers tests and public-contract fixtures as well as source.
- Identify requests omit ambient credentials and referrers, bypass browser
  caches, and reject redirects instead of forwarding device data or tokens.

## [0.1.0] - 2026-06-09

### Added

- Initial release.
- `AtolFingerprint.load()` / `identify()` / `getSignals()` API.
- 27 browser signal collectors: canvas, WebGL, audio, fonts, screen metrics,
  hardware info, languages, platform, UA-CH high-entropy data, touch points,
  codecs, media device count, CSS preferences, math fingerprint, timezone,
  API availability, and automation/incognito markers.
- Server contract types (`IdentifyResult`, `SmartSignals`, `ClientSignals`)
  matching the control plane `POST /api/v1/devices/identify` response.
- Consent controls: `disabled` config option and Global Privacy Control
  support (on by default, opt out with `respectGPC: false`), both returning a
  typed `CollectionDisabled` result instead of fabricated data.
- ESM + CJS + type declaration builds via tsup.
- Vitest test suite (happy-dom) and GitHub Actions CI.
