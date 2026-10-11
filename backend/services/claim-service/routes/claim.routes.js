import { Router } from 'express'
import { ClaimController } from '../controllers/claim.controller.js'
import { authenticateToken } from '../middleware/auth.middleware.js'
import { validateClaimCreate, validateClaimStatus } from '../middleware/validation.middleware.js'

const router = Router()

// All claim operations require authentication
router.use(authenticateToken)

/**
 * Routes
 */
router.post('/', validateClaimCreate, ClaimController.create)
router.post('/:resourceId', validateClaimCreate, ClaimController.create)
router.get('/my', ClaimController.getMyClaims)
router.get('/', ClaimController.getMyClaims)
router.patch('/:id/status', validateClaimStatus, ClaimController.updateStatus)

export default router
