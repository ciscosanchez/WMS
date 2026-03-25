FROM node:22-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_PUBLIC_USE_MOCK_DATA=false
ENV NEXT_PUBLIC_USE_MOCK_AUTH=false
ENV USE_MOCK_DATA=false
ENV USE_MOCK_AUTH=false
RUN npx prisma generate --schema=prisma/schema.prisma && \
    npx prisma generate --schema=prisma/tenant-schema.prisma && \
    npm run build && \
    npx esbuild src/lib/jobs/worker-entrypoint.ts \
      --bundle --platform=node --target=node22 \
      --outfile=dist/worker.js \
      --external:pg-native --external:@prisma/client

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist/worker.js ./worker.js
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
