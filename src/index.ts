export { HebrahClient, interpolateSqlParams } from './client.js'
export { HebrahAgentHarness } from './harness.js'
export { HebrahApiError } from './errors.js'
export { verifyWebhookSignature } from './webhooks.js'
export { safePathSegment, assertSafeBaseUrl } from './http.js'
export { DEFAULT_BASE_URL } from './types.js'
export type {
  HealthResponse,
  PatientListResponse,
  PatientSummary,
  SandboxCatalog,
  TriggerMockEventParams,
  TriggerMockEventResponse,
  WebhookEventEnvelope,
  HebrahClientOptions,
  CreateEnvironmentParams,
  EnvironmentSummary,
  EnvironmentDetail,
  DbQueryParams,
  DbQueryResponse,
  DbTableColumn,
  DbTableInfo,
  DbTablesResponse,
  RecordOutcomeParams,
  RecordOutcomeResponse,
  ConnectAgentParams,
  AutosaveConfigUpdateParams,
  AutosaveConfigResponse,
  WireguardConfigResponse,
  TriggerClinicScenarioParams,
  TriggerClinicScenarioResponse,
  EnvironmentLogItem,
  ListTargetsParams,
  TargetSummary,
  TargetDetail,
  PackSummary,
  OpenConnectionParams,
  OpenConnectionResponse,
  ConnectionSummary,
  ConnectionDetail,
  ConnectionQueryParams,
  ConnectionQueryResponse,
  TopLevelQueryParams,
  ListConnectionAuditParams,
  ConnectionAuditEvent,
  AuditChainVerification,
  AgentUsageResponse,
  AgentWalletResponse,
  AgentTopupParams,
  AgentTopupResponse
} from './types.js'
export type { HebrahAgentHarnessOptions, LlmProvider } from './harness.js'