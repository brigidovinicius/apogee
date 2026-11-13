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
COPY --from=editorial-contract lib/blog/corroboration.mjs /make-it-fly-current/lib/blog/corroboration.mjs
COPY --from=editorial-contract lib/blog/reference-catalog.json /make-it-fly-current/lib/blog/reference-catalog.json
COPY --from=editorial-contract lib/blog/explainer-catalog.json /make-it-fly-current/lib/blog/explainer-catalog.json
USER node
ENTRYPOINT ["/app/bin/keyring-session.sh"]
CMD ["node", "src/cli.mjs", "run"]
