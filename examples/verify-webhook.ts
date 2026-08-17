/**
 * examples/verify-webhook.ts
 *
 * Minimal webhook signature verification using the SDK's
 * `verifyWebhookSignature` helper. Drop this into an Express / Fastify /
 * Cloudflare Workers handler — the body bytes and the
 * `X-Hebrah-Signature` header must reach it unmodified.
 *
 * Run with: HEBRAH_WEBHOOK_SECRET=hbsec_... tsx examples/verify-webhook.ts <raw-body> <signature>
 */

import { verifyWebhookSignature, HebrahApiError } from '../dist/index.js'

const secret = process.env.HEBRAH_WEBHOOK_SECRET
if (!secret) {
  console.error('HEBRAH_WEBHOOK_SECRET is required')
  process.exit(1)
}

const [, , rawBody, signature] = process.argv
if (!rawBody || !signature) {
  console.error('usage: tsx examples/verify-webhook.ts <raw-body> <signature>')
  process.exit(1)
}

try {
  const envelope = verifyWebhookSignature(rawBody, signature, secret)
  console.log('verified event:', envelope.event, 'at', envelope.delivered_at)
  console.log('connection:', envelope.connection_id, 'patient:', envelope.patient_id)
} catch (err) {
  if (err instanceof HebrahApiError) {
    console.error('verification failed:', err.message)
    process.exit(1)
  }
  throw err
}