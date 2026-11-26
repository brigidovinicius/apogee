import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireSignedInMember } from "@/lib/members/dal";
import { mcpEnabled, mcpResource } from "@/lib/mcp/config";
import { listMcpConnections } from "@/lib/mcp/connections";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { McpSetup } from "@/components/members/mcp-setup";
import { disconnectMcp } from "./actions";
import styles from "@/components/members/members.module.css";

export const metadata: Metadata = { title: "Conexões de IA", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function McpConnectionsPage({ searchParams }: { searchParams: Promise<{ desconectado?: string; provedor?: string }> }) {
  if (!mcpEnabled()) notFound();
  const params = await searchParams;
  const member = await requireSignedInMember(`/membros/integracoes/mcp${params.provedor === "claude" ? "?provedor=claude#claude" : ""}`);
  const connections = await listMcpConnections(member.id);
  return <MemberWorkspace member={member} current="integracoes">
    <div className={styles.container}>
      <h1 className={styles.title}>Conexões de IA</h1>
      <McpSetup resource={mcpResource()} />
      {params.desconectado === "1" && <p role="status">Conexão desconectada. Para usar novamente, autorize a Apogee no aplicativo.</p>}
      <h2 data-ap-heading="">Aplicativos autorizados</h2>
      {connections.length ? connections.map(connection => <div className={styles.panel} key={connection.clientId}>
        <h3 data-ap-heading="">{connection.name}</h3>
        <p>Conexão autorizada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(connection.authorizedAt))}.</p>
        <form action={disconnectMcp}>
          <input type="hidden" name="clientId" value={connection.clientId} />
          <button className={styles.linkButton} type="submit">Desconectar aplicativo</button>
        </form>
      </div>) : <p>Nenhum aplicativo conectado.</p>}
    </div>
  </MemberWorkspace>;
}
