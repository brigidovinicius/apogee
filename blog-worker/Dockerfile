FROM node:24-bookworm-slim
ARG APOGEE_RELEASE_SHA=local
LABEL org.opencontainers.image.revision=$APOGEE_RELEASE_SHA
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates dbus gnome-keyring libsecret-tools \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY sql ./sql
COPY config ./config
COPY bin ./bin
USER node
ENTRYPOINT ["/app/bin/keyring-session.sh"]
CMD ["node", "src/cli.mjs", "run"]
