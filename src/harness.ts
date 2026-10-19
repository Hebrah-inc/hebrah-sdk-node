import {
  assertSafeBaseUrl,
  assertSafeExternalUrl,
  fetchWithTimeout,
  redactSecrets,
  safePathSegment,
  validateTimeoutMs,
  validateToken
} from './http.js'

export type LlmProvider = 'openai' | 'anthropic' | 'azure' | 'ollama' | 'openai_compatible'

const MAX_TOOL_OUTPUT_CHARS = 256_000
const MAX_DOC_URLS = 20

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
  if (!tool || typeof tool !== 'string' || !/^[a-zA-Z0-9_.-]{1,128}$/.test(tool)) {
    throw new Error('Invalid MCP tool name')
  }
  const base = mcpUrl.replace(/\/+$/, '')
  assertSafeBaseUrl(base)
  const validPat = validateToken(pat, 'pat')
  const endpoint = base.endsWith('/mcp') ? base : `${base}/mcp`
  const res = await fetchWithTimeout(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: `Bearer ${validPat}`
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
    const rawErr = (await res.text()).slice(0, 4096)
    throw new Error(`MCP ${tool} failed (${res.status}): ${redactSecrets(rawErr)}`)
  }
  let payload: {
    result?: {
      isError?: boolean
      content?: Array<{ text?: string }>
    }
    error?: { message?: string }
  }
  try {
    payload = await res.json()
  } catch {
    throw new Error(`MCP ${tool} returned invalid JSON`)
  }
  if (payload.error) {
    throw new Error(redactSecrets(payload.error.message ?? 'MCP tool error'))
  }
  const text = payload.result?.content?.[0]?.text
  if (payload.result?.isError) {
    const errMsg = typeof text === 'string' && text.trim() ? text : 'MCP tool execution error'
    throw new Error(redactSecrets(errMsg.slice(0, 4096)))
  }
  if (typeof text !== 'string') {
    return payload.result
  }
  const boundedText =
    text.length > MAX_TOOL_OUTPUT_CHARS ? `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}...[truncated]` : text
  try {
    return JSON.parse(boundedText)
  } catch {
    return redactSecrets(boundedText)
  }
}

export class HebrahAgentHarness {
  private readonly opts!: HebrahAgentHarnessOptions

  constructor(options: HebrahAgentHarnessOptions) {
    const validPat = validateToken(options.pat, 'pat')
    if (!options.mcpUrl?.trim()) {
      throw new Error('mcpUrl is required')
    }
    const validTimeout = validateTimeoutMs(options.timeoutMs)
    const cleanMcpUrl = options.mcpUrl.trim().replace(/\/$/, '')
    assertSafeBaseUrl(cleanMcpUrl)
    if (options.hebrahApiUrl) {
      assertSafeBaseUrl(options.hebrahApiUrl.trim().replace(/\/$/, ''))
    }
    if (options.integrationAgentUrl) {
      assertSafeBaseUrl(options.integrationAgentUrl.trim().replace(/\/$/, ''))
    }
    const sanitizedLlm = options.llm ? { ...options.llm } : undefined
    if (sanitizedLlm && sanitizedLlm.apiKey) {
      const validLlmKey = validateToken(sanitizedLlm.apiKey, 'llm.apiKey')
      Object.defineProperty(sanitizedLlm, 'apiKey', {
        value: validLlmKey,
        enumerable: false,
        writable: false,
        configurable: false
      })
    }
    const optsCopy: HebrahAgentHarnessOptions = {
      ...options,
      timeoutMs: validTimeout,
      llm: sanitizedLlm,
      mcpUrl: cleanMcpUrl,
      pat: validPat
    }
    Object.defineProperty(optsCopy, 'pat', {
      value: validPat,
      enumerable: false,
      writable: false,
      configurable: false
    })
    Object.defineProperty(this, 'opts', {
      value: optsCopy,
      enumerable: false,
      writable: false,
      configurable: false
    })
  }

