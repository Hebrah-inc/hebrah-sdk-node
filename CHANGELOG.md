# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- `scripts/smoke.mjs` now uses the non-deprecated `client.sandbox.resource('Patient', id)` path (was `client.patients.get(id)` which emits `DeprecationWarning` since v0.8).
- Pinned `postcss >=8.5.23`, `nanoid >=3.3.18`, and `esbuild >=0.28.1` via `pnpm.overrides` to clear 5 dev-only transitive Dependabot advisories (3 high, 1 moderate, 1 low) coming through `tsup`. No runtime impact — all affected packages are dev dependencies.

### Added

- `CONTRIBUTING.md` describing dev setup, scripts, public-API rules, and the release process.
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1).
- Issue templates (bug report, feature request, docs) and PR template under `.github/`.
- OSS discovery badges in README (License, npm version + downloads, Node engine, TypeScript strict, GitHub stars + issues).
- CI matrix now tests Node 18, 20, and 22.

## [0.8.2] — 2026-08-17

### Fixed

- README polish for the v0.8 public release.

## [0.8.0] — 2026-08-01

### Added

- `defaultConnectionId` on `HebrahClient` — applied when sandbox methods omit `connectionId`.
- `HebrahAgentHarness` for BYOM / integration-agent workflows (exported but documented separately from the core quickstart).

### Changed

- **Deprecated:** `client.patients.list()` and `client.patients.get()`. Use
  `client.sandbox.listSyntheticResources('Patient')` /
  `client.sandbox.resource('Patient', id)` instead.

### Security

- `baseUrl` constructor check: rejects `http://` hosts that are not `localhost` / `127.0.0.1` to reduce API-key exfiltration risk.
- New `includeErrorDetail` option to omit raw `detail` payloads from thrown `HebrahApiError`s.

## [0.1.0] — 2026-06-08

### Added

- Initial open-source release of `@hebrah/sdk` for npm.
- Sandbox, HL7, webhook, SMART, and FHIR surface over `/v1/sandbox/*`, `/v1/webhooks/*`, `/v1/smart/*`, `/oauth/token`, `/fhir/R4/*`.
- `verifyWebhookSignature(rawBody, signatureHeader, secret)` helper.

[Unreleased]: https://github.com/Hebrah-inc/hebrah-sdk-node/compare/v0.8.2...HEAD
[0.8.2]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.8.2
[0.8.0]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.8.0
[0.1.0]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.1.0