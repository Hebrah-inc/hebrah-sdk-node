/**
 * examples/trigger-mock-event.ts
 *
 * Trigger a mock webhook event against the sandbox connection. Useful for
 * local dev to confirm your webhook receiver is wired up end-to-end.
 *
 * Run with:
 *   HEBRAH_API_KEY=hb_test_... \
 *   HEBRAH_CONNECTION_ID=conn-sa-... \
 *   tsx examples/trigger-mock-event.ts [event]
 *
 * Default event: patient.admitted
 */

import { HebrahClient } from '../dist/index.js'

const apiKey = process.env.HEBRAH_API_KEY
if (!apiKey) {
  console.error('HEBRAH_API_KEY is required')
  process.exit(1)
}

const connectionId = process.env.HEBRAH_CONNECTION_ID
if (!connectionId) {
  console.error('HEBRAH_CONNECTION_ID is required for trigger_mock_event')
  process.exit(1)
}

const event = process.argv[2] ?? 'patient.admitted'

const client = new HebrahClient({
  apiKey,
  baseUrl: process.env.HEBRAH_API_BASE_URL,
})

const resp = await client.webhooks.triggerMockEvent({ event, connectionId })
console.log('triggered:', resp.event, 'delivery_id:', resp.delivery_id, 'status:', resp.status)