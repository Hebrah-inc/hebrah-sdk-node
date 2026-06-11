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
  baseUrl: process.env.HEBRAH_API_BASE_URL // optional; defaults to https://api.hebrah.com
})

const patient = await client.patients.get('pat_00000000_01')
const catalog = await client.sandbox.catalog()

await client.webhooks.triggerMockEvent({
  event: 'patient.admitted',
  patientId: 'pat_00000000_01'
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

## API surface (v0.1)

| Method | Description |
|--------|-------------|
| `client.health()` | `GET /health` (no API key) |
| `client.sandbox.catalog(connectionId?)` | `GET /v1/sandbox/catalog` |
| `client.patients.list()` | `GET /v1/patients` |
| `client.patients.get(id)` | `GET /v1/patients/{id}` |
| `client.webhooks.triggerMockEvent({ event, patientId? })` | `POST /v1/webhooks/trigger-mock-event` |
| `verifyWebhookSignature(rawBody, signature, secret)` | Local HMAC-SHA256 verify |

## Local development

Point at hebrah-api on your machine:

```bash
export HEBRAH_API_BASE_URL=http://localhost:8000
export HEBRAH_API_KEY=hb_test_your_key
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
