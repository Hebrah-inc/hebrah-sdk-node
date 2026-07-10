# Publishing @hebrah/sdk

## Prerequisites

1. npm account with publish access to the `@hebrah` scope (create the org on npm if needed).
2. **Preferred:** npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) linked to `Hebrah-inc/hebrah-sdk-node` on the `@hebrah/sdk` package.
3. **Fallback:** repository secret `NPM_TOKEN` (Automation token with publish permission) if OIDC is not yet configured.

## Release

```bash
git tag sdk-node-v0.8.0
git push origin main
git push origin sdk-node-v0.8.0
```

GitHub Actions (`.github/workflows/ci.yml`) runs tests and publishes on tags matching `sdk-node-v*`.

The publish job uses OIDC trusted publishing with npm provenance when configured on npmjs.com. If trusted publishing is not set up, add the `NPM_TOKEN` repository secret and the workflow will fall back to it.

## Local publish (optional)

```bash
pnpm build && pnpm test
npm login
npm publish --access public
```

## Smoke test after publish

```bash
npm install @hebrah/sdk@0.8.0
HEBRAH_API_BASE_URL=http://localhost:8000 HEBRAH_API_KEY=hb_test_your_key node scripts/smoke.mjs
```

## First-time npm setup checklist

1. Create the `@hebrah` org on [npmjs.com](https://www.npmjs.com/org/create) if it does not exist.
2. Add trusted publishing: npm package settings → **Publishing access** → link GitHub repo `Hebrah-inc/hebrah-sdk-node`, workflow `CI`, environment `npm` (or tag-based).
3. Confirm the GitHub repo is public (referenced in `package.json` `repository`).
4. Push tag `sdk-node-v0.8.0` and verify the package appears at `https://www.npmjs.com/package/@hebrah/sdk`.
