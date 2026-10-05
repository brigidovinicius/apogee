import type { ReactNode } from "react";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/lib/hexclave/server";

// O provider fica apenas no ramo de autenticação para que páginas públicas não
// dependam das variáveis de um projeto Stack Auth ainda não configurado.
export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <HexclaveProvider app={hexclaveServerApp}>
      <HexclaveTheme>{children}</HexclaveTheme>
    </HexclaveProvider>
  );
}
