import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: { cpus: 1 },
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }];
  },
  // Desliga o double-mount do StrictMode em dev: ele monta/desmonta o Canvas
  // do react-three-fiber duas vezes, o que perde o contexto WebGL e deixa a
  // LUA invisivel so no `next dev` (no build de producao isso nao acontece —
  // por isso ela aparecia na Vercel, mas nao localmente).
  reactStrictMode: false,
  // Fixa a raiz do workspace para o Turbopack nao subir ate o diretorio home.
  // process.cwd() e a raiz do projeto tanto local quanto no build da Vercel.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
