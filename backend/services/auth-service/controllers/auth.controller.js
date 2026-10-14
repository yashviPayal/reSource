import { AuthService } from '../services/auth.service.js'

const COOKIE_NAME = 'token'
const isProduction = process.env.NODE_ENV === 'production'

const cookieOptions = {
  httpOnly: true, // Prevents client-side JS access (mitigates XSS)
  secure: isProduction, // Transmitted only over HTTPS in production
  sameSite: isProduction ? 'none' : 'lax', // Supports cross-site in prod with credentials
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
}

export class AuthController {
  /**
   * POST /api/auth/register
   */
  static async register(req, res, next) {
    try {
      const { name, email, password } = req.body
      const result = await AuthService.register({ name, email, password })

      // Set httpOnly secure cookie
      res.cookie(COOKIE_NAME, result.token, cookieOptions)

      res.status(201).json({
        success: true,
        message: 'User registered successfully.',
        user: result.user,
        token: result.token, // Returned for non-browser/mobile clients
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      const { email, password } = req.body
      const result = await AuthService.login({ email, password })

      // Set httpOnly secure cookie
      res.cookie(COOKIE_NAME, result.token, cookieOptions)

      res.status(200).json({
        success: true,
        message: 'Login successful.',
        user: result.user,
        token: result.token, // Returned for non-browser/mobile clients
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/auth/logout
   */
  static async logout(_req, res) {
    // Clear the httpOnly cookie from the client
    res.clearCookie(COOKIE_NAME, cookieOptions)

    res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    })
  }

  /**
   * GET /api/auth/me
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getProfile(req.user.userId)
      res.status(200).json({
        success: true,
        user,
      })
    } catch (error) {
      next(error)
    }
  }
}
