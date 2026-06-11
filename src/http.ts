import { HebrahApiError } from './errors.js'
import { DEFAULT_BASE_URL } from './types.js'

export interface HttpClientConfig {
  apiKey: string
  baseUrl: string
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
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })
  } catch {
    throw new HebrahApiError(
      `Control plane unreachable at ${base}. Is hebrah-api running?`,
      503
    )
  }

  if (!response.ok) {
    const detail = await response.text()
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
  return (baseUrl ?? process.env.HEBRAH_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, '')
}