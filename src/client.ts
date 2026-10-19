import {
  assertSafeBaseUrl,
  hebrahRequest,
  resolveBaseUrl,
  safePathSegment,
  validateTimeoutMs,
  validateToken
} from './http.js'
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
  ConsultArchitectParams,
  ConsultArchitectResponse,
  AdmitPatientsParams,
  AdmitPatientsResponse,
  ConsultStudioParams,
  ConsultStudioResponse,
  ListEnvironmentPatientsParams,
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

export function interpolateSqlParams(sql: string, params?: unknown[]): string {
  if (typeof sql !== 'string' || !sql.trim()) {
    throw new Error('sql is required')
  }
  if (!params || params.length === 0) {
    return sql
  }
  return sql.replace(/\$(\d+)\b/g, (match, indexStr: string) => {
    const idx = Number.parseInt(indexStr, 10) - 1
    if (idx < 0 || idx >= params.length) {
      throw new Error(`Missing SQL parameter for placeholder ${match}`)
    }
    const val = params[idx]
    if (val === null || val === undefined) {
      return 'NULL'
    }
    if (typeof val === 'number') {
      if (!Number.isFinite(val)) {
        throw new Error(`Invalid numeric SQL parameter at ${match}`)
      }
      return String(val)
    }
    if (typeof val === 'bigint') {
      return String(val)
    }
    if (typeof val === 'boolean') {
      return val ? 'TRUE' : 'FALSE'
    }
    if (val instanceof Date) {
      if (Number.isNaN(val.getTime())) {
        throw new Error(`Invalid Date SQL parameter at ${match}`)
      }
      return `'${val.toISOString().replace(/'/g, "''")}'`
    }
    if (typeof val === 'string') {
      if (val.includes('\x00')) {
        throw new Error(`Null byte not allowed in SQL parameter at ${match}`)
      }
      return `'${val.replace(/'/g, "''")}'`
    }
    if (typeof val === 'symbol' || typeof val === 'function') {
      throw new Error(`Unsupported SQL parameter type at ${match}`)
    }
    const serialized = JSON.stringify(val)
    if (serialized === undefined) {
      throw new Error(`Unsupported SQL parameter value at ${match}`)
    }
    if (serialized.includes('\x00') || serialized.includes('\\u0000')) {
      throw new Error(`Null byte not allowed in SQL parameter at ${match}`)
    }
    return `'${serialized.replace(/'/g, "''")}'`
  })
}

export class HebrahClient {
  private readonly config!: {
    apiKey: string
    baseUrl: string
    defaultConnectionId?: string
    environmentId?: string
    includeErrorDetail?: boolean
    timeoutMs?: number
  }

