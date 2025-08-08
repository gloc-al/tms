# Multi-stage build for ultra-lightweight frontend
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with frozen lockfile
RUN npm ci --only=production

# Copy source code
COPY . .

# Build with aggressive optimization
ENV NODE_ENV=production
ENV VITE_BUNDLE_SIZE_LIMIT=14000
ENV VITE_COMPRESSION_LEVEL=9
RUN npm run build

# Verify bundle size constraints
RUN node scripts/verify-bundle-size.js

# Production stage - Ultra-lightweight nginx
FROM nginx:alpine

# Copy custom nginx config optimized for performance
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Add compression and caching
RUN gzip -r -9 /usr/share/nginx/html/

# Create non-root user
RUN addgroup -g 1001 -S tms && \
    adduser -S tms -u 1001

# Use non-root user
USER tms

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
