export type LlmProvider = 'openai' | 'anthropic' | 'azure' | 'ollama' | 'openai_compatible'

export interface HebrahAgentHarnessOptions {
  mcpUrl: string
  pat: string
  dashboardUrl?: string
  hebrahApiUrl?: string
  integrationAgentUrl?: string
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
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const res = await fetch(`${mcpUrl.replace(/\/$/, '')}/mcp`, {
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
  })
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
    this.opts = options
  }

  async getDeveloperDoc(connectionId?: string) {
    return mcpCall(this.opts.mcpUrl, this.opts.pat, 'get_connection_developer_doc', {
      connectionId
    })
  }

  async getSyntheticEhrProfile(connectionId?: string) {
    return mcpCall(this.opts.mcpUrl, this.opts.pat, 'get_synthetic_ehr_profile', {
      connectionId
    })
  }

  async listBaseEhrModels() {
    return mcpCall(this.opts.mcpUrl, this.opts.pat, 'list_ehr_base_models')
  }

  async researchAndModelEhr(input: {
    vendor: string
    connectionId: string
    docUrls?: string[]
    docText?: string
  }) {
    const agentUrl = this.opts.integrationAgentUrl ?? 'http://localhost:3050'
    const chunkIds: string[] = []
    for (const url of input.docUrls ?? []) {
      const ingest = await fetch(`${agentUrl}/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: input.connectionId, url })
      })
      if (ingest.ok) {
        const body = await ingest.json() as { chunk_id: string }
        chunkIds.push(body.chunk_id)
      }
    }
    if (input.docText) {
      const ingest = await fetch(`${agentUrl}/v1/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection_id: input.connectionId, text: input.docText })
      })
      if (ingest.ok) {
        const body = await ingest.json() as { chunk_id: string }
        chunkIds.push(body.chunk_id)
      }
    }
    const gen = await fetch(`${agentUrl}/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        connection_id: input.connectionId,
        vendor: input.vendor,
        doc_chunk_ids: chunkIds
      })
    })
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
    return mcpCall(this.opts.mcpUrl, this.opts.pat, 'run_sandbox_scenario', {
      scenarioId,
      connectionId
    })
  }
}
