# syntax=docker/dockerfile:1

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci && \
    npm cache clean --force

# Copy TypeScript config and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine AS runner

WORKDIR /app

# Add non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 fastify

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder --chown=fastify:nodejs /app/dist ./dist

# Copy SSL certificates for production
COPY --chown=fastify:nodejs ssl ./ssl

# Set restrictive permissions on private key
RUN chmod 600 ssl/dynainfo.key

# Switch to non-root user
USER fastify

# Expose port
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:5002/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/server.js"]
