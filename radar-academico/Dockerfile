FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY vendor/braces ./vendor/braces
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=true
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Dedicated PostgreSQL client only; independent from the web dependency graph/build.
FROM node:22-alpine AS ai-deps
WORKDIR /app/ai-worker
COPY ai-worker/package.json ai-worker/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Optional worker: no Next build, public server or blog files.
FROM node:22-alpine AS ai-runner
WORKDIR /app
ARG APOGEE_RELEASE_SHA=local
LABEL org.opencontainers.image.title="Radar AI worker" \
      org.opencontainers.image.revision="${APOGEE_RELEASE_SHA}"
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 radarai && adduser --system --uid 1001 radarai
COPY --chown=radarai:radarai ai-worker ./ai-worker
COPY --from=ai-deps --chown=radarai:radarai /app/ai-worker/node_modules ./ai-worker/node_modules
USER radarai
CMD ["node", "ai-worker/cli.mjs", "run"]

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
# PDF.js loads its worker dynamically at runtime; Next's standalone trace does not include it.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/pdfjs-dist ./node_modules/pdfjs-dist
# The legacy PDF parser needs DOMMatrix from this optional Alpine-native package.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@napi-rs ./node_modules/@napi-rs
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
# The NASA Space Apps origin serves an intermediate cross-signed by a root absent from this image.
# This alternate intermediate chains to Node's existing SSL.com 2022 root.
COPY certs/sslcom-tls-issuing-rsa-ca-r1.pem ./certs/sslcom-tls-issuing-rsa-ca-r1.pem
ENV NODE_EXTRA_CA_CERTS=/app/certs/sslcom-tls-issuing-rsa-ca-r1.pem
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
