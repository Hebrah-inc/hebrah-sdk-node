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

## API surface (v0.8)

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
| `client.webhooks.triggerMockEvent({ event?, patientId?, connectionId?, scenarioId? })` | `POST /v1/webhooks/trigger-mock-event` |
| `verifyWebhookSignature(rawBody, signature, secret)` | Local HMAC-SHA256 verify |

## Local development

Point at hebrah-api on your machine:

```bash
export HEBRAH_API_BASE_URL=http://localhost:8000
export HEBRAH_API_KEY=hb_test_your_key
export HEBRAH_CONNECTION_ID=conn-sa-your_connection_id
```

Start the control plane: `docker compose up --build` in the [hebrah-api](https://github.com/Hebrah-inc/hebrah-api) repo.

## Development

```bash
pnpm install
pnpm test
pnpm build
```

## Publishing

Tag releases as `sdk-node-v0.1.0` to trigger GitHub Actions publish to npm.

Set repository secret `NPM_TOKEN` with publish access to the `@hebrah` scope.

## Docs

Full integrator reference: [hebrah-app `/docs/sdk`](https://app.hebrah.com/docs/sdk) (dashboard developer docs).

## License

MIT
