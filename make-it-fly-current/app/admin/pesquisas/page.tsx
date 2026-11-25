import Link from "next/link";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import styles from "@/components/surveys/surveys.module.css";
import { surveyStatusLabels } from "@/lib/surveys/contract";
import { listSurveys } from "@/lib/surveys/store";

export const metadata = { title: "Pesquisas" };

export default async function SurveysAdminPage() {
  const surveys = await listSurveys();
  return <div className={adminStyles.content}>
    <AdminPageHeader title="Pesquisas" description="Crie formulários e consulte as respostas." aside={<Link href="/admin/pesquisas/nova" data-ap-button="primary">Criar pesquisa</Link>} />
    <section className={styles.panel} aria-label="Pesquisas">
      <p><Link href="/admin/pesquisas/nova?modelo=codex">Usar modelo do workshop Codex</Link></p>
      {surveys.length ? <ul className={styles.list}>{surveys.map(survey => <li key={survey.id}>
        <div className={styles.actions}>
          <div><Link href={`/admin/pesquisas/${survey.id}`}>{survey.title}</Link> · {surveyStatusLabels[survey.status]}</div>
          <Link href={`/admin/pesquisas/${survey.id}/respostas`} aria-label={`Ver respostas de ${survey.title}`}>Ver respostas</Link>
        </div>
      </li>)}</ul> : <p>Você ainda não criou nenhuma pesquisa.</p>}
    </section>
  </div>;
}
