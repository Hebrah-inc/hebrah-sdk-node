# Publishing @hebrah/sdk

## Prerequisites

1. npm account with publish access to the `@hebrah` scope (create the org on npm if needed).
2. Repository secret `NPM_TOKEN` (Automation token with publish permission).

## Release

```bash
git tag sdk-node-v0.1.0
git push origin main
git push origin sdk-node-v0.1.0
```

GitHub Actions (`.github/workflows/ci.yml`) runs tests and publishes on tags matching `sdk-node-v*`.

Configure npm **trusted publishing** (OIDC) for this repository, or set the `NPM_TOKEN` repository secret with publish access to the `@hebrah` scope.

## Local publish (optional)

```bash
pnpm build && pnpm test
npm login
npm publish --access public
```

## Smoke test after publish

```bash
npm install @hebrah/sdk
HEBRAH_API_BASE_URL=http://localhost:8000 HEBRAH_API_KEY=hb_test_your_key node scripts/smoke.mjs
```
