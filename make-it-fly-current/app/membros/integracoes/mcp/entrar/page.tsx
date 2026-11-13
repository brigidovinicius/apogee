import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { McpLogin } from "@/components/members/mcp-login";
import styles from "@/components/members/members.module.css";
import { mcpEnabled } from "@/lib/mcp/config";
import { verifiedMcpQuery } from "@/lib/mcp/oauth";

export const metadata: Metadata = { title: "Conectar o Radar", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function McpLoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!mcpEnabled()) notFound();
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  const query = await verifiedMcpQuery(params);
  return <div className={styles.narrow}>
    <h1 className={styles.title}>Conectar o Radar</h1>
    {query ? <>
      <p className={styles.lead}>Entre com sua conta da Apogee. Depois, você poderá autorizar o aplicativo a consultar o Radar com o acesso que já possui.</p>
      <div className={styles.panel}><McpLogin /></div>
      <p><Link href="/membros/esqueci-senha">Esqueci minha senha</Link></p>
    </> : <p role="alert">Esta solicitação expirou ou é inválida. Volte ao aplicativo e conecte a Apogee novamente.</p>}
  </div>;
}
