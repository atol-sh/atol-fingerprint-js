# Contributing to @atol-sh/fingerprint

Thanks for your interest in improving the Atol Fingerprint SDK.

## Getting started

```bash
git clone https://github.com/atol-sh/atol-fingerprint-js.git
cd atol-fingerprint-js
npm install
```

Common tasks:

```bash
npm run build       # tsup -> dist/ (ESM + CJS + d.ts, minified)
npm test            # vitest (happy-dom)
npm run typecheck   # tsc --noEmit
```

## Before you open a pull request

- `npm run typecheck` passes.
- `npm test` passes. Add or update tests for any behavior change, especially
  to the collected signal set, the consent/opt-out paths, and the submit
  contract.
- `npm run build` succeeds and `npm pack --dry-run` shows the expected files.
- Keep production dependencies at zero. This package is pure TypeScript + DOM
  APIs by design; adding a runtime dependency needs a strong justification.
- New collectors must catch their own errors and never block other signals,
  and must not collect PII or persist client-side identifiers.

## Reporting security issues

Do not open a public issue for a vulnerability. Follow the process in
[SECURITY.md](./SECURITY.md) (email security@atol.sh).

## License

By contributing, you agree that your contributions are licensed under the
Apache License 2.0, the same license that covers this project.
