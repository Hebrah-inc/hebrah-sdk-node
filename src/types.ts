export const DEFAULT_BASE_URL = 'https://api.hebrah.com'

export interface HebrahClientOptions {
  /** Sandbox or live API key (`hb_test_*` / `hb_live_*` / `hb_conn_*`). */
  apiKey: string
  /** Control plane base URL. Defaults to production. */
  baseUrl?: string
  /** Default sandbox connection id for methods that accept optional `connectionId`. */
  defaultConnectionId?: string
  /** Default environment id for methods that accept optional `environmentId`. */
  environmentId?: string
  /** When false, HebrahApiError.detail is omitted. Default true. */
  includeErrorDetail?: boolean
  /** Default request timeout in milliseconds (100..300000). Default 30000. */
  timeoutMs?: number
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

export interface CreateEnvironmentParams {
  name: string
  clinic_type?: string
  patient_cohort?: string
  patient_count?: number
  bed_count?: number
  addons?: string[]
}

export interface EnvironmentSummary {
  id: string
  org_id: string
  name: string
  clinic_type: string
  patient_cohort: string
  status: string
  addons: string[]
  patient_count: number
  bed_count: number
  endpoints: Record<string, string>
  wireguard_ip?: string | null
  queries_run: number
  bytes_egressed: number
  hourly_rate_cents: number
  total_cost_cents: number
  connected_agents_count: number
  last_active_at?: string | null
  created_at: string
}

export interface EnvironmentDetail extends EnvironmentSummary {
  connection_instructions: Record<string, unknown>
  database_modules: Record<string, unknown>[]
  connected_agents: Record<string, unknown>[]
}

export interface DbQueryParams {
  sql: string
  params?: unknown[]
  addon?: string
  actor_type?: string
  environmentId?: string
}

export interface DbQueryResponse {
  rows: Record<string, unknown>[]
  row_count: number
  bytes_egressed: number
  duration_ms: number
  sql_executed: string
}

export interface DbTableColumn {
  name: string
  type: string
  nullable: boolean
}

export interface DbTableInfo {
  name: string
  table_name: string
  schema: string
  row_count: number
  column_count: number
  columns: DbTableColumn[]
  category: string
  description: string
}

export interface DbTablesResponse {
  environment_id: string
  schema: string
  table_count: number
  total_rows: number
  autosave_config: Record<string, boolean>
  tables: DbTableInfo[]
}

export interface RecordOutcomeParams {
  patientId?: string
  patient_id?: string
  outcomeType?: string
  outcome_type?: string
  sourceAgent?: string
  source_agent?: string
  agentId?: string
  agent_id?: string
  score?: number
  riskScore?: number
  risk_score?: number
  summary: string
  payload?: Record<string, unknown>
  environmentId?: string
}

export interface RecordOutcomeResponse {
  success: boolean
  outcome: Record<string, unknown>
}

export interface ConnectAgentParams {
  agent_name?: string
  agentName?: string
  client?: string
}

export interface AutosaveConfigUpdateParams {
  enabled?: boolean
  sync_patients?: boolean
  sync_hl7_events?: boolean
  sync_x12_claims?: boolean
  sync_vector_embeddings?: boolean
}

export interface AutosaveConfigResponse {
  success?: boolean
  environment_id: string
  autosave_config: Record<string, boolean>
}

export interface WireguardConfigResponse {
  filename: string
  client_ip: string
  config: string
  instructions: string
}

export interface TriggerClinicScenarioParams {
  scenario: string
  patient_id?: string
  notes?: string
}

export interface TriggerClinicScenarioResponse {
  success: boolean
  scenario: string
  patient_id: string
  hl7_event: string
  broadcasted: boolean
}

export interface EnvironmentLogItem {
  id: string
  environment_id: string
  actor_type: string
  actor_id: string
  event_type: string
  summary: string
  details: Record<string, unknown>
  duration_ms?: number | null
  status: string
  created_at: string
}

export interface ConsultArchitectParams {
  prompt: string
  sessionId?: string
  session_id?: string
}

export interface ConsultArchitectResponse {
  session_id: string
  reply: string
  scope_classification: 'in_scope' | 'adjacent_redirect' | 'out_of_scope_refusal' | string
  blueprint?: Record<string, unknown> | null
  clarifying_questions?: string[]
  recommendations?: Record<string, unknown>[]
  ready_to_provision?: boolean
  [key: string]: unknown
}

export interface AdmitPatientsParams {
  count?: number
  cohort?: string
  patient_cohort?: string
  acuity?: string
  notes?: string
}

export interface AdmitPatientsResponse {
  success?: boolean
  environment_id: string
  admitted_count: number
  total_patient_count?: number
  patients?: Record<string, unknown>[]
  [key: string]: unknown
}

export interface ConsultStudioParams {
  prompt: string
  sessionId?: string
  session_id?: string
  applyChanges?: boolean
  apply_changes?: boolean
}

export interface ConsultStudioResponse {
  session_id: string
  reply: string
  proposed_actions?: Record<string, unknown>[]
  applied_actions?: Record<string, unknown>[]
  [key: string]: unknown
}

export interface ListEnvironmentPatientsParams {
  department?: string
  acuity?: string
  status?: string
  search?: string
  limit?: number
}

export interface ListTargetsParams {
  pack?: string
  all?: boolean
  healthy?: boolean
}

export interface TargetSummary {
  target_id: string
  target?: string
  connector: string
  label: string
  description: string
  pack_id?: string
  pack_label?: string
  pack_status?: string
  tables: string[]
  required_scopes?: string[]
  example_scopes?: string[]
  sample_queries?: string[]
  tiers?: string[]
  writes_allowed?: boolean
  health?: string
  relay_required?: boolean
  wave?: number
}

export type TargetDetail = TargetSummary

export interface PackSummary {
  pack_id: string
  label: string
  tagline?: string
  status?: string
  tier_note?: string
  target_count: number
  connector_count: number
  wave?: number
}

export interface OpenConnectionParams {
  targetId?: string
  target_id?: string
  scopes: string[]
  tier?: 'container' | 'vm'
  ttlSeconds?: number
  ttl_seconds?: number
}

export interface OpenConnectionResponse {
  connectionId: string
  target: string
  target_id: string
  scopes: string[]
  tier: string
  scope_snapshot: Record<string, unknown>
  ttl_seconds: number
  expires_at: string
  audit_genesis_hash: string
}

export interface ConnectionSummary {
  connectionId: string
  target_id: string
  scopes: string[]
  tier: string
  ttl_seconds: number
  expires_at: string
  status: string
  queries_run: number
  bytes_egressed: number
  cost_cents: number
  last_query_at?: string | null
}

export interface ConnectionDetail extends ConnectionSummary {
  created_at?: string | null
  revoked_at?: string | null
  revoked_reason?: string | null
}

export interface ConnectionQueryParams {
  sql: string
  maxRows?: number
  max_rows?: number
}

export interface TopLevelQueryParams extends ConnectionQueryParams {
  connectionId?: string
  connection_id?: string
  environmentId?: string
  params?: unknown[]
  addon?: string
  actor_type?: string
}

export interface ConnectionQueryResponse {
  rows: Record<string, unknown>[]
  row_count: number
  audit_event_id: string
  bytes_egressed: number
  cost_cents: number
  scope_applied: Record<string, unknown>
  sql_executed: string
}

export interface ListConnectionAuditParams {
  limit?: number
  eventType?: string
  event_type?: string
}

export interface ConnectionAuditEvent {
  id: string
  sequence: number
  event_type: string
  sql_fingerprint?: string | null
  sql_executed?: string | null
  bytes_egressed: number
  rows_returned: number
  cost_cents: number
  prev_hash: string
  event_hash: string
  created_at: string
  error_code?: string | null
  error_message?: string | null
}

export interface AuditChainVerification {
  verified: boolean
  events_checked: number
  genesis_hash?: string | null
  broken_at?: number | null
}

export interface AgentUsageResponse {
  orgId: string
  orgName: string
  tier: string
  period: {
    start: string
    end: string
  }
  queries: number
  queriesDenied: number
  egressBytes: number
  quota: {
    queries: number
    egressBytes: number
  }
  remaining: {
    queries: number
    egressBytes: number
  }
  balanceCents: number
  trial?: {
    expiresAt?: string | null
  }
}

export interface AgentWalletResponse {
  org_id?: string
  balance_cents: number
  auto_reload_enabled?: boolean
  auto_reload_threshold_cents?: number | null
  auto_reload_amount_cents?: number | null
  [key: string]: unknown
}

export interface AgentTopupParams {
  amountCents?: number
  amount_cents?: number
  successUrl?: string
  success_url?: string
  cancelUrl?: string
  cancel_url?: string
}

export interface AgentTopupResponse {
  session_id: string
  url: string
  amount_cents: number
  mode: string
}


