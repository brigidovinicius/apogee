FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ARG APOGEE_RELEASE_SHA=local
LABEL org.opencontainers.image.title="Radar Academico" \
      org.opencontainers.image.revision="${APOGEE_RELEASE_SHA}"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APOGEE_RELEASE_SHA=${APOGEE_RELEASE_SHA}
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# The NASA Space Apps origin serves an intermediate cross-signed by a root absent from this image.
# This alternate intermediate chains to Node's existing SSL.com 2022 root.
COPY certs/sslcom-tls-issuing-rsa-ca-r1.pem ./certs/sslcom-tls-issuing-rsa-ca-r1.pem
ENV NODE_EXTRA_CA_CERTS=/app/certs/sslcom-tls-issuing-rsa-ca-r1.pem
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
