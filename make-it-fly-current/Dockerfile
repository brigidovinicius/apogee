FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ARG APOGEE_RELEASE_SHA=local
LABEL org.opencontainers.image.title="Apogee Site" \
      org.opencontainers.image.revision="${APOGEE_RELEASE_SHA}"
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APOGEE_RELEASE_SHA=${APOGEE_RELEASE_SHA}
RUN groupadd --system --gid 1001 nextjs \
  && useradd --system --uid 1001 --gid nextjs nextjs
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
# Ferramenta administrativa estreita: o runner recebe somente o script de
# concessão e o driver necessário, sem levar as demais dependências de build.
COPY --from=builder --chown=nextjs:nextjs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nextjs /app/scripts/members-grant-admin.mjs ./scripts/members-grant-admin.mjs
COPY --from=dependencies --chown=nextjs:nextjs /app/node_modules/postgres ./node_modules/postgres
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
