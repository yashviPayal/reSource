# Stage 1: Build & Dependencies
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Final Minimal Runtime Image
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4004

# Install curl for Docker/Kubernetes healthcheck probes
RUN apk add --no-cache curl

# Security Best Practice: Run as non-root user
USER node

# Copy dependencies and application source
COPY --chown=node:node --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node index.js ./
COPY --chown=node:node config/ ./config/
COPY --chown=node:node consumers/ ./consumers/
COPY --chown=node:node services/ ./services/

EXPOSE 4004

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:4004/health || exit 1

CMD ["node", "index.js"]
