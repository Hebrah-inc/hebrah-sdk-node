const QUICK_SECRET_CHECK_RE =
  /hb_(?:live|test|pat|conn|claim)_|enc:v1:|PrivateKey|Bearer\s|(?:sk|rk)_(?:live|test)_|whsec_|eyJ[A-Za-z0-9_-]{10,}\.|(?:postgres(?:ql)?|redis(?:s)?):\/\//i

const SECRET_PATTERNS: ReadonlyArray< readonly [RegExp, string] > = [
  [/\bhb_(?:live|test|pat|conn|claim)_[A-Za-z0-9_-]{6,}\b/g, '[REDACTED_HEBRAH_TOKEN]'],
  [/\benc:v1:[A-Za-z0-9+/=_:-]+/g, 'enc:v1:[REDACTED]'],
  [/(PrivateKey\s*=\s*)[^\r\n]+/gi, '$1[REDACTED]'],
  [/(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, '$1[REDACTED]'],
  [/\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}\b/g, '[REDACTED_STRIPE_KEY]'],
  [/\bwhsec_[A-Za-z0-9]{10,}\b/g, '[REDACTED_WEBHOOK_SECRET]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[REDACTED_JWT]'],
  [/((?:postgres(?:ql)?|redis(?:s)?):\/\/[^/\s:@]+:)[^@\s/]+(@)/gi, '$1[REDACTED]$2']
]

export function redactSecrets(raw: string): string {
  if (!raw || !QUICK_SECRET_CHECK_RE.test(raw)) {
    return raw
  }
  let out = raw
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

export class HebrahApiError extends Error {
  readonly name = 'HebrahApiError'
  readonly status: number
  readonly detail?: string

  constructor(message: string, status: number, detail?: string) {
    super(redactSecrets(message))
    this.status = status
    this.detail = detail !== undefined ? redactSecrets(detail) : undefined
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      status: this.status,
      ...(this.detail !== undefined ? { detail: this.detail } : {})
    }
  }
}

