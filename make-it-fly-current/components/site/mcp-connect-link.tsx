"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";

const McpEnabledContext = createContext(false);

export function McpAvailabilityProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <McpEnabledContext.Provider value={enabled}>{children}</McpEnabledContext.Provider>;
}

export function McpConnectLink({ className, provider = "chatgpt" }: { className?: string; provider?: "chatgpt" | "claude" }) {
  return useContext(McpEnabledContext)
    ? <Link className={className} href={`/membros/integracoes/mcp${provider === "claude" ? "#claude" : ""}`} prefetch={false}>Incluir no meu {provider === "claude" ? "Claude" : "ChatGPT"}</Link>
    : null;
}
