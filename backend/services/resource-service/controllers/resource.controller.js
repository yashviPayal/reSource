import { ResourceService } from '../services/resource.service.js'

export class ResourceController {
  /**
   * GET /api/resources
   */
  static async getAll(req, res, next) {
    try {
      const { category, action, location, search, status, limit, offset } = req.query
      const result = await ResourceService.getResources({
        category,
        action,
        location,
        search,
        status,
        limit,
        offset,
      })

      res.status(200).json({
        success: true,
        count: result.count,
        resources: result.resources,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/resources/:id
   */
  static async getById(req, res, next) {
    try {
      const resource = await ResourceService.getResourceById(req.params.id)
      res.status(200).json({
        success: true,
        resource,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/resources (Protected)
   */
  static async create(req, res, next) {
    try {
      const newListing = await ResourceService.createResource(req.sanitizedResource, req.user)
      res.status(201).json({
        success: true,
        message: 'Listing created successfully.',
        resource: newListing,
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/resources/:id (Protected)
   */
  static async delete(req, res, next) {
    try {
      await ResourceService.deleteResource(req.params.id, req.user)
      res.status(200).json({
        success: true,
        message: 'Listing deleted successfully.',
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PATCH /api/resources/:id/status (Protected / Internal)
   */
  static async updateStatus(req, res, next) {
    try {
      const { status } = req.body
      if (!['available', 'reserved', 'completed'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Status must be available, reserved, or completed.',
        })
      }
      const updated = await ResourceService.updateStatus(req.params.id, status)
      res.status(200).json({
        success: true,
        message: `Resource marked as ${status}.`,
        resource: updated,
      })
    } catch (error) {
      next(error)
    }
  }
}
