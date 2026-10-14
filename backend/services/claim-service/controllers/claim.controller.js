import { ClaimService } from '../services/claim.service.js'

export class ClaimController {
  /**
   * POST /api/claims
   */
  static async create(req, res, next) {
    try {
      const claim = await ClaimService.createClaim(req.sanitizedClaim, req.user)
      res.status(201).json({
        success: true,
        message: 'Request submitted successfully.',
        claim,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/claims/my
   */
  static async getMyClaims(req, res, next) {
    try {
      const { received, sent } = await ClaimService.getMyClaims(req.user.userId)
      res.status(200).json({
        success: true,
        received,
        sent,
        claims: received, // Backward compatibility
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PATCH /api/claims/:id/status
   */
  static async updateStatus(req, res, next) {
    try {
      const { id } = req.params
      const { status } = req.body
      const updated = await ClaimService.updateClaimStatus(id, status, req.user)
      res.status(200).json({
        success: true,
        message: `Claim marked as ${status}.`,
        claim: updated,
      })
    } catch (error) {
      next(error)
    }
  }
}
