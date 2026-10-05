import { HexclaveClientApp } from "@hexclave/next";
import { hexclaveUrls } from "./urls";

// O identificador de projeto é público por definição; a chave de servidor fica
// exclusivamente em lib/hexclave/server.ts e nunca é enviada ao navegador.
export const hexclaveClientApp = new HexclaveClientApp({
  projectId: process.env.NEXT_PUBLIC_HEXCLAVE_PROJECT_ID!,
  tokenStore: "nextjs-cookie",
  urls: hexclaveUrls,
});
