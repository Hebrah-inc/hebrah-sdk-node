# Contributing to hebrah-sdk-node

Thanks for your interest in the Hebrah Node.js SDK.

## Repo scope

This repo ships the official Node.js SDK for the Hebrah healthcare
connectivity platform — TypeScript types, an HTTP client, webhook
verification helpers, and a sandbox/resource harness.

| Path | Purpose |
|------|---------|
| `src/client.ts` | `Hebrah` class — top-level entry point (mirrors `hebrah-sdk-python/src/hebrah/client.py`). |
| `src/http.ts` | Fetch-based HTTP transport (timeout, retry, error mapping). |
| `src/webhooks.ts` | `verifyWebhookSignature` helper. |
| `src/harness.ts` | Test-harness server (Stripe-style webhook replay). |
| `src/errors.ts` | Typed error hierarchy. |
| `src/types.ts` | Public types (sandbox, connection, patient, observation, …). |
| `src/index.ts` | Barrel export. |
| `test/` | Vitest suite (22 tests covering auth, error mapping, webhooks). |

It is **not** the control plane (see
[`hebrah-api`](https://github.com/Hebrah-inc/hebrah-api)) and it is **not**
the hosted MCP server (see
[`hebrah-mcp-host`](https://github.com/Hebrah-inc/hebrah-mcp-host)).

## Development setup

You need **Node 18 or newer** and **pnpm**.

```bash
pnpm install
pnpm test         # vitest run
pnpm typecheck    # tsc --noEmit
pnpm build        # tsup → dist/
```

> We use [pnpm](https://pnpm.io/) for reproducible installs. `npm`/`yarn`
> will work for development but may produce slightly different
> lockfiles; the CI runs `pnpm` only.

## Code style

- **TypeScript strict mode** — `pnpm typecheck` must exit 0.
- **ESM** — `package.json` has `"type": "module"`. Do not introduce CJS-only
  dependencies.
- **No runtime deps** we don't need. Keep `dependencies` lean — every
  transitive dep ships to every consumer. `devDependencies` is fine for
  anything that doesn't end up in `dist/`.
- **No `any`** in public types. Use `unknown` + narrowing, or define a
  real interface.
- **JSDoc on every exported symbol** — `src/index.ts` is the public surface
  and IDE intellisense reads these comments. Keep them current.

## Adding a new method

1. Add the implementation to `src/client.ts` (or whichever module fits).
2. Add the public type to `src/types.ts`.
3. Export it from `src/index.ts`.
4. Add a vitest in `test/client.test.ts` that exercises the happy path
   *and* at least one error case (401, 4xx with detail, 5xx, network).
5. Run `pnpm test && pnpm typecheck && pnpm build`.
6. Update the README's method table.

If the method has a counterpart in [`hebrah-sdk-python`](https://github.com/Hebrah-inc/hebrah-sdk-python),
mirror its signature and error semantics — the two SDKs are designed
to be drop-in equivalents across runtimes.

## Adding a webhook event type

1. Add the type to `src/types.ts` (see `WebhookEvent` and friends).
2. Update `verifyWebhookSignature`'s overload to accept it.
3. Add a test in `test/client.test.ts` using the harness in
   `src/harness.ts`.
4. Update `README.md`'s webhooks section.

## Pull requests

1. Fork the repo and create a branch.
2. Run `pnpm test && pnpm typecheck` before pushing.
3. Keep PRs scoped — one method / one type / one fix per PR is easier
   to review.
4. Reference any related issue or design doc.
5. CI runs `pnpm test`, `pnpm typecheck`, and a `pnpm build` smoke
   check. PRs that break CI will be asked to fix before review.

## Release process

Releases are cut from `main` by the maintainers. The version in
`package.json` is bumped, a tag is created (`vX.Y.Z`), and the publish
pipeline (GitHub Actions) pushes to npm.

Please don't bump versions or push tags yourself — just open the PR.

## Security disclosures

See [SECURITY.md](./SECURITY.md). **Please don't** file public issues
for security bugs — email security@hebrah.com instead.