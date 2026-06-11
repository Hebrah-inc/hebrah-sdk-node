import { HebrahClient } from '../dist/index.js'

const apiKey = process.env.HEBRAH_API_KEY
if (!apiKey) {
  console.error('HEBRAH_API_KEY is required (use SEED_API_KEY from scripts/generate-local-secrets.sh)')
  process.exit(1)
}
const baseUrl = process.env.HEBRAH_API_BASE_URL || 'http://localhost:8000'

const client = new HebrahClient({ apiKey, baseUrl })

const health = await client.health()
console.log('health:', health.status)

const catalog = await client.sandbox.catalog()
const patientId = catalog.sample_patient_ids[0]
const patient = await client.patients.get(patientId)
console.log('patient:', patient.resourceType, patient.id)
console.log('smoke ok')
