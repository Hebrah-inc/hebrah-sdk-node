# Contributing to hebrah-sdk-node

Thanks for your interest in `@hebrah/sdk` — the official Node.js client
for the hebrah control plane API.

## Repo scope

This repo ships the official Node.js SDK for the Hebrah healthcare
connectivity platform — TypeScript types, an HTTP client, webhook
verification helpers, and a sandbox/resource harness.

| Path | Purpose |
|------|---------|
| `src/client.ts` | `HebrahClient` class — top-level entry point (mirrors `hebrah-sdk-python/src/hebrah/client.py`). |
| `src/http.ts` | Fetch-based HTTP transport (timeout, retry, error mapping). |
| `src/webhooks.ts` | `verifyWebhookSignature` helper. |
| `src/harness.ts` | Test-harness server (Stripe-style webhook replay). |
| `src/errors.ts` | Typed error hierarchy. |
| `src/types.ts` | Public types (sandbox, connection, patient, observation, …). |
| `src/index.ts` | Barrel export. |
| `test/` | Vitest suite. |
| `examples/` | Runnable TypeScript snippets (catalog, webhook verify, mock event trigger). |

It is **not** the control plane (see
[`hebrah-api`](https://github.com/Hebrah-inc/hebrah-api)) and it is **not**
the hosted MCP server (see
[`hebrah-mcp-host`](https://github.com/Hebrah-inc/hebrah-mcp-host)).

## Development setup

You need **Node 18 or newer** and **pnpm 9+**. No `.env` is needed for the
SDK itself.

```bash
git clone https://github.com/Hebrah-inc/hebrah-sdk-node.git
cd hebrah-sdk-node
pnpm install
```

For end-to-end smoke testing against a local control plane:

```bash
HEBRAH_API_BASE_URL=http://localhost:8000 \
HEBRAH_API_KEY=hb_test_your_key_here \
pnpm build && node scripts/smoke.mjs
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm build` | Bundle ESM + CJS with type declarations via `tsup` |
| `pnpm typecheck` | `tsc --noEmit` strict check |
| `pnpm test` | Run `vitest` suite |
| `pnpm test:watch` | Watch-mode tests |
| `pnpm prepublishOnly` | `build && test` (runs on `pnpm publish`) |

## Tests

`vitest` with HTTP mocking via `vi.mocked(fetch)`. Add a test next to the
file you are changing (`test/<module>.test.ts`). Tests must not hit the
network.

```bash
pnpm test
```

## Public API rules

- Public exports live in `src/index.ts`. Don't re-export internals.
- New methods on `HebrahClient` should match the corresponding
  `/v1/sandbox/*` (or `/v1/webhooks/*`, `/v1/smart/*`, `/fhir/R4/*`)
  endpoint and include the matching TypeScript type in `src/types.ts`.
- Method naming: `camelCase`, no abbreviations. Sandbox methods read,
  webhook / write methods act.
- Mark deprecated methods with `/** @deprecated … */` and a
  `DeprecationWarning` in the implementation; keep them working for at
  least one minor version.
- If the method has a counterpart in
  [`hebrah-sdk-python`](https://github.com/Hebrah-inc/hebrah-sdk-python),
  mirror its signature and error semantics — the two SDKs are designed
  to be drop-in equivalents across runtimes.

## Code style

- **TypeScript strict mode** — `pnpm typecheck` must exit 0.
- **ESM-first, dual-published as ESM + CJS** — `package.json` has
  `"type": "module"`. Do not introduce CJS-only dependencies.
- **No runtime deps** we don't need. Keep `dependencies` lean — every
  transitive dep ships to every consumer. `devDependencies` is fine for
  anything that doesn't end up in `dist/`.
- **No `any`** in public types. Use `unknown` + narrowing, or define a
  real interface.
- **JSDoc on every exported symbol** — `src/index.ts` is the public
  surface and IDE intellisense reads these comments. Keep them current.
- Prefer named exports over default exports.

## Adding a new method

1. Add the implementation to the appropriate namespace file
   (`src/client.ts`, `src/webhooks.ts`, etc.).
2. Add the public type to `src/types.ts`.
3. Re-export it from `src/index.ts`.
4. Add a vitest in `test/client.test.ts` that exercises the happy path
   *and* at least one error case (401, 4xx with detail, 5xx, network).
5. Run `pnpm typecheck && pnpm test && pnpm build`.
6. Update `README.md`'s method table.

## Adding a webhook event type

1. Add the type to `src/types.ts` (see `WebhookEvent` and friends).
2. Update `verifyWebhookSignature`'s overload to accept it.
3. Add a test in `test/client.test.ts` using the harness in
   `src/harness.ts`.
4. Update `README.md`'s webhooks section.

## Pull requests

1. Fork the repo and create a branch.
2. Run `pnpm typecheck && pnpm test` before pushing.
3. Keep PRs scoped — one method / one type / one fix per PR is easier
   to review.
4. Update `README.md` if you added or changed public methods.
5. Add a `## Unreleased` entry to `CHANGELOG.md`.
6. Reference any related issue or design doc.
7. CI runs `pnpm typecheck`, `pnpm test`, `pnpm build`, and
   `pnpm audit --audit-level=high`. PRs that break CI will be asked to
   fix before review.

## Release process

Releases are cut from `main` by the maintainers. The version in
`package.json` is bumped, a tag is created (`sdk-node-vX.Y.Z`), and the
publish pipeline (GitHub Actions, OIDC trusted publishing) pushes to npm.

Please don't bump versions or push tags yourself — just open the PR.
Maintainers: see [`PUBLISHING.md`](./PUBLISHING.md) for the full flow.

## Security disclosures

See [`SECURITY.md`](./SECURITY.md). Please report privately — do not
open a public issue.

## License

By contributing, you agree that your contributions will be licensed
under the MIT License. See [`LICENSE`](./LICENSE).