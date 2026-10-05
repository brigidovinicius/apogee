import "server-only";
import { HexclaveServerApp } from "@hexclave/next";
import { hexclaveUrls } from "./urls";

// O SDK obtém a identidade da sessão pelos cookies do Next.js. Nunca exponha
// HEXCLAVE_SECRET_SERVER_KEY com o prefixo NEXT_PUBLIC_.
export const hexclaveServerApp = new HexclaveServerApp({
  projectId: process.env.HEXCLAVE_PROJECT_ID!,
  secretServerKey: process.env.HEXCLAVE_SECRET_SERVER_KEY!,
  tokenStore: "nextjs-cookie",
  urls: hexclaveUrls,
});
