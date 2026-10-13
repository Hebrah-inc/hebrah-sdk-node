import { HebrahApiError } from './errors.js'
import { errorDetail, fetchWithTimeout, hebrahRequest, resolveBaseUrl } from './http.js'
import type {
  HealthResponse,
  PatientListResponse,
  PayerRules,
  RunScenarioParams,
  RunScenarioResponse,
  Hl7TemplateSummary,
  InjectHl7Params,
  InjectHl7Response,
  ListWebhookDeliveriesParams,
  WebhookDeliveryListResponse,
  WebhookDeliveryReplayResponse,
  WebhookReliabilityProfile,
  SandboxCatalog,
  SandboxDomainSummary,
  SandboxResourceListResponse,
  TriggerMockEventParams,
  TriggerMockEventResponse,
  HebrahClientOptions,
  SmartLaunchParams,
  SmartLaunchResponse,
  RegisterSmartClientParams,
  RegisterSmartClientResponse,
  SmartTokenParams,
  SmartTokenResponse,
  MpiMatchParams,
  AggregatorQueryParams,
  SyntheticEhrProfile,
  EhrModelSummary,
  ResetSyntheticEhrResponse,
  CreateEnvironmentParams,
  EnvironmentSummary,
  EnvironmentDetail,
  DbQueryParams,
  DbQueryResponse,
  WireguardConfigResponse,
  TriggerClinicScenarioParams,
  TriggerClinicScenarioResponse,
  EnvironmentLogItem
} from './types.js'

export class HebrahClient {
  private readonly config: {
    apiKey: string
    baseUrl: string
    defaultConnectionId?: string
    environmentId?: string
    includeErrorDetail?: boolean
  }

  readonly environments = {
    list: () => this.listEnvironments(),
    get: (environmentId?: string) => this.getEnvironment(this.resolveEnvironmentId(environmentId)),
    create: (params: CreateEnvironmentParams) => this.createEnvironment(params),
    pause: (environmentId?: string) => this.pauseEnvironment(this.resolveEnvironmentId(environmentId)),
    resume: (environmentId?: string) => this.resumeEnvironment(this.resolveEnvironmentId(environmentId)),
    destroy: (environmentId?: string) => this.destroyEnvironment(this.resolveEnvironmentId(environmentId)),
    addModule: (environmentId: string, moduleType: string, config?: Record<string, unknown>) =>
      this.addEnvironmentModule(environmentId, moduleType, config),
    removeModule: (environmentId: string, moduleId: string) =>
      this.removeEnvironmentModule(environmentId, moduleId),
    wireguardConfig: (environmentId?: string) =>
      this.getEnvironmentWireguardConfig(this.resolveEnvironmentId(environmentId)),
    listPatients: (environmentId?: string) =>
      this.listEnvironmentPatients(this.resolveEnvironmentId(environmentId)),
    getPatientChart: (environmentId: string, patientId: string) =>
      this.getEnvironmentPatientChart(environmentId, patientId),
    triggerScenario: (environmentId: string, params: TriggerClinicScenarioParams) =>
      this.triggerEnvironmentScenario(environmentId, params),
    logs: (environmentId?: string) =>
      this.getEnvironmentLogs(this.resolveEnvironmentId(environmentId))
  }

  readonly db = {
    query: (params: DbQueryParams, environmentId?: string) =>
      this.queryEnvironmentDb(params, environmentId)
  }

  readonly sandbox = {
    catalog: (connectionId?: string) => this.getSandboxCatalog(connectionId),
    domains: () => this.listSandboxDomains(),
    domain: (domainId: string) => this.getSandboxDomain(domainId),
    resource: (resourceType: string, resourceId: string, patientId?: string) =>
      this.getSyntheticResource(resourceType, resourceId, patientId),
    listSyntheticResources: (resourceType: string, connectionId?: string) =>
      this.listSyntheticResources(resourceType, connectionId),
    runScenario: (scenarioId: string, params?: RunScenarioParams) =>
      this.runSandboxScenario(scenarioId, params),
    payerRules: (payerId: string) => this.getPayerRules(payerId),
    hl7Templates: () => this.listHl7Templates(),
    injectHl7: (params?: InjectHl7Params) => this.injectHl7(params ?? {}),
    configureWebhookReliability: (profile: WebhookReliabilityProfile) =>
      this.configureWebhookReliability(profile),
    runWebhookReliabilityScenario: (scenarioId: string, params?: RunScenarioParams) =>
      this.runWebhookReliabilityScenario(scenarioId, params),
    runMpiMatch: (params?: MpiMatchParams) => this.runMpiMatch(params ?? {}),
    runAggregatorQuery: (params: AggregatorQueryParams) => this.runAggregatorQuery(params),
    getPractitionerCredentialing: (practitionerId: string) =>
      this.getPractitionerCredentialing(practitionerId),
    getSyntheticEhrProfile: (connectionId?: string) =>
      this.getSyntheticEhrProfile(connectionId),
    listEhrModels: () => this.listEhrModels(),
    resetSyntheticEhr: (connectionId?: string) => this.resetSyntheticEhr(connectionId)
  }

