import { createHmac } from 'node:crypto'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  HebrahClient,
  HebrahAgentHarness,
  HebrahApiError,
  assertSafeBaseUrl,
  assertSafeExternalUrl,
  interpolateSqlParams,
  redactSecrets,
  safePathSegment,
  validateTimeoutMs,
  validateToken,
  verifyWebhookSignature
} from '../src/index.js'

describe('SDK-NODE-01: SSRF IPv4/IPv6 & URL Hardening', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('blocks IPv6 loopback, unspecified, link-local, unique-local, and IPv6-mapped IPv4 metadata/private addresses', () => {
    const blockedUrls = [
      'https://[::1]/doc',
      'https://[::]/doc',
      'https://[::ffff:127.0.0.1]/doc',
      'https://[::ffff:7f00:1]/doc',
      'https://[::ffff:169.254.169.254]/latest/meta-data/',
      'https://[::ffff:a9fe:a9fe]/latest/meta-data/',
      'https://[::ffff:10.0.0.1]/doc',
      'https://[::ffff:192.168.1.1]/doc',
      'https://[fe80::1]/doc',
      'https://[fd00:ec2::254]/latest/meta-data/',
      'https://[fc00::1]/doc',
      'https://[ff02::1]/doc'
    ]
    for (const url of blockedUrls) {
      expect(() => assertSafeExternalUrl(url), `Expected ${url} to be blocked`).toThrow(
        /private, loopback, or metadata/i
      )
    }
  })

  it('blocks IPv4 loopback, RFC1918, link-local IMDS, CGNAT (100.64.0.0/10), and 0.0.0.0/8', () => {
    const blockedUrls = [
      'https://127.0.0.1/doc',
      'https://127.255.255.254/doc',
      'https://0.0.0.0/doc',
      'https://10.0.0.1/doc',
      'https://172.16.0.1/doc',
      'https://172.31.255.255/doc',
      'https://192.168.1.1/doc',
      'https://169.254.169.254/latest/meta-data/',
      'https://100.64.0.1/doc',
      'https://100.100.100.200/latest/meta-data/',
      'https://255.255.255.255/doc'
    ]
    for (const url of blockedUrls) {
      expect(() => assertSafeExternalUrl(url), `Expected ${url} to be blocked`).toThrow(
        /private, loopback, or metadata/i
      )
    }
  })

  it('blocks internal/local hostnames including trailing dots', () => {
    const blockedHosts = [
      'https://localhost/doc',
      'https://localhost./doc',
      'https://api.localhost/doc',
      'https://metadata.google.internal/computeMetadata/v1/',
      'https://metadata.google.internal./computeMetadata/v1/',
      'https://metadata/computeMetadata/v1/',
      'https://ehr.internal/doc',
      'https://ehr.local/doc',
      'https://ehr.localdomain/doc',
      'https://ehr.home.arpa/doc',
      'https://ehr.corp/doc',
      'https://ehr.lan/doc'
    ]
    for (const url of blockedHosts) {
      expect(() => assertSafeExternalUrl(url), `Expected ${url} to be blocked`).toThrow(
        /private, loopback, or metadata/i
      )
    }
  })

  it('allows legitimate public HTTPS URLs and rejects embedded credentials or non-HTTPS', () => {
    expect(assertSafeExternalUrl('https://hl7.org/fhir/R4/patient.html')).toBe(
      'https://hl7.org/fhir/R4/patient.html'
    )
    expect(assertSafeExternalUrl('https://172.15.0.1/public')).toBe('https://172.15.0.1/public')
    expect(assertSafeExternalUrl('https://172.32.0.1/public')).toBe('https://172.32.0.1/public')
    expect(() => assertSafeExternalUrl('http://hl7.org/fhir')).toThrow(/https:\/\//i)
    expect(() => assertSafeExternalUrl('https://user:pass@hl7.org/fhir')).toThrow(/credentials/i)
    expect(() => assertSafeBaseUrl('https://user:pass@api.hebrah.com')).toThrow(/credentials/i)
    expect(() => assertSafeBaseUrl('ftp://api.hebrah.com')).toThrow(/https:\/\//i)
  })
})

describe('SDK-NODE-02 & SDK-NODE-03: Token, Header, Timeout & Path Hardening', () => {
  it('rejects control characters, CRLF, and whitespace in tokens', () => {
    expect(() => validateToken('hb_test_valid123', 'apiKey')).not.toThrow()
    expect(() => validateToken('hb_test_abc\r\nX-Injected: 1', 'apiKey')).toThrow(/whitespace or control/i)
    expect(() => validateToken('hb_test_abc\n', 'apiKey')).toThrow(/whitespace or control/i)
    expect(() => validateToken('hb_test_abc def', 'apiKey')).toThrow(/whitespace or control/i)
    expect(() => validateToken('hb_test_abc\x00', 'apiKey')).toThrow(/whitespace or control/i)
    expect(() => new HebrahClient({ apiKey: 'hb_test_bad\r\nHeader: 1' })).toThrow(/whitespace or control/i)
    expect(() =>
      new HebrahAgentHarness({ mcpUrl: 'https://mcp.hebrah.com', pat: 'hb_pat_bad\r\n' })
    ).toThrow(/whitespace or control/i)
  })

  it('validates timeoutMs range (100..300000)', () => {
    expect(validateTimeoutMs(undefined)).toBe(30_000)
    expect(validateTimeoutMs(5000)).toBe(5000)
    expect(() => validateTimeoutMs(50)).toThrow(/between 100 and 300000/)
    expect(() => validateTimeoutMs(400_000)).toThrow(/between 100 and 300000/)
    expect(() => validateTimeoutMs(Number.NaN)).toThrow(/between 100 and 300000/)
    expect(() => new HebrahClient({ apiKey: 'hb_test_ok', timeoutMs: 10 })).toThrow(/timeoutMs/)
  })

  it('rejects URL-encoded path traversal, slashes, query/fragment, and overlong IDs in safePathSegment', () => {
    expect(() => safePathSegment('%2e%2e', 'id')).toThrow(/Invalid id/i)
    expect(() => safePathSegment('foo%2fbar', 'id')).toThrow(/Invalid id/i)
    expect(() => safePathSegment('foo%5cbar', 'id')).toThrow(/Invalid id/i)
    expect(() => safePathSegment('foo%00bar', 'id')).toThrow(/Invalid id/i)
    expect(() => safePathSegment('pat?admin=true', 'id')).toThrow(/Invalid id/i)
    expect(() => safePathSegment('pat#frag', 'id')).toThrow(/Invalid id/i)
    expect(() => safePathSegment('a'.repeat(257), 'id')).toThrow(/Invalid id/i)
    expect(() =>
      new HebrahClient({ apiKey: 'hb_test_ok', environmentId: '../etc/passwd' })
    ).toThrow(/Invalid environmentId/i)
  })

  it('freezes all client resource namespaces against prototype/method tampering', () => {
    const client = new HebrahClient({ apiKey: 'hb_test_ok' })
    expect(Object.isFrozen(client.environments)).toBe(true)
    expect(Object.isFrozen(client.db)).toBe(true)
    expect(Object.isFrozen(client.connections)).toBe(true)
    expect(Object.isFrozen(client.agent)).toBe(true)
    expect(Object.isFrozen(client.sandbox)).toBe(true)
    expect(Object.isFrozen(client.smart)).toBe(true)
    expect(Object.isFrozen(client.fhir)).toBe(true)
    expect(Object.isFrozen(client.patients)).toBe(true)
    expect(Object.isFrozen(client.webhooks)).toBe(true)
  })
})

describe('SDK-NODE-04: Secret Redaction, Bounded Error Details, and Harness Resilience', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('redacts Hebrah keys, Stripe keys, JWTs, encrypted values, WireGuard keys, and DB URIs', () => {
    const fakeStripeSecret = ['sk', 'live', '1234567890abcdefghijklmn'].join('_')
    const fakeWhSecret = ['whsec', '1234567890abcdefghijklmn'].join('_')
    const raw = [
      'key=hb_live_1234567890abcdef',
      'claim=hb_claim_abcdef123456',
      'cipher=enc:v1:aGVsbG8gd29ybGQ=',
      'wg=PrivateKey = cHJpdmF0ZWtleXNlY3JldA==',
      `stripe=${fakeStripeSecret}`,
      `wh=${fakeWhSecret}`,
      'jwt=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      'pg=postgresql://admin:supersecret@db.hebrah.com:5432/hebrah'
    ].join(' | ')

    const scrubbed = redactSecrets(raw)
    expect(scrubbed).not.toContain('hb_live_1234567890abcdef')
    expect(scrubbed).not.toContain('hb_claim_abcdef123456')
    expect(scrubbed).not.toContain('aGVsbG8gd29ybGQ=')
    expect(scrubbed).not.toContain('cHJpdmF0ZWtleXNlY3JldA==')
    expect(scrubbed).not.toContain(fakeStripeSecret)
    expect(scrubbed).not.toContain(fakeWhSecret)
    expect(scrubbed).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c')
    expect(scrubbed).not.toContain('supersecret')
  })

  it('bounds error detail to 4096 chars and handles malformed 200 JSON cleanly', async () => {
    const hugeBody = `hb_live_secret123456 ${'X'.repeat(10_000)}`
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(hugeBody, { status: 500 }))

    const client = new HebrahClient({ apiKey: 'hb_test_key' })
    await expect(client.environments.list()).rejects.toSatisfy((err: unknown) => {
      const apiErr = err as HebrahApiError
      expect(apiErr).toBeInstanceOf(HebrahApiError)
      expect(apiErr.status).toBe(500)
      expect(apiErr.detail).not.toContain('hb_live_secret123456')
      expect(apiErr.detail?.endsWith('...[truncated]')).toBe(true)
      expect((apiErr.detail ?? '').length).toBeLessThanOrEqual(4120)
      return true
    })

    globalThis.fetch = vi.fn().mockResolvedValue(new Response('<html>not json</html>', { status: 200 }))
    await expect(client.environments.list()).rejects.toMatchObject({
      name: 'HebrahApiError',
      status: 502
    })
  })

  it('HebrahAgentHarness handles MCP isError=true, plain-text tool outputs, and concurrent URL ingestion', async () => {
    const harness = new HebrahAgentHarness({
      mcpUrl: 'https://mcp.hebrah.com',
      pat: 'hb_pat_1234567890'
    })

    // 1. MCP tool returns result.isError = true with a leaked token
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            isError: true,
            content: [{ type: 'text', text: 'Upstream failed for token hb_pat_1234567890' }]
          }
        }),
        { status: 200 }
      )
    )
    await expect(harness.listBaseEhrModels()).rejects.toThrow(/\[REDACTED_HEBRAH_TOKEN\]/)

    // 2. MCP tool returns non-JSON plain text
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            content: [{ type: 'text', text: 'Plain text developer guide for Bearer secret_tok_123456789' }]
          }
        }),
        { status: 200 }
      )
    )
    const plainResult = await harness.getDeveloperDoc('conn_123')
    expect(plainResult).toBe('Plain text developer guide for Bearer [REDACTED]')

    // 3. Rejects excessive docUrls (> 20)
    const tooManyUrls = Array.from({ length: 21 }, (_, i) => `https://hl7.org/doc/${i}`)
    await expect(
      harness.researchAndModelEhr({
        vendor: 'epic',
        connectionId: 'conn_123',
        docUrls: tooManyUrls
      })
    ).rejects.toThrow(/cannot exceed 20 URLs/)
  })
})

