# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |

## Reporting a vulnerability

Please report security issues privately to **security@hebrah.com**.

Include:

- A description of the issue and potential impact
- Steps to reproduce
- Affected SDK version(s)

We aim to acknowledge reports within 2 business days. Do not open public GitHub issues for undisclosed vulnerabilities.

## Scope

This SDK is a thin HTTP client for the hebrah control plane API. It does not store credentials; callers supply API keys and webhook secrets at runtime.
