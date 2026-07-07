# Release process

`@atol-sh/fingerprint` publishes to npm via GitHub Actions Trusted Publishing
(OIDC, keyless, with provenance) — see `.github/workflows/release.yml`. Trusted
publishing requires the package to already exist on the registry (npm has no
first-publish-via-OIDC yet: [npm/cli#8544](https://github.com/npm/cli/issues/8544)).
This package is net-new under the `atol-sh` org and currently 404s on npm, so
it needs a one-time manual bootstrap publish before CI can take over.

## One-time bootstrap (0.1.0)

1. **npm org access.** Confirm the publishing npm account is a member of the
   `atol-sh` org with 2FA enabled, or holds a granular access token scoped to
   `@atol-sh` with 2FA bypass for CLI publish.
2. **Sanity-check the tarball:**
   ```bash
   npm run build
   npm pack --dry-run
   npm run verify:pack   # publint + are-the-types-wrong
   ```
3. **Manual first publish** (creates the package on the registry):
   ```bash
   npm publish --access public
   ```
   Omit `--provenance` here: provenance attestation needs a cloud CI runner
   (it binds the publish to a GitHub Actions run), so this laptop-originated
   0.1.0 publish will not carry a provenance badge. Every version published by
   CI after this one will.
4. **Configure Trusted Publisher on npmjs.com:** package Settings -> Trusted
   Publisher -> GitHub Actions -> org `atol-sh`, repo `atol-fingerprint-js`,
   workflow filename `release.yml`. npm does not validate this configuration
   when you save it — a typo in org/repo/workflow only surfaces as a failure
   the next time CI tries to publish.
5. **Harden publishing access:** package Settings -> Publishing access ->
   enable "Require two-factor authentication and disallow tokens". This
   forces all subsequent publishes through the Trusted Publisher / OIDC flow
   (or 2FA-backed manual publishes), closing off long-lived token exposure.

> **Repository visibility.** `atol-fingerprint-js` is private for now.
> `npm publish --provenance` and trusted publishing's automatic provenance
> require a public repo, so make the repo public before the first tag-driven
> release — ideally before step 3, so even the bootstrap `0.1.0` can carry a
> provenance badge.

## Every release after 0.1.0

1. Update `CHANGELOG.md` for the new version and commit it (`npm version`
   needs a clean tree).
2. Run `npm version <patch|minor|major>`. This bumps `package.json`, commits,
   and creates a matching `vX.Y.Z` tag in one atomic step, so the version and
   the tag can never drift — the `release.yml` guard that checks tag ==
   `package.json` version will always pass.
3. Push both together: `git push --follow-tags`.
4. `.github/workflows/release.yml` runs on the tag push: typecheck, test,
   build, `publint`, then `npm publish --provenance --access public` using a
   short-lived OIDC token — no `NPM_TOKEN` involved.

The first CI-published version will be **0.1.1**.