  readonly environments = Object.freeze({
    list: () => this.listEnvironments(),
    get: (environmentId?: string) => this.getEnvironment(this.resolveEnvironmentId(environmentId)),
    create: (params: CreateEnvironmentParams) => this.createEnvironment(params),
    pause: (environmentId?: string) => this.pauseEnvironment(this.resolveEnvironmentId(environmentId)),
    resume: (environmentId?: string) => this.resumeEnvironment(this.resolveEnvironmentId(environmentId)),
    destroy: (environmentId?: string) => this.destroyEnvironment(this.resolveEnvironmentId(environmentId)),
    addModule: (
      envOrModuleType: string,
      moduleTypeOrConfig?: string | Record<string, unknown>,
      config?: Record<string, unknown>
    ) => {
      if (typeof moduleTypeOrConfig === 'string') {
        return this.addEnvironmentModule(envOrModuleType, moduleTypeOrConfig, config)
      }
      return this.addEnvironmentModule(
        this.resolveEnvironmentId(),
        envOrModuleType,
        moduleTypeOrConfig
      )
    },
    removeModule: (envOrModuleId: string, moduleId?: string) => {
      if (moduleId !== undefined) {
        return this.removeEnvironmentModule(envOrModuleId, moduleId)
      }
      return this.removeEnvironmentModule(this.resolveEnvironmentId(), envOrModuleId)
    },
    wireguardConfig: (environmentId?: string) =>
      this.getEnvironmentWireguardConfig(this.resolveEnvironmentId(environmentId)),
    listPatients: (
      envOrParams?: string | ListEnvironmentPatientsParams,
      params?: ListEnvironmentPatientsParams
    ) => {
      if (typeof envOrParams === 'string' || envOrParams === undefined) {
        return this.listEnvironmentPatients(this.resolveEnvironmentId(envOrParams), params)
      }
      return this.listEnvironmentPatients(this.resolveEnvironmentId(), envOrParams)
    },
    admitPatients: (
      envOrParams?: string | AdmitPatientsParams,
      params?: AdmitPatientsParams
    ) => {
      if (typeof envOrParams === 'string') {
        return this.admitEnvironmentPatients(envOrParams, params)
      }
      return this.admitEnvironmentPatients(this.resolveEnvironmentId(), envOrParams)
    },
    getPatientChart: (envOrPatientId: string, patientId?: string) => {
      if (patientId !== undefined) {
        return this.getEnvironmentPatientChart(envOrPatientId, patientId)
      }
      return this.getEnvironmentPatientChart(this.resolveEnvironmentId(), envOrPatientId)
    },
    triggerScenario: (
      envOrParams: string | TriggerClinicScenarioParams,
      params?: TriggerClinicScenarioParams
    ) => {
      if (typeof envOrParams === 'string') {
        if (!params) {
          throw new Error('triggerScenario requires scenario parameters')
        }
        return this.triggerEnvironmentScenario(envOrParams, params)
      }
      return this.triggerEnvironmentScenario(this.resolveEnvironmentId(), envOrParams)
    },
    connectAgent: (params?: ConnectAgentParams, environmentId?: string) =>
      this.connectEnvironmentAgent(this.resolveEnvironmentId(environmentId), params),
    getAutosave: (environmentId?: string) =>
      this.getEnvironmentAutosave(this.resolveEnvironmentId(environmentId)),
    updateAutosave: (params: AutosaveConfigUpdateParams, environmentId?: string) =>
      this.updateEnvironmentAutosave(this.resolveEnvironmentId(environmentId), params),
    tables: (environmentId?: string) =>
      this.listEnvironmentDbTables(this.resolveEnvironmentId(environmentId)),
    recordOutcome: (params: RecordOutcomeParams, environmentId?: string) =>
      this.recordEnvironmentOutcome(params, environmentId),
    logs: (environmentId?: string) =>
      this.getEnvironmentLogs(this.resolveEnvironmentId(environmentId)),
    consultArchitect: (params: ConsultArchitectParams | string) =>
      this.consultEnvironmentArchitect(typeof params === 'string' ? { prompt: params } : params),
    consultStudio: (
      envOrParams: string | ConsultStudioParams,
      params?: ConsultStudioParams
    ) => {
      if (typeof envOrParams === 'string') {
        if (!params) {
          throw new Error('consultStudio requires studio parameters')
        }
        return this.consultEnvironmentStudio(envOrParams, params)
      }
      return this.consultEnvironmentStudio(this.resolveEnvironmentId(), envOrParams)
    },
    openDataCatalog: (environmentId?: string) => this.getOpenDataCatalog(environmentId)
  })

  readonly db = Object.freeze({
    query: (
      sqlOrParams: string | DbQueryParams,
      paramsOrEnvId?: unknown[] | string,
      environmentId?: string
    ): Promise<DbQueryResponse> => {
      if (typeof sqlOrParams === 'string') {
        const sqlParams = Array.isArray(paramsOrEnvId) ? paramsOrEnvId : undefined
        const envId = typeof paramsOrEnvId === 'string' ? paramsOrEnvId : environmentId
        return this.queryEnvironmentDb({ sql: sqlOrParams, params: sqlParams }, envId)
      }
      const envId = typeof paramsOrEnvId === 'string' ? paramsOrEnvId : environmentId
      return this.queryEnvironmentDb(sqlOrParams, envId)
    },
    recordOutcome: (params: RecordOutcomeParams, environmentId?: string) =>
      this.recordEnvironmentOutcome(params, environmentId),
    tables: (environmentId?: string) =>
      this.listEnvironmentDbTables(this.resolveEnvironmentId(environmentId)),
    exportVpnConfig: (environmentId?: string) =>
      this.getEnvironmentWireguardConfig(this.resolveEnvironmentId(environmentId))
  })

