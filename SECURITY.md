# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.8.x   | Yes       |

## Reporting a vulnerability

Please report security issues privately to **security@hebrah.com**.

Include:

- A description of the issue and potential impact
- Steps to reproduce
- Affected SDK version(s)

We aim to acknowledge reports within 2 business days. Do not open public GitHub issues for undisclosed vulnerabilities.

## Scope

This SDK is a thin HTTP client for the hebrah control plane API. It does not store credentials; callers supply API keys and webhook secrets at runtime.

## Integrator guidance

- Keep `HEBRAH_API_KEY`, `HEBRAH_WEBHOOK_SECRET`, and MCP PATs in server-side environment variables or a secrets manager — never in client-side code, browser bundles, or committed `.env` files.
- Do not log API keys, webhook secrets, or raw webhook payloads containing PHI.
- `HebrahApiError.detail` contains the raw control-plane response body for operator diagnostics. Do not return or log `detail` to end users or untrusted clients. Pass `includeErrorDetail: false` to `HebrahClient` to omit `detail` from thrown errors.
- `baseUrl` must use `https://` or `http://localhost` / `http://127.0.0.1` for local development; other `http://` hosts are rejected at client construction.
- The SDK holds credentials only in memory for the lifetime of a `HebrahClient` instance; it does not write them to disk or cache them.
