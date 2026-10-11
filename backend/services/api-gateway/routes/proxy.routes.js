import { Router } from 'express'
import proxy from 'express-http-proxy'

const router = Router()

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4002'
const RESOURCE_SERVICE_URL = process.env.RESOURCE_SERVICE_URL || 'http://localhost:4001'

// Proxy options preserving cookies and request headers
const createProxyOptions = (prefix) => ({
  proxyReqPathResolver: (req) => prefix + req.url,
  proxyReqOptDecorator: (proxyReqOpts, srcReq) => {
    // Forward original client IP and host
    proxyReqOpts.headers['X-Forwarded-For'] = srcReq.ip || srcReq.connection.remoteAddress
    proxyReqOpts.headers['X-Forwarded-Host'] = srcReq.headers.host || 'api-gateway'
    // Ensure cookies and auth headers are passed downstream
    if (srcReq.headers.cookie) {
      proxyReqOpts.headers['cookie'] = srcReq.headers.cookie
    }
    if (srcReq.headers.authorization) {
      proxyReqOpts.headers['authorization'] = srcReq.headers.authorization
    }
    return proxyReqOpts
  },
  userResHeaderDecorator: (headers, _userReq, _userRes, _proxyReq, _proxyRes) => {
    // Preserve Set-Cookie header so client receives the auth token cookie
    return headers
  },
  errorHandler: (err, res, next) => {
    console.error(`[API Gateway] Error proxying to ${prefix}:`, err.message)
    res.status(502).json({
      success: false,
      error: `Downstream service unavailable (${prefix}). Please check that the microservice is running.`,
    })
  },
})

// Route: /api/auth/* -> Auth Service
router.use('/auth', proxy(AUTH_SERVICE_URL, createProxyOptions('/api/auth')))

// Route: /api/resources/* -> Resource Service
router.use('/resources', proxy(RESOURCE_SERVICE_URL, createProxyOptions('/api/resources')))

export default router