  readonly connections = Object.freeze({
    targets: (params?: ListTargetsParams) => this.listConnectionTargets(params),
    target: (targetId: string) => this.getConnectionTarget(targetId),
    packs: (params?: { all?: boolean }) => this.listConnectionPacks(params),
    open: (params: OpenConnectionParams) => this.openScopedConnection(params),
    list: (params?: { status?: string }) => this.listScopedConnections(params),
    get: (connectionId?: string) => this.getScopedConnection(connectionId),
    query: (connectionId: string, params: ConnectionQueryParams | string) =>
      this.queryScopedConnection(
        connectionId,
        typeof params === 'string' ? { sql: params } : params
      ),
    revoke: (connectionId: string, reason?: string) =>
      this.revokeScopedConnection(connectionId, reason),
    audit: (connectionId: string, params?: ListConnectionAuditParams) =>
      this.listConnectionAudit(connectionId, params),
    verifyAudit: (connectionId?: string) => this.verifyConnectionAudit(connectionId)
  })

  readonly agent = Object.freeze({
    usage: () => this.getAgentUsage(),
    wallet: () => this.getAgentWallet(),
    topup: (params: AgentTopupParams) => this.createAgentTopup(params)
  })

  readonly sandbox = Object.freeze({
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
  })

  readonly smart = Object.freeze({
    launch: (params: SmartLaunchParams) => this.smartLaunch(params),
    registerClient: (params: RegisterSmartClientParams) => this.registerSmartClient(params),
    exchangeToken: (params: SmartTokenParams) => this.exchangeSmartToken(params)
  })

  readonly fhir = Object.freeze({
    readPatient: (patientId: string, accessToken?: string) =>
      this.readFhirPatient(patientId, accessToken),
    search: (
      resourceType: string,
      params?: Record<string, string | number | boolean>,
      environmentId?: string
    ) => this.searchFhirResources(resourceType, params, environmentId),
    metadata: () => this.getFhirMetadata()
  })

  readonly patients = Object.freeze({
    /** @deprecated Use `sandbox.listSyntheticResources('Patient', connectionId)` for connection-scoped sandbox IDs. */
    list: (connectionId?: string) => this.listPatients(connectionId),
    /** @deprecated Use `sandbox.resource('Patient', patientId)` or connection-scoped catalog IDs. */
    get: (patientId: string, connectionId?: string) => this.getPatient(patientId, connectionId)
  })

  readonly webhooks = Object.freeze({
    triggerMockEvent: (params: TriggerMockEventParams) =>
      this.triggerMockEvent(params),
    listDeliveries: (params?: ListWebhookDeliveriesParams) =>
      this.listWebhookDeliveries(params ?? {}),
    replayDelivery: (deliveryId: string) => this.replayWebhookDelivery(deliveryId)
  })

  constructor(options: HebrahClientOptions) {
    const validApiKey = validateToken(options.apiKey, 'apiKey')
    const validTimeout = validateTimeoutMs(options.timeoutMs)
    const defaultConnId = options.defaultConnectionId?.trim() || undefined
    if (defaultConnId) {
      safePathSegment(defaultConnId, 'defaultConnectionId')
    }
    const defaultEnvId = options.environmentId?.trim() || undefined
    if (defaultEnvId) {
      safePathSegment(defaultEnvId, 'environmentId')
    }
    const cfg = {
      apiKey: validApiKey,
      baseUrl: resolveBaseUrl(options.baseUrl),
      defaultConnectionId: defaultConnId,
      environmentId: defaultEnvId,
      includeErrorDetail: options.includeErrorDetail,
      timeoutMs: validTimeout
    }
    Object.defineProperty(cfg, 'apiKey', {
      value: validApiKey,
      enumerable: false,
      writable: false,
      configurable: false
    })
    Object.defineProperty(this, 'config', {
      value: cfg,
      enumerable: false,
      writable: false,
      configurable: false
    })
  }

