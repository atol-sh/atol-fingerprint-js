# Release process

`@atol-sh/fingerprint` publishes to npm via trusted publishing (OIDC) in
[`.github/workflows/release.yml`](.github/workflows/release.yml). A `v*` tag
starts an unprivileged qualification job that builds and verifies the package,
creates one tarball with lifecycle scripts disabled, and hands that exact
artifact to a separate publisher job.

Before installing project dependencies, qualification downloads the npm
11.18.0 archive, verifies its pinned SHA-512, and invokes that CLI directly
without a global install. The publisher does not check out the repository,
install project dependencies, or run project scripts. It independently
verifies the same npm archive, rehashes the received tarball, validates the
tarball's internal identity and file manifest, publishes those exact bytes
with provenance, and boundedly waits for npm to report the same SHA-512
integrity. There is no `NPM_TOKEN` in CI.

npm does not support a first publish through OIDC
([npm/cli#8544](https://github.com/npm/cli/issues/8544)). Version 0.1.0
completed that one-time package bootstrap. The bootstrap path is closed: no
current or future version may use a local manual publish path.

Fingerprint 0.2.0 is staged and unpublished. It is the first artifact in the
coordinated browser SDK release. Publish and registry-verify fingerprint 0.2.0
first, `@atol-sh/js` 0.3.0 second, and `@atol-sh/react` 0.5.0 last.

## Trusted-publisher prerequisites

npm must bind `@atol-sh/fingerprint` to the exact `atol-sh/atol-fingerprint-js`
GitHub repository and `release.yml` workflow with no Environment name. The
repository must satisfy npm's trusted-publishing and provenance requirements.
A missing or mismatched binding is a terminal release configuration error.
Never fall back to a local publish or a long-lived token.

## Every release after the bootstrap

1. Update [`CHANGELOG.md`](./CHANGELOG.md): move completed entries into the
   release version with the actual UTC release date, restore an empty
   `## [Unreleased]`, and commit the result.
2. Run the full typecheck, test, build, package-verification, and audit gates.
3. For a new version, run `npm version <patch|minor|major>` from a clean tree.
   This updates the manifest, creates the release commit, and creates the
   matching `vX.Y.Z` tag together. Then push the commit and tag atomically.
4. The unprivileged qualification job verifies the tag, typechecks, tests,
   builds, runs both package verifiers, and calls
   `npm pack --ignore-scripts --json` exactly once. It records the tarball
   filename, package identity, file count, and SHA-512.
5. The OIDC-authorized publisher receives only that tarball. It requires one
   regular file, matching name and version, the qualified SHA-512 and file
   count, one internal `package.json`, no bundled dependencies, and exact
   `publishConfig: {"access":"public"}`. All tarball inspection and publishing
   disables lifecycle scripts.
6. The publisher sends the exact qualified artifact to the public npm
   registry with provenance and the `latest` tag. It polls for at most two
   minutes and requires registry `dist.integrity` to equal the qualified
   SHA-512.
7. Confirm the version on
   [npmjs.com/package/@atol-sh/fingerprint](https://www.npmjs.com/package/@atol-sh/fingerprint)
   and confirm the GitHub Actions run includes a provenance attestation before
   releasing either dependent SDK.

## Exact tag path for staged 0.2.0

The repository already records package version 0.2.0, but that version is not
tagged or published. Do not run `npm version` for this release because that
would change the intended version. Freeze all 0.2.0 source, tests, packed
documentation, and changelog content in one clean release commit on `main`.
Run every package gate against that exact commit, verify npm still has no
0.2.0, and verify Git has no `v0.2.0` tag.

This staged release changes the identification boundary. Its frozen gates must
cover exact non-null smart-signal responses, the operation-scoped Bearer or
DPoP authorization pair, no credential retention, closed error projection, and
the exact packed public API. Do not tag 0.2.0 until those checks pass.

Bind the existing manifest version to the frozen commit without modifying
package files:

```bash
version="$(node -p "require('./package.json').version")"
test "$version" = "0.2.0"
test "$(git branch --show-current)" = "main"
test -z "$(git status --porcelain)"
! git rev-parse --verify --quiet "refs/tags/v${version}"
git tag --annotate "v${version}" \
  --message "@atol-sh/fingerprint ${version}" HEAD
git push --atomic origin \
  HEAD:refs/heads/main \
  "refs/tags/v${version}:refs/tags/v${version}"
```

The atomic push prevents the tag from reaching the release workflow without
the frozen commit it names. Do not publish core 0.3.0 or update downstream
locks until the fingerprint workflow has confirmed registry byte identity.
