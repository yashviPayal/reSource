import { ResourceModel } from '../models/resource.model.js'

export class ResourceService {
  /**
   * Fetch paginated and filtered resources
   */
  static async getResources(filters) {
    const [resources, totalCount] = await Promise.all([
      ResourceModel.findAll(filters),
      ResourceModel.countAll(filters),
    ])

    return {
      count: totalCount,
      resources,
    }
  }

  /**
   * Fetch single resource by ID
   */
  static async getResourceById(id) {
    if (!/^\d+$/.test(String(id))) {
      const error = new Error('Invalid resource ID.')
      error.statusCode = 400
      throw error
    }

    const resource = await ResourceModel.findById(id)
    if (!resource) {
      const error = new Error('Resource not found.')
      error.statusCode = 404
      throw error
    }

    return resource
  }

  /**
   * Create a new resource listing
   */
  static async createResource(resourceData, user) {
    return ResourceModel.create({
      ...resourceData,
      ownerId: user.userId,
      ownerEmail: user.email,
    })
  }

  /**
   * Delete listing with ownership check
   */
  static async deleteResource(id, user) {
    if (!/^\d+$/.test(String(id))) {
      const error = new Error('Invalid resource ID.')
      error.statusCode = 400
      throw error
    }

    const existing = await ResourceModel.findById(id)
    if (!existing) {
      const error = new Error('Resource not found.')
      error.statusCode = 404
      throw error
    }

    if (String(existing.owner_id) !== String(user.userId)) {
      const error = new Error('You can only delete listings you created.')
      error.statusCode = 403
      throw error
    }

    return ResourceModel.deleteByIdAndOwner(id, user.userId)
  }

  /**
   * Update status of a resource
   */
  static async updateStatus(id, status) {
    const updated = await ResourceModel.updateStatus(id, status)
    if (!updated) {
      const error = new Error('Resource not found.')
      error.statusCode = 404
      throw error
    }
    return updated
  }
}
