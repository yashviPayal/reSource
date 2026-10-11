import { Router } from 'express'
import { AuthController } from '../controllers/auth.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { validateLogin, validateRegister } from '../middleware/validation.middleware.js'

const router = Router()

/**
 * Public routes
 */
router.post('/register', validateRegister, AuthController.register)
router.post('/login', validateLogin, AuthController.login)
router.post('/logout', AuthController.logout)

/**
 * Protected routes (require Bearer JWT)
 */
router.get('/me', authenticateToken, AuthController.getMe)

export default router
