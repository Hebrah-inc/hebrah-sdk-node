# Contributing

Thanks for your interest in `@hebrah/sdk`! This is the official Node.js client
for the hebrah control plane API.

## Development setup

Requirements: Node.js 18+, pnpm 9+, and a local hebrah-api on port 8000 for
smoke testing.

```bash
git clone https://github.com/Hebrah-inc/hebrah-sdk-node.git
cd hebrah-sdk-node
pnpm install
```

No `.env` is needed for the SDK itself. For end-to-end smoke testing:

```bash
HEBRAH_API_BASE_URL=http://localhost:8000 \
HEBRAH_API_KEY=hb_test_your_key_here \
pnpm build && node scripts/smoke.mjs
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm build` | Bundle ESM + CJS with type declarations via `tsup` |
| `pnpm test` | Run `vitest` suite |
| `pnpm test:watch` | Watch-mode tests |
| `pnpm typecheck` | `tsc --noEmit` strict check |
| `pnpm prepublishOnly` | `build && test` (runs on `pnpm publish`) |

## Tests

`vitest` with HTTP mocking via `vi.mocked(fetch)`. Add a test next to the
file you are changing. Tests must not hit the network.

```bash
pnpm test
```

## Public API rules

- Public exports live in `src/index.ts`. Don't re-export internals.
- New methods on `HebrahClient` should match the corresponding
  `/v1/sandbox/*` (or `/v1/webhooks/*`, `/v1/smart/*`, `/fhir/R4/*`) endpoint
  and include the matching TypeScript type in `src/types.ts`.
- Method naming: `camelCase`, no abbreviations. Sandbox methods read, webhook
  / write methods act.
- Mark deprecated methods with `/** @deprecated … */` and a `DeprecationWarning`
  in the implementation; keep them working for at least one minor version.

## Pull request process

1. Fork the repository and create a feature branch.
2. Run `pnpm typecheck && pnpm test && pnpm build` — all three must pass.
3. Update `README.md` if you added or changed public methods.
4. Add a `## Unreleased` entry to `CHANGELOG.md`.
5. Open a PR. CI will run `typecheck`, `test`, `build`, and `pnpm audit
   --audit-level=high`.

## Coding style

- TypeScript strict mode, ESM-first, dual-published as ESM + CJS.
- No external runtime dependencies on a heavy HTTP framework — native `fetch`
  is fine.
- Prefer named exports over default exports.

## Adding a method

1. Add the implementation to the appropriate namespace file
   (`src/client.ts`, `src/webhooks.ts`, etc.).
2. Add the TypeScript request/response types to `src/types.ts`.
3. Re-export from `src/index.ts`.
4. Add tests in `test/` covering success, auth, and error paths.
5. Document in `README.md` under the relevant section.

## Reporting security issues

See [`SECURITY.md`](./SECURITY.md). Please report privately — do not open a
public issue.

## Releasing

Maintainers: see [`PUBLISHING.md`](./PUBLISHING.md) for the OIDC trusted
publishing flow. Releases are tag-driven (`sdk-node-vX.Y.Z`).

## License

By contributing, you agree that your contributions will be licensed under the
MIT License. See [`LICENSE`](./LICENSE).