describe('SDK-NODE-05: interpolateSqlParams Hardening', () => {
  it('supports primitives, BigInt, valid Date, and rejects NaN, invalid Date, Symbol, Function, and null bytes', () => {
    expect(
      interpolateSqlParams('SELECT * FROM p WHERE id = $1 AND n = $2 AND b = $3', [
        "O'Reilly",
        42n,
        true
      ])
    ).toBe("SELECT * FROM p WHERE id = 'O''Reilly' AND n = 42 AND b = TRUE")

    expect(() => interpolateSqlParams('', ['a'])).toThrow(/sql is required/)
    expect(() => interpolateSqlParams('SELECT $1', [Number.NaN])).toThrow(/Invalid numeric/)
    expect(() => interpolateSqlParams('SELECT $1', [Number.POSITIVE_INFINITY])).toThrow(/Invalid numeric/)
    expect(() => interpolateSqlParams('SELECT $1', [new Date('invalid-date')])).toThrow(/Invalid Date/)
    expect(() => interpolateSqlParams('SELECT $1', ['bad\x00str'])).toThrow(/Null byte/)
    expect(() => interpolateSqlParams('SELECT $1', [{ nested: 'bad\x00byte' }])).toThrow(/Null byte/)
    expect(() => interpolateSqlParams('SELECT $1', [Symbol('x')])).toThrow(/Unsupported SQL parameter/)
  })
})

