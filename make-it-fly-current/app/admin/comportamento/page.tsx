import { AdminPageHeader, MetricCard, adminStyles as styles } from "@/components/admin/admin-ui";
import { getBehaviorOverview } from "@/lib/admin/behavior";
import { BehaviorInsightsPanel } from "@/components/admin/behavior-insights";
export const dynamic = "force-dynamic";
const number = new Intl.NumberFormat("pt-BR");
const pages: Record<string, string> = { home: "Página inicial", radar_list: "Radar · catálogo", radar_detail: "Radar · detalhes", radar_saved: "Radar · salvos", radar_calendar: "Radar · calendário", radar_access: "Radar · acesso", calendars: "Calendários", calendar_detail: "Calendário público", collections: "Coleções", collection_detail: "Coleção", competitions: "Competições", blog_list: "Blog", blog_article: "Artigos", store: "Loja", gallery: "Galeria", makeitfly: "Make It Fly", makeitfly_application: "Inscrição Make It Fly", login: "Entrada", signup: "Cadastro", password_recovery: "Recuperação de acesso", community: "Comunidade", privacy: "Privacidade", terms: "Termos" };
const events: Record<string, string> = { page_view: "Visualização", navigation: "Navegação para", scroll_depth: "Rolagem (%)", engaged_time: "Tempo visível", section_view: "Seção", action: "Ação iniciada", filter_apply: "Uso dos filtros", form_progress: "Etapa do formulário" };
const targets: Record<string, string> = { view: "Página", save: "Salvar", remove_saved: "Remover dos salvos", alert_request: "Solicitar aviso", series_alert_request: "Acompanhar edições", checkout_start: "Iniciar checkout", google_calendar: "Conectar Google Agenda", official_link: "Abrir fonte oficial", store_interest: "Interesse em produto", application_start: "Abrir inscrição", application_open: "Abrir formulário externo", applied: "Aplicar", cleared: "Limpar", started: "Primeira interação", step_1: "Etapa 1 concluída", step_2: "Etapa 2 concluída", step_3: "Etapa 3 concluída", validation_error: "Erro de validação", submit_started: "Envio iniciado", submit_succeeded: "Envio confirmado", submit_failed: "Envio sem confirmação" };
export default async function BehaviorPage() {
  const overview = await getBehaviorOverview();
  return <div className={styles.content}>
    <AdminPageHeader title="Comportamento" description="Contagens dos últimos 30 dias, no horário de Brasília. Incluem apenas a medição permitida pelo visitante; não representam pessoas únicas nem todo o tráfego." />
    {overview.state !== "ready" ? <p role="status">{overview.state === "disabled" ? "Medição de uso desativada neste ambiente." : "Não foi possível consultar as contagens agora."}</p> : <>
      <section className={styles.metrics} aria-label="Uso agregado">
        <MetricCard label="Visualizações" value={number.format(overview.insights.totals.views)} detail="Páginas medidas" />
        <MetricCard label="Navegações" value={number.format(overview.insights.totals.navigation)} detail="Cliques para outras páginas" />
        <MetricCard label="Ações iniciadas" value={number.format(overview.insights.totals.actions)} detail="Intenção; não comprova conclusão ou pagamento" />
        <MetricCard label="Uso dos filtros" value={number.format(overview.insights.totals.filters)} detail="Sem termos buscados ou valores dos filtros" />
      </section>
      <BehaviorInsightsPanel data={overview.insights} />
      <section className={styles.surface} aria-label="Contagens por categoria">
        <p>Sem identificadores de conta ou sessão, respostas, termos de busca ou histórico individual. Cada linha soma uma categoria de página e de ação. Até 500 combinações mais frequentes.</p>
        {overview.rows.length ? <div style={{ overflowX: "auto" }}><table><caption>Eventos medidos nos últimos 30 dias</caption><thead><tr><th scope="col">Página</th><th scope="col">Evento</th><th scope="col">Ação ou marco</th><th scope="col">Dispositivo</th><th scope="col">Contagem</th></tr></thead><tbody>
          {overview.rows.slice(0, 500).map(row => <tr key={[row.page, row.event, row.target, row.device].join(":")}><td>{pages[row.page] ?? row.page}</td><td>{events[row.event] ?? row.event}</td><td>{pages[row.target] ?? targets[row.target] ?? row.target}</td><td>{row.device === "mobile" ? "Móvel" : "Desktop"}</td><td>{number.format(Number(row.total))}</td></tr>)}
        </tbody></table></div> : <p role="status">Ainda não há eventos medidos no período.</p>}
      </section>
    </>}
  </div>;
}
