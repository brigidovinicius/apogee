import Link from "next/link";
import { AdminPageHeader, MetricCard, adminStyles as styles } from "@/components/admin/admin-ui";
import { getBehaviorOverview } from "@/lib/admin/behavior";
import { BehaviorInsightsPanel } from "@/components/admin/behavior-insights";
import { getBlogRadarReport } from "@/lib/admin/blog-radar";
import { BLOG_RADAR_ARTICLES } from "@/lib/behavior-contract";
export const dynamic = "force-dynamic";
const number = new Intl.NumberFormat("pt-BR");
const dropSignupEvent = "drop_signup_completed";
const pages: Record<string, string> = { event_page: "Evento Codex Community", member_benefits: "Benefícios", member_toolbox: "Caixa de Ferramentas", member_learning: "Trilha", annual_offer: "Oferta anual", annual_summary: "Resumo da assinatura", home: "Página inicial", radar_list: "Radar · catálogo", radar_detail: "Radar · detalhes", radar_saved: "Radar · catálogo de membros", radar_calendar: "Radar · calendário", radar_access: "Radar · acesso", calendars: "Calendários", calendar_detail: "Calendário público", collections: "Coleções", collection_detail: "Coleção", competitions: "Competições", blog_list: "Blog", blog_article: "Artigos", store: "Loja", gallery: "Galeria", makeitfly: "Make It Fly", makeitfly_application: "Inscrição Make It Fly", login: "Entrada", signup: "Cadastro", password_recovery: "Recuperação de acesso", community: "Comunidade", privacy: "Privacidade", terms: "Termos" };
const events: Record<string, string> = { page_view: "Visualização", navigation: "Navegação para", scroll_depth: "Rolagem (%)", engaged_time: "Tempo visível", section_view: "Seção", action: "Ação iniciada", filter_apply: "Uso dos filtros", form_progress: "Etapa do formulário", blog_radar_view: "Leitura medida", blog_radar_click: "Leitura com clique no Radar", [dropSignupEvent]: "Cadastro concluído" };
const blogLabels = Object.fromEntries(BLOG_RADAR_ARTICLES.map(article => [article.key, article.label]));
const targets: Record<string, string> = { event_online_selected: "Escolher online", event_workshop_selected: "Escolher lista presencial", event_luma_opened: "Abrir lista no Luma", annual_price: "Preço anual visto", annual_choose: "Plano anual escolhido", account_ready: "Conta apta para pagar", confirmed_return: "Confirmação exibida", view: "Página", save: "Salvar", remove_saved: "Remover dos salvos", alert_request: "Solicitar aviso", series_alert_request: "Acompanhar edições", checkout_start: "Iniciar checkout", google_calendar: "Conectar Google Agenda", official_link: "Abrir fonte oficial", store_interest: "Interesse em produto", application_start: "Abrir inscrição", application_open: "Abrir formulário externo", applied: "Aplicar", cleared: "Limpar", started: "Primeira interação", step_1: "Etapa 1 concluída", step_2: "Etapa 2 concluída", step_3: "Etapa 3 concluída", validation_error: "Erro de validação", submit_started: "Envio iniciado", submit_succeeded: "Envio confirmado", submit_failed: "Envio sem confirmação" };
export default async function BehaviorPage({ searchParams }: {
  searchParams: Promise<{ inicio?: string | string[]; fim?: string | string[] }>;
}) {
  const dates = await searchParams;
  const overview = await getBehaviorOverview();
  const blog = await getBlogRadarReport(typeof dates.inicio === "string" ? dates.inicio : undefined, typeof dates.fim === "string" ? dates.fim : undefined);
  return <div className={styles.content}>
    <AdminPageHeader title="Comportamento" description="Contagens dos últimos 30 dias, no horário de Brasília. Incluem apenas a medição permitida pelo visitante; não representam pessoas únicas nem todo o tráfego." />
    <section className={styles.surface} aria-labelledby="blog-radar-title">
      <h2 id="blog-radar-title">Blog → Radar</h2>
      <p>Cada leitura pode registrar um clique medido no Radar.</p>
      <form method="get" action="/admin/comportamento">
        <label>Início <input type="date" name="inicio" defaultValue={blog.range.start} required /></label>{" "}
        <label>Fim <input type="date" name="fim" defaultValue={blog.range.end} required /></label>{" "}
        <button type="submit">Ver período</button>
      </form>
      {blog.state === "ready" ? <table>
        <caption>Leituras de {blog.range.start} a {blog.range.end}</caption>
        <thead><tr><th scope="col">Artigo</th><th scope="col">Primeiro registro disponível</th><th scope="col">Leituras medidas</th><th scope="col">Leituras com clique</th><th scope="col">Taxa de clique</th></tr></thead>
        <tbody>{blog.rows.map(row => <tr key={row.label}>
          <th scope="row">{row.label}</th><td>{row.firstDay ?? "Sem dados"}</td>
          <td>{row.views === null ? "Sem dados" : number.format(row.views)}</td>
          <td>{row.clicks === null ? "Sem dados" : number.format(row.clicks)}</td>
          <td>{row.views && row.clicks !== null && row.clicks <= row.views ? `${number.format(Math.round(row.clicks / row.views * 1_000) / 10)}%` : "Sem dados"}</td>
        </tr>)}</tbody>
      </table> : <p role="status">{blog.state === "invalid" ? "Selecione dias completos dentro do histórico de 90 dias." : blog.state === "disabled" ? "Medição desativada neste ambiente." : "Contagem por artigo indisponível."}</p>}
    </section>
    {overview.state !== "ready" ? <p role="status">{overview.state === "disabled" ? "Medição de uso desativada neste ambiente." : "Não foi possível consultar as contagens agora."}</p> : <>
      <section className={styles.metrics} aria-label="Uso agregado">
        <MetricCard label="Visualizações" value={number.format(overview.insights.totals.views)} detail="Páginas medidas" />
        <MetricCard label="Navegações" value={number.format(overview.insights.totals.navigation)} detail="Cliques para outras páginas" />
        <MetricCard label="Ações iniciadas" value={number.format(overview.insights.totals.actions)} detail="Intenção; não comprova conclusão ou pagamento" />
        <MetricCard label="Uso dos filtros" value={number.format(overview.insights.totals.filters)} detail="Sem termos buscados ou valores dos filtros" />
        <MetricCard label="Cadastros de espera" value={number.format(overview.rows.reduce((total, row) =>
          row.event === dropSignupEvent ? total + Number(row.total) : total, 0))}
          detail="Inscrições distintas por peça com medição permitida" />
      </section>
      <section className={styles.surface} aria-label="Jornada de compra anual">
        <h2>Jornada de compra anual</h2>
        <p>Ocorrências consentidas por dispositivo nos últimos 30 dias. Uma pessoa pode passar pela mesma etapa mais de uma vez.</p>
        <table><caption>Etapas da assinatura</caption><thead><tr><th>Etapa</th><th>Celular</th><th>Desktop</th></tr></thead>
          <tbody>{[["annual_offer","annual_price"],["annual_offer","annual_choose"],["annual_summary","account_ready"],["annual_summary","checkout_start"],["annual_summary","confirmed_return"]].map(([page, target]) =>
            <tr key={target}><th scope="row">{targets[target]}</th>{["mobile","desktop"].map(device =>
              <td key={device}>{number.format(Number(overview.rows.find(row => row.page === page && row.target === target && row.device === device)?.total ?? 0))}</td>)}</tr>)}</tbody>
        </table>
        <Link href="/admin/assinaturas">Consultar compradores e primeiro uso registrado</Link>
      </section>
      <BehaviorInsightsPanel data={overview.insights} />
      <section className={styles.surface} aria-label="Contagens por categoria">
        <p>Sem identificadores de conta ou sessão, respostas, termos de busca ou histórico individual. Cada linha soma uma categoria de página e de ação. Até 500 combinações mais frequentes.</p>
        {overview.rows.length ? <div style={{ overflowX: "auto" }}><table><caption>Eventos medidos nos últimos 30 dias</caption><thead><tr><th scope="col">Página</th><th scope="col">Evento</th><th scope="col">Ação ou marco</th><th scope="col">Dispositivo</th><th scope="col">Contagem</th></tr></thead><tbody>
          {overview.rows.slice(0, 500).map(row => <tr key={[row.page, row.event, row.target, row.device].join(":")}><td>{pages[row.page] ?? row.page}</td><td>{events[row.event] ?? row.event}</td><td>{row.event === dropSignupEvent ? "Lista de espera da loja" : pages[row.target] ?? targets[row.target] ?? blogLabels[row.target] ?? row.target}</td><td>{row.device === "mobile" ? "Móvel" : "Desktop"}</td><td>{number.format(Number(row.total))}</td></tr>)}
        </tbody></table></div> : <p role="status">Ainda não há eventos medidos no período.</p>}
      </section>
    </>}
  </div>;
}
