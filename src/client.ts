import { HebrahApiError } from './errors.js'
import { hebrahRequest, resolveBaseUrl } from './http.js'
import type {
  HealthResponse,
  PatientListResponse,
  SandboxCatalog,
  TriggerMockEventParams,
  TriggerMockEventResponse,
  HebrahClientOptions
} from './types.js'

export class HebrahClient {
  private readonly config: { apiKey: string; baseUrl: string }

  readonly sandbox = {
    catalog: (connectionId?: string) => this.getSandboxCatalog(connectionId)
  }

  readonly patients = {
    list: () => this.listPatients(),
    get: (patientId: string) => this.getPatient(patientId)
  }

  readonly webhooks = {
    triggerMockEvent: (params: TriggerMockEventParams) =>
      this.triggerMockEvent(params)
  }

  constructor(options: HebrahClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error('apiKey is required')
    }
    this.config = {
      apiKey: options.apiKey.trim(),
      baseUrl: resolveBaseUrl(options.baseUrl)
    }
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
    const query = connectionId
      ? `?connection_id=${encodeURIComponent(connectionId)}`
      : ''
    return hebrahRequest<SandboxCatalog>(
      this.config,
      `/v1/sandbox/catalog${query}`
    )
  }

  private listPatients(): Promise<PatientListResponse> {
    return hebrahRequest<PatientListResponse>(this.config, '/v1/patients')
  }

  private getPatient(patientId: string): Promise<Record<string, unknown>> {
    return hebrahRequest<Record<string, unknown>>(
      this.config,
      `/v1/patients/${encodeURIComponent(patientId)}`
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
          event: params.event,
          ...(params.patientId ? { patient_id: params.patientId } : {})
        })
      }
    )
  }
}