import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import styles from "@/components/surveys/surveys.module.css";
import { collaborationLabels, surveyInactivityMinutes } from "@/lib/surveys/contract";
import { surveyResponses } from "@/lib/surveys/store";
import { purgeSurveyAction } from "../../actions";

export const metadata = { title: "Respostas da pesquisa" };
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function SurveyResponsesPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const parsedPage = z.coerce.number().int().min(1).max(1000).safeParse((await searchParams).pagina ?? "1");
  const page = parsedPage.success ? parsedPage.data : 1;
  const result = await surveyResponses(id, page);
  if (!result) notFound();
  const base = `/admin/pesquisas/${id}/respostas`;

  return <div className={adminStyles.content}>
    <AdminPageHeader title="Respostas da pesquisa" description={result.survey.title}
      aside={<Link href={`/admin/pesquisas/${id}`}>Voltar à edição</Link>} />
    <section className={styles.panel} data-ap-card="" aria-labelledby="survey-funnel">
      <h2 id="survey-funnel" data-ap-title="">Progresso por etapa</h2>
      <p>Versão {result.survey.revision} · {result.summary.started} tentativas iniciadas · {result.summary.submitted} envios confirmados · {result.summary.inactive} desistências estimadas</p>
      <p>Uma tentativa sem envio após {surveyInactivityMinutes} minutos de inatividade aparece na última etapa registrada. A contagem inclui tentativas com autorização para a pesquisa.</p>
      <div className={styles.stageTable}>
        <table>
          <thead><tr><th scope="col">Etapa</th><th scope="col">Alcançaram</th><th scope="col">Pararam aqui</th></tr></thead>
          <tbody>{result.stages.map(stage => <tr key={stage.id}>
            <th scope="row">{stage.label}</th><td>{stage.reached}</td><td>{stage.inactive}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>
    {result.responses.length === 0 && <p>Nenhuma resposta disponível nesta página.</p>}
    {result.responses.map(response => <article className={styles.panel} key={response.id}>
      <h2>Resposta de {date.format(new Date(response.created_at))}</h2>
      <p>Versão {response.revision}</p>
      {response.answers.map(({ label, value }, index) => <div key={index}>
        <strong>{label}</strong>
        <p className={styles.answer}>{value}</p>
      </div>)}
      {response.collaboration && <p>Convite para {collaborationLabels[response.collaboration].toLowerCase()} · {response.email}</p>}
      {response.radar_choice && <p>Escolha sobre o Radar · {response.radar_choice === "allow" ? "Sim, com confirmação na conta" : "Não autoriza"}</p>}
      {response.research_notice && <details>
        <summary>Texto da autorização</summary>
        <p>{response.research_notice}</p>
      </details>}
    </article>)}
    {(page > 1 || result.hasMore) && <nav className={styles.actions} aria-label="Páginas de respostas">
      {page > 1 && <Link href={`${base}?pagina=${page - 1}`}>Anterior</Link>}
      {result.hasMore && <Link href={`${base}?pagina=${page + 1}`}>Próxima</Link>}
    </nav>}
    <form action={purgeSurveyAction}>
      <input name="id" type="hidden" value={id} />
      <button type="submit" data-ap-button="secondary">Excluir registros vencidos</button>
    </form>
  </div>;
}
