import test from 'node:test'
import assert from 'node:assert/strict'
import { validateResource, validateClaim } from './validation.js'

test('valid resource is accepted and trimmed', () => {
  const result = validateResource({ title: '  Java Book ', category: 'Books & Paper', action: 'Donate', condition: 'Good', location: ' Ahmedabad ', description: '' })
  assert.deepEqual(result.errors, [])
  assert.equal(result.value.title, 'Java Book')
  assert.equal(result.value.location, 'Ahmedabad')
})

test('invalid resource fields are rejected', () => {
  const result = validateResource({ title: '', category: 'Other', action: 'Sell', location: '' })
  assert.ok(result.errors.length >= 4)
})

test('valid claim is accepted and trimmed', () => {
  const result = validateClaim({ requester_name: ' Asha ', requester_email: 'asha@example.com', message: ' Please contact me ' })
  assert.deepEqual(result.errors, [])
  assert.equal(result.value.name, 'Asha')
  assert.equal(result.value.message, 'Please contact me')
})

test('invalid email and long claim message are rejected', () => {
  const result = validateClaim({ requester_name: 'A', requester_email: 'not-an-email', message: 'x'.repeat(501) })
  assert.equal(result.errors.length, 2)
})