  readonly smart = {
    launch: (params: SmartLaunchParams) => this.smartLaunch(params),
    registerClient: (params: RegisterSmartClientParams) => this.registerSmartClient(params),
    exchangeToken: (params: SmartTokenParams) => this.exchangeSmartToken(params)
  }

  readonly fhir = {
    readPatient: (patientId: string, accessToken: string) =>
      this.readFhirPatient(patientId, accessToken)
  }

  readonly patients = {
    /** @deprecated Use `sandbox.listSyntheticResources('Patient', connectionId)` for connection-scoped sandbox IDs. */
    list: (connectionId?: string) => this.listPatients(connectionId),
    /** @deprecated Use `sandbox.resource('Patient', patientId)` or connection-scoped catalog IDs. */
    get: (patientId: string, connectionId?: string) => this.getPatient(patientId, connectionId)
  }

  readonly webhooks = {
    triggerMockEvent: (params: TriggerMockEventParams) =>
      this.triggerMockEvent(params),
    listDeliveries: (params?: ListWebhookDeliveriesParams) =>
      this.listWebhookDeliveries(params ?? {}),
    replayDelivery: (deliveryId: string) => this.replayWebhookDelivery(deliveryId)
  }

  constructor(options: HebrahClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error('apiKey is required')
    }
    this.config = {
      apiKey: options.apiKey.trim(),
      baseUrl: resolveBaseUrl(options.baseUrl),
      defaultConnectionId: options.defaultConnectionId?.trim() || undefined,
      environmentId: options.environmentId?.trim() || undefined,
      includeErrorDetail: options.includeErrorDetail
    }
  }

  private resolveConnectionId(connectionId?: string): string | undefined {
    return connectionId ?? this.config.defaultConnectionId
  }

  private connectionQuery(connectionId?: string): string {
    const resolved = this.resolveConnectionId(connectionId)
    return resolved ? `?connection_id=${encodeURIComponent(resolved)}` : ''
  }

  get baseUrl(): string {
    return this.config.baseUrl
  }

  async health(): Promise<HealthResponse> {
    const base = this.config.baseUrl.replace(/\/$/, '')
    let response: Response
    try {
      response = await fetchWithTimeout(`${base}/health`)
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new HebrahApiError('Health check timed out', 504)
      }
      throw new HebrahApiError('Health check failed: control plane unreachable', 503)
    }
    if (!response.ok) {
      const detail = errorDetail(this.config, await response.text())
      throw new HebrahApiError(
        `Health check failed (${response.status})`,
        response.status,
        detail
      )
    }
    return response.json() as Promise<HealthResponse>
  }

  private getSandboxCatalog(connectionId?: string): Promise<SandboxCatalog> {
    return hebrahRequest<SandboxCatalog>(
      this.config,
      `/v1/sandbox/catalog${this.connectionQuery(connectionId)}`
    )
  }

  private listSandboxDomains(): Promise<SandboxDomainSummary[]> {
    return hebrahRequest<SandboxDomainSummary[]>(this.config, '/v1/sandbox/domains')
  }

  private getSandboxDomain(domainId: string): Promise<SandboxDomainSummary> {
    return hebrahRequest<SandboxDomainSummary>(
      this.config,
      `/v1/sandbox/domains/${encodeURIComponent(domainId)}`
    )
  }

  private getSyntheticResource(
    resourceType: string,
    resourceId: string,
    patientId?: string
  ): Promise<Record<string, unknown>> {
    const query = patientId
      ? `?patient_id=${encodeURIComponent(patientId)}`
      : ''
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/sandbox/resources/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}${query}`
    )
  }

  private listSyntheticResources(
    resourceType: string,
    connectionId?: string
  ): Promise<SandboxResourceListResponse> {
    return hebrahRequest<SandboxResourceListResponse>(
      this.config,
      `/v1/sandbox/resources/${encodeURIComponent(resourceType)}${this.connectionQuery(connectionId)}`
    )
  }

  private runSandboxScenario(
    scenarioId: string,
    params: RunScenarioParams = {}
  ): Promise<RunScenarioResponse> {
    return hebrahRequest<RunScenarioResponse>(
      this.config,
      `/v1/sandbox/scenarios/${encodeURIComponent(scenarioId)}/run`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(params.patientId ? { patient_id: params.patientId } : {}),
          ...(this.resolveConnectionId(params.connectionId)
            ? { connection_id: this.resolveConnectionId(params.connectionId) }
            : {}),
          ...(params.delaySeconds !== undefined
            ? { delay_seconds: params.delaySeconds }
            : {})
        })
      }
    )
  }

  private getPayerRules(payerId: string): Promise<PayerRules> {
    return hebrahRequest<PayerRules>(
      this.config,
      `/v1/sandbox/payer-rules/${encodeURIComponent(payerId)}`
    )
  }

  private listHl7Templates(): Promise<Hl7TemplateSummary[]> {
    return hebrahRequest<Hl7TemplateSummary[]>(this.config, '/v1/sandbox/hl7/templates')
  }

  private injectHl7(params: InjectHl7Params = {}): Promise<InjectHl7Response> {
    return hebrahRequest<InjectHl7Response>(this.config, '/v1/sandbox/hl7/inject', {
      method: 'POST',
      body: JSON.stringify({
        ...(params.message ? { message: params.message } : {}),
        ...(params.templateId ? { template_id: params.templateId } : {}),
        ...(params.patientId ? { patient_id: params.patientId } : {}),
        ...(this.resolveConnectionId(params.connectionId)
          ? { connection_id: this.resolveConnectionId(params.connectionId) }
          : {}),
        ...(params.event ? { event: params.event } : {}),
        ...(params.deliver !== undefined ? { deliver: params.deliver } : {})
      })
    })
  }

  private listPatients(connectionId?: string): Promise<PatientListResponse> {
    return hebrahRequest<PatientListResponse>(
      this.config,
      `/v1/patients${this.connectionQuery(connectionId)}`
    )
  }

  private getPatient(patientId: string, connectionId?: string): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/patients/${encodeURIComponent(patientId)}${this.connectionQuery(connectionId)}`
    )
  }

  private triggerMockEvent(
    params: TriggerMockEventParams
  ): Promise<TriggerMockEventResponse> {
    return hebrahRequest<TriggerMockEventResponse>(
      this.config,
      '/v1/webhooks/trigger-mock-event',
      {
        method: 'POST',
        body: JSON.stringify({
          ...(params.event ? { event: params.event } : {}),
          ...(params.patientId ? { patient_id: params.patientId } : {}),
          ...(this.resolveConnectionId(params.connectionId)
          ? { connection_id: this.resolveConnectionId(params.connectionId) }
          : {}),
          ...(params.domainId ? { domain_id: params.domainId } : {}),
          ...(params.scenarioId ? { scenario_id: params.scenarioId } : {})
        })
      }
    )
  }

  private listWebhookDeliveries(
    params: ListWebhookDeliveriesParams
  ): Promise<WebhookDeliveryListResponse> {
    const search = new URLSearchParams()
    const resolvedConnection = this.resolveConnectionId(params.connectionId)
    if (resolvedConnection) search.set('connection_id', resolvedConnection)
    if (params.status) search.set('status', params.status)
    if (params.event) search.set('event', params.event)
    if (params.limit) search.set('limit', String(params.limit))
    const q = search.toString() ? `?${search.toString()}` : ''
    return hebrahRequest<WebhookDeliveryListResponse>(
      this.config,
      `/v1/webhooks/deliveries${q}`
    )
  }

  private replayWebhookDelivery(
    deliveryId: string
  ): Promise<WebhookDeliveryReplayResponse> {
    return hebrahRequest<WebhookDeliveryReplayResponse>(
      this.config,
      `/v1/webhooks/deliveries/${encodeURIComponent(deliveryId)}/replay`,
      { method: 'POST' }
    )
  }

  private configureWebhookReliability(
    profile: WebhookReliabilityProfile
  ): Promise<{ profile: WebhookReliabilityProfile }> {
    return hebrahRequest<{ profile: WebhookReliabilityProfile }>(
      this.config,
      '/v1/sandbox/webhook-reliability',
      {
        method: 'PATCH',
        body: JSON.stringify({
          mode: profile.mode,
          fail_rate: profile.failRate ?? 0,
          latency_ms: profile.latencyMs ?? 0,
          status_code: profile.statusCode ?? null
        })
      }
    )
  }

  private runWebhookReliabilityScenario(
    scenarioId: string,
    params: RunScenarioParams = {}
  ): Promise<RunScenarioResponse> {
    return this.runSandboxScenario(scenarioId, params)
  }

  private smartLaunch(params: SmartLaunchParams): Promise<SmartLaunchResponse> {
    return hebrahRequest<SmartLaunchResponse>(this.config, '/v1/smart/launch', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: params.patientId,
        encounter_id: params.encounterId ?? null,
        smart_app_url: params.smartAppUrl ?? null
      })
    })
  }

  private registerSmartClient(
    params: RegisterSmartClientParams
  ): Promise<RegisterSmartClientResponse> {
    return hebrahRequest<RegisterSmartClientResponse>(this.config, '/v1/smart/clients', {
      method: 'POST',
      body: JSON.stringify({
        client_id: params.clientId,
        name: params.name ?? 'SDK SMART client',
        redirect_uris: params.redirectUris
      })
    })
  }

  private async exchangeSmartToken(params: SmartTokenParams): Promise<SmartTokenResponse> {
    const base = this.config.baseUrl.replace(/\/$/, '')
    const body = new URLSearchParams({
      grant_type: params.grantType ?? 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.codeVerifier
    })
    let response: Response
    try {
      response = await fetchWithTimeout(`${base}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      })
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new HebrahApiError('SMART token exchange timed out', 504)
      }
      throw new HebrahApiError('SMART token exchange failed: control plane unreachable', 503)
    }
    if (!response.ok) {
      const detail = errorDetail(this.config, await response.text())
      throw new HebrahApiError(`SMART token exchange failed (${response.status})`, response.status, detail)
    }
    return response.json() as Promise<SmartTokenResponse>
  }

  private async readFhirPatient(
    patientId: string,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    const base = this.config.baseUrl.replace(/\/$/, '')
    let response: Response
    try {
      response = await fetchWithTimeout(
        `${base}/fhir/R4/Patient/${encodeURIComponent(patientId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/fhir+json'
          }
        }
      )
    } catch (err) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        throw new HebrahApiError('FHIR Patient read timed out', 504)
      }
      throw new HebrahApiError('FHIR Patient read failed: control plane unreachable', 503)
    }
    if (!response.ok) {
      const detail = errorDetail(this.config, await response.text())
      throw new HebrahApiError(`FHIR Patient read failed (${response.status})`, response.status, detail)
    }
    return response.json() as Promise<Record<string, unknown>>
  }

  private runMpiMatch(params: MpiMatchParams = {}): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(this.config, '/v1/sandbox/mpi/match', {
      method: 'POST',
      body: JSON.stringify({
        ...(params.firstName ? { first_name: params.firstName } : {}),
        ...(params.lastName ? { last_name: params.lastName } : {}),
        ...(params.birthDate ? { birth_date: params.birthDate } : {}),
        ...(params.identifier ? { identifier: params.identifier } : {})
      })
    })
  }

  private runAggregatorQuery(params: AggregatorQueryParams): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(this.config, '/v1/sandbox/aggregator/query', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: params.patientId,
        include_consent: params.includeConsent ?? true,
        include_provenance: params.includeProvenance ?? true
      })
    })
  }

  private getPractitionerCredentialing(practitionerId: string): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/sandbox/credentialing/practitioners/${encodeURIComponent(practitionerId)}`
    )
  }

  private getSyntheticEhrProfile(connectionId?: string): Promise<SyntheticEhrProfile> {
    return hebrahRequest<SyntheticEhrProfile>(
      this.config,
      `/v1/sandbox/synthetic-ehr/profile${this.connectionQuery(connectionId)}`
    )
  }

  private listEhrModels(): Promise<EhrModelSummary[]> {
    return hebrahRequest<EhrModelSummary[]>(this.config, '/v1/sandbox/ehr-models')
  }

  private resetSyntheticEhr(connectionId?: string): Promise<ResetSyntheticEhrResponse> {
    return hebrahRequest<ResetSyntheticEhrResponse>(
      this.config,
      `/v1/sandbox/synthetic-ehr/reset${this.connectionQuery(connectionId)}`,
      { method: 'POST' }
    )
  }

  private resolveEnvironmentId(environmentId?: string): string {
    const resolved = environmentId ?? this.config.environmentId
    if (!resolved) {
      throw new Error('environmentId is required (pass as argument or set in client options)')
    }
    return resolved
  }

  private listEnvironments(): Promise<EnvironmentSummary[]> {
    return hebrahRequest<EnvironmentSummary[]>(this.config, '/v1/environments')
  }

  private getEnvironment(environmentId: string): Promise<EnvironmentDetail> {
    return hebrahRequest<EnvironmentDetail>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}`
    )
  }

  private createEnvironment(params: CreateEnvironmentParams): Promise<EnvironmentSummary> {
    return hebrahRequest<EnvironmentSummary>(this.config, '/v1/environments', {
      method: 'POST',
      body: JSON.stringify(params)
    })
  }

  private pauseEnvironment(environmentId: string): Promise<EnvironmentSummary> {
    return hebrahRequest<EnvironmentSummary>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/pause`,
      { method: 'POST' }
    )
  }

  private resumeEnvironment(environmentId: string): Promise<EnvironmentSummary> {
    return hebrahRequest<EnvironmentSummary>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/resume`,
      { method: 'POST' }
    )
  }

  private destroyEnvironment(environmentId: string): Promise<{ success: boolean; message: string }> {
    return hebrahRequest<{ success: boolean; message: string }>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}`,
      { method: 'DELETE' }
    )
  }

  private addEnvironmentModule(
    environmentId: string,
    moduleType: string,
    config?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/modules`,
      {
        method: 'POST',
        body: JSON.stringify({ module_type: moduleType, config: config ?? {} })
      }
    )
  }

  private removeEnvironmentModule(
    environmentId: string,
    moduleId: string
  ): Promise<{ success: boolean; message: string }> {
    return hebrahRequest<{ success: boolean; message: string }>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/modules/${encodeURIComponent(moduleId)}`,
      { method: 'DELETE' }
    )
  }

  private getEnvironmentWireguardConfig(
    environmentId: string
  ): Promise<WireguardConfigResponse> {
    return hebrahRequest<WireguardConfigResponse>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/wireguard/config`
    )
  }

  private listEnvironmentPatients(
    environmentId: string
  ): Promise<Record<string, unknown>[]> {
    return hebrahRequest<Record<string, unknown>[]>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/ehr/patients`
    )
  }

  private getEnvironmentPatientChart(
    environmentId: string,
    patientId: string
  ): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/ehr/patients/${encodeURIComponent(patientId)}`
    )
  }

  private triggerEnvironmentScenario(
    environmentId: string,
    params: TriggerClinicScenarioParams
  ): Promise<TriggerClinicScenarioResponse> {
    return hebrahRequest<TriggerClinicScenarioResponse>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/ehr/scenarios/trigger`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      }
    )
  }

  private getEnvironmentLogs(
    environmentId: string
  ): Promise<EnvironmentLogItem[]> {
    return hebrahRequest<EnvironmentLogItem[]>(
      this.config,
      `/v1/environments/${encodeURIComponent(environmentId)}/logs`
    )
  }

  private queryEnvironmentDb(
    params: DbQueryParams,
    environmentId?: string
  ): Promise<DbQueryResponse> {
    const envId = this.resolveEnvironmentId(environmentId ?? params.environmentId)
    return hebrahRequest<DbQueryResponse>(
      this.config,
      `/v1/environments/${encodeURIComponent(envId)}/db/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          sql: params.sql,
          addon: params.addon ?? 'postgres',
          actor_type: params.actor_type ?? 'agent'
        })
      }
    )
  }
}
