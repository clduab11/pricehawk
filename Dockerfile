# Base image
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# Install Sharp dependencies (linux-x64) and Playwright dependencies
RUN apk add --no-cache libc6-compat python3 make g++ vips-dev
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
RUN npx prisma generate
# Build Next.js
RUN npm run build
# Compile Workers (using tsc or just ensuring tsx is available)
# Since we use tsx for workers, we don't strictly need a build step for them if we copy src
# But for production we might want to compile. For now, running with tsx is fine.

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install playwight browsers dependencies for Alpine
# Note: Playwright on Alpine is tricky. Using Debian might be safer for Playwright.
# However, let's try to minimal setup.
# Actually, for Playwright, it's recommended to use the official playwright image or at least install deps.
# We will use the official Playwright image for the worker containers if possible, 
# or install deps here.
# For simplicity, we assume this container might just run the Next.js app 
# and we might have separate containers for workers based on `mcr.microsoft.com/playwright:v1.49.0-jammy`.

# Create a group and user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# We need tsx for workers in the runner image
RUN npm install -g tsx

USER nextjs

EXPOSE 3000

ENV PORT=3000

# Default command is Next.js, but can be overridden
CMD ["node", "server.js"]
