import { HebrahApiError } from './errors.js'
import { hebrahRequest, resolveBaseUrl } from './http.js'
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
  ResetSyntheticEhrResponse
} from './types.js'

export class HebrahClient {
  private readonly config: {
    apiKey: string
    baseUrl: string
    defaultConnectionId?: string
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
      defaultConnectionId: options.defaultConnectionId?.trim() || undefined
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
    const response = await fetch(`${base}/health`)
    if (!response.ok) {
      const detail = await response.text()
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
    const response = await fetch(`${base}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new HebrahApiError(`SMART token exchange failed (${response.status})`, response.status, detail)
    }
    return response.json() as Promise<SmartTokenResponse>
  }

  private async readFhirPatient(
    patientId: string,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    const base = this.config.baseUrl.replace(/\/$/, '')
    const response = await fetch(
      `${base}/fhir/R4/Patient/${encodeURIComponent(patientId)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/fhir+json'
        }
      }
    )
    if (!response.ok) {
      const detail = await response.text()
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
}
