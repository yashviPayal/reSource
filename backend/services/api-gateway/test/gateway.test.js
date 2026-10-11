import test from 'node:test'
import assert from 'node:assert/strict'

test('Gateway microservice URL configuration defaults correctly', () => {
  const defaultAuthUrl = process.env.AUTH_SERVICE_URL || 'http://localhost:4002'
  const defaultResourceUrl = process.env.RESOURCE_SERVICE_URL || 'http://localhost:4001'
  const defaultClaimUrl = process.env.CLAIM_SERVICE_URL || 'http://localhost:4003'

  assert.equal(defaultAuthUrl, 'http://localhost:4002')
  assert.equal(defaultResourceUrl, 'http://localhost:4001')
  assert.equal(defaultClaimUrl, 'http://localhost:4003')
})
