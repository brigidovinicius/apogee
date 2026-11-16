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
  return <MemberWorkspace member={member} current="trilha"><div className={styles.container}>
    <header className={styles.pageHead}><div><p className={styles.eyebrow}>Comunidade Apogee</p><h1 className={styles.title}>Trilha inicial.</h1><p className={styles.lead}>Atividades práticas e seu progresso. Novos módulos em preparação.</p></div></header>
    <div className={local.section}>{!access.active ? <AnnualAccessNotice title="Trilha" next="/membros/trilha" /> : <>
      {next ? <p>Próximo passo: <a href={`#atividade-${next.id}`}>{next.name}</a>.</p> : activities.length ? <p role="status">Você concluiu todas as atividades disponíveis.</p> : null}
      {!tracks.length ? <section className={local.card}><h2>Conteúdo em preparação</h2><p>As atividades aparecerão aqui quando forem publicadas.</p><Link href="/membros/oportunidades">Explorar o Radar</Link></section> : tracks.map(t => <section key={t.id} className={local.card} aria-labelledby={`trilha-${t.id}`}>
        <h2 id={`trilha-${t.id}`}>{t.name}</h2><p>{t.description}</p>
        {modules.filter(m => m.track_id === t.id).map(m => {
          const items = activities.filter(a => a.module_id === m.id), done = items.filter(a => a.completed_at).length;
          return <section key={m.id} className={local.card}><h3>{m.name}</h3>
            {m.status === "preparing" ? <p>Em preparação.</p> : <><p>{m.description}</p><p><strong>Entregável:</strong> {m.deliverable}</p><p>{items.length ? `${done} de ${items.length} atividades concluídas${done === items.length ? " · Módulo concluído" : " · Disponível"}` : "Atividades em preparação"}</p>
              {items.map(a => <article key={a.id} id={`atividade-${a.id}`} className={local.card}><h4>{a.name}{a.completed_at ? " · Concluída" : ""}</h4><p className={local.instructions}>{a.instructions}</p>
                {a.resource_url ? <p><a href={a.resource_url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Abrir material oficial (nova aba)</a></p> : null}<LearningProgress id={a.id} completed={Boolean(a.completed_at)} /></article>)}
            </>}
          </section>;
        })}
      </section>)}
    </>}</div><p><Link href="/membros/suporte">Preciso de ajuda</Link></p>
  </div></MemberWorkspace>;
}
