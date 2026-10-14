import { assertSafeBaseUrl, fetchWithTimeout } from './http.js'

export type LlmProvider = 'openai' | 'anthropic' | 'azure' | 'ollama' | 'openai_compatible'

export interface HebrahAgentHarnessOptions {
  mcpUrl: string
  pat: string
  dashboardUrl?: string
  hebrahApiUrl?: string
  integrationAgentUrl?: string
  timeoutMs?: number
  llm?: {
    provider: LlmProvider
    model: string
    apiKey?: string
    baseUrl?: string
  }
}

async function mcpCall(
  mcpUrl: string,
  pat: string,
  tool: string,
  args: Record<string, unknown> = {},
  timeoutMs?: number
): Promise<unknown> {
  const base = mcpUrl.replace(/\/$/, '')
  assertSafeBaseUrl(base)
  const res = await fetchWithTimeout(
    `${base}/mcp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pat}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: tool, arguments: args }
      })
    },
    timeoutMs
  )
  if (!res.ok) {
    throw new Error(`MCP ${tool} failed (${res.status}): ${await res.text()}`)
  }
  const payload = await res.json() as { result?: { content?: Array<{ text?: string }> }, error?: { message?: string } }
  if (payload.error) {
    throw new Error(payload.error.message ?? 'MCP tool error')
  }
  const text = payload.result?.content?.[0]?.text
  return text ? JSON.parse(text) : payload.result
}

export class HebrahAgentHarness {
  private readonly opts: HebrahAgentHarnessOptions

  constructor(options: HebrahAgentHarnessOptions) {
    if (!options.pat?.trim()) {
      throw new Error('pat is required')
    }
    if (!options.mcpUrl?.trim()) {
      throw new Error('mcpUrl is required')
    }
    assertSafeBaseUrl(options.mcpUrl.trim().replace(/\/$/, ''))
    if (options.hebrahApiUrl) {
      assertSafeBaseUrl(options.hebrahApiUrl.trim().replace(/\/$/, ''))
    }
    if (options.integrationAgentUrl) {
      assertSafeBaseUrl(options.integrationAgentUrl.trim().replace(/\/$/, ''))
    }
    this.opts = {
      ...options,
      mcpUrl: options.mcpUrl.trim().replace(/\/$/, ''),
      pat: options.pat.trim()
    }
  }

  async getDeveloperDoc(connectionId?: string) {
    return mcpCall(
      this.opts.mcpUrl,
      this.opts.pat,
      'get_connection_developer_doc',
      { connectionId },
      this.opts.timeoutMs
    )
  }

  async getSyntheticEhrProfile(connectionId?: string) {
    return mcpCall(
      this.opts.mcpUrl,
      this.opts.pat,
      'get_synthetic_ehr_profile',
      { connectionId },
      this.opts.timeoutMs
    )
  }

  async listBaseEhrModels() {
    return mcpCall(
      this.opts.mcpUrl,
      this.opts.pat,
      'list_ehr_base_models',
      {},
      this.opts.timeoutMs
    )
  }

  async researchAndModelEhr(input: {
    vendor: string
    connectionId: string
    docUrls?: string[]
    docText?: string
  }) {
    const agentUrl = (this.opts.integrationAgentUrl ?? 'http://localhost:3050').replace(/\/$/, '')
    assertSafeBaseUrl(agentUrl)
    const chunkIds: string[] = []
    for (const url of input.docUrls ?? []) {
      const ingest = await fetchWithTimeout(
        `${agentUrl}/v1/ingest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: input.connectionId, url })
        },
        this.opts.timeoutMs
      )
      if (ingest.ok) {
        const body = await ingest.json() as { chunk_id: string }
        chunkIds.push(body.chunk_id)
      }
    }
    if (input.docText) {
      const ingest = await fetchWithTimeout(
        `${agentUrl}/v1/ingest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: input.connectionId, text: input.docText })
        },
        this.opts.timeoutMs
      )
      if (ingest.ok) {
        const body = await ingest.json() as { chunk_id: string }
        chunkIds.push(body.chunk_id)
      }
    }
    const gen = await fetchWithTimeout(
      `${agentUrl}/v1/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: input.connectionId,
          vendor: input.vendor,
          doc_chunk_ids: chunkIds
        })
      },
      this.opts.timeoutMs
    )
    if (!gen.ok) {
      throw new Error(`Model generation failed: ${await gen.text()}`)
    }
    return gen.json()
  }

  async validateSandbox(connectionId?: string) {
    const profile = await this.getSyntheticEhrProfile(connectionId)
    const doc = await this.getDeveloperDoc(connectionId)
    return { profile, doc, ok: Boolean(profile && doc) }
  }

  async runSandboxScenario(scenarioId: string, connectionId?: string) {
    return mcpCall(
      this.opts.mcpUrl,
      this.opts.pat,
      'run_sandbox_scenario',
      { scenarioId, connectionId },
      this.opts.timeoutMs
    )
  }
}

