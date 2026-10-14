import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { generateToken, verifyToken } from '../utils/jwt.js'

test('JWT utility creates and decodes token correctly', () => {
  const mockUser = {
    id: 101,
    name: 'Rohit Nirma',
    email: 'rohit@example.com',
  }

  const token = generateToken(mockUser)
  assert.ok(typeof token === 'string' && token.length > 20, 'Token should be a non-empty string')

  const decoded = verifyToken(token)
  assert.equal(decoded.userId, 101)
  assert.equal(decoded.name, 'Rohit Nirma')
  assert.equal(decoded.email, 'rohit@example.com')
})

test('Bcrypt hashes and verifies password correctly', async () => {
  const plainPassword = 'SuperStrongPassword123!'
  const hash = await bcrypt.hash(plainPassword, 10)

  assert.notEqual(hash, plainPassword)
  const isMatch = await bcrypt.compare(plainPassword, hash)
  assert.equal(isMatch, true)

  const isWrongMatch = await bcrypt.compare('WrongPassword999', hash)
  assert.equal(isWrongMatch, false)
})
