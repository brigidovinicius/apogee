import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Preserve the approved landing's CSS output during promotion to the root.
  experimental: { cssChunking: false },
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