  toJSON(): Record<string, unknown> {
    return {
      baseUrl: this.config.baseUrl,
      defaultConnectionId: this.config.defaultConnectionId,
      environmentId: this.config.environmentId,
      apiKey: '[REDACTED]'
    }
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `HebrahClient { baseUrl: '${this.config.baseUrl}', apiKey: '[REDACTED]' }`
  }

  private resolveConnectionId(connectionId?: string): string | undefined {
    const resolved = connectionId?.trim() || this.config.defaultConnectionId
    if (resolved) {
      safePathSegment(resolved, 'connectionId')
    }
    return resolved
  }

  private requireConnectionId(connectionId?: string): string {
    const resolved = this.resolveConnectionId(connectionId)
    if (!resolved) {
      throw new Error('connectionId is required (pass as argument or set defaultConnectionId in client options)')
    }
    return resolved
  }

  private connectionQuery(connectionId?: string): string {
    const resolved = this.resolveConnectionId(connectionId)
    return resolved ? `?connection_id=${encodeURIComponent(resolved)}` : ''
  }

  get baseUrl(): string {
    return this.config.baseUrl
  }

  async query(
    params: TopLevelQueryParams
  ): Promise<ConnectionQueryResponse | DbQueryResponse> {
    const connId = params.connectionId ?? params.connection_id ?? (params.environmentId ? undefined : this.config.defaultConnectionId)
    if (connId) {
      const interpolated = interpolateSqlParams(params.sql, params.params)
      return this.queryScopedConnection(connId, {
        sql: interpolated,
        maxRows: params.maxRows ?? params.max_rows
      })
    }
    return this.queryEnvironmentDb(
      {
        sql: params.sql,
        params: params.params,
        addon: params.addon,
        actor_type: params.actor_type,
        environmentId: params.environmentId
      },
      params.environmentId
    )
  }

