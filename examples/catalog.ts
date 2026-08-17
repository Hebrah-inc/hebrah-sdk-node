/**
 * examples/catalog.ts
 *
 * Fetch the sandbox catalog for the active org and print a summary.
 * Run with: HEBRAH_API_KEY=hb_test_... tsx examples/catalog.ts
 *
 * Optional: HEBRAH_API_BASE_URL=http://localhost:8000
 * Optional: HEBRAH_CONNECTION_ID=conn-sa-...
 */

import { HebrahClient } from '../dist/index.js'

const apiKey = process.env.HEBRAH_API_KEY
if (!apiKey) {
  console.error('HEBRAH_API_KEY is required')
  process.exit(1)
}

const client = new HebrahClient({
  apiKey,
  baseUrl: process.env.HEBRAH_API_BASE_URL,
  defaultConnectionId: process.env.HEBRAH_CONNECTION_ID,
})

const catalog = await client.sandbox.catalog()
console.log('org:', catalog.org_name, `(${catalog.org_id})`)
console.log('connection:', catalog.connection_id, catalog.environment)
console.log('sample patients:', catalog.sample_patient_ids)
console.log('supported events:', catalog.supported_events)