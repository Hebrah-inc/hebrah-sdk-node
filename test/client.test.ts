import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HebrahClient,
  HebrahApiError,
  HebrahAgentHarness,
  verifyWebhookSignature,
  safePathSegment
} from '../src/index.js'
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

  it('fhir.readPatient uses SMART access token when provided, or falls back to apiKey', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resourceType: 'Patient', id: 'pat_01' }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resourceType: 'Patient', id: 'pat_02' }), { status: 200 })
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

    await client.fhir.readPatient('pat_02')
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${BASE}/fhir/R4/Patient/pat_02`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer hb_test_key'
        })
      })
    )
  })

  it('fhir.search routes Patient to environment EHR when environmentId is configured', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'pat-1', name: 'Elena' }]), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE, environmentId: 'env-123' })
    const res = await client.fhir.search('Patient', { status: 'active' })

    expect(res).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/environments/env-123/ehr/patients`,
      expect.any(Object)
    )
  })

  it('fhir.metadata calls /fhir/R4/metadata', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ resourceType: 'CapabilityStatement', fhirVersion: '4.0.1' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const meta = await client.fhir.metadata()

    expect(meta.fhirVersion).toBe('4.0.1')
    expect(fetch).toHaveBeenCalledWith(`${BASE}/fhir/R4/metadata`, expect.any(Object))
  })

  it('environments.list calls /v1/environments with Bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 'env-1', name: 'St. Jude Sandbox' }]), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const envs = await client.environments.list()

    expect(envs).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/environments`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer hb_test_key'
        })
      })
    )
  })

  it('environments.create posts payload to /v1/environments', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'env-new', name: 'Pediatric Clinic', status: 'active' }), { status: 200 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const created = await client.environments.create({
      name: 'Pediatric Clinic',
      patient_cohort: 'pediatric',
      addons: ['postgres', 'vector_qdrant']
    })

    expect(created.id).toBe('env-new')
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/environments`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer hb_test_key',
          'Content-Type': 'application/json'
        })
      })
    )
  })

  it('environments overloads use configured environmentId', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ patient: { id: 'pat-1' }, encounters: [] }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: true,
            scenario: 'new_patient_admitted',
            patient_id: 'pat-1',
            hl7_event: 'MSH|...',
            broadcasted: true
          }),
          { status: 200 }
        )
      )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE, environmentId: 'env-123' })
    await client.environments.getPatientChart('pat-1')
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/environments/env-123/ehr/patients/pat-1`,
      expect.any(Object)
    )

    await client.environments.triggerScenario({ scenario: 'new_patient_admitted' })
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${BASE}/v1/environments/env-123/ehr/scenarios/trigger`,
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('db.query posts SQL query with credential blindness and supports positional params', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [{ id: 'pat-1', first_name: 'Elena' }],
            row_count: 1,
            bytes_egressed: 84,
            duration_ms: 3,
            sql_executed: 'SELECT * FROM patients'
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [{ id: 'pat-1' }],
            row_count: 1,
            bytes_egressed: 42,
            duration_ms: 2,
            sql_executed: "SELECT * FROM patients WHERE status = 'active' LIMIT 5"
          }),
          { status: 200 }
        )
      )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE, environmentId: 'env-123' })
    const res = await client.db.query({ sql: 'SELECT * FROM patients' })

    expect(res.row_count).toBe(1)
    expect(res.rows[0].first_name).toBe('Elena')
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/environments/env-123/db/query`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sql: 'SELECT * FROM patients',
          addon: 'postgres',
          actor_type: 'agent'
        })
      })
    )

    await client.db.query('SELECT * FROM patients WHERE status = $1 LIMIT $2', ['active', 5])
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${BASE}/v1/environments/env-123/db/query`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sql: "SELECT * FROM patients WHERE status = 'active' LIMIT 5",
          addon: 'postgres',
          actor_type: 'agent'
        })
      })
    )
  })

  it('db.recordOutcome and db.tables call environment DB endpoints', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: true, outcome: { id: 'out-1', outcome_type: 'care_gap_closed' } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ environment_id: 'env-123', tables: [{ name: 'patients', row_count: 25 }] }),
          { status: 200 }
        )
      )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE, environmentId: 'env-123' })
    const outcome = await client.db.recordOutcome({
      patientId: 'pat-1',
      outcomeType: 'care_gap_closed',
      summary: 'Scheduled follow-up lab'
    })
    expect(outcome.success).toBe(true)
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/v1/environments/env-123/db/outcomes`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          patient_id: 'pat-1',
          outcome_type: 'care_gap_closed',
          source_agent: 'hebrah-sdk-node',
          summary: 'Scheduled follow-up lab',
          payload: {}
        })
      })
    )

    const tables = await client.db.tables()
    expect(tables.tables[0]?.name).toBe('patients')
  })

  it('connections namespace and top-level client.query execute against /v1/connections', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ target_id: 'synthetic_ehr', label: 'Synthetic EHR' }]), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            connectionId: 'conn-1',
            target: 'synthetic_ehr',
            target_id: 'synthetic_ehr',
            scopes: ['patients.read'],
            tier: 'container',
            scope_snapshot: {},
            ttl_seconds: 3600,
            expires_at: '2026-10-15T00:00:00Z',
            audit_genesis_hash: 'abc'
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [{ id: 'pat-1' }],
            row_count: 1,
            audit_event_id: 'evt-1',
            bytes_egressed: 24,
            cost_cents: 0,
            scope_applied: {},
            sql_executed: 'SELECT id FROM patients LIMIT 1'
          }),
          { status: 200 }
        )
      )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const targets = await client.connections.targets({ pack: 'healthcare' })
    expect(targets).toHaveLength(1)
    expect(fetch).toHaveBeenCalledWith(`${BASE}/v1/connections/targets?pack=healthcare`, expect.any(Object))

    const opened = await client.connections.open({
      targetId: 'synthetic_ehr',
      scopes: ['patients.read'],
      ttlSeconds: 3600
    })
    expect(opened.connectionId).toBe('conn-1')

    const queryRes = await client.query({
      connectionId: 'conn-1',
      sql: 'SELECT id FROM patients LIMIT 1',
      maxRows: 50
    })
    expect(queryRes.row_count).toBe(1)
    expect(fetch).toHaveBeenNthCalledWith(
      3,
      `${BASE}/v1/connections/conn-1/query`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ sql: 'SELECT id FROM patients LIMIT 1', max_rows: 50 })
      })
    )
  })

  it('agent.usage and agent.wallet call /v1/agent/*', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            orgId: 'org-1',
            orgName: 'Acme',
            tier: 'trial',
            period: { start: '2026-10-01', end: '2026-11-01' },
            queries: 10,
            queriesDenied: 0,
            egressBytes: 1024,
            quota: { queries: 1000, egressBytes: 52428800 },
            remaining: { queries: 990, egressBytes: 52427776 },
            balanceCents: 500
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            balance_cents: 500,
            auto_reload_enabled: false
          }),
          { status: 200 }
        )
      )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    const usage = await client.agent.usage()
    expect(usage.balanceCents).toBe(500)

    const wallet = await client.agent.wallet()
    expect(wallet.balance_cents).toBe(500)
  })
})

describe('safePathSegment', () => {
  it('rejects empty, dot, dot-dot, and control characters', () => {
    expect(() => safePathSegment('', 'patientId')).toThrow('patientId is required')
    expect(() => safePathSegment('   ', 'patientId')).toThrow('patientId is required')
    expect(() => safePathSegment('.', 'patientId')).toThrow('Invalid patientId')
    expect(() => safePathSegment('..', 'patientId')).toThrow('Invalid patientId')
    expect(() => safePathSegment('abc\x00def', 'patientId')).toThrow('Invalid patientId')
    expect(safePathSegment('pat_01')).toBe('pat_01')
  })
})

describe('HebrahAgentHarness security', () => {
  it('requires pat and enforces https on remote URLs', () => {
    expect(
      () =>
        new HebrahAgentHarness({
          mcpUrl: 'https://mcp.hebrah.com/mcp',
          pat: '',
          hebrahApiUrl: 'https://api.hebrah.com'
        })
    ).toThrow('pat is required')

    expect(
      () =>
        new HebrahAgentHarness({
          mcpUrl: 'http://evil.example.com/mcp',
          pat: 'hb_pat_123',
          hebrahApiUrl: 'https://api.hebrah.com'
        })
    ).toThrow(/baseUrl must use https/)

    expect(
      () =>
        new HebrahAgentHarness({
          mcpUrl: 'http://localhost:3021/mcp',
          pat: 'hb_pat_123',
          hebrahApiUrl: 'http://localhost:8000'
        })
    ).not.toThrow()
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
  it('verifies valid signatures and supports optional sha256= prefix', () => {
    const secret = 'hbsec_test'
    const payload = { event: 'patient.admitted', connection_id: 'conn-1' }
    const raw = Buffer.from(JSON.stringify(payload))
    const signature = createHmac('sha256', secret).update(raw).digest('hex')

    const parsed = verifyWebhookSignature(raw, signature, secret)
    expect(parsed.event).toBe('patient.admitted')

    const parsedPrefixed = verifyWebhookSignature(raw, `sha256=${signature}`, secret)
    expect(parsedPrefixed.event).toBe('patient.admitted')
  })

  it('rejects empty webhookSecret', () => {
    const raw = Buffer.from('{}')
    expect(() => verifyWebhookSignature(raw, 'abcd', '')).toThrow('webhookSecret is required')
    expect(() => verifyWebhookSignature(raw, 'abcd', '   ')).toThrow('webhookSecret is required')
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

