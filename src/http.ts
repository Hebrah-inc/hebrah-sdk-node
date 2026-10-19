import { HebrahApiError, redactSecrets } from './errors.js'
import { DEFAULT_BASE_URL } from './types.js'

export { redactSecrets }

const DEFAULT_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 100
const MAX_TIMEOUT_MS = 300_000
const MAX_ERROR_DETAIL_LENGTH = 4_096
const MAX_PATH_SEGMENT_LENGTH = 256

const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export interface HttpClientConfig {
  apiKey: string
  baseUrl: string
  /** When false, HebrahApiError.detail is omitted. Default true. */
  includeErrorDetail?: boolean
  /** Request timeout in milliseconds (100..300000). Default 30000. */
  timeoutMs?: number
}

export interface HebrahRequestOptions {
  /** Omit the Authorization header (e.g., /health or /oauth/token). */
  skipAuth?: boolean
  /** Override the Bearer token (e.g., SMART access token on FHIR reads). */
  bearerToken?: string
  /** Prefix for HTTP error and timeout messages (defaults to "Control plane request"). */
  errorPrefix?: string
  /** Custom timeout error message. */
  timeoutMessage?: string
  /** Custom unreachable network error message. */
  unreachableMessage?: string
  /** Per-request timeout override in milliseconds. */
  timeoutMs?: number
}

export function validateToken(rawToken: string, name = 'apiKey'): string {
  if (typeof rawToken !== 'string') {
    throw new Error(`${name} is required`)
  }
  if (/[\x00-\x1f\x7f]/.test(rawToken)) {
    throw new Error(`Invalid ${name}: must not contain whitespace or control characters`)
  }
  const trimmed = rawToken.trim()
  if (!trimmed) {
    throw new Error(`${name} is required`)
  }
  if (/\s/.test(trimmed)) {
    throw new Error(`Invalid ${name}: must not contain whitespace or control characters`)
  }
  return trimmed
}

export function validateTimeoutMs(timeoutMs?: number): number {
  if (timeoutMs === undefined) {
    return DEFAULT_TIMEOUT_MS
  }
  if (
    typeof timeoutMs !== 'number' ||
    !Number.isFinite(timeoutMs) ||
    timeoutMs < MIN_TIMEOUT_MS ||
    timeoutMs > MAX_TIMEOUT_MS
  ) {
    throw new Error(`timeoutMs must be a finite number between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`)
  }
  return Math.floor(timeoutMs)
}

export function errorDetail(config: HttpClientConfig, raw?: string): string | undefined {
  if (config.includeErrorDetail === false || raw === undefined) {
    return undefined
  }
  const bounded =
    raw.length > MAX_ERROR_DETAIL_LENGTH
      ? `${raw.slice(0, MAX_ERROR_DETAIL_LENGTH)}...[truncated]`
      : raw
  return redactSecrets(bounded)
}

