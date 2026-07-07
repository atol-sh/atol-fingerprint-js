# Changelog

All notable changes to `@atol-sh/fingerprint` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

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
