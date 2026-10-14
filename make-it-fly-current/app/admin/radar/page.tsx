import Link from "next/link";
import { AdminNotice, AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { OpportunitiesBoard } from "@/components/opportunities/opportunities-board";
import { requireAdmin } from "@/lib/admin/access";
import { listRadarEditorialSources, listRadarManagedOpportunities } from "@/lib/opportunities/radar-editorial-client";
import { toOpportunity } from "@/lib/opportunities/radar-client";
import { CatalogueForm } from "./catalogue-form";
import { SourceCard } from "./source-card";
export const dynamic = "force-dynamic";
export default async function AdminRadarPage({ searchParams }: { searchParams: Promise<{ editar?: string; criar?: string; vista?: string; resultado?: string }> }) {
  await requireAdmin("/admin/radar");
  const params = await searchParams;
  const radar = await listRadarManagedOpportunities();
  const editing = params.editar ? radar.opportunities.find((item) => item.id === params.editar) : undefined;
  const showForm = params.criar === "1" || Boolean(editing);
  const sources = showForm || params.vista === "fontes" ? await listRadarEditorialSources() : null;
  const mapped = radar.opportunities.map(toOpportunity);
  const available = radar.available && mapped.every((item) => item !== null);
  const opportunities = mapped.filter((item) => item !== null);
  return <div className={styles.content}>
    <AdminPageHeader title="Radar · catálogo ao vivo" description="As mesmas oportunidades disponíveis para o público, com controles de criação, edição e exclusão." />
    <nav aria-label="Gerenciamento do Radar" className={styles.radarAction}><Link href="/admin/radar">Catálogo</Link><Link href="/admin/radar?criar=1">Criar oportunidade</Link><Link href="/admin/radar?vista=fontes">Configurar fontes</Link><Link href="/oportunidades">Ver página pública</Link></nav>
    {params.resultado ? <AdminNotice tone={params.resultado.startsWith("erro") ? "attention" : "success"} title="Gerenciamento" description={params.resultado === "salva" ? "Oportunidade salva no catálogo ao vivo." : params.resultado === "excluida" ? "Oportunidade excluída do catálogo." : params.resultado.startsWith("erro") ? "A operação não foi concluída. Confira os dados e tente novamente." : "Operação de fonte concluída. Fichas válidas entram automaticamente."} /> : null}
    {!available ? <AdminNotice tone="attention" title="Catálogo indisponível" description="Não foi possível consultar o Radar. Tente novamente em instantes." /> : null}
    {params.editar && available && !editing ? <p role="alert">Esta ficha não está mais no catálogo ao vivo. Recarregue a lista.</p> : null}
    {showForm && sources?.available ? <CatalogueForm key={editing?.id ?? "create"} item={editing} sources={sources.sources.filter((source) => source.active && source.verificationStatus === "verified")} /> : null}
    {showForm && !sources?.available ? <p role="alert">Fontes indisponíveis. O formulário estará disponível quando a conexão voltar.</p> : null}
    {params.vista === "fontes" ? <section><h2>Fontes e coleta</h2><p>A autorização de fontes controla onde o coletor pode consultar. Cada ficha válida é publicada automaticamente.</p><ul className={styles.radarSourceList}>{sources?.sources.map((source) => <SourceCard key={source.id} source={source} />)}</ul></section> : !showForm && available ? <OpportunitiesBoard opportunities={opportunities} management /> : null}
  </div>;
}
