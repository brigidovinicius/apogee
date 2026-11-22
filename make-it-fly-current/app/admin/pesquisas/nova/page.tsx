import Link from "next/link";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import { SurveyEditor } from "@/components/surveys/survey-editor";
import { requireAdmin } from "@/lib/admin/access";
import { blankSurvey, codexWorkshopSurvey } from "@/lib/surveys/templates";

export const metadata = { title: "Criar pesquisa" };

export default async function NewSurveyPage({ searchParams }: { searchParams: Promise<{ modelo?: string }> }) {
  await requireAdmin("/admin/pesquisas/nova");
  const template = (await searchParams).modelo === "codex";
  return <div className={adminStyles.content}>
    <AdminPageHeader title="Criar pesquisa" description="Defina as perguntas, a finalidade e o prazo de retenção." aside={<Link href="/admin/pesquisas">Voltar às pesquisas</Link>} />
    <SurveyEditor key={String(template)} initial={template ? codexWorkshopSurvey : blankSurvey} />
  </div>;
}
