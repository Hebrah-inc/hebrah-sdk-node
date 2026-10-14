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

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bhb_(?:live|test|pat|conn|claim)_[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_HEBRAH_TOKEN]'],
  [/\benc:v1:[A-Za-z0-9+/=_:-]+/g, 'enc:v1:[REDACTED]'],
  [/(PrivateKey\s*=\s*)[^\r\n]+/gi, '$1[REDACTED]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[REDACTED]']
]

export function redactSecrets(raw: string): string {
  let out = raw
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

export function errorDetail(config: HttpClientConfig, raw?: string): string | undefined {
  if (config.includeErrorDetail === false || raw === undefined) {
    return undefined
  }
  return redactSecrets(raw)
}

export function assertSafeBaseUrl(url: string): void {
  if (/[\x00-\x1f\x7f]/.test(url)) {
    throw new Error('Invalid baseUrl: contains control characters')
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`Invalid baseUrl: ${redactSecrets(url)}`)
  }

  if (parsed.username || parsed.password) {
    throw new Error('Invalid baseUrl: embedded credentials in URL are not allowed')
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

const PRIVATE_OR_METADATA_HOST_RE =
  /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|0\.0\.0\.0|\[?::1\]?|\[?fe80:[^\]]*\]?|\[?fc00:[^\]]*\]?|\[?fd[0-9a-f]{2}:[^\]]*\]?|metadata\.google\.internal)$/i

export function assertSafeExternalUrl(url: string, label = 'url'): string {
  if (typeof url !== 'string' || !url.trim() || /[\x00-\x1f\x7f]/.test(url)) {
    throw new Error(`Invalid ${label}`)
  }
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    throw new Error(`Invalid ${label}: ${redactSecrets(url)}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${label} must use https:// or http:// protocol`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain embedded credentials`)
  }
  const host = parsed.hostname.toLowerCase()
  if (
    PRIVATE_OR_METADATA_HOST_RE.test(host) ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    throw new Error(`${label} cannot target private, loopback, or metadata hosts (${host})`)
  }
  return parsed.toString()
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

export function safePathSegment(value: string, name = 'id'): string {
  if (typeof value !== 'string') {
    throw new Error(`${name} is required`)
  }
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`${name} is required`)
  }
  if (
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('\\') ||
    trimmed.includes('..') ||
    /%(?:2e|5c)/i.test(trimmed) ||
    /[\x00-\x1f\x7f]/.test(trimmed)
  ) {
    throw new Error(`Invalid ${name}`)
  }
  return encodeURIComponent(trimmed)
}

