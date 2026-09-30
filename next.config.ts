import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
