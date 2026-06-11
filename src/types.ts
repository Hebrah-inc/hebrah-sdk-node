export const DEFAULT_BASE_URL = 'https://api.hebrah.com'

export interface HebrahClientOptions {
  /** Sandbox or live API key (`hb_test_*` / `hb_live_*`). */
  apiKey: string
  /** Control plane base URL. Defaults to production. */
  baseUrl?: string
}

export interface HealthResponse {
  status: string
}

export interface SandboxCatalog {
  org_id: string
  org_name: string
  connection_id: string
  environment: string
  sample_patient_ids: string[]
  supported_events: string[]
  example_patient_response: Record<string, unknown>
  example_webhook_envelope: Record<string, unknown>
  ehr_vendor?: string | null
  data_format?: string | null
  resource_types?: string[] | null
  field_mappings?: Record<string, unknown> | null
}

export interface PatientSummary {
  id: string
}

export interface PatientListResponse {
  patients: PatientSummary[]
}

export interface TriggerMockEventParams {
  event: string
  patientId?: string
}

export interface TriggerMockEventResponse {
  status: string
  event: string
  patient_id?: string
  connection_id: string
  envelope_preview: Record<string, unknown>
}

export interface WebhookEventEnvelope {
  event: string
  resource: Record<string, unknown>
  connection_id: string
  environment: 'sandbox' | 'live'
  timestamp: string
  org_id: string
  method?: string
  path?: string
  status_code?: number
  latency_ms?: number
}