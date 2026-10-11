import bcrypt from 'bcryptjs'
import { UserModel } from '../models/user.model.js'
import { generateToken } from '../utils/jwt.js'

const BCRYPT_SALT_ROUNDS = 10

export class AuthService {
  /**
   * Register a new user
   */
  static async register({ name, email, password }) {
    // 1. Check if email already exists
    const exists = await UserModel.emailExists(email)
    if (exists) {
      const error = new Error('An account with this email address already exists.')
      error.statusCode = 409
      throw error
    }

    // 2. Hash the password
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)

    // 3. Persist the user
    const newUser = await UserModel.createUser({
      name,
      email,
      passwordHash,
    })

    // 4. Generate JWT
    const token = generateToken(newUser)

    return {
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.created_at,
      },
      token,
    }
  }

  /**
   * Login user with email and password
   */
  static async login({ email, password }) {
    // 1. Find user by email
    const user = await UserModel.findByEmail(email)
    if (!user) {
      const error = new Error('Invalid email or password.')
      error.statusCode = 401
      throw error
    }

    // 2. Verify password
    const isValid = await bcrypt.compare(password, user.password_hash)
    if (!isValid) {
      const error = new Error('Invalid email or password.')
      error.statusCode = 401
      throw error
    }

    // 3. Generate JWT
    const token = generateToken(user)

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.created_at,
      },
      token,
    }
  }

  /**
   * Fetch current authenticated user's profile
   */
  static async getProfile(userId) {
    const user = await UserModel.findById(userId)
    if (!user) {
      const error = new Error('User profile not found.')
      error.statusCode = 404
      throw error
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    }
  }
}
