import { referenceCatalog, taxonomy } from "@/lib/blog/corroboration.mjs";
import { manageDossier } from "./dossie/actions";
import { editorialChecks } from "@/lib/blog/editorial-review";
import Link from "next/link";
import Image from "next/image";
import { AdminNotice, AdminPageHeader, MetricCard, adminStyles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";
import { getPipelineDashboard } from "@/lib/blog/pipeline";
import { EDITORIAS, pipelineMessages, pipelineReason, type PipelineSource } from "@/lib/blog/pipeline-validation";
import { managePipeline } from "./actions";
import styles from "./pipeline.module.css";

export const dynamic = "force-dynamic";
const money = (value: string | number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(Number(value) / 1_000_000);
const date = (value: Date | null) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)) : "Ainda não verificado";
const states: Record<string, string> = { ready: "Pronta para criar", discovered: "Aguardando evidências", held: "Retida", draft: "Rascunho no CMS", published: "Publicado", scheduled: "Agendado", archived: "Arquivado", pending: "Aguardando geração", reserved: "Em geração", review: "Revisar capa", completed: "Concluído", queued: "Na fila", running: "Em execução", blocked: "Bloqueado", confirmed: "Consumo confirmado", unknown: "Consumo incerto" };

function SourceForm({ source, revision = 0 }: { source?: PipelineSource; revision?: number }) {
  return <form action={managePipeline} className={styles.form}>
    <input type="hidden" name="intent" value="source" /><input type="hidden" name="revision" value={revision} />
    <div className={styles.fields}>
      <label>Identificador<input name="id" required pattern="[A-Z0-9_-]{1,40}" maxLength={40} defaultValue={source?.id} readOnly={!!source} placeholder="NASA_ARMSTRONG" /></label>
      <label>Nome<input name="name" required minLength={3} maxLength={100} defaultValue={source?.name} /></label>
      <label>Editoria<select name="editoria" defaultValue={source?.editoria ?? "tecnologia"}>{Object.entries(EDITORIAS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Intervalo de coleta (minutos)<input name="interval_minutes" type="number" min={60} max={1440} required defaultValue={source?.interval_minutes ?? 180} /></label>
      <label>Feed RSS (HTTPS)<input name="url" type="url" required maxLength={500} defaultValue={source?.url} /></label>
      <label>Domínios permitidos, separados por vírgula<input name="article_hosts" required defaultValue={source?.article_hosts.join(", ")} placeholder="www.nasa.gov, nasa.gov" /></label>
      <label>Palavras de interesse, separadas por vírgula<input name="keywords" defaultValue={source?.keywords.join(", ")} placeholder="Em branco: todos os temas da fonte" /></label>
      <label>Referência da autorização de coleta<input name="collection_approval_reference" maxLength={500} defaultValue={source?.collection_approval_reference ?? ""} placeholder="URL ou registro de aprovação" /></label>
      <label className={styles.wide}>Referência de uso editorial do conteúdo<input name="rights_reference" maxLength={500} defaultValue={source?.rights_reference ?? ""} placeholder="Licença, termos ou autorização revisada" /></label>
    </div>
    <label className={styles.check}><input type="checkbox" name="enabled" defaultChecked={source?.enabled} />Ativar captação desta fonte</label>
    <label className={styles.check}><input type="checkbox" name="feed_content_approved" defaultChecked={source?.feed_content_approved} />Conteúdo do feed aprovado como evidência editorial</label>
    <p className={styles.muted}>Ativar a coleta não gera artigos. Imagens da fonte não são copiadas automaticamente.</p>
    <button className={adminStyles.button} type="submit">Salvar fonte</button>
  </form>;
}
function Command({ intent, candidate, children, disabled = false }: { intent: string; candidate?: string; children: React.ReactNode; disabled?: boolean }) {
  return <form action={managePipeline}><input type="hidden" name="intent" value={intent} />{candidate ? <input type="hidden" name="candidate_id" value={candidate} /> : null}<button className={adminStyles.button} type="submit" disabled={disabled}>{children}</button></form>;
}
export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ message?: string; pagina?: string }> }) {
  await requireAdmin("/admin/posts/pipeline");
  const params = await searchParams, requested = Number(params.pagina), page = Number.isInteger(requested) && requested > 0 && requested <= 10000 ? requested : 1;
  const data = await getPipelineDashboard(page);
  const notice = pipelineMessages[params.message ?? ""];
  if (!data) return <div className={adminStyles.content}><AdminPageHeader title="Central Editorial" description="Da captação à revisão, todo o fluxo do blog em um lugar." aside={<Link href="/admin/posts">Voltar aos artigos</Link>} /><AdminNotice title="Preparada para instalação" description="O pipeline ainda não está instalado no banco deste ambiente. Após a instalação e o primeiro contato do worker, fontes, fila e consumo aparecerão aqui." /></div>;
  const { control, benefit, usage, quota, subscription } = data, p = control.snapshot;
  const google = p?.provider === "google_subscription";
  const alive = control.alive;
  const busy = data.commands.some(c => ["queued", "running"].includes(c.state));
  const available = alive && !control.paused && !!p?.generation_enabled && !busy;
  const cycleCap = p && benefit ? Math.min(p.cycle_cap, Number(benefit.amount) * p.cycle_fraction / 10000) : null;
  return <div className={adminStyles.content}>
    <AdminPageHeader title="Central Editorial" description="Capte notícias, prepare artigos e revise cada publicação com o consumo sob controle." aside={<Link className={adminStyles.button} href="/admin/posts">Artigos e edição</Link>} />
    {notice ? <div role="status"><AdminNotice title="Atualização do pipeline" description={notice} /></div> : null}
    <nav className={styles.tabs} aria-label="Etapas editoriais"><a href="#pautas">Pautas</a><a href="#referencias">Referências e pesquisa</a><a href="#fontes">Captação RSS</a><a href="#consumo">Consumo</a><a href="#historico">Histórico</a><Link href="/admin/posts/pipeline">Atualizar</Link></nav>
    <section className={styles.panel} aria-label="Operação do worker">
      <div className={styles.row}><div><span className={styles.badge}>{!alive ? "Worker sem contato recente" : control.paused ? "Geração pausada" : p?.generation_enabled ? p.operator_commands_only ? "Pronto para pedidos" : "Geração automática de rascunhos" : "Geração desativada"}</span><p className={styles.muted}>Último contato: {date(control.heartbeat_at)} · Horário de Brasília</p>{control.reason ? <p>{pipelineReason(control.reason)}</p> : null}</div>
        <div className={styles.actions}><Command intent="collect" disabled={!alive || busy}>Captar notícias</Command><Command intent={control.paused ? "resume" : "pause"}>{control.paused ? "Retomar geração" : "Pausar geração"}</Command></div></div>
      <p>{p?.operator_commands_only === false ? "A pesquisa e a geração de rascunhos são automáticas, dentro dos tetos diários e semanais. A associação exige DOI compartilhado ou referência explícita ao artigo; pautas sem evidências suficientes continuam retidas. " : ""}As fontes são consultadas nos intervalos cadastrados. Cada pedido verifica o acesso e os limites antes de gerar texto e capa. A captação e o monitoramento das fontes não consomem IA. Publicar exige revisão no editor.</p>
    </section>
    <div className={styles.metrics}>
      <MetricCard label="Pautas prontas" value={String(data.counts.find(c => c.status === "ready")?.count ?? 0)} detail="Selecionadas a partir das fontes aprovadas" />
      <MetricCard label="Artigos criados" value={String(data.counts.find(c => c.status === "draft")?.count ?? 0)} detail="Rascunhos e publicações no CMS" />
      <MetricCard label={google ? "Chamadas Google hoje" : "Consumo hoje"} value={google ? `${quota.day_calls} / ${p?.daily_calls_cap}` : money(usage.day)} detail={google ? "Assinatura, sem créditos extras" : p ? `Teto diário ${money(p.daily_cap)}` : "Aguardando configuração"} />
      <MetricCard label={google ? "Uso local hoje" : "Reservas pendentes"} value={google ? Number(quota.day_tokens).toLocaleString("pt-BR") : money(usage.held)} detail={google ? "Tokens contabilizados e reservados" : "Valor retido até confirmar a cobrança"} />
    </div>
    <section id="pautas" className={styles.section}><div className={styles.row}><div><h2>Pautas e produção</h2><p className={styles.muted}>{data.total} pauta(s) · fontes originais preservadas para conferência</p></div><Link href="/admin/posts/novo">Criar artigo manualmente →</Link></div>
      {data.candidates.length ? data.candidates.map(c => <article key={c.id} className={styles.panel}>
        <div className={styles.row}><div><span className={styles.badge}>{EDITORIAS[c.editoria as keyof typeof EDITORIAS] ?? c.editoria} · {states[c.post_status ?? c.status]}</span><h3>{c.post_title ?? c.title}</h3><p className={styles.muted}>{c.source_id} · {date(c.published_at)}</p></div><a href={c.url} target="_blank" rel="noopener noreferrer">Conferir fonte ↗</a></div>
        {c.reason ? <p>{pipelineReason(c.reason)}</p> : null}
        <div className={styles.actions}>
          {c.status === "ready" ? <><Command intent="generate" candidate={c.id} disabled={!available}>Criar texto e capa</Command><Command intent="hold" candidate={c.id}>Reter pauta</Command></> : null}
          {c.reason === "operator_hold" ? <Command intent="release" candidate={c.id}>Devolver à fila</Command> : null}
          {c.post_id ? <Link className={adminStyles.button} href={`/admin/posts/${c.post_id}`}>Editar e revisar artigo →</Link> : null}
          {c.image_state === "pending" ? <Command intent="generate" candidate={c.id} disabled={!available}>Gerar capa pendente</Command> : null}
        </div>
        {c.image_state ? <div className={styles.cover}>
          {c.media_id || c.image_state === "review" ? <Image unoptimized src={c.media_id ? `/blog/media/${c.media_id}.webp` : `/admin/posts/pipeline/cover/${c.id}`} alt={c.alt ?? "Capa aguardando revisão"} width={384} height={256} /> : null}
          <div><h4>Capa · {states[c.image_state]}</h4><p>{c.caption}</p>{c.image_reason ? <p>{pipelineReason(c.image_reason)}</p> : null}
            {c.image_state === "review" && c.post_status === "draft" ? <form action={managePipeline}><input type="hidden" name="intent" value="apply_cover" /><input type="hidden" name="candidate_id" value={c.id} /><input type="hidden" name="revision" value={c.post_revision ?? ""} /><button className={adminStyles.button}>Aprovar esta capa para o rascunho</button></form> : null}
          </div>
        </div> : null}
        {c.image_state === "pending" ? <details className={styles.details}><summary>Editar descrição da capa antes da geração</summary><form action={managePipeline} className={styles.form}><input type="hidden" name="intent" value="cover" /><input type="hidden" name="candidate_id" value={c.id} /><label>Descrição visual<textarea name="prompt" required minLength={20} maxLength={2500} rows={4} defaultValue={c.prompt ?? ""} /></label><label>Texto alternativo<input name="alt" required minLength={3} maxLength={160} defaultValue={c.alt ?? ""} /></label><label>Legenda<input name="caption" required minLength={10} maxLength={300} defaultValue={c.caption ?? ""} /></label><button className={adminStyles.button}>Salvar descrição da capa</button></form></details> : null}
        {c.post_id ? <details className={styles.details}><summary>Revisão de SEO e GEO</summary><ul>{editorialChecks({ title:c.post_title ?? c.title, body:c.body ?? "", seoTitle:c.seo_title, seoDescription:c.seo_description, hasCover:!!c.media_id, noIndex:!!c.seo_noindex }).map(check => <li key={check.label}>{check.ok ? "✓" : "Pendente:"} {check.label}</li>)}</ul><p className={styles.muted}>Conferir clareza da abertura, precisão dos fatos, contexto, limitações e contribuição original. Essas verificações não garantem ranqueamento nem citação por IA. Para indexar, revise a opção de busca no editor.</p></details> : null}
        <p><Link href={`/admin/posts/pipeline/dossie/${c.id}`}>Pesquisar fontes, comparar fatos e revisar dossiê →</Link></p><details className={styles.details}><summary>Evidências captadas originalmente ({c.evidence.length})</summary>{c.evidence.map(e => <div className={styles.evidence} key={e.id}><h4>{e.id} · {e.title}</h4><p>{e.text}</p><a href={e.url} target="_blank" rel="noopener noreferrer">Abrir documento original ↗</a><p className={styles.muted}>Referência editorial: {e.rights_reference}</p></div>)}{!c.evidence.length ? <p>A fonte foi descoberta, mas ainda não há conteúdo aprovado suficiente para redigir.</p> : null}</details>
      </article>) : <p className={styles.empty}>Nenhuma notícia captada. Cadastre uma fonte aprovada e solicite a captação.</p>}
      {data.total > 20 ? <nav className={styles.row} aria-label="Páginas de pautas">{page > 1 ? <Link href={`?pagina=${page - 1}#pautas`}>← Anterior</Link> : <span />}<span>Página {page}</span>{page * 20 < data.total ? <Link href={`?pagina=${page + 1}#pautas`}>Próxima →</Link> : null}</nav> : null}
    </section>
    <section id="referencias" className={styles.section}><h2>Referências por área e pesquisa multifonte</h2><p>44 referências fornecidas e {referenceCatalog.length - 44} fontes primárias complementares. Dez publicações podem compartilhar uma única origem; a comparação verifica fatos, dependências e divergências. Coleta automática continua limitada aos canais homologados abaixo.</p>
      <details className={styles.source}><summary>Iniciar pesquisa de uma matéria real</summary><form action={manageDossier} className={styles.form}><input type="hidden" name="intent" value="new_research" />
        <label>Título da pauta<input name="title" required minLength={8} maxLength={220} /></label>
        <label>Área<select name="topic">{Object.entries(taxonomy).flatMap(([id, t]) => [<option key={id} value={id}>{t.label}</option>, ...Object.entries(t.subcategories).map(([sub, label]) => <option key={sub} value={`${id}:${sub}`}>{t.label} / {label}</option>)])}</select></label>
        <label>Referência inicial<select name="reference_id">{referenceCatalog.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label><label>Link da notícia ou documento<input name="url" type="url" required maxLength={2048} /></label><label>Data da publicação<input name="published_at" type="date" required /></label><button className={adminStyles.button}>Abrir dossiê de pesquisa</button><p>Esta ação não chama IA. Adicione evidências autorizadas, compare e confira os fatos antes da redação.</p></form></details>
      <details className={styles.source}><summary>Consultar referências e fontes primárias</summary><div className={styles.tableWrap}><table><caption>Referências editoriais; cadastro não significa coleta automática ativa</caption><thead><tr><th>Referência</th><th>Áreas</th><th>Captura</th></tr></thead><tbody>{referenceCatalog.map(r => <tr key={r.id}><td><a href={r.url} target="_blank" rel="noopener noreferrer">{r.name} ↗</a></td><td>{r.categories.map(c => taxonomy[c]?.label ?? c).join(", ")}</td><td>Curadoria assistida · canal automático a homologar</td></tr>)}</tbody></table></div></details>
    </section>
    <section id="fontes" className={styles.section}><h2>Fontes e captação</h2><p>Cadastre feeds RSS, interesses e autorizações. As cinco editorias participam da seleção de pautas.</p>
      {data.sources.map(s => <details className={styles.source} key={s.id}><summary><strong>{s.definition.name || s.id}</strong><span>{s.definition.enabled ? "Captação ativa" : "Desativada"} · {EDITORIAS[s.definition.editoria]}</span></summary><p className={styles.muted}>Última coleta: {date(s.last_collected_at)} · {s.last_result === "ok" ? "Concluída" : s.last_result === "not_modified" ? "Sem novidades" : s.last_result ? "Falha de coleta; nova tentativa após o intervalo" : "Aguardando"}</p><SourceForm source={s.definition} revision={s.revision} /></details>)}
      <details className={styles.source}><summary><strong>Adicionar fonte RSS</strong></summary><SourceForm /></details>
    </section>
    {google ? <section id="consumo" className={styles.panel}><h2>Assinatura Google e limites</h2>
      <dl className={styles.limits}><div><dt>Provedor</dt><dd>Google AI Pro · Antigravity oficial</dd></div><div><dt>Custo adicional permitido</dt><dd>Zero · créditos extras e APIs pagas desativados</dd></div><div><dt>Conta</dt><dd>{p?.account_email ?? "Não configurada"}</dd></div><div><dt>Acesso conferido</dt><dd>{subscription ? `${subscription.valid ? "Válido" : "Revalidar"} até ${date(subscription.valid_until)}` : "Aguardando conferência do login e da assinatura"}</dd></div><div><dt>Modelo textual</dt><dd>{p?.model}</dd></div><div><dt>Capas</dt><dd>Ferramenta de imagens do Antigravity · uma por artigo</dd></div><div><dt>Chamadas nesta semana</dt><dd>{quota.week_calls} / {p?.weekly_calls_cap}</dd></div><div><dt>Tokens contabilizados e reservados nesta semana</dt><dd>{Number(quota.week_tokens).toLocaleString("pt-BR")} / {p?.weekly_tokens_cap?.toLocaleString("pt-BR")}</dd></div><div><dt>Reservas de execução incerta</dt><dd>{Number(quota.held).toLocaleString("pt-BR")} tokens</dd></div><div><dt>Novos artigos</dt><dd>{p?.per_day}/dia · {p?.per_week}/semana</dd></div></dl>
      <p>Novas gerações ficam bloqueadas quando alguma cota Google tem menos de 20% disponível. Não há compra de créditos nem troca automática para uma API paga.</p><p className={styles.muted}>Os contadores são limites locais conservadores, não o saldo exato da assinatura. O Google também aplica cotas compartilhadas com outros usos da conta. Texto, SEO e GEO são preparados juntos; captação e deduplicação não usam IA.</p>
      <details><summary>Consumo por área e observações da cota Google</summary><p>A meta de uma matéria por dia em cada categoria e subcategoria corresponde a dez por dia. Essa é uma meta sujeita à cota observada, não capacidade garantida. Há limite de uma por área ao dia, além dos tetos globais de chamadas e tokens exibidos acima.</p>
        {data.topicUsage?.length ? <div className={styles.tableWrap}><table><caption>Chamadas de hoje por enquadramento do dossiê</caption><thead><tr><th>Área</th><th>Chamadas</th><th>Tokens usados ou reservados</th></tr></thead><tbody>{data.topicUsage.map((t, i) => <tr key={i}><td>{t.category ? `${taxonomy[t.category]?.label ?? t.category}${t.subcategory ? " / " + (taxonomy[t.category]?.subcategories[t.subcategory] ?? t.subcategory) : ""}` : "Histórico sem classificação"}</td><td>{t.calls}</td><td>{Number(t.tokens).toLocaleString("pt-BR")}</td></tr>)}</tbody></table></div> : <p>Ainda não há chamadas classificadas neste período.</p>}
        {data.quotaObservations?.length ? <ul>{data.quotaObservations.map((q, i) => <li key={i}>{date(q.created_at)} · {q.stage === "before" ? "Antes" : "Após"} a execução: menor fração disponível entre as cotas Gemini verificadas, {(q.minimum_fraction * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.</li>)}</ul> : <p>Ainda não há observações recentes da cota. A assinatura não garante uma quantidade fixa de matérias.</p>}
        <p className={styles.muted}>Frações observadas podem ter atualização defasada e representam uso compartilhado. Elas não são saldo de tokens nem previsão garantida de produção.</p>
      </details>
      <details><summary>Histórico anterior de API</summary><p>Consumo confirmado preservado: {money(usage.charged)}. Novas chamadas de API estão desativadas.</p></details>
    </section> : <>    <section id="consumo" className={styles.panel}><h2>Créditos e limites</h2>
      <dl className={styles.limits}><div><dt>Por artigo, texto + capa + correção</dt><dd>{p ? money(p.article_cap) : "Não configurado"}</dd></div><div><dt>Novos artigos</dt><dd>{p ? `${p.per_day}/dia · ${p.per_week}/semana` : "Não configurado"}</dd></div><div><dt>Consumo neste ciclo</dt><dd>{money(usage.cycle)} / {cycleCap === null ? "aguardando créditos" : money(cycleCap)}</dd></div><div><dt>Consumo confirmado, todo o histórico</dt><dd>{money(usage.charged)}</dd></div><div><dt>Modelos configurados</dt><dd>{p?.model ?? "Não configurado"} · {p?.image_model ?? "sem imagem"}</dd></div><div><dt>Crédito gratuito na última conferência</dt><dd>{benefit ? money(benefit.remaining) : "Não verificado"}</dd></div><div><dt>Crédito verificado em</dt><dd>{date(benefit?.verified_at ?? null)}</dd></div><div><dt>Validade do benefício</dt><dd>{date(benefit?.expires_at ?? null)}</dd></div></dl>
      <p className={styles.muted}>Os limites são reservas preventivas. A cobrança efetiva é registrada com o consumo retornado pela API. Uma resposta incerta pausa novas gerações; não há repetição automática de imagem.</p>
      {benefit?.shared ? <p>Organização Vinicius: o saldo é compartilhado com outros projetos. Exigimos conferência dos créditos a cada 15 minutos e preservamos US$ 1 de margem. Gastos externos ao blog podem reduzir esse saldo; o painel não representa o saldo ao vivo.</p> : null}
      <p className={styles.muted}>Alterações de modelo, preço, teto e credencial exigem configuração do worker. Pausar aqui não cancela uma chamada que já foi enviada.</p>
    </section>
</>}
    <section id="historico" className={styles.section}><h2>Fila e histórico de consumo</h2><div className={styles.tableWrap}><table><caption>Últimos pedidos do painel</caption><thead><tr><th>Pedido</th><th>Data</th><th>Estado</th><th>Resultado</th></tr></thead><tbody>{data.commands.map(c => <tr key={c.id}><td>{c.kind === "collect" ? "Captar notícias" : c.kind === "compare" ? "Comparar fontes" : "Criar matéria"}</td><td>{date(c.created_at)}</td><td>{states[c.state]}</td><td>{pipelineReason(c.result?.image?.reason ?? c.result?.generation?.reason)}</td></tr>)}</tbody></table>{!data.commands.length ? <p>Nenhum pedido registrado.</p> : null}</div>
      <div className={styles.tableWrap}><table><caption>Últimas chamadas de IA</caption><thead><tr><th>Etapa</th><th>Modelo</th><th>Data</th><th>Estado</th><th>Uso / reserva</th><th>Observação</th></tr></thead><tbody>{data.attempts.map(a => <tr key={a.id}><td>{a.kind === "image" ? "Capa" : a.kind === "comparison" ? "Comparação de fontes" : "Texto"}</td><td>{a.model}</td><td>{date(a.created_at)}</td><td>{states[a.state]}</td><td>{a.provider === "google_subscription" ? `${a.quota_used ?? "Pendente"} / ${a.quota_reserved} tokens · assinatura` : `${a.charged === null ? "Pendente" : money(a.charged)} / ${money(a.reserved)} · API anterior`}</td><td>{pipelineReason(a.reason)}</td></tr>)}</tbody></table>{!data.attempts.length ? <p>Nenhuma chamada de IA registrada.</p> : null}</div>
    </section>
  </div>;
}
