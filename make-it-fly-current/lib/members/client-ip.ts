import "server-only";
import { isIP } from "node:net";

export function memberIpHeaders(): string[] {
  const provider = process.env.APPLICATION_HOSTING_PROVIDER || (process.env.VERCEL === "1" ? "vercel" : "unknown");
  if (provider === "caddy") return ["x-apogee-client-ip"];
  if (provider === "vercel") return ["x-vercel-forwarded-for"];
  return [];
}

// O cabeçalho só é confiável quando a borda o sobrescreve e o backend é privado.
// Não aceitar cadeias, portas, zone IDs ou fallback para outro provedor.
export function memberClientIp(headers: Headers): string | null {
  const header = memberIpHeaders()[0];
  const value = header ? headers.get(header) : null;
  if (value && !value.includes("%") && isIP(value)) return value;
  return process.env.NODE_ENV === "production" ? null : "127.0.0.1";
}
