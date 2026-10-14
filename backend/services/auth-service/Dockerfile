# ==========================================
# Stage 1: Build & Dependencies
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies cleanly
RUN npm ci --omit=dev

# ==========================================
# Stage 2: Minimal Production Image
# ==========================================
FROM node:20-alpine AS runner

# Security: Set production environment
ENV NODE_ENV=production
ENV PORT=4002

WORKDIR /app

# Install curl for container health check
RUN apk add --no-cache curl

# Copy production node_modules from builder stage
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node . .

# DevSecOps Best Practice: Never run containers as root
USER node

# Expose microservice port
EXPOSE 4002

# Kubernetes/Docker native healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4002/health || exit 1

# Start service
CMD ["node", "index.js"]
