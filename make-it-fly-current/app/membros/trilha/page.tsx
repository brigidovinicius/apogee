import type { CSSProperties } from "react";
import Link from "next/link";
import { memberLearning } from "@/lib/deliverables/store";
import { MemberWorkspace } from "@/components/members/member-workspace";
import { AnnualAccessNotice } from "@/components/community/annual-access-notice";
import { LearningProgress } from "@/components/community/learning-progress";
import styles from "@/components/members/members.module.css";
import local from "@/components/community/deliverables.module.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "Trilha inicial", robots: { index: false, follow: false } };
export default async function LearningPage() {
  const { member, access, tracks, modules, activities } = await memberLearning();
  const next = tracks.flatMap(t => modules.filter(m => m.track_id === t.id).flatMap(m => activities.filter(a => a.module_id === m.id))).find(a => !a.completed_at);
  return <MemberWorkspace member={member} current="trilha"><div data-ap-learning="" className={styles.container}>
    <header data-ap-learning-studio="catalogue" className={styles.pageHead}><div><p className={styles.eyebrow}>Comunidade Apogee</p><h1 data-ap-title="" className={styles.title}>Trilha inicial.</h1><p className={styles.lead}>Acompanhe suas atividades e seu progresso. Lhe avisaremos sobre novidades.</p></div></header>
    <div className={local.section}>{!access.allowed ? <AnnualAccessNotice title="Trilha" next="/membros/trilha" /> : <>
      {next ? <p className={local.nextActivity}>Próximo passo: <a href={`#atividade-${next.id}`}>{next.name}</a>.</p> : activities.length ? <p role="status">Você concluiu todas as atividades disponíveis.</p> : null}
      {!activities.length ? <section data-ap-card="" className={local.card}><h2 data-ap-heading="">Conteúdo em preparação</h2><p>As atividades aparecerão aqui quando forem publicadas.</p><Link href="/membros/oportunidades">Explorar o Radar</Link></section> : tracks.map(t => <section key={t.id} data-ap-card="" className={local.card} aria-labelledby={`trilha-${t.id}`}>
        <h2 data-ap-heading="" id={`trilha-${t.id}`}>{t.name}</h2><p>{t.description}</p>
        {modules.filter(m => m.track_id === t.id).map(m => {
          const items = activities.filter(a => a.module_id === m.id), done = items.filter(a => a.completed_at).length;
          return <section key={m.id} data-ap-card="" className={local.card}><h3 data-ap-heading="">{m.name}</h3>
            {m.status === "preparing" ? <p>Em preparação.</p> : <><p>{m.description}</p><p><strong>Entregável:</strong> {m.deliverable}</p><p className={items.length ? local.moduleProgress : undefined} style={items.length ? { "--ap-progress": `${100 * done / items.length}%` } as CSSProperties : undefined}>{items.length ? `${done} de ${items.length} atividades concluídas${done === items.length ? " · Módulo concluído" : " · Disponível"}` : "Atividades em preparação"}</p>
              {items.map(a => <article data-complete={Boolean(a.completed_at)} key={a.id} id={`atividade-${a.id}`} data-ap-card="" className={local.card}><h4 data-ap-heading="">{a.name}{a.completed_at ? " · Concluída" : ""}</h4><p className={local.instructions}>{a.instructions}</p>
                {a.resource_url ? <p><a href={a.resource_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir material oficial (nova aba)</a></p> : null}<LearningProgress id={a.id} completed={Boolean(a.completed_at)} /></article>)}
            </>}
          </section>;
        })}
      </section>)}
    </>}</div><p><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
