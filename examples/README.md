# `@hebrah/sdk` examples

Runnable TypeScript snippets that exercise the most common control-plane
endpoints. Every example reads its credentials from environment variables
(never hard-coded) and exits non-zero if a required var is missing.

| File | What it shows |
|------|---------------|
| `catalog.ts` | Connect, fetch the sandbox catalog, print org + connection + sample IDs. |
| `verify-webhook.ts` | Verify an `X-Hebrah-Signature` header against a raw body using `verifyWebhookSignature`. |
| `trigger-mock-event.ts` | Trigger a mock webhook event against a sandbox connection. |

## Running

The examples import from `../dist/index.js`, so build the SDK first:

```bash
pnpm install
pnpm build
```

Then run any example with [`tsx`](https://tsx.is):

```bash
HEBRAH_API_KEY=hb_test_your_key \
HEBRAH_API_BASE_URL=http://localhost:8000 \
pnpm dlx tsx examples/catalog.ts
```

Each example documents its own required environment variables and optional
overrides.

## Pointing at staging vs local

- Local dev (hebrah-api on `:8000`): `HEBRAH_API_BASE_URL=http://localhost:8000`
- Staging: omit `HEBRAH_API_BASE_URL` (defaults to `https://api.hebrah.com`)