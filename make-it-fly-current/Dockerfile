FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# O ID do projeto é público e o Next.js precisa conhecê-lo no build para
# incluí-lo no bundle do cliente. A chave de servidor permanece apenas no
# ambiente de execução do container.
ARG NEXT_PUBLIC_HEXCLAVE_PROJECT_ID
ENV NEXT_PUBLIC_HEXCLAVE_PROJECT_ID=${NEXT_PUBLIC_HEXCLAVE_PROJECT_ID} \
    HEXCLAVE_PROJECT_ID=${NEXT_PUBLIC_HEXCLAVE_PROJECT_ID}
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
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
