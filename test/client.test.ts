import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HebrahClient, HebrahApiError, verifyWebhookSignature } from '../src/index.js'

const BASE = 'https://api.test.local'

describe('HebrahClient', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requires apiKey', () => {
    expect(() => new HebrahClient({ apiKey: '' })).toThrow('apiKey is required')
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

  it('throws HebrahApiError on HTTP errors', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('not found', { status: 404 })
    )

    const client = new HebrahClient({ apiKey: 'hb_test_key', baseUrl: BASE })
    await expect(client.patients.get('bad')).rejects.toBeInstanceOf(HebrahApiError)
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
})