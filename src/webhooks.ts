import { createHmac, timingSafeEqual } from 'node:crypto'
import type { WebhookEventEnvelope } from './types.js'

/**
 * Verify an inbound hebrah webhook using HMAC-SHA256 (`X-Hebrah-Signature`).
 * Returns the parsed payload when the signature is valid.
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string | null | undefined,
  webhookSecret: string
): WebhookEventEnvelope {
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    throw new Error('Missing X-Hebrah-Signature header')
  }

  const raw = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody

  const expected = createHmac('sha256', webhookSecret)
    .update(raw)
    .digest('hex')

  const sigBuffer = Buffer.from(signatureHeader, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')

  if (sigBuffer.length !== expectedBuffer.length) {
    throw new Error('Invalid webhook signature')
  }

  if (!timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error('Invalid webhook signature')
  }

  return JSON.parse(raw.toString('utf8')) as WebhookEventEnvelope
}