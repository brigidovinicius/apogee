import Link from "next/link";
import { AdminNotice, AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { listAdminOpportunityCatalogue } from "@/lib/opportunities/access";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function AdminCurationPage() {
  const opportunities = await listAdminOpportunityCatalogue();

  return (
    <div className={styles.content}>
      <AdminPageHeader
        title="Curadoria"
        description="Auditoria somente leitura do catálogo que o produto já consome. Ações de publicar, rejeitar, reprocessar e comparar revisões permanecem ausentes até existir contrato de dados e auditoria."
        aside={<span className={styles.dataBadge}>Somente leitura</span>}
      />

      <AdminNotice
        tone="attention"
        title="Fila editorial ainda não implementada"
        description="O app não possui revisões, evidências por campo, justificativas nem transições editoriais persistidas. Esta tela não simula essas operações."
      />

      {opportunities.length > 0 ? (
        <section aria-labelledby="catalogue-title">
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Catálogo disponível</p>
              <h2 id="catalogue-title">Oportunidades consumidas pelo Radar</h2>
              <p>{opportunities.length} {opportunities.length === 1 ? "registro" : "registros"}, incluindo a fonte local e a integração Radar quando configurada.</p>
            </div>
          </div>
          <ul className={styles.catalogueGrid}>
            {opportunities.map((opportunity) => (
              <li className={styles.catalogueCard} key={opportunity.id}>
                <div className={styles.catalogueMeta}>
                  <span>{opportunity.kind}</span>
                  <span>{opportunity.level}</span>
                </div>
                <div>
                  <h2>{opportunity.title}</h2>
                  <p>{opportunity.organization}</p>
                </div>
                <p>{opportunity.deadlineLabel}</p>
                <p>Verificado em {date.format(new Date(`${opportunity.verifiedAt}T12:00:00Z`))}</p>
                <Link
                  className={styles.textLink}
                  href={opportunity.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Conferir fonte oficial
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className={styles.emptyState} role="status">
          <div className={styles.stateCard}>
            <p className={styles.eyebrow}>Catálogo vazio</p>
            <h2>Nenhuma oportunidade disponível.</h2>
            <p>Confirme a fonte editorial ou a integração do Radar antes de tentar revisar conteúdo.</p>
          </div>
        </section>
      )}
    </div>
  );
}
