# Multi-stage Dockerfile for TTB Label Verification App
# Optimized for Railway deployment with Tesseract.js + sharp

# --- Stage 1: Dependencies ---
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production=false

# --- Stage 2: Build ---
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js app
RUN npm run build

# --- Stage 3: Production ---
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built app and dependencies
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Tesseract.js needs node_modules at runtime for worker scripts
COPY --from=builder /app/node_modules/tesseract.js ./node_modules/tesseract.js

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
