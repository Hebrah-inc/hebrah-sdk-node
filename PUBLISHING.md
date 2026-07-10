# Publishing @hebrah/sdk

## Prerequisites

1. npm account with publish access to the `@hebrah` scope (create the org on npm if needed).
2. **Preferred:** npm [trusted publishing](https://docs.npmjs.com/trusted-publishers) (OIDC) linked to `Hebrah-inc/hebrah-sdk-node` on the `@hebrah/sdk` package, using the `npm` GitHub Environment.
3. **Fallback:** set repository variable `PUBLISH_WITH_NPM_TOKEN=true` and add `NPM_TOKEN` as a secret on the `npm` environment.

## Release

```bash
git tag sdk-node-v0.8.0
git push origin main
git push origin sdk-node-v0.8.0
```

GitHub Actions (`.github/workflows/ci.yml`) runs tests and publishes on tags matching `sdk-node-v*`.

### Publish authentication

| Mode | Setup |
|------|--------|
| OIDC (default) | Configure npm trusted publishing; leave `PUBLISH_WITH_NPM_TOKEN` unset or `false` |
| NPM token fallback | Set repo variable `PUBLISH_WITH_NPM_TOKEN=true` and `NPM_TOKEN` secret on the `npm` environment |

Do not set `NODE_AUTH_TOKEN` unconditionally when using OIDC — an empty `NPM_TOKEN` overrides setup-node's OIDC token and breaks publish.

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
2. Create GitHub Environment `npm` on `Hebrah-inc/hebrah-sdk-node`.
3. Add trusted publishing: npm package settings → **Publishing access** → link GitHub repo `Hebrah-inc/hebrah-sdk-node`, workflow `CI`, environment `npm`.
4. Confirm the GitHub repo is public (referenced in `package.json` `repository`).
5. Push tag `sdk-node-v0.8.0` and verify the package appears at `https://www.npmjs.com/package/@hebrah/sdk`.
