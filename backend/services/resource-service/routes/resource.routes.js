import { Router } from 'express'
import { ResourceController } from '../controllers/resource.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { validateResource } from '../middleware/validation.middleware.js'

const router = Router()

/**
 * Public routes
 */
router.get('/', ResourceController.getAll)
router.get('/:id', ResourceController.getById)

/**
 * Protected routes
 */
router.post('/', authenticateToken, validateResource, ResourceController.create)
router.delete('/:id', authenticateToken, ResourceController.delete)
router.patch('/:id/status', authenticateToken, ResourceController.updateStatus)

export default router
