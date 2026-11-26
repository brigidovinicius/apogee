import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import { SurveyEditor } from "@/components/surveys/survey-editor";
import { SurveyForm } from "@/components/surveys/survey-form";
import styles from "@/components/surveys/surveys.module.css";
import { getAdminSurvey, surveysEnabled } from "@/lib/surveys/store";

export const metadata = { title: "Editar pesquisa" };

export default async function EditSurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const survey = await getAdminSurvey(id);
  if (!survey) notFound();

  return <div className={adminStyles.content}>
    <AdminPageHeader title="Editar pesquisa" aside={<Link href="/admin/pesquisas">Voltar às pesquisas</Link>} />
    <div className={styles.actions}>
      <Link href={`/admin/pesquisas/${id}/respostas`} data-ap-button="secondary">Ver respostas</Link>
      {surveysEnabled() && survey.status === "open" && <Link href={`/pesquisas/${survey.slug}`} data-ap-button="secondary">Abrir formulário</Link>}
    </div>
    <SurveyEditor initial={survey} existing={{ id, revision: survey.revision }} />
    <details className={styles.panel}>
      <summary>Prévia da última versão salva</summary>
      <h2>{survey.title}</h2>
      {survey.intro && <p>{survey.intro}</p>}
      <SurveyForm key={survey.revision} survey={survey} preview />
    </details>
  </div>;
}
