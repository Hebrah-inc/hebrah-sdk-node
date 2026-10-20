# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.1] — 2026-10-19

### Added

- **Conversational Architect, Studio & Patient Admission (`client.environments`)**:
  - `consultArchitect()`, `admitPatients()`, and `consultStudio()`.
- **Modular HTTP & Security Utilities**:
  - Exported `redactSecrets`, `safePathSegment`, `assertSafeBaseUrl`, `assertSafeExternalUrl`, `validateToken`, `validateTimeoutMs`, and `interpolateSqlParams`.

### Security

- Enforced zero-leak secret redaction (`redactSecrets`) across `HebrahApiError` (`toJSON`, `nodejs.util.inspect.custom`), `HebrahClient` (`Symbol.toStringTag`, non-enumerable private token storage), and `HebrahAgentHarness` (`hb_live_*`, `hb_test_*`, `hb_pat_*`, `hb_conn_*`, `hb_claim_*`, `enc:v1:*`, WireGuard `PrivateKey`, Bearer/Basic headers).
- Hardened SSRF defenses (`assertSafeBaseUrl`, `assertSafeExternalUrl`) to block IPv4/IPv6 loopback/private/link-local/metadata addresses, URL credentials, and query/fragment injection.
- Added timestamp replay protection (`toleranceSeconds`, default 300s) to `verifyWebhookSignature()`.
- Hardened `interpolateSqlParams()` to skip `$n` placeholders inside SQL comments, single-quoted strings, double-quoted identifiers, and dollar-quoted blocks.

## [0.9.0] — 2026-10-14

### Added

- **Isolated Health Environments (`client.environments`)**:
  - `list()`, `create()`, `get()`, `delete()`, `addModule()`, `removeModule()`, `listPatients()`, `getPatientChart()`, `triggerScenario()`, `connectAgent()`, `getAutosave()`, `updateAutosave()`, `tables()`, `recordOutcome()`, and `wireguardConfig()`.
  - Overloads on `getPatientChart(patientId)`, `triggerScenario(params)`, `addModule(moduleId)`, and `removeModule(moduleId)` that automatically use `config.environmentId` when configured on `HebrahClient`.
- **Credential-Blind Database Pack (`client.db`)**:
  - `client.db.query(sql, params?, environmentId?)` supporting both `(sql, params)` positional `$1, $2` parameter interpolation and `{ sql, params, addon, actor_type }` object syntax.
  - `client.db.recordOutcome(params, environmentId?)` (`POST /v1/environments/{id}/db/outcomes`).
  - `client.db.tables(environmentId?)` (`GET /v1/environments/{id}/db/tables`).
  - `client.db.wireguardConfig(environmentId?)` and `client.db.exportVpnConfig(environmentId?)` (`GET /v1/environments/{id}/vpn/wireguard-config`).
- **Scoped Connections & Catalog (`client.connections` + `client.query`)**:
  - `targets()`, `target(id)`, `packs()`, `open()`, `list()`, `get()`, `query()`, `revoke()`, `audit()`, `verifyAudit()`, and top-level `client.query()`.
- **Agent Wallet & Metering (`client.agent`)**:
  - `usage()`, `wallet()`, and `topup()`.
- **FHIR R4 (`client.fhir`)**:
  - `fhir.search(resourceType, params?, environmentId?)`, `fhir.metadata()`, and optional `accessToken` fallback to `apiKey` on `fhir.readPatient(patientId, accessToken?)`.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, GitHub issue/PR templates, and Node 18/20/22 CI matrix.

### Security

- Added `safePathSegment(value, name)` across all URL path interpolations to block empty segments, `.` / `..` path traversal, and control characters.
- Enforced `assertSafeBaseUrl` (`https://` required for non-localhost URLs) and `fetchWithTimeout` across `HebrahAgentHarness` (`mcpUrl`, `hebrahApiUrl`, `integrationAgentUrl`).
- Hardened `verifyWebhookSignature` to reject empty/whitespace `webhookSecret` values and support optional `sha256=` header prefixes before constant-time `timingSafeEqual`.
- Locked `.github/workflows/ci.yml` publish job to `pnpm install --frozen-lockfile`.
- Pinned `postcss >=8.5.23`, `nanoid >=3.3.18`, and `esbuild >=0.28.1` via `pnpm.overrides`.

### Fixed

- `scripts/smoke.mjs` now uses the non-deprecated `client.sandbox.resource('Patient', id)` path.

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

[Unreleased]: https://github.com/Hebrah-inc/hebrah-sdk-node/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.9.0
[0.8.2]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.8.2
[0.8.0]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.8.0
[0.1.0]: https://github.com/Hebrah-inc/hebrah-sdk-node/releases/tag/sdk-node-v0.1.0