export const DEFAULT_BASE_URL = 'https://api.hebrah.com'

export interface HebrahClientOptions {
  /** Sandbox or live API key (`hb_test_*` / `hb_live_*`). */
  apiKey: string
  /** Control plane base URL. Defaults to production. */
  baseUrl?: string
  /** Default sandbox connection id for methods that accept optional `connectionId`. */
  defaultConnectionId?: string
  /** When false, HebrahApiError.detail is omitted. Default true. */
  includeErrorDetail?: boolean
}

export interface HealthResponse {
  status: string
}

export interface SandboxScenarioSummary {
  id: string
  name: string
  description: string
  events: string[]
  delay_seconds?: number
}

export interface SandboxDomainSummary {
  id: string
  name: string
  description: string
  events: string[]
  resource_types: string[]
  hl7_message_types?: Record<string, string>
  scenarios?: SandboxScenarioSummary[]
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
  sandbox_domains?: SandboxDomainSummary[]
  event_groups?: Record<string, string[]>
  example_envelopes?: Record<string, Record<string, unknown>>
  ehr_vendor?: string | null
  data_format?: string | null
  resource_types?: string[] | null
  field_mappings?: Record<string, unknown>[] | null
}

export interface SandboxResourceListResponse {
  resource_type: string
  ids: string[]
}

export interface PayerRules {
  id: string
  name: string
  required_documents: string[]
  typical_pend_reasons: string[]
  typical_denial_reasons: string[]
}

export interface Hl7TemplateSummary {
  id: string
  name: string
  domain_id?: string | null
  event?: string | null
  message_type?: string | null
}

export interface InjectHl7Params {
  message?: string
  templateId?: string
  patientId?: string
  connectionId?: string
  event?: string
  deliver?: boolean
}

export interface InjectHl7Response {
  status: string
  ack: string
  event: string
  connection_id: string
  message_type?: string | null
  envelope_preview: Record<string, unknown>
}

export interface RunScenarioParams {
  patientId?: string
  connectionId?: string
  delaySeconds?: number
}

export interface RunScenarioResponse {
  status: string
  scenario_id: string
  connection_id: string
  events: string[]
  envelope_previews: Record<string, unknown>[]
}

export interface PatientSummary {
  id: string
}

export interface PatientListResponse {
  patients: PatientSummary[]
}

export interface TriggerMockEventParams {
  event?: string
  patientId?: string
  connectionId?: string
  domainId?: string
  scenarioId?: string
}

export interface TriggerMockEventResponse {
  status: string
  event: string
  patient_id?: string
  connection_id: string
  envelope_preview: Record<string, unknown>
  scenario_id?: string
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
  delivery_id?: string
}

export interface WebhookReliabilityProfile {
  mode?: 'healthy' | 'transient_503' | 'slow' | 'rate_limit' | 'always_fail'
  failRate?: number
  latencyMs?: number
  statusCode?: number | null
}

export interface ListWebhookDeliveriesParams {
  connectionId?: string
  status?: string
  event?: string
  limit?: number
}

export interface WebhookDeliverySummary {
  id: string
  delivery_key: string
  connection_id: string | null
  event: string
  environment: string
  terminal_status: string
  attempt_count: number
  max_attempts: number
  next_retry_at: string | null
  status_code: number | null
  latency_ms: number
  success: boolean
  error_message: string | null
  created_at: string
}

export interface WebhookDeliveryListResponse {
  items: WebhookDeliverySummary[]
  total: number
}

export interface WebhookDeliveryReplayResponse {
  status: string
  delivery_id: string
  replay_delivery_id: string | null
  message: string
}

export interface SmartLaunchParams {
  patientId: string
  encounterId?: string | null
  smartAppUrl?: string | null
}

export interface SmartLaunchResponse {
  launch: string
  authorize_url: string
  expires_at: string
  patient_id: string
  encounter_id?: string | null
}

export interface RegisterSmartClientParams {
  clientId: string
  name?: string
  redirectUris: string[]
}

export interface RegisterSmartClientResponse {
  client_id: string
  name: string
  redirect_uris: string[]
  created_at: string
}

export interface SmartTokenParams {
  grantType?: 'authorization_code'
  code: string
  redirectUri: string
  clientId: string
  codeVerifier: string
}

export interface SmartTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  patient?: string
  encounter?: string | null
  fhirUser?: string
}

export interface MpiMatchParams {
  firstName?: string
  lastName?: string
  birthDate?: string
  identifier?: string
}

export interface AggregatorQueryParams {
  patientId: string
  includeConsent?: boolean
  includeProvenance?: boolean
}

export interface EhrModelSummary {
  vendor: string
  version: string
  description?: string
}

export interface SyntheticEhrProfile {
  vendor: string
  model_version: string
  base_url: string
  fhir_base_path: string
  resource_types: string[]
  auth: Record<string, unknown>
  capabilities?: Record<string, string>
  writeback_endpoints?: string[]
  hl7_templates?: string[]
  seed_patients?: number
  connection_id: string
}

export interface ResetSyntheticEhrResponse {
  connection_id: string
  vendor: string
  seed: string
  vm_id: string
  status: string
  resource_counts: Record<string, number>
  reseed_via?: string | null
  message: string
}
