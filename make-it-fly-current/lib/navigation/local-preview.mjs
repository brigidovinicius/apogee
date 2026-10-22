// The navigation fixture is deliberately restricted to its existing loopback services.
export function localPreviewEnv(config, mode) {
  previewCommand(mode);
  const db = new URL(config.DATABASE_URL);
  if (db.hostname !== "127.0.0.1" || db.port !== "55439" || db.pathname !== "/apogee_navigation"
    || config.BETTER_AUTH_URL !== "http://127.0.0.1:4381"
    || config.RADAR_ACADEMICO_API_URL !== "http://127.0.0.1:4382/catalogue") {
    throw new Error("Preview requires the isolated navigation database, origin and catalogue.");
  }
  return {
    ...config,
    NODE_ENV: "production",
    NODE_OPTIONS: `--max-old-space-size=${mode === "build" ? 2048 : 768}`,
    NEXT_TELEMETRY_DISABLED: "1",
    APOGEE_LOCAL_PREVIEW: "1",
    APPLICATION_HOSTING_PROVIDER: "caddy",
    MEMBERS_EMAIL_ENABLED: "false",
    RADAR_BILLING_ENABLED: "false",
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
  };
}

export function previewCommand(mode) {
  if (mode === "build") return ["node_modules/next/dist/bin/next", "build", "--webpack"];
  if (mode === "serve") return ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "4383"];
  throw new Error("Use build or serve; this preview never starts next dev.");
}

export function previewHeaders(input) {
  const headers = { ...input };
  for (const key of ["forwarded", "x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-vercel-forwarded-for", "connection"]) delete headers[key];
  // A loopback-only boundary overwrites client identity before the private backend.
  headers["x-apogee-client-ip"] = "127.0.0.1";
  headers.host = "127.0.0.1:4381";
  headers["x-forwarded-host"] = "127.0.0.1:4381";
  headers["x-forwarded-proto"] = "http";
  return headers;
}
