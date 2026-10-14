# @hebrah/sdk

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![npm](https://img.shields.io/npm/v/@hebrah/sdk.svg)](https://www.npmjs.com/package/@hebrah/sdk)
[![npm downloads](https://img.shields.io/npm/dm/@hebrah/sdk.svg)](https://www.npmjs.com/package/@hebrah/sdk)
[![Node ≥18](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](./package.json)
[![TypeScript strict](https://img.shields.io/badge/typescript-strict-3178C6?logo=typescript&logoColor=white)](./tsconfig.json)
[![GitHub stars](https://img.shields.io/github/stars/Hebrah-inc/hebrah-sdk-node.svg?style=social)](https://github.com/Hebrah-inc/hebrah-sdk-node)
[![GitHub issues](https://img.shields.io/github/issues/Hebrah-inc/hebrah-sdk-node.svg)](https://github.com/Hebrah-inc/hebrah-sdk-node/issues)

Official Node.js SDK for [Hebrah](https://hebrah.com) **Isolated Health Environments**, credential-blind Database Packs, synthetic clinic EHRs (FHIR R4, HL7 v2, X12 EDI), and scoped agent connections.

## Install

```bash
npm install @hebrah/sdk
# or
pnpm add @hebrah/sdk
```

Requires **Node.js 18+** (native `fetch`, zero runtime dependencies).

## Quick start (Isolated Health Environments)

```typescript
import { HebrahClient, verifyWebhookSignature } from '@hebrah/sdk'

const hebrah = new HebrahClient({
  apiKey: process.env.HEBRAH_API_KEY!,
  environmentId: process.env.HEBRAH_ENV_ID, // optional default clinic environment ID
  baseUrl: process.env.HEBRAH_API_BASE_URL  // optional; defaults to https://api.hebrah.com
})

// 1. Credential-blind SQL query against the environment's attached PostgreSQL 16 module
const { rows } = await hebrah.db.query(
  'SELECT id, mrn, first_name, last_name, primary_diagnosis FROM patients WHERE status = $1 LIMIT 10',
  ['active']
)

// 2. Fetch full synthetic EHR chart (FHIR R4 Patient + Encounters + Observations + Medications)
const chart = await hebrah.environments.getPatientChart(rows[0].id)

// 3. Trigger a live clinical scenario (emits HL7 v2 ADT^A01 + webhook event)
await hebrah.environments.triggerScenario({
  scenario: 'new_patient_admitted'
})

// 4. Write an agent clinical outcome back to the environment
await hebrah.db.recordOutcome({
  patientId: rows[0].id,
  outcomeType: 'care_gap_closed',
  summary: 'Scheduled follow-up HbA1c lab panel'
})
```

### Webhook verification

```typescript
import { verifyWebhookSignature } from '@hebrah/sdk'

const payload = verifyWebhookSignature(
  rawBody,
  req.headers['x-hebrah-signature'],
  process.env.HEBRAH_WEBHOOK_SECRET!
)
```

## Security

- Store `HEBRAH_API_KEY` and `HEBRAH_WEBHOOK_SECRET` in server-side environment variables or a secrets manager only — never expose them to browsers or commit `.env` files.
- The SDK does not persist credentials; they live in memory for the lifetime of each `HebrahClient` instance.
- `baseUrl` must be `https://` in production, or `http://localhost` / `http://127.0.0.1` for local dev — other `http://` hosts are rejected at construction to prevent API-key exfiltration.
- All path segment identifiers (`environmentId`, `patientId`, `connectionId`, etc.) are validated against path-traversal and control-character injection via `safePathSegment`.
- Treat `HebrahApiError.detail` as operator-only diagnostics. Do not log or return it to end users — set `includeErrorDetail: false` on `HebrahClient` to omit `detail` from errors.

See [SECURITY.md](./SECURITY.md) for supported versions and vulnerability reporting.

## API surface (v0.9)

### Isolated Health Environments (`client.environments`)

| Method | Description |
|--------|-------------|
| `client.environments.list()` | `GET /v1/environments` — list isolated clinic environments |
| `client.environments.create(params)` | `POST /v1/environments` — provision a new clinic environment |
| `client.environments.get(environmentId?)` | `GET /v1/environments/{id}` |
| `client.environments.pause(environmentId?)` / `resume(environmentId?)` | `POST /v1/environments/{id}/pause` · `POST /v1/environments/{id}/resume` |
| `client.environments.destroy(environmentId?)` | `DELETE /v1/environments/{id}` |
| `client.environments.addModule(moduleType)` / `addModule(envId, moduleType)` | `POST /v1/environments/{id}/modules` — attach a Database Pack module |
| `client.environments.removeModule(moduleId)` / `removeModule(envId, moduleId)` | `DELETE /v1/environments/{id}/modules/{moduleId}` |
| `client.environments.listPatients(environmentId?)` | `GET /v1/environments/{id}/ehr/patients` |
| `client.environments.getPatientChart(patientId)` / `getPatientChart(envId, patientId)` | `GET /v1/environments/{id}/ehr/patients/{patientId}` |
| `client.environments.triggerScenario(params)` / `triggerScenario(envId, params)` | `POST /v1/environments/{id}/ehr/scenarios/trigger` |
| `client.environments.connectAgent(params?)` / `connectAgent(envId, params?)` | `POST /v1/environments/{id}/agents/connect` |
| `client.environments.getAutosave(environmentId?)` | `GET /v1/environments/{id}/autosave` |
| `client.environments.updateAutosave(params, environmentId?)` | `PATCH /v1/environments/{id}/autosave` |
| `client.environments.tables(environmentId?)` | `GET /v1/environments/{id}/db/tables` |
| `client.environments.recordOutcome(params, environmentId?)` | `POST /v1/environments/{id}/db/outcomes` |
| `client.environments.wireguardConfig(environmentId?)` | `GET /v1/environments/{id}/wireguard/config` |

### Credential-Blind Database Pack (`client.db`)

| Method | Description |
|--------|-------------|
| `client.db.query(sql, params?, environmentId?)` | `POST /v1/environments/{id}/db/query` — execute parameterized SQL (`$1, $2`) |
| `client.db.query({ sql, params?, addon?, actor_type? }, environmentId?)` | `POST /v1/environments/{id}/db/query` — execute SQL against `postgres`, `sqlite`, `vector_qdrant`, or `graph_neo4j` |
| `client.db.tables(environmentId?)` | `GET /v1/environments/{id}/db/tables` — list tables and row counts |
| `client.db.recordOutcome(params, environmentId?)` | `POST /v1/environments/{id}/db/outcomes` — record structured agent clinical outcome |
| `client.db.wireguardConfig(environmentId?)` / `exportVpnConfig(environmentId?)` | `GET /v1/environments/{id}/wireguard/config` — export WireGuard VPN config for human GUI tools |

### Scoped Connections & Connector Catalog (`client.connections`)

| Method | Description |
|--------|-------------|
| `client.connections.targets(params?)` | `GET /v1/connections/targets` — list connector targets (`pack`, `all`, `healthy`) |
| `client.connections.target(targetId)` | `GET /v1/connections/targets/{id}` |
| `client.connections.packs(params?)` | `GET /v1/connections/packs` — list active digital health connector packs |
| `client.connections.open(params)` | `POST /v1/connections` — open a scoped connection (`targetId`, `scopes`, `ttlSeconds`) |
| `client.connections.list(params?)` | `GET /v1/connections` |
| `client.connections.get(connectionId?)` | `GET /v1/connections/{id}` |
| `client.connections.query(connectionId, params)` / `client.query(params)` | `POST /v1/connections/{id}/query` — run a scoped, audited query |
| `client.connections.revoke(connectionId, reason?)` | `POST /v1/connections/{id}/revoke` |
| `client.connections.audit(connectionId, params?)` | `GET /v1/connections/{id}/audit` — retrieve hash-chained audit events |
| `client.connections.verifyAudit(connectionId?)` | `GET /v1/audit/verify` — verify cryptographic SHA-256 chain integrity |

### Agent Wallet & Metering (`client.agent`)

| Method | Description |
|--------|-------------|
| `client.agent.usage()` | `GET /v1/agent/account/usage` — current query count, egress bytes, and trial balance |
| `client.agent.wallet()` | `GET /v1/agent/wallet` — wallet balance and auto-reload config |
| `client.agent.topup(params)` | `POST /v1/agent/topup` — create a Stripe Checkout top-up session |

### SMART on FHIR & FHIR R4 (`client.smart`, `client.fhir`)

| Method | Description |
|--------|-------------|
| `client.smart.launch(params)` | `POST /v1/smart/launch` |
| `client.smart.registerClient(params)` | `POST /v1/smart/clients` |
| `client.smart.exchangeToken(params)` | `POST /oauth/token` (form-encoded; no API key) |
| `client.fhir.readPatient(patientId, accessToken?)` | `GET /fhir/R4/Patient/{id}` (uses SMART token or falls back to `apiKey`) |
| `client.fhir.search(resourceType, params?, environmentId?)` | Searches environment EHR patients or `/v1/sandbox/resources/{type}` |
| `client.fhir.metadata()` | `GET /fhir/R4/metadata` — FHIR R4 CapabilityStatement |

### Sandbox, HL7 & Webhooks (`client.sandbox`, `client.webhooks`)

| Method | Description |
|--------|-------------|
| `client.health()` | `GET /health` (no API key) |
| `client.sandbox.catalog(connectionId?)` | `GET /v1/sandbox/catalog` |
| `client.sandbox.domains()` / `domain(id)` | `GET /v1/sandbox/domains` |
| `client.sandbox.listSyntheticResources(type, connectionId?)` | `GET /v1/sandbox/resources/{type}` |
| `client.sandbox.resource(type, id, patientId?)` | `GET /v1/sandbox/resources/{type}/{id}` |
| `client.sandbox.runScenario(scenarioId, params?)` | `POST /v1/sandbox/scenarios/{id}/run` |
| `client.sandbox.hl7Templates()` / `injectHl7(params?)` | `GET /v1/sandbox/hl7/templates` · `POST /v1/sandbox/hl7/inject` |
| `client.webhooks.triggerMockEvent(params?)` | `POST /v1/webhooks/trigger-mock-event` |
| `client.webhooks.listDeliveries(params?)` / `replayDelivery(id)` | `GET /v1/webhooks/deliveries` · `POST /v1/webhooks/deliveries/{id}/replay` |
| `verifyWebhookSignature(rawBody, signature, secret)` | Constant-time HMAC-SHA256 webhook signature verification |

## Docs

Full integrator reference: [app.hebrah.com/docs/sdk](https://app.hebrah.com/docs/sdk).

## Examples

Runnable TypeScript snippets live in [`examples/`](./examples):

- [`catalog.ts`](./examples/catalog.ts) — fetch the sandbox catalog
- [`verify-webhook.ts`](./examples/verify-webhook.ts) — verify an `X-Hebrah-Signature`
- [`trigger-mock-event.ts`](./examples/trigger-mock-event.ts) — fire a mock event

## License

MIT