export function assertSafeBaseUrl(url: string): void {
  if (typeof url !== 'string' || !url.trim() || /[\x00-\x1f\x7f]/.test(url)) {
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

  if (parsed.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(parsed.hostname.toLowerCase())) {
    return
  }

  throw new Error(
    `baseUrl must use https:// or http://localhost/127.0.0.1 for local development (got ${parsed.protocol}//${parsed.hostname})`
  )
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.')
  if (parts.length !== 4) return false
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN))
  if (octets.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false
  const [a, b, c] = octets
  return (
    a === 0 || // 0.0.0.0/8
    a === 10 || // 10.0.0.0/8 RFC1918
    a === 127 || // 127.0.0.0/8 loopback
    (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT & Alibaba metadata
    (a === 169 && b === 254) || // 169.254.0.0/16 link-local & cloud metadata
    (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12 RFC1918
    (a === 192 && b === 0 && (c === 0 || c === 2)) || // 192.0.0.0/24 & 192.0.2.0/24
    (a === 192 && b === 168) || // 192.168.0.0/16 RFC1918
    (a === 198 && (b === 18 || b === 19)) || // 198.18.0.0/15 benchmark
    (a === 198 && b === 51 && c === 100) || // 198.51.100.0/24 TEST-NET-2
    (a === 203 && b === 0 && c === 113) || // 203.0.113.0/24 TEST-NET-3
    a >= 224 // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved
  )
}

function isPrivateOrReservedHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/\.$/, '')
  if (!host) return true

  if (
    host === 'localhost' ||
    host === 'metadata.google.internal' ||
    host === 'metadata' ||
    host === 'instance-data' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local') ||
    host.endsWith('.localdomain') ||
    host.endsWith('.home.arpa') ||
    host.endsWith('.corp') ||
    host.endsWith('.lan')
  ) {
    return true
  }

  if (isPrivateOrReservedIpv4(host)) {
    return true
  }

  // IPv6 literal checks (URL.hostname wraps IPv6 in brackets: [::1])
  if (host.startsWith('[') && host.endsWith(']')) {
    const ipv6 = host.slice(1, -1).toLowerCase()
    if (
      ipv6 === '::' ||
      ipv6 === '::1' ||
      /^(?:0+:){7}0*[01]$/.test(ipv6) ||
      /^fe[89ab][0-9a-f]:/.test(ipv6) || // fe80::/10 link-local
      /^f[cd][0-9a-f]{2}:/.test(ipv6) || // fc00::/7 unique local (includes fd00:ec2::254)
      /^ff[0-9a-f]{2}:/.test(ipv6) // ff00::/8 multicast
    ) {
      return true
    }

    // IPv6-mapped IPv4: ::ffff:a.b.c.d or ::ffff:xxxx:yyyy (or 0:0:0:0:0:ffff:...)
    const mappedMatch = ipv6.match(/^(?:::ffff:|(?:0+:){5}ffff:)(.+)$/)
    if (mappedMatch) {
      const tail = mappedMatch[1]!
      if (isPrivateOrReservedIpv4(tail)) {
        return true
      }
      const hexPair = tail.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
      if (hexPair) {
        const hi = Number.parseInt(hexPair[1]!, 16)
        const lo = Number.parseInt(hexPair[2]!, 16)
        const reconstructedIpv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
        if (isPrivateOrReservedIpv4(reconstructedIpv4)) {
          return true
        }
      }
      return true
    }
  }

  return false
}

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
    throw new Error(`${label} must use https:// protocol`)
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${label} must not contain embedded credentials`)
  }
  const host = parsed.hostname.toLowerCase()
  if (isPrivateOrReservedHost(host)) {
    throw new Error(`${label} cannot target private, loopback, or metadata hosts (${host})`)
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use https:// protocol`)
  }
  return parsed.toString()
}

export async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(validateTimeoutMs(timeoutMs)) })
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')
}

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return { ...(headers as Record<string, string>) }
}

export async function hebrahRequest<T>(
  config: HttpClientConfig,
  path: string,
  init?: RequestInit,
  options?: HebrahRequestOptions
): Promise<T> {
  const base = config.baseUrl
  const url = `${base}${path}`
  const timeoutMs = options?.timeoutMs ?? config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const errorPrefix = options?.errorPrefix ?? 'Control plane request'

  const mergedHeaders = normalizeHeaders(init?.headers)
  if (init?.body && typeof init.body === 'string' && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json'
  }
  if (!options?.skipAuth) {
    const token = options?.bearerToken
      ? validateToken(options.bearerToken, 'accessToken')
      : config.apiKey
    mergedHeaders.Authorization = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      url,
      {
        ...init,
        headers: mergedHeaders
      },
      timeoutMs
    )
  } catch (err) {
    if (isTimeoutError(err)) {
      throw new HebrahApiError(options?.timeoutMessage ?? `${errorPrefix} timed out`, 504)
    }
    throw new HebrahApiError(
      options?.unreachableMessage ??
        `Control plane unreachable at ${base}. Is hebrah-api running?`,
      503
    )
  }

  if (!response.ok) {
    const detail = errorDetail(config, await response.text())
    throw new HebrahApiError(
      `${errorPrefix} failed (${response.status})`,
      response.status,
      detail
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  try {
    return (await response.json()) as T
  } catch {
    throw new HebrahApiError(`${errorPrefix} returned invalid JSON`, 502)
  }
}

export function resolveBaseUrl(baseUrl?: string): string {
  const resolved = (baseUrl ?? process.env.HEBRAH_API_BASE_URL ?? DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, '')
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
    trimmed.length > MAX_PATH_SEGMENT_LENGTH ||
    trimmed === '.' ||
    trimmed === '..' ||
    trimmed.includes('\\') ||
    trimmed.includes('..') ||
    trimmed.includes('?') ||
    trimmed.includes('#') ||
    /%(?:2e|2f|5c|00)/i.test(trimmed) ||
    /[\x00-\x1f\x7f]/.test(trimmed)
  ) {
    throw new Error(`Invalid ${name}`)
  }
  return encodeURIComponent(trimmed)
}


