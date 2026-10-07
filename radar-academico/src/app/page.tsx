import Link from "next/link";
import { listPublicOpportunities } from "@/lib/db/read-models";
import styles from "./radar.module.css";

const coverage = process.env.NEXT_PUBLIC_COVERAGE_LABEL ??
  "Beta: UFSC, oportunidades de Santa Catarina e programas nacionais selecionados";

function routeLabel(route: string) {
  if (route === "application_via_professor") return "Candidatura via professor";
  if (route === "application_via_university" || route === "institutional_call") return "Candidatura via instituição";
  return "Candidatura direta";
}

export default async function Home() {
  const opportunities = await listPublicOpportunities();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={`${styles.shell} ${styles.headerInner}`}>
          <Link href="/" className={styles.brand}>
            <strong>Radar Acadêmico</strong>
            <span>Por Apogee</span>
          </Link>
          <Link href="/admin/fontes" className={styles.adminLink}>Administração</Link>
        </div>
      </header>

      <section className={`${styles.shell} ${styles.hero}`}>
        <p className={styles.eyebrow}>Oportunidades verificadas</p>
        <h1>Origem que você pode <em>conferir.</em></h1>
        <p>Oportunidades acadêmicas públicas, provenientes de fontes oficiais, reunidas, verificadas e organizadas em um só lugar.</p>
        <p className={styles.coverage}>{coverage}</p>
      </section>

      <section className={styles.board} aria-labelledby="opportunities-heading">
        <div className={styles.shell}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Oportunidades abertas</p>
              <h2 id="opportunities-heading">Revisadas pela equipe.</h2>
            </div>
            <p className={styles.count}>{opportunities.length} publicada(s)</p>
          </div>

          {opportunities.length ? (
            <div className={styles.grid}>
              {opportunities.map((item) => (
                <article key={item.id} className={styles.card}>
                  <ul className={styles.statusList} aria-label="Status da oportunidade">
                    <li className={styles.status}>Fonte oficial</li>
                    <li className={styles.status}>Revisada</li>
                    {item.has_retification ? <li className={`${styles.status} ${styles.statusMuted}`}>Possui retificação</li> : null}
                  </ul>
                  <p className={styles.cardInstitution}>{item.institution}</p>
                  <h3>{item.title}</h3>
                  <p className={styles.cardRoute}>{routeLabel(item.application_route)}</p>
                  <Link href={`/oportunidades/${item.id}`} className={styles.detailsLink}>Ver detalhes <span aria-hidden="true">→</span></Link>
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h2>Nenhuma oportunidade publicada ainda.</h2>
              <p>Itens coletados só aparecem aqui depois da conferência da fonte, do prazo, do público e do caminho de candidatura.</p>
            </div>
          )}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={`${styles.shell} ${styles.footerInner}`}>
          <p>O Radar Acadêmico reúne informações públicas de fontes oficiais. A plataforma não possui vínculo com as instituições divulgadas, não participa dos processos seletivos e não garante aprovação. Em caso de divergência, prevalecem o edital, as retificações e as informações publicadas pela instituição responsável.</p>
        </div>
      </footer>
    </main>
  );
}