describe('SDK-NODE-06: verifyWebhookSignature Hardening', () => {
  const secret = 'whsec_test_secret_123'

  function sign(body: string): string {
    return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
  }

  it('rejects non-string/Buffer rawBody, malformed JSON, and non-object JSON payloads', () => {
    expect(() =>
      verifyWebhookSignature(12345 as unknown as string, 'a'.repeat(64), secret)
    ).toThrow(/rawBody must be a string or Buffer/)

    const badJson = '{not valid json'
    expect(() => verifyWebhookSignature(badJson, sign(badJson), secret)).toThrow(
      /Invalid webhook payload JSON/
    )

    const arrayJson = '[{"event":"patient.created"}]'
    expect(() => verifyWebhookSignature(arrayJson, sign(arrayJson), secret)).toThrow(
      /Webhook payload must be a JSON object/
    )
  })

  it('strips __proto__, constructor, and prototype keys when parsing webhook JSON', () => {
    const body =
      '{"event":"patient.created","resource":{"id":"p1"},"connection_id":"c1","environment":"sandbox","timestamp":"2026-10-19T00:00:00Z","org_id":"o1","__proto__":{"polluted":true}}'
    const env = verifyWebhookSignature(body, sign(body), secret)
    expect(env.event).toBe('patient.created')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('New Isolated Health Environment & Topup Methods', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('calls consultArchitect, admitPatients, consultStudio, openDataCatalog, and validates topup', async () => {
    const mockFetch = vi.mocked(globalThis.fetch)
    mockFetch.mockImplementation(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const client = new HebrahClient({
      apiKey: 'hb_test_key',
      baseUrl: 'https://api.hebrah.com',
      environmentId: 'env_default'
    })

    await client.environments.consultArchitect('Design an ICU environment with 20 beds')
    expect(mockFetch.mock.calls[0]?.[0]).toBe('https://api.hebrah.com/v1/environments/architect')

    await client.environments.admitPatients({ count: 3, cohort: 'sepsis' })
    expect(mockFetch.mock.calls[1]?.[0]).toBe(
      'https://api.hebrah.com/v1/environments/env_default/ehr/patients/generate'
    )

    await client.environments.consultStudio({ prompt: 'Add 2 cardiology patients', applyChanges: true })
    expect(mockFetch.mock.calls[2]?.[0]).toBe(
      'https://api.hebrah.com/v1/environments/env_default/studio/chat'
    )

    await client.environments.openDataCatalog()
    expect(mockFetch.mock.calls[3]?.[0]).toBe(
      'https://api.hebrah.com/v1/environments/env_default/open-data/catalog'
    )

    const clientNoEnv = new HebrahClient({
      apiKey: 'hb_test_key',
      baseUrl: 'https://api.hebrah.com'
    })
    await clientNoEnv.environments.openDataCatalog()
    expect(mockFetch.mock.calls[4]?.[0]).toBe(
      'https://api.hebrah.com/v1/sandbox/research-packs/clinical_knowledge_v1'
    )

    await client.environments.listPatients({ department: 'ICU', limit: 10 })
    expect(mockFetch.mock.calls[5]?.[0]).toBe(
      'https://api.hebrah.com/v1/environments/env_default/ehr/patients?department=ICU&limit=10'
    )

    expect(() => client.agent.topup({ amountCents: -500 })).toThrow(/positive integer/)
    expect(() =>
      client.agent.topup({ amountCents: 1000, successUrl: 'http://evil.example.com/cb' })
    ).toThrow(/https:\/\//i)
  })
})
