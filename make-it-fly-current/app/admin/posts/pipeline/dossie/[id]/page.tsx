import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/access";
import { getDossierView } from "@/lib/blog/dossier";
import { assessDossier, referenceCatalog, taxonomy, type Claim, type Document } from "@/lib/blog/corroboration.mjs";
import { candidateKey, pipelineMessages, pipelineReason } from "@/lib/blog/pipeline-validation";
import { AdminNotice, AdminPageHeader, adminStyles } from "@/components/admin/admin-ui";
import { manageDossier } from "../actions";
import { managePipeline } from "../../actions";
import styles from "../../pipeline.module.css";

export const dynamic = "force-dynamic";
function Fields({ id, revision, intent }: { id: string; revision: number; intent: string }) {
  return <><input type="hidden" name="candidate_id" value={id} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="intent" value={intent} /></>;
}
function Topic({ value }: { value: string }) {
  return <label>Área da pauta<select name="topic" defaultValue={value}>{Object.entries(taxonomy).flatMap(([id, t]) => [<option key={id} value={id}>{t.label}</option>, ...Object.entries(t.subcategories).map(([sub, label]) => <option key={sub} value={`${id}:${sub}`}>{t.label} / {label}</option>)])}</select></label>;
}
function DocumentForm({ id, revision, next, document: d }: { id: string; revision: number; next: number; document?: Document }) {
  return <form action={manageDossier} className={styles.form}>
    <Fields id={id} revision={revision} intent="document" /><input type="hidden" name="document_id" value={d?.id ?? `E${next}`} />
    <div className={styles.fields}>
      <label>Referência<select name="reference_id" defaultValue={d?.reference_id}>{referenceCatalog.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
      <label>Título do documento<input name="title" required minLength={3} maxLength={220} defaultValue={d?.title} /></label>
      <label>Link do documento original<input name="url" type="url" required maxLength={2048} defaultValue={d?.url} /></label>
      <label>Data da publicação, quando informada<input name="published_at" type="date" defaultValue={d?.published_at?.slice(0, 10)} /></label>
      <label>Papel desta publicação<select name="kind" defaultValue={d?.kind ?? "context"}><option value="primary">Documento primário</option><option value="independent">Apuração ou análise independente</option><option value="derivative">Reprodução ou resumo de outra fonte</option><option value="context">Contexto</option></select></label>
      <label>Origem dos dados ou análise<input name="origin_url" type="url" required defaultValue={d?.origin_url} /><span className={styles.muted}>Use o link do paper, release ou da análise própria; preserve a mesma origem nas reproduções.</span></label>
      <label className={styles.wide}>O que torna esta análise independente?<textarea name="independence_note" maxLength={1000} defaultValue={d?.independence_note} /><span className={styles.muted}>Obrigatório para análise independente. Um novo domínio que repete um release não basta.</span></label>
      <label className={styles.wide}>Condição de uso editorial conferida<input name="rights_reference" required minLength={8} maxLength={500} defaultValue={d?.rights_reference} /></label>
      <label className={styles.wide}>Texto ou trecho autorizado para conferência<textarea name="text" required minLength={80} maxLength={12000} rows={8} defaultValue={d?.text} /></label>
    </div>
    <label className={styles.check}><input name="same_event" type="checkbox" defaultChecked={d?.same_event} />Conferi que este documento trata do mesmo acontecimento e escopo.</label>
    <label>Motivo da inclusão ou alteração<input name="reason" required minLength={8} maxLength={1000} /></label>
    <p className={styles.muted}>Salvar evidência inicia nova versão e exige refazer a comparação. Texto original e decisões anteriores ficam no histórico. Não ultrapasse paywalls nem copie conteúdo sem condição de uso compatível.</p>
    <button className={adminStyles.button}>Salvar evidência</button>
  </form>;
}
function ClaimForm({ id, revision, documents, next, claim: c }: { id: string; revision: number; documents: Document[]; next: number; claim?: Claim }) {
  return <form action={manageDossier} className={styles.form}><Fields id={id} revision={revision} intent="claim" /><input type="hidden" name="claim_id" value={c?.id ?? `C${next}`} />
    <label>Afirmação factual<textarea name="claim_text" required minLength={8} maxLength={500} defaultValue={c?.text} /></label>
    <label className={styles.check}><input type="checkbox" name="critical" defaultChecked={c?.critical} />Fato crítico para a manchete, conclusão, identidade ou estágio da notícia.</label>
    {documents.map(d => { const cell = c?.cells.find(v => v.document_id === d.id); return <fieldset className={styles.evidence} key={d.id}><legend>{d.id} · {d.title}</legend>
      <label>Relação com este fato<select name={`status_${d.id}`} defaultValue={cell?.status ?? "unverifiable"}><option value="supports">Sustenta</option><option value="contradicts">Contradiz</option><option value="not_mentioned">Não menciona</option><option value="unverifiable">Não verificável</option></select></label>
      <label>Trecho literal da evidência<textarea name={`quote_${d.id}`} maxLength={700} defaultValue={cell?.quote} /><span className={styles.muted}>Para sustenta/contradiz, cole um trecho exato do documento. Nos demais estados, deixe vazio.</span></label>
      <label>Contexto ou ressalva<input name={`note_${d.id}`} maxLength={500} defaultValue={cell?.note} /></label>
    </fieldset>; })}
    <label>Motivo da inclusão ou alteração<input name="reason" required minLength={8} maxLength={1000} /></label><button className={adminStyles.button}>Salvar fato e comparação</button>
  </form>;
}
export default async function DossierPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ message?: string }> }) {
  await requireAdmin("/admin/posts/pipeline");
  const { id } = await params;
  if (!candidateKey.safeParse(id).success) notFound();
  const view = await getDossierView(id), query = await searchParams;
  if (!view) return <div className={adminStyles.content}><AdminNotice title="Dossiê indisponível" description="Confira a instalação da etapa multifonte e a pauta selecionada." /><Link href="/admin/posts/pipeline">Voltar à Central Editorial</Link></div>;
  const v = view.latest, d = v?.document, a = d ? assessDossier(d, { comparisonVerified: !!v?.assessment?.comparison_verified && v.source_hash === view.candidate.evidence_hash }) : null;
  return <div className={adminStyles.content}><AdminPageHeader title="Pesquisa e comparação de fontes" description={view.candidate.title} aside={<Link href="/admin/posts/pipeline">Voltar à Central Editorial</Link>} />
    {query.message && pipelineMessages[query.message] ? <div role="status"><AdminNotice title="Dossiê atualizado" description={pipelineMessages[query.message]} /></div> : null}
    {!v || !d || !a ? <form action={manageDossier}><Fields id={id} revision={0} intent="initialize" /><button className={adminStyles.button}>Iniciar dossiê multifonte</button></form> : <>
      <section className={styles.panel}>{view.candidate.reason ? <p>{pipelineReason(view.candidate.reason)}</p> : null}<h2>Convergência factual</h2><p><strong>{a.percentage === null ? "Comparação pendente" : `${a.percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% · ${a.convergent}/${a.total} fatos convergentes`}</strong></p>
        <p>{a.documents}/10 documentos · {a.publishers} veículos · {a.origins} origens declaradas · {a.independent_analyses} análises independentes pertinentes</p>
        <p>O limiar é de 90%, com todos os fatos críticos confirmados. Cada fato convergente exige suporte de pelo menos duas origens e veículos diferentes. A nota não representa probabilidade de verdade. Dez reproduções de um release continuam uma origem.</p>
        <ul>{a.blockers.map(b => <li key={b}>{pipelineReason(b)}</li>)}</ul>
        <div className={styles.actions}><form action={manageDossier}><Fields id={id} revision={v.revision} intent="compare" /><button className={adminStyles.button} disabled={!view.available || view.busy || !!view.candidate.post_id || d.documents.length < 2}>Comparar com Google</button></form>
          <form action={managePipeline}><input type="hidden" name="intent" value="generate" /><input type="hidden" name="candidate_id" value={id} /><button className={adminStyles.button} disabled={!view.available || !a.eligible || !!view.candidate.post_id || view.busy}>Criar rascunho a partir dos fatos convergentes</button></form></div>
        <p className={styles.muted}>Comparação e redação usam a mesma assinatura, fila e limites de consumo. A comparação Google passa pelas regras de fatos, fontes e citações antes da redação. O editor pode conferir e corrigir a matriz; publicar exige revisão humana do artigo completo.</p>
      </section>
      <details className={styles.source}><summary>Enquadramento e identificação do acontecimento</summary><form action={manageDossier} className={styles.form}><Fields id={id} revision={v.revision} intent="scope" /><Topic value={`${d.category}${d.subcategory ? ":" + d.subcategory : ""}`} /><label>Acontecimento ou documento de origem<input name="event_key" required minLength={8} maxLength={180} defaultValue={d.event_key} /></label><label>Motivo da alteração<input name="reason" required minLength={8} maxLength={1000} /></label><button className={adminStyles.button}>Salvar enquadramento</button></form></details>
      <section className={styles.section}><h2>Evidências</h2>{d.documents.map(doc => <details className={styles.source} key={doc.id}><summary>{doc.id} · {doc.title}</summary><p><a href={doc.url} target="_blank" rel="noopener noreferrer">Abrir documento original ↗</a></p><DocumentForm id={id} revision={v.revision} next={0} document={doc} /></details>)}
        {view.captured.length ? <details className={styles.source}><summary>Documentos captados e relacionados para conferir ({view.captured.length})</summary><p>Agrupamento ajuda a pesquisa; confirme acontecimento, origem e papel editorial após adicionar.</p>{view.captured.map(c => <details className={styles.evidence} key={c.id}><summary>{c.document.title}</summary><p>{c.document.text}</p><a href={c.document.url} target="_blank" rel="noopener noreferrer">Abrir origem ↗</a><form action={manageDossier}><Fields id={id} revision={v.revision} intent="import_captured" /><input type="hidden" name="captured_id" value={c.id} /><button className={adminStyles.button} disabled={d.documents.length >= 10}>Adicionar ao dossiê para conferir</button></form></details>)}</details> : null}
        {d.documents.length < 10 ? <details className={styles.source}><summary>Adicionar evidência de uma referência cadastrada</summary><DocumentForm id={id} revision={v.revision} next={Math.max(0, ...d.documents.map(doc => Number(doc.id.slice(1)))) + 1} /></details> : <p>Limite de dez documentos nesta versão do contrato.</p>}
      </section>
      <section className={styles.section}><h2>Matriz de fatos e fontes</h2>{a.claims.map(claim => <details className={styles.source} key={claim.id}><summary>{claim.id} · {claim.critical ? "Crítico · " : ""}{claim.text} · {claim.status === "convergent" ? "Convergente" : claim.status === "divergent" ? "Divergente" : "Pendente"}</summary>
        <div className={styles.tableWrap}><table><caption>Comparação de {claim.id}</caption><thead><tr><th>Documento</th><th>Relação</th><th>Trecho literal</th><th>Contexto</th></tr></thead><tbody>{claim.cells.map(cell => <tr key={cell.document_id}><td>{cell.document_id}</td><td>{({ supports: "Sustenta", contradicts: "Contradiz", not_mentioned: "Não menciona", unverifiable: "Não verificável" })[cell.status]}</td><td>{cell.quote || "Sem trecho"}</td><td>{cell.note || "Sem ressalva"}</td></tr>)}</tbody></table></div>
        <ClaimForm id={id} revision={v.revision} documents={d.documents} next={0} claim={claim} /></details>)}
        {d.documents.length && d.claims.length < 16 ? <details className={styles.source}><summary>Adicionar fato à comparação</summary><ClaimForm id={id} revision={v.revision} documents={d.documents} next={Math.max(0, ...d.claims.map(c => Number(c.id.slice(1)))) + 1} /></details> : null}
        <form action={manageDossier} className={styles.form}><Fields id={id} revision={v.revision} intent="review" /><label className={styles.check}><input name="confirmed" type="checkbox" required />Conferi documentos, origens, independência, fatos críticos, citações e limitações desta versão.</label><button className={adminStyles.button} disabled={!assessDossier(d, { comparisonVerified: true }).eligible}>Registrar conferência editorial da matriz</button></form>
      </section>
      {view.post ? <section className={styles.panel}><h2>Revisão final do artigo</h2><Link href={`/admin/posts/${view.post.id}`}>Abrir texto, referências e capa no editor</Link><p>Confira todas as afirmações e a mídia. Salve as alterações no editor antes de registrar a revisão final. Texto ou capa alterados depois exigem nova conferência.</p><form action={manageDossier} className={styles.form}><Fields id={id} revision={view.post.revision} intent="review_article" /><label className={styles.check}><input name="confirmed" type="checkbox" required />Revisei o artigo completo, sua atribuição, fontes e direitos da imagem.</label><button className={adminStyles.button} disabled={!a.eligible}>Registrar revisão final desta versão</button></form><p>Esta ação mantém o rascunho. Publicar ou agendar continua sendo uma decisão no editor.</p></section> : null}
      <section className={styles.section}><h2>Histórico preservado</h2><ol>{view.versions.map(version => <li key={version.revision}>Versão {version.revision} · {version.change_reason} · {version.reviewed_by ? "Conferida pelo editor" : version.assessment.comparison_verified ? version.actor_id === "google_assisted" ? "Comparação Google verificada" : "Comparação registrada no painel" : "Aguardando comparação"}</li>)}</ol></section>
    </>}
  </div>;
}
