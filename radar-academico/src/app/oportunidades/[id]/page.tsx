import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicOpportunity } from "@/lib/db/read-models";
import styles from "../../radar.module.css";

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getPublicOpportunity(id);
  if (!item) notFound();
  const verified = new Intl.DateTimeFormat("pt-BR").format(new Date(item.last_checked_at));
  return (
    <main className={styles.page}>
      <div className={`${styles.shell} ${styles.detail}`}>
        <Link href="/" className={styles.backLink}>← Voltar ao Radar</Link>
        <header className={styles.detailHeader}>
          <p className={styles.detailInstitution}>{item.institution}</p>
          <h1>{item.title}</h1>
          <ul className={`${styles.statusList} ${styles.detailStatuses}`} aria-label="Status da oportunidade">
            <li className={styles.status}>Fonte oficial</li>
            <li className={styles.status}>Revisada</li>
            <li className={`${styles.status} ${styles.statusMuted}`}>Atualizada em {verified}</li>
            {item.has_retification ? <li className={`${styles.status} ${styles.statusMuted}`}>Possui retificação</li> : null}
          </ul>
        </header>

        <section className={styles.detailPanel} aria-labelledby="source-heading">
          <h2 id="source-heading">Fonte e verificação</h2>
          <dl className={styles.details}>
            <div><dt>Instituição responsável</dt><dd>{item.institution}</dd></div>
            <div><dt>Última verificação</dt><dd>{verified}</dd></div>
          </dl>
          <div className={styles.actions}>
            <a href={item.official_document_url ?? item.source_page_url} target="_blank" rel="noopener noreferrer" className={styles.cta}>Abrir edital oficial</a>
            {item.application_url ? <a href={item.application_url} target="_blank" rel="noopener noreferrer" className={styles.secondaryCta}>Acessar inscrição oficial</a> : null}
          </div>
        </section>

        <p className={styles.notice}>Confirme prazos, requisitos e eventuais retificações diretamente no edital. Em caso de divergência, prevalece a fonte oficial.</p>
      </div>
    </main>
  );
}
