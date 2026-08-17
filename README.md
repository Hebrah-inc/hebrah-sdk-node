# @hebrah/sdk

Official Node.js SDK for the [hebrah](https://hebrah.com) control plane API (hebrah-api).

## Install

```bash
npm install @hebrah/sdk
# or
pnpm add @hebrah/sdk
```

Requires **Node.js 18+** (native `fetch`).

## Quick start

```typescript
import { HebrahClient, verifyWebhookSignature } from '@hebrah/sdk'

const client = new HebrahClient({
  apiKey: process.env.HEBRAH_API_KEY!,
  baseUrl: process.env.HEBRAH_API_BASE_URL, // optional; defaults to https://api.hebrah.com
  defaultConnectionId: process.env.HEBRAH_CONNECTION_ID // optional; conn-sa-...
})

const catalog = await client.sandbox.catalog()
const patientId = catalog.sample_patient_ids[0]
const patient = await client.sandbox.resource('Patient', patientId)

await client.webhooks.triggerMockEvent({
  event: 'patient.admitted',
  patientId
})
```

> **v0.8:** `defaultConnectionId` is applied when sandbox methods omit `connectionId`. `client.patients.list()` / `get()` are deprecated — use `sandbox.listSyntheticResources('Patient')` or `sandbox.resource('Patient', id)` instead.

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
- `baseUrl` must be `https://` in production, or `http://localhost` / `http://127.0.0.1` for local dev — other `http://` hosts are rejected at construction to reduce API-key exfiltration risk.
- Treat `HebrahApiError.detail` as operator-only diagnostics. Do not log or return it to end users — it may contain internal paths or sensitive API error payloads. Set `includeErrorDetail: false` on `HebrahClient` to omit `detail` from errors.

See [SECURITY.md](./SECURITY.md) for supported versions and vulnerability reporting.

## API surface (v0.8)

### Sandbox & resources

| Method | Description |
|--------|-------------|
| `client.health()` | `GET /health` (no API key) |
| `client.sandbox.catalog(connectionId?)` | `GET /v1/sandbox/catalog` — uses `defaultConnectionId` when omitted |
| `client.sandbox.domains()` | `GET /v1/sandbox/domains` |
| `client.sandbox.domain(id)` | `GET /v1/sandbox/domains/{id}` |
| `client.sandbox.listSyntheticResources(type, connectionId?)` | `GET /v1/sandbox/resources/{type}` |
| `client.sandbox.resource(type, id, patientId?)` | `GET /v1/sandbox/resources/{type}/{id}` |
| `client.sandbox.runScenario(scenarioId, params?)` | `POST /v1/sandbox/scenarios/{id}/run` |
| `client.sandbox.getSyntheticEhrProfile(connectionId?)` | `GET /v1/sandbox/synthetic-ehr/profile` |
| `client.sandbox.listEhrModels()` | `GET /v1/sandbox/ehr-models` |
| `client.sandbox.resetSyntheticEhr(connectionId?)` | `POST /v1/sandbox/synthetic-ehr/reset` |
| `client.sandbox.payerRules(payerId)` | `GET /v1/sandbox/payer-rules/{id}` |
| `client.patients.list(connectionId?)` | **Deprecated** — `GET /v1/patients` |
| `client.patients.get(id, connectionId?)` | **Deprecated** — `GET /v1/patients/{id}` |

### HL7, webhooks, interop

| Method | Description |
|--------|-------------|
| `client.sandbox.hl7Templates()` | `GET /v1/sandbox/hl7/templates` |
| `client.sandbox.injectHl7(params?)` | `POST /v1/sandbox/hl7/inject` |
| `client.sandbox.configureWebhookReliability(profile)` | `PATCH /v1/sandbox/webhook-reliability` |
| `client.sandbox.runWebhookReliabilityScenario(scenarioId, params?)` | `POST /v1/sandbox/scenarios/{id}/run` (alias) |
| `client.sandbox.runMpiMatch(params?)` | `POST /v1/sandbox/mpi/match` |
| `client.sandbox.runAggregatorQuery(params)` | `POST /v1/sandbox/aggregator/query` |
| `client.sandbox.getPractitionerCredentialing(practitionerId)` | `GET /v1/sandbox/credentialing/practitioners/{id}` |
| `client.webhooks.triggerMockEvent({ event?, patientId?, connectionId?, scenarioId? })` | `POST /v1/webhooks/trigger-mock-event` |
| `client.webhooks.listDeliveries(params?)` | `GET /v1/webhooks/deliveries` |
| `client.webhooks.replayDelivery(deliveryId)` | `POST /v1/webhooks/deliveries/{id}/replay` |
| `verifyWebhookSignature(rawBody, signature, secret)` | Local HMAC-SHA256 verify |

### SMART & FHIR

| Method | Description |
|--------|-------------|
| `client.smart.launch(params)` | `POST /v1/smart/launch` |
| `client.smart.registerClient(params)` | `POST /v1/smart/clients` |
| `client.smart.exchangeToken(params)` | `POST /oauth/token` (form-encoded; no API key) |
| `client.fhir.readPatient(patientId, accessToken)` | `GET /fhir/R4/Patient/{id}` (SMART access token) |

### Advanced: BYOM agent harness

`HebrahAgentHarness` is exported for bring-your-own-model EHR workflows (MCP + integration-agent). It is **not** part of the core integrator quick start — see the [athena-model-agent demo](https://github.com/Hebrah-inc/hebrah-examples/tree/main/athena-model-agent-demo) for usage. Harness improvements are tracked separately from the core client.

## Docs

Full integrator reference: [hebrah-app `/docs/sdk`](https://app.hebrah.com/docs/sdk) (dashboard developer docs).

## Examples

Runnable TypeScript snippets live in [`examples/`](./examples):

- [`catalog.ts`](./examples/catalog.ts) — fetch the sandbox catalog
- [`verify-webhook.ts`](./examples/verify-webhook.ts) — verify an `X-Hebrah-Signature`
- [`trigger-mock-event.ts`](./examples/trigger-mock-event.ts) — fire a mock event

## License

MIT
