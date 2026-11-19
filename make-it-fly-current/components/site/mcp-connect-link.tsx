"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";

const McpEnabledContext = createContext(false);

export function McpAvailabilityProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <McpEnabledContext.Provider value={enabled}>{children}</McpEnabledContext.Provider>;
}

export function McpConnectLink({ className, provider, label }: { className?: string; provider?: "chatgpt" | "claude"; label?: string }) {
  return useContext(McpEnabledContext)
    ? <Link data-ap-provider={provider} className={className} href={`/membros/integracoes/mcp${provider === "claude" ? "?provedor=claude#claude" : ""}`} prefetch={false}>{label ?? `Incluir no meu ${provider === "claude" ? "Claude" : "ChatGPT"}`}</Link>
    : null;
}

export function McpConnectionStrip({ className }: { className: string }) {
  if (!useContext(McpEnabledContext)) return null;
  return <nav id="integracoes-ia" className={className} aria-label="Integrações da Apogee"><span>Use o Radar na sua IA</span>
    <McpConnectLink label="Incluir no ChatGPT" provider="chatgpt" /><McpConnectLink label="Incluir no Claude" provider="claude" />
  </nav>;
}
