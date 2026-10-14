import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WebhookEventEnvelope } from './types.js'

export interface VerifyWebhookOptions {
  /** Maximum allowed age of the webhook event timestamp in seconds (replay protection). */
  maxAgeSeconds?: number
  /** Current timestamp in milliseconds (defaults to Date.now()). */
  nowMs?: number
}

/**
 * Verify an inbound hebrah webhook using HMAC-SHA256 (`X-Hebrah-Signature`).
 * Returns the parsed payload when the signature is valid.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | null | undefined,
  webhookSecret: string,
  options?: VerifyWebhookOptions
): WebhookEventEnvelope {
  if (!webhookSecret || typeof webhookSecret !== 'string' || !webhookSecret.trim()) {
    throw new Error('webhookSecret is required')
  }

  if (!signatureHeader || typeof signatureHeader !== 'string') {
    throw new Error('Missing X-Hebrah-Signature header')
  }

  const raw = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody

  const expected = createHmac('sha256', webhookSecret)
    .update(raw)
    .digest('hex')

  const normalizedSig = signatureHeader.trim().replace(/^sha256=/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(normalizedSig)) {
    throw new Error('Invalid webhook signature')
  }
  const sigBuffer = Buffer.from(normalizedSig, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  if (sigBuffer.length !== expectedBuffer.length) {
    throw new Error('Invalid webhook signature')
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid webhook signature')
  }

  const envelope = JSON.parse(raw.toString('utf8')) as WebhookEventEnvelope

  if (options?.maxAgeSeconds !== undefined && options.maxAgeSeconds > 0) {
    const rawTs = (envelope as unknown as Record<string, unknown>).timestamp
    if (typeof rawTs !== 'string' && typeof rawTs !== 'number') {
      throw new Error('Webhook payload missing timestamp required for replay protection')
    }
    const eventTimeMs = typeof rawTs === 'number' ? rawTs * 1000 : Date.parse(rawTs)
    if (!Number.isFinite(eventTimeMs)) {
      throw new Error('Invalid webhook timestamp')
    }
    const nowMs = options.nowMs ?? Date.now()
    if (Math.abs(nowMs - eventTimeMs) > options.maxAgeSeconds * 1000) {
      throw new Error('Webhook timestamp outside allowed replay window')
    }
  }

  return envelope
}