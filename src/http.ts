import { HebrahApiError } from './errors.js'
import { DEFAULT_BASE_URL } from './types.js'

const DEFAULT_TIMEOUT_MS = 30_000

const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface HttpClientConfig {
  apiKey: string
  baseUrl: string
  /** When false, HebrahApiError.detail is omitted. Default true. */
  includeErrorDetail?: boolean
}

export function errorDetail(config: HttpClientConfig, raw?: string): string | undefined {
  return config.includeErrorDetail !== false ? raw : undefined
}

export function assertSafeBaseUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid baseUrl: ${url}`)
  }

  if (parsed.protocol === 'https:') {
    return
  }

  if (parsed.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(parsed.hostname)) {
    return
  }

  throw new Error(
    `baseUrl must use https:// or http://localhost/127.0.0.1 for local development (got ${parsed.protocol}//${parsed.hostname})`
  )
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
}

export async function hebrahRequest<T>(
  config: HttpClientConfig,
  path: string,
  init?: RequestInit
): Promise<T> {
  const base = config.baseUrl.replace(/\/$/, '')
  const url = `${base}${path}`

  let response: Response
  try {
    response = await fetchWithTimeout(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new HebrahApiError('Control plane request timed out', 504)
    }
    throw new HebrahApiError(
      `Control plane unreachable at ${base}. Is hebrah-api running?`,
      503
    )
  }

  if (!response.ok) {
    const detail = errorDetail(config, await response.text())
    throw new HebrahApiError(
      `Control plane request failed (${response.status})`,
      response.status,
      detail
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function resolveBaseUrl(baseUrl?: string): string {
  const resolved = (baseUrl ?? process.env.HEBRAH_API_BASE_URL ?? DEFAULT_BASE_URL).replace(
    /\/$/,
    ''
  )
  assertSafeBaseUrl(resolved)
  return resolved
}
