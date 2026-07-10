import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HebrahClient, HebrahApiError, verifyWebhookSignature } from '../src/index.js'
import { resolveBaseUrl } from '../src/http.js'

const BASE = 'https://api.test.local'

describe('HebrahClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.HEBRAH_API_BASE_URL
  })

  it('requires apiKey', () => {
    expect(() => new HebrahClient({ apiKey: '' })).toThrow('apiKey is required')
  })

  it('allows https baseUrl', () => {
    expect(() => new HebrahClient({ apiKey: 'hb_test_key', baseUrl: 'https://api.hebrah.com' })).not.toThrow()
  })

  it('allows http localhost baseUrl', () => {
    expect(() => new HebrahClient({ apiKey: 'hb_test_key', baseUrl: 'http://localhost:8000' })).not.toThrow()
  })

  it('rejects non-local http baseUrl', () => {
    expect(() => new HebrahClient({ apiKey: 'hb_test_key', baseUrl: 'http://evil.example.com' })).toThrow(
      /baseUrl must use https/
    )
  })

  it('fetches sandbox catalog', async () => {
    const catalog = {
      org_id: 'org-1',
      org_name: 'Acme',
      connection_id: 'conn-sa-1',
      environment: 'sandbox',
      sample_patient_ids: ['pat_01'],
      supported_events: ['patient.admitted'],
      example_patient_response: {},
      example_webhook_envelope: {}
    }

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(catalog), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const result = await client.sandbox.catalog()

    expect(result).toEqual(catalog)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/sandbox/catalog`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer hb_test_key'
        })
      })
    )
  })

  it('encodes special characters in sandbox domain path', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'foo/bar' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await client.sandbox.domain('foo/bar')

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/sandbox/domains/foo%2Fbar`,
      expect.any(Object)
    )
  })

  it('gets a patient by id', async () => {
    const patient = { resourceType: 'Patient', id: 'pat_01' }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(patient), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const result = await client.patients.get('pat_01')

    expect(result).toEqual(patient)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/patients/pat_01`,
      expect.any(Object)
    )
  })

  it('throws HebrahApiError with detail on HTTP errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not found', { status: 404 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    try {
      await client.patients.get('bad')
      expect.fail('expected HebrahApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(HebrahApiError)
      const apiErr = err as HebrahApiError
      expect(apiErr.status).toBe(404)
      expect(apiErr.detail).toBe('not found')
    }
  })

  it('omits error detail when includeErrorDetail is false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not found', { status: 404 })
    )

    const client = new HebrahClient({
      apiKey: 'hb_test_key',
      baseUrl: BASE,
      includeErrorDetail: false
    })
    try {
      await client.patients.get('bad')
      expect.fail('expected HebrahApiError')
    } catch (err) {
      expect(err).toBeInstanceOf(HebrahApiError)
      const apiErr = err as HebrahApiError
      expect(apiErr.status).toBe(404)
      expect(apiErr.detail).toBeUndefined()
    }
  })

  it('health() does not send Authorization header', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await client.health()

    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.Authorization).toBeUndefined()
  })

  it('triggers mock webhook event', async () => {
    const body = {
      status: 'queued',
      event: 'patient.admitted',
      patient_id: 'pat_01',
      connection_id: 'conn-sa-1',
      envelope_preview: {}
    }
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status: 202 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const result = await client.webhooks.triggerMockEvent({
      event: 'patient.admitted',
      patientId: 'pat_01'
    })

    expect(result.status).toBe('queued')
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    expect(init?.method).toBe('POST')
    expect(init?.body).toContain('patient.admitted')
  })

  it('smart.launch sends API key Bearer', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ launch_url: 'https://example.com' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await client.smart.launch({ patientId: 'pat_01' })

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/smart/launch`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer hb_test_key'
        })
      })
    )
  })

  it('smart.registerClient posts to /v1/smart/clients with API key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ client_id: 'app-1' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await client.smart.registerClient({
      clientId: 'app-1',
      redirectUris: ['https://app.example/callback']
    })

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/smart/clients`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer hb_test_key'
        })
      })
    )
  })

  it('smart.exchangeToken posts to /oauth/token without API key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'tok', token_type: 'Bearer' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await client.smart.exchangeToken({
      code: 'auth-code',
      redirectUri: 'https://app.example/callback',
      clientId: 'app-1',
      codeVerifier: 'verifier'
    })

    const [url, init] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe(`${BASE}/oauth/token`)
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(headers.Authorization).toBeUndefined()
  })

  it('fhir.readPatient uses SMART access token not API key', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ resourceType: 'Patient', id: 'pat_01' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await client.fhir.readPatient('pat_01', 'smart-access-token')

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/fhir/R4/Patient/pat_01`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer smart-access-token'
        })
      })
    )
    const [, init] = vi.mocked(fetch).mock.calls[0]!
    const headers = init?.headers as Record<string, string>
    expect(headers.Authorization).not.toContain('hb_test_key')
  })
})

describe('resolveBaseUrl', () => {
  afterEach(() => {
    delete process.env.HEBRAH_API_BASE_URL
  })

  it('uses explicit baseUrl when provided', () => {
    expect(resolveBaseUrl('https://custom.example/')).toBe('https://custom.example')
  })

  it('falls back to HEBRAH_API_BASE_URL env var', () => {
    process.env.HEBRAH_API_BASE_URL = 'http://localhost:8000/'
    expect(resolveBaseUrl()).toBe('http://localhost:8000')
  })

  it('rejects unsafe http env baseUrl', () => {
    process.env.HEBRAH_API_BASE_URL = 'http://evil.example.com'
    expect(() => resolveBaseUrl()).toThrow(/baseUrl must use https/)
  })
})

describe('verifyWebhookSignature', () => {
  it('verifies valid signatures', () => {
    const secret = 'hbsec_test'
    const payload = { event: 'patient.admitted', connection_id: 'conn-1' }
    const raw = Buffer.from(JSON.stringify(payload))
    const signature = createHmac('sha256', secret).update(raw).digest('hex')

    const parsed = verifyWebhookSignature(raw, signature, secret)
    expect(parsed.event).toBe('patient.admitted')
  })

  it('rejects invalid signatures', () => {
    const raw = Buffer.from('{}')
    expect(() => verifyWebhookSignature(raw, 'bad', 'hbsec_test')).toThrow(
      'Invalid webhook signature'
    )
  })

  it('rejects missing signature header', () => {
    const raw = Buffer.from('{}')
    expect(() => verifyWebhookSignature(raw, null, 'hbsec_test')).toThrow(
      'Missing X-Hebrah-Signature header'
    )
    expect(() => verifyWebhookSignature(raw, undefined, 'hbsec_test')).toThrow(
      'Missing X-Hebrah-Signature header'
    )
  })

  it('rejects wrong-length signatures', () => {
    const secret = 'hbsec_test'
    const raw = Buffer.from('{}')
    const signature = createHmac('sha256', secret).update(raw).digest('hex')
    const truncated = signature.slice(0, -2)

    expect(() => verifyWebhookSignature(raw, truncated, secret)).toThrow(
      'Invalid webhook signature'
    )
  })
})
