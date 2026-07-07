# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `@atol-sh/fingerprint`, please
report it responsibly.

**Email:** security@atol.sh

Do NOT open a public GitHub issue for security vulnerabilities.

## Response Timeline

- **48 hours** -- initial acknowledgment of your report.
- **7 days** -- preliminary assessment and severity classification.
- **30 days** -- target for fix development and coordinated disclosure.

We will keep you informed throughout the process.

## Scope

This SDK runs in the browser. It reads device signals and submits them to the
Atol control plane. The following are in scope:

- Collection of data beyond the documented signal set (e.g. PII, page
  contents, keystrokes, raw audio/camera, persistent client identifiers)
- Bypass of the consent / opt-out controls (`disabled`, Global Privacy
  Control handling) such that collection runs when it should not
- Leakage of the bearer token or collected signals to third parties
- Cross-site scripting (XSS) vectors introduced by the SDK
- Tampering with the identify request/response that affects a trust decision

## Out of Scope

- Vulnerabilities in the Atol control plane or APIs (report those against the
  `atol-sh/atol` repository)
- The inherent fingerprintability of a browser (this SDK measures it; it does
  not create it)
- Social engineering, phishing, or denial-of-service attacks
- Reports from automated scanners without a demonstrated proof of concept

## Safe Harbor

We consider security research conducted in good faith to be authorized
activity and will not pursue legal action against researchers who avoid
privacy violations and service disruption, only interact with accounts they
own or have permission to test, report through the process above, and allow
reasonable time for remediation before public disclosure.

## Preferred Languages

Reports may be submitted in English.
