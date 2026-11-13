import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getAuth } from "@/lib/members/auth";
import { requireSignedInMember } from "@/lib/members/dal";
import { mcpEnabled } from "@/lib/mcp/config";
import { verifiedMcpQuery } from "@/lib/mcp/oauth";
import { decideMcpConsent } from "../actions";
import styles from "@/components/members/members.module.css";

export const metadata: Metadata = { title: "Autorizar conexão com o Radar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function McpConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!mcpEnabled()) notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  const query = await verifiedMcpQuery(params);
  if (!query) return <div className={styles.narrow}><h1 className={styles.title}>Conexão expirada</h1><p>Volte ao aplicativo e conecte a Apogee novamente.</p></div>;
  const signed = new URLSearchParams(query);
  const member = await requireSignedInMember(`/membros/integracoes/mcp/autorizar?${query}`);
  const clientId = signed.get("client_id");
  if (!clientId) notFound();
  const client = await getAuth().api.getOAuthClientPublic({ query: { client_id: clientId }, headers: await headers() });
  const scopes = (signed.get("scope") ?? "").split(" ").filter(Boolean);
  if (scopes.some(scope => !["radar:read", "offline_access"].includes(scope))) notFound();
  let callbackHost: string;
  try { callbackHost = new URL(signed.get("redirect_uri") ?? "").host; } catch { notFound(); }
  return <div className={styles.narrow}>
    <p className={styles.eyebrow}>Conexão com o Radar</p>
    <h1 className={styles.title}>Autorizar {client.client_name ?? "aplicativo"}?</h1>
    <p className={styles.lead}>Você está conectado como @{member.username}. O nome acima é informado pelo aplicativo. Confira também o domínio de retorno: <strong>{callbackHost}</strong>.</p>
    <div className={styles.panel}>
      <p>Ao autorizar, o aplicativo poderá buscar oportunidades e consultar detalhes e datas com os mesmos direitos de acesso da sua conta.</p>
      {scopes.includes("offline_access") && <p>A conexão poderá ser renovada para consultas futuras até você desconectá-la.</p>}
      <p>Sua escolha gratuita não será consumida pelo aplicativo. Você poderá revogar o acesso em Conexões de IA na área de membros.</p>
      <form action={decideMcpConsent} className={styles.form}>
        <input type="hidden" name="oauth_query" value={query} />
        <button className={styles.primary} type="submit" name="decision" value="allow">Autorizar leitura do Radar</button>
        <button className={styles.linkButton} type="submit" name="decision" value="deny">Cancelar</button>
      </form>
    </div>
  </div>;
}
