import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Links de convite/verificação contêm segredos transitórios; omitir dos logs dev.
  logging: { incomingRequests: { ignore: [/\/meu-calendario\//, /\/membros\/convite/, /\/membros\/(cadastro|entrar)/, /\/api\/auth\/verify-email/] } },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
      ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }, { source: "/api/:path*", headers: [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
    ] }, ...["mobile", "desktop"].map(device => ({
      // Versioned clips are never overwritten after publication.
      source: `/media/earth-v2/earth-${device}-scroll-v3.mp4`,
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }))];
  },
  // Gera um servidor Node enxuto para o container da VPS. Os assets públicos
  // são copiados pelo Dockerfile conforme a documentação de self-hosting.
  output: "standalone",
  // The loopback preview runs next start from this checkout, not a container bundle.
  ...(process.env.APOGEE_LOCAL_PREVIEW === "1" ? { output: undefined } : {}),
  // Preserve the approved landing's CSS output during promotion to the root.
  experimental: {
    cssChunking: false,
    ...(process.env.APOGEE_LOCAL_PREVIEW === "1" ? {
      cpus: 1,
      webpackBuildWorker: true,
      webpackMemoryOptimizations: true,
      preloadEntriesOnStart: false,
    } : {}),
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
  // A imagem de produção é construída em uma camada limpa, sem reutilizar
  // `.next/cache`. Mantemos o cache de desenvolvimento, mas evitamos gravar
  // o cache persistente do Webpack em cada build de produção.
  webpack(config, { dev }) {
    if (config.cache && !dev) config.cache = { type: "memory" };
    return config;
  },
  // O Make It Fly virou uma página do site Apogee (/makeitfly). Mantém vivos os
  // links já divulgados: o formulário antigo e a raiz do domínio makeitfly.
  async redirects() {
    return [
      { source: "/participar", destination: "/makeitfly/participar", permanent: false },
      {
        source: "/",
        has: [{ type: "host", value: "makeitfly.vercel.app" }],
        destination: "/makeitfly",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
