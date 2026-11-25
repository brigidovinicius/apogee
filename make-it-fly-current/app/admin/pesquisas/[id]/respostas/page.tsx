import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AdminPageHeader, MetricCard, adminStyles } from "@/components/admin/admin-ui";
import { collaborationLabels, surveyInactivityMinutes, surveyResponseFilters, type SurveyResponseFilter } from "@/lib/surveys/contract";
import { surveyResponses } from "@/lib/surveys/store";
import { purgeSurveyAction } from "../../actions";
import styles from "./responses.module.css";

export const metadata = { title: "Respostas da pesquisa" };
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" });
const number = new Intl.NumberFormat("pt-BR");
const filterLabels: Record<SurveyResponseFilter, string> = {
  todos: "Todos",
  pesquisa: "Pesquisa",
  radar: "Só Radar",
};

function ResponseDate({ value }: { value: string }) {
  const timestamp = new Date(value);
  return <time dateTime={timestamp.toISOString()}>{date.format(timestamp)}</time>;
}

export default async function SurveyResponsesPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pagina?: string | string[]; tipo?: string | string[] }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const query = await searchParams;
  const filter = z.enum(surveyResponseFilters).safeParse(query.tipo).data ?? "todos";
  const requestedPage = z.coerce.number().int().positive().safeParse(query.pagina).data ?? 1;
  const result = await surveyResponses(id, requestedPage, filter);
  if (!result) notFound();
  const { survey, responses, totals, page, pageCount, summary, stages } = result;
  const base = `/admin/pesquisas/${id}/respostas`;
  const href = (type: SurveyResponseFilter, pageNumber = 1) => `${base}?tipo=${type}&pagina=${pageNumber}`;

  return (
    <div className={adminStyles.content}>
      <AdminPageHeader
        eyebrow="Administração · Pesquisas"
        title="Respostas da pesquisa"
        description={survey.title}
        aside={<Link href={`/admin/pesquisas/${id}`} data-ap-button="secondary">Editar pesquisa</Link>}
      />

      <div className={styles.metrics}>
        <MetricCard label="Envios recebidos" value={number.format(totals.todos)} detail="Dentro do prazo de retenção" />
        <MetricCard label="Respostas à pesquisa" value={number.format(totals.pesquisa)} detail="Envios com autorização para a pesquisa" />
        <MetricCard label="Envios identificados" value={number.format(totals.identified)} detail="Vinculados a uma conta Apogee" />
      </div>

      <section className={styles.panel} data-ap-card="" aria-labelledby="received">
        <header>
          <h2 id="received">Envios individuais</h2>
          <p>Abra um envio para ler as respostas e as autorizações. Horários de Brasília.</p>
        </header>
        <nav className={styles.controls} aria-label="Filtrar envios">
          {surveyResponseFilters.map(type => (
            <Link key={type} href={href(type)} aria-current={filter === type ? "page" : undefined}
              data-ap-button={filter === type ? "primary" : "secondary"}>
              {filterLabels[type]} ({number.format(totals[type])})
            </Link>
          ))}
        </nav>

        {responses.length === 0 ? (
          <p className={styles.empty}>{totals.todos === 0 ? "Nenhum envio disponível." : "Nenhum envio neste filtro."}</p>
        ) : (
          <ul className={styles.responses}>
            {responses.map(response => (
              <li key={response.id}>
                <details>
                  <summary className={styles.responseSummary}>
                    <span className={styles.respondent}>
                      <strong>{response.respondent_name ?? "Sem identificação de conta"}</strong>
                      {response.respondent_email && <span>{response.respondent_email}</span>}
                      {response.email && !response.respondent_email && <span>Contato para convite: {response.email}</span>}
                    </span>
                    <span className={styles.submission}>
                      <ResponseDate value={response.created_at} />
                      <span>{response.research_notice ? "Pesquisa" : "Só Radar"} · Versão {response.revision}</span>
                    </span>
                  </summary>
                  <div className={styles.responseBody}>
                    {response.research_notice && (
                      <div>
                        <h3>Respostas do formulário</h3>
                        {response.answers.length === 0 ? <p>Nenhuma pergunta preenchida.</p> : (
                          <dl className={styles.answers}>
                            {response.answers.map(({ label, value }, index) => (
                              <div key={index}>
                                <dt>{label}</dt>
                                <dd>{typeof value === "number" ? `${value}/10` : value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    )}
                    <div>
                      <h3>Autorizações e retenção</h3>
                      <dl className={styles.details}>
                        <div>
                          <dt>Pesquisa</dt>
                          <dd>{response.research_notice ? "Autorizada" : "Recusada"}</dd>
                        </div>
                        <div>
                          <dt>Medição do Radar</dt>
                          <dd>{response.radar_choice === "allow" ? "Aceitou na pesquisa. A medição depende de confirmação na conta."
                            : response.radar_choice === "deny" ? "Recusou na pesquisa" : "Sem escolha registrada"}</dd>
                        </div>
                        {response.collaboration && (
                          <div>
                            <dt>Convite para colaborar</dt>
                            <dd>{collaborationLabels[response.collaboration]} · {response.email}</dd>
                          </div>
                        )}
                        <div>
                          <dt>Disponível até</dt>
                          <dd><ResponseDate value={response.expires_at} /></dd>
                        </div>
                      </dl>
                      <details className={styles.notices}>
                        <summary>Textos apresentados no formulário</summary>
                        {response.research_notice && <p><strong>Pesquisa.</strong> {response.research_notice}</p>}
                        {response.collaboration_notice && <p><strong>Convite.</strong> {response.collaboration_notice}</p>}
                        {response.radar_notice && <p><strong>Radar.</strong> {response.radar_notice}</p>}
                      </details>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 && (
          <nav className={styles.controls} aria-label="Páginas de respostas">
            {page > 1 && <Link href={href(filter, page - 1)} data-ap-button="secondary">Anterior</Link>}
            <span>Página {number.format(page)} de {number.format(pageCount)}</span>
            {page < pageCount && <Link href={href(filter, page + 1)} data-ap-button="secondary">Próxima</Link>}
          </nav>
        )}
      </section>

      <section className={styles.panel} data-ap-card="" aria-labelledby="survey-funnel">
        <header>
          <h2 id="survey-funnel">Progresso por etapa</h2>
          <p>Versão {survey.revision} · Inícios {number.format(summary.started)} · Conclusões {number.format(summary.submitted)} · Interrupções estimadas {number.format(summary.inactive)}</p>
        </header>
        <p>O progresso conta tentativas com autorização para a pesquisa. Após {surveyInactivityMinutes} minutos sem atividade e sem envio, a tentativa aparece na última etapa registrada.</p>
        {summary.started > 0 && (
          <table className={styles.stages}>
            <thead><tr><th scope="col">Etapa</th><th scope="col">Alcançaram</th><th scope="col">Pararam aqui</th></tr></thead>
            <tbody>{stages.map(stage => (
              <tr key={stage.id}>
                <th scope="row">{stage.label}</th><td>{number.format(stage.reached)}</td><td>{number.format(stage.inactive)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>

      <details className={styles.retention}>
        <summary>Gerenciar retenção</summary>
        <p>Remova os envios e os registros de progresso que já passaram do prazo desta pesquisa.</p>
        <form action={purgeSurveyAction}>
          <input name="id" type="hidden" value={id} />
          <button type="submit" data-ap-button="secondary">Excluir registros vencidos</button>
        </form>
      </details>
    </div>
  );
}