  toJSON(): Record<string, unknown> {
    return {
      mcpUrl: this.opts.mcpUrl,
      pat: '[REDACTED]'
    }
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return `HebrahAgentHarness { mcpUrl: '${this.opts.mcpUrl}', pat: '[REDACTED]' }`
  }

  async callTool(tool: string, args: Record<string, unknown> = {}) {
    return mcpCall(this.opts.mcpUrl, this.opts.pat, tool, args, this.opts.timeoutMs)
  }

  async getDeveloperDoc(connectionId?: string) {
    if (connectionId !== undefined) {
      safePathSegment(connectionId, 'connectionId')
    }
    return mcpCall(
      this.opts.mcpUrl,
      this.opts.pat,
      'get_connection_developer_doc',
      { connectionId },
      this.opts.timeoutMs
    )
  }

  async getSyntheticEhrProfile(connectionId?: string) {
    if (connectionId !== undefined) {
      safePathSegment(connectionId, 'connectionId')
    }
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
    safePathSegment(input.connectionId, 'connectionId')
    if (!input.vendor || typeof input.vendor !== 'string' || !input.vendor.trim()) {
      throw new Error('vendor is required')
    }
    const rawUrls = input.docUrls ?? []
    if (rawUrls.length > MAX_DOC_URLS) {
      throw new Error(`docUrls cannot exceed ${MAX_DOC_URLS} URLs per call`)
    }
    const agentUrl = (this.opts.integrationAgentUrl ?? 'http://localhost:3050').replace(/\/$/, '')
    assertSafeBaseUrl(agentUrl)
    const validatedUrls = rawUrls.map((u) => assertSafeExternalUrl(u, 'docUrl'))

    const urlChunkPromises = validatedUrls.map(async (url) => {
      const ingest = await fetchWithTimeout(
        `${agentUrl}/v1/ingest`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connection_id: input.connectionId, url })
        },
        this.opts.timeoutMs
      )
      if (!ingest.ok) return null
      const body = (await ingest.json()) as { chunk_id?: string }
      return body.chunk_id ?? null
    })

    const textChunkPromise = input.docText
      ? (async () => {
          const ingest = await fetchWithTimeout(
            `${agentUrl}/v1/ingest`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ connection_id: input.connectionId, text: input.docText })
            },
            this.opts.timeoutMs
          )
          if (!ingest.ok) return null
          const body = (await ingest.json()) as { chunk_id?: string }
          return body.chunk_id ?? null
        })()
      : Promise.resolve(null)

    const [urlChunks, textChunk] = await Promise.all([Promise.all(urlChunkPromises), textChunkPromise])
    const chunkIds = [
      ...urlChunks.filter((id): id is string => Boolean(id)),
      ...(textChunk ? [textChunk] : [])
    ]

    const gen = await fetchWithTimeout(
      `${agentUrl}/v1/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: input.connectionId,
          vendor: input.vendor.trim(),
          doc_chunk_ids: chunkIds
        })
      },
      this.opts.timeoutMs
    )
    if (!gen.ok) {
      const rawErr = (await gen.text()).slice(0, 4096)
      throw new Error(`Model generation failed: ${redactSecrets(rawErr)}`)
    }
    return gen.json()
  }

  async validateSandbox(connectionId?: string) {
    if (connectionId !== undefined) {
      safePathSegment(connectionId, 'connectionId')
    }
    const [profile, doc] = await Promise.all([
      this.getSyntheticEhrProfile(connectionId),
      this.getDeveloperDoc(connectionId)
    ])
    return { profile, doc, ok: Boolean(profile && doc) }
  }

  async runSandboxScenario(scenarioId: string, connectionId?: string) {
    safePathSegment(scenarioId, 'scenarioId')
    if (connectionId !== undefined) {
      safePathSegment(connectionId, 'connectionId')
    }
    return mcpCall(
      this.opts.mcpUrl,
      this.opts.pat,
      'run_sandbox_scenario',
      { scenarioId, connectionId },
      this.opts.timeoutMs
    )
  }
}