  async health(): Promise<HealthResponse> {
    return hebrahRequest<HealthResponse>(this.config, '/health', undefined, {
      skipAuth: true,
      errorPrefix: 'Health check failed',
      timeoutMessage: 'Health check timed out',
      unreachableMessage: 'Health check failed: control plane unreachable'
    })
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
      `/v1/sandbox/domains/${safePathSegment(domainId, 'domainId')}`
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
      `/v1/sandbox/resources/${safePathSegment(resourceType, 'resourceType')}/${safePathSegment(resourceId, 'resourceId')}${query}`
    )
  }

  private listSyntheticResources(
    resourceType: string,
    connectionId?: string
  ): Promise<SandboxResourceListResponse> {
    return hebrahRequest<SandboxResourceListResponse>(
      this.config,
      `/v1/sandbox/resources/${safePathSegment(resourceType, 'resourceType')}${this.connectionQuery(connectionId)}`
    )
  }

  private runSandboxScenario(
    scenarioId: string,
    params: RunScenarioParams = {}
  ): Promise<RunScenarioResponse> {
    return hebrahRequest<RunScenarioResponse>(
      this.config,
      `/v1/sandbox/scenarios/${safePathSegment(scenarioId, 'scenarioId')}/run`,
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
      `/v1/sandbox/payer-rules/${safePathSegment(payerId, 'payerId')}`
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
      `/v1/patients/${safePathSegment(patientId, 'patientId')}${this.connectionQuery(connectionId)}`
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
      `/v1/webhooks/deliveries/${safePathSegment(deliveryId, 'deliveryId')}/replay`,
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
    if (params.smartAppUrl) {
      assertSafeBaseUrl(params.smartAppUrl)
    }
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
    if (!Array.isArray(params.redirectUris) || params.redirectUris.length === 0) {
      throw new Error('redirectUris must be a non-empty array')
    }
    for (const uri of params.redirectUris) {
      assertSafeBaseUrl(uri)
    }
    return hebrahRequest<RegisterSmartClientResponse>(this.config, '/v1/smart/clients', {
      method: 'POST',
      body: JSON.stringify({
        client_id: params.clientId,
        name: params.name ?? 'SDK SMART client',
        redirect_uris: params.redirectUris
      })
    })
  }

  private exchangeSmartToken(params: SmartTokenParams): Promise<SmartTokenResponse> {
    assertSafeBaseUrl(params.redirectUri)
    const body = new URLSearchParams({
      grant_type: params.grantType ?? 'authorization_code',
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.clientId,
      code_verifier: params.codeVerifier
    })
    return hebrahRequest<SmartTokenResponse>(
      this.config,
      '/oauth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body
      },
      {
        skipAuth: true,
        errorPrefix: 'SMART token exchange failed',
        timeoutMessage: 'SMART token exchange timed out',
        unreachableMessage: 'SMART token exchange failed: control plane unreachable'
      }
    )
  }

  private readFhirPatient(
    patientId: string,
    accessToken?: string
  ): Promise<Record<string, unknown>> {
    const bearerToken = accessToken?.trim()
      ? validateToken(accessToken, 'accessToken')
      : undefined
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/fhir/R4/Patient/${safePathSegment(patientId, 'patientId')}`,
      {
        headers: { Accept: 'application/fhir+json' }
      },
      {
        bearerToken,
        errorPrefix: 'FHIR Patient read failed',
        timeoutMessage: 'FHIR Patient read timed out',
        unreachableMessage: 'FHIR Patient read failed: control plane unreachable'
      }
    )
  }

  private async searchFhirResources(
    resourceType: string,
    params?: Record<string, string | number | boolean>,
    environmentId?: string
  ): Promise<unknown> {
    const safeType = safePathSegment(resourceType, 'resourceType')
    const envId = environmentId ?? this.config.environmentId
    if (resourceType.trim().toLowerCase() === 'patient' && envId) {
      return this.listEnvironmentPatients(envId)
    }
    const search = new URLSearchParams()
    const resolvedConn = this.resolveConnectionId()
    if (resolvedConn) {
      search.set('connection_id', resolvedConn)
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          search.set(k, String(v))
        }
      }
    }
    const q = search.toString() ? `?${search.toString()}` : ''
    return hebrahRequest<unknown>(this.config, `/v1/sandbox/resources/${safeType}${q}`)
  }

  private getFhirMetadata(): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(this.config, '/fhir/R4/metadata', {
      headers: { Accept: 'application/fhir+json' }
    })
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
      `/v1/sandbox/credentialing/practitioners/${safePathSegment(practitionerId, 'practitionerId')}`
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
    const resolved = environmentId?.trim() || this.config.environmentId
    if (!resolved) {
      throw new Error('environmentId is required (pass as argument or set in client options)')
    }
    safePathSegment(resolved, 'environmentId')
    return resolved
  }

  private listEnvironments(): Promise<EnvironmentSummary[]> {
    return hebrahRequest<EnvironmentSummary[]>(this.config, '/v1/environments')
  }

  private getEnvironment(environmentId: string): Promise<EnvironmentDetail> {
    return hebrahRequest<EnvironmentDetail>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}`
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
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/pause`,
      { method: 'POST' }
    )
  }

  private resumeEnvironment(environmentId: string): Promise<EnvironmentSummary> {
    return hebrahRequest<EnvironmentSummary>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/resume`,
      { method: 'POST' }
    )
  }

  private destroyEnvironment(environmentId: string): Promise<{ success: boolean; message: string }> {
    return hebrahRequest<{ success: boolean; message: string }>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}`,
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
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/modules`,
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
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/modules/${safePathSegment(moduleId, 'moduleId')}`,
      { method: 'DELETE' }
    )
  }

  private getEnvironmentWireguardConfig(
    environmentId: string
  ): Promise<WireguardConfigResponse> {
    return hebrahRequest<WireguardConfigResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/wireguard/config`
    )
  }

  private listEnvironmentPatients(
    environmentId: string,
    params?: ListEnvironmentPatientsParams
  ): Promise<Record<string, unknown>[]> {
    const search = new URLSearchParams()
    if (params?.department) search.set('department', params.department)
    if (params?.acuity) search.set('acuity', params.acuity)
    if (params?.status) search.set('status', params.status)
    if (params?.search) search.set('search', params.search)
    if (params?.limit !== undefined) search.set('limit', String(params.limit))
    const q = search.toString() ? `?${search.toString()}` : ''
    return hebrahRequest<Record<string, unknown>[]>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/ehr/patients${q}`
    )
  }

  private admitEnvironmentPatients(
    environmentId: string,
    params: AdmitPatientsParams = {}
  ): Promise<AdmitPatientsResponse> {
    const cohort = params.patient_cohort ?? params.cohort
    return hebrahRequest<AdmitPatientsResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/ehr/patients/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          count: params.count ?? 5,
          ...(cohort ? { cohort, patient_cohort: cohort } : {}),
          ...(params.acuity ? { acuity: params.acuity } : {}),
          ...(params.notes ? { notes: params.notes } : {})
        })
      }
    )
  }

  private getEnvironmentPatientChart(
    environmentId: string,
    patientId: string
  ): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/ehr/patients/${safePathSegment(patientId, 'patientId')}`
    )
  }

  private triggerEnvironmentScenario(
    environmentId: string,
    params: TriggerClinicScenarioParams
  ): Promise<TriggerClinicScenarioResponse> {
    return hebrahRequest<TriggerClinicScenarioResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/ehr/scenarios/trigger`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      }
    )
  }

  private connectEnvironmentAgent(
    environmentId: string,
    params: ConnectAgentParams = {}
  ): Promise<EnvironmentDetail> {
    return hebrahRequest<EnvironmentDetail>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/agents/connect`,
      {
        method: 'POST',
        body: JSON.stringify({
          agent_name: params.agent_name ?? params.agentName ?? 'hebrah-sdk-agent',
          client: params.client ?? 'sdk-node'
        })
      }
    )
  }

  private getEnvironmentAutosave(
    environmentId: string
  ): Promise<AutosaveConfigResponse> {
    return hebrahRequest<AutosaveConfigResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/autosave`
    )
  }

  private updateEnvironmentAutosave(
    environmentId: string,
    params: AutosaveConfigUpdateParams
  ): Promise<AutosaveConfigResponse> {
    return hebrahRequest<AutosaveConfigResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/autosave`,
      {
        method: 'PATCH',
        body: JSON.stringify(params)
      }
    )
  }

  private listEnvironmentDbTables(
    environmentId: string
  ): Promise<DbTablesResponse> {
    return hebrahRequest<DbTablesResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/db/tables`
    )
  }

  private recordEnvironmentOutcome(
    params: RecordOutcomeParams,
    environmentId?: string
  ): Promise<RecordOutcomeResponse> {
    const envId = this.resolveEnvironmentId(environmentId ?? params.environmentId)
    const outcomeType = params.outcome_type ?? params.outcomeType
    if (!outcomeType?.trim()) {
      throw new Error('outcomeType is required')
    }
    if (!params.summary?.trim()) {
      throw new Error('summary is required')
    }
    const patientId = params.patient_id ?? params.patientId
    const sourceAgent = params.source_agent ?? params.sourceAgent ?? 'hebrah-sdk-node'
    const agentId = params.agent_id ?? params.agentId
    const score = params.score ?? params.risk_score ?? params.riskScore
    return hebrahRequest<RecordOutcomeResponse>(
      this.config,
      `/v1/environments/${safePathSegment(envId, 'environmentId')}/db/outcomes`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...(patientId ? { patient_id: patientId } : {}),
          outcome_type: outcomeType.trim(),
          source_agent: sourceAgent,
          ...(agentId ? { agent_id: agentId } : {}),
          ...(score !== undefined ? { score, risk_score: score } : {}),
          summary: params.summary,
          payload: params.payload ?? {}
        })
      }
    )
  }

  private getEnvironmentLogs(
    environmentId: string
  ): Promise<EnvironmentLogItem[]> {
    return hebrahRequest<EnvironmentLogItem[]>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/logs`
    )
  }

  private consultEnvironmentArchitect(
    params: ConsultArchitectParams
  ): Promise<ConsultArchitectResponse> {
    if (!params.prompt || typeof params.prompt !== 'string' || !params.prompt.trim()) {
      throw new Error('prompt is required')
    }
    const sessionId = params.session_id ?? params.sessionId
    return hebrahRequest<ConsultArchitectResponse>(
      this.config,
      '/v1/environments/architect',
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: params.prompt.trim(),
          ...(sessionId ? { session_id: sessionId } : {})
        })
      }
    )
  }

  private consultEnvironmentStudio(
    environmentId: string,
    params: ConsultStudioParams
  ): Promise<ConsultStudioResponse> {
    if (!params.prompt || typeof params.prompt !== 'string' || !params.prompt.trim()) {
      throw new Error('prompt is required')
    }
    const sessionId = params.session_id ?? params.sessionId
    const applyChanges = params.apply_changes ?? params.applyChanges
    return hebrahRequest<ConsultStudioResponse>(
      this.config,
      `/v1/environments/${safePathSegment(environmentId, 'environmentId')}/studio/chat`,
      {
        method: 'POST',
        body: JSON.stringify({
          prompt: params.prompt.trim(),
          ...(sessionId ? { session_id: sessionId } : {}),
          ...(applyChanges !== undefined ? { apply_changes: Boolean(applyChanges) } : {})
        })
      }
    )
  }

  private getOpenDataCatalog(environmentId?: string): Promise<Record<string, unknown>> {
    const envId = environmentId?.trim() || this.config.environmentId
    if (envId) {
      return hebrahRequest<Record<string, unknown>>(
        this.config,
        `/v1/environments/${safePathSegment(envId, 'environmentId')}/open-data/catalog`
      )
    }
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      '/v1/sandbox/research-packs/clinical_knowledge_v1'
    )
  }

  private queryEnvironmentDb(
    params: DbQueryParams,
    environmentId?: string
  ): Promise<DbQueryResponse> {
    const envId = this.resolveEnvironmentId(environmentId ?? params.environmentId)
    const interpolatedSql = interpolateSqlParams(params.sql, params.params)
    return hebrahRequest<DbQueryResponse>(
      this.config,
      `/v1/environments/${safePathSegment(envId, 'environmentId')}/db/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          sql: interpolatedSql,
          addon: params.addon ?? 'postgres',
          actor_type: params.actor_type ?? 'agent'
        })
      }
    )
  }

  private listConnectionTargets(params: ListTargetsParams = {}): Promise<TargetSummary[]> {
    const search = new URLSearchParams()
    if (params.pack) search.set('pack', params.pack)
    if (params.all) search.set('all', 'true')
    if (params.healthy) search.set('healthy', 'true')
    const q = search.toString() ? `?${search.toString()}` : ''
    return hebrahRequest<TargetSummary[]>(this.config, `/v1/connections/targets${q}`)
  }

  private getConnectionTarget(targetId: string): Promise<TargetDetail> {
    return hebrahRequest<TargetDetail>(
      this.config,
      `/v1/connections/targets/${safePathSegment(targetId, 'targetId')}`
    )
  }

  private listConnectionPacks(params: { all?: boolean } = {}): Promise<PackSummary[]> {
    const q = params.all ? '?all=true' : ''
    return hebrahRequest<PackSummary[]>(this.config, `/v1/connections/packs${q}`)
  }

  private openScopedConnection(params: OpenConnectionParams): Promise<OpenConnectionResponse> {
    const targetId = params.target_id ?? params.targetId
    if (!targetId?.trim()) {
      throw new Error('targetId is required')
    }
    return hebrahRequest<OpenConnectionResponse>(this.config, '/v1/connections', {
      method: 'POST',
      body: JSON.stringify({
        target_id: targetId.trim(),
        scopes: params.scopes,
        tier: params.tier ?? 'container',
        ttl_seconds: params.ttl_seconds ?? params.ttlSeconds ?? 3600
      })
    })
  }

  private listScopedConnections(params: { status?: string } = {}): Promise<ConnectionSummary[]> {
    const q = params.status ? `?status=${encodeURIComponent(params.status)}` : ''
    return hebrahRequest<ConnectionSummary[]>(this.config, `/v1/connections${q}`)
  }

  private getScopedConnection(connectionId?: string): Promise<ConnectionDetail> {
    const resolved = this.requireConnectionId(connectionId)
    return hebrahRequest<ConnectionDetail>(
      this.config,
      `/v1/connections/${safePathSegment(resolved, 'connectionId')}`
    )
  }

  private queryScopedConnection(
    connectionId: string,
    params: ConnectionQueryParams
  ): Promise<ConnectionQueryResponse> {
    const maxRows = params.max_rows ?? params.maxRows
    return hebrahRequest<ConnectionQueryResponse>(
      this.config,
      `/v1/connections/${safePathSegment(connectionId, 'connectionId')}/query`,
      {
        method: 'POST',
        body: JSON.stringify({
          sql: params.sql,
          ...(maxRows !== undefined ? { max_rows: maxRows } : {})
        })
      }
    )
  }

  private revokeScopedConnection(
    connectionId: string,
    reason?: string
  ): Promise<{ connectionId: string; status: string }> {
    return hebrahRequest<{ connectionId: string; status: string }>(
      this.config,
      `/v1/connections/${safePathSegment(connectionId, 'connectionId')}/revoke`,
      {
        method: 'POST',
        body: JSON.stringify(reason ? { reason } : {})
      }
    )
  }

  private listConnectionAudit(
    connectionId: string,
    params: ListConnectionAuditParams = {}
  ): Promise<ConnectionAuditEvent[]> {
    const search = new URLSearchParams()
    if (params.limit !== undefined) search.set('limit', String(params.limit))
    const eventType = params.event_type ?? params.eventType
    if (eventType) search.set('event_type', eventType)
    const q = search.toString() ? `?${search.toString()}` : ''
    return hebrahRequest<ConnectionAuditEvent[]>(
      this.config,
      `/v1/connections/${safePathSegment(connectionId, 'connectionId')}/audit${q}`
    )
  }

  private verifyConnectionAudit(connectionId?: string): Promise<AuditChainVerification> {
    const resolved = this.requireConnectionId(connectionId)
    return hebrahRequest<AuditChainVerification>(
      this.config,
      `/v1/audit/verify?connection_id=${encodeURIComponent(resolved)}`
    )
  }

  private getAgentUsage(): Promise<AgentUsageResponse> {
    return hebrahRequest<AgentUsageResponse>(this.config, '/v1/agent/account/usage')
  }

  private getAgentWallet(): Promise<AgentWalletResponse> {
    return hebrahRequest<AgentWalletResponse>(this.config, '/v1/agent/wallet')
  }

  private createAgentTopup(params: AgentTopupParams): Promise<AgentTopupResponse> {
    const amountCents = params.amount_cents ?? params.amountCents
    if (amountCents === undefined) {
      throw new Error('amountCents is required')
    }
    if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error('amountCents must be a positive integer')
    }
    const successUrl = params.success_url ?? params.successUrl
    if (successUrl) {
      assertSafeBaseUrl(successUrl)
    }
    const cancelUrl = params.cancel_url ?? params.cancelUrl
    if (cancelUrl) {
      assertSafeBaseUrl(cancelUrl)
    }
    return hebrahRequest<AgentTopupResponse>(this.config, '/v1/agent/topup', {
      method: 'POST',
      body: JSON.stringify({
        amount_cents: amountCents,
        ...(successUrl ? { success_url: successUrl } : {}),
        ...(cancelUrl ? { cancel_url: cancelUrl } : {})
      })
    })
  }
}

