import { AdminNotice, AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";
import { listAdminOpportunityCatalogue } from "@/lib/opportunities/access";
import { BRAZILIAN_STATE_CODES } from "@/lib/opportunities/location";
import { listRadarEditorialSources, listRadarReviewOpportunities, type RadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";
import { isOpportunityOpen } from "@/lib/opportunities/types";
import { decideRadarOpportunity, importRadarCsv, ingestRadarSource, setRadarSourceActive, verifyRadarSource } from "./actions";

export const dynamic = "force-dynamic";

const automaticModes = new Set(["rss", "html", "pdf", "api", "sitemap"]);

function location(source: RadarEditorialSource) {
  return source.cityName ? `${source.cityName} · ${source.stateCode}` :
    source.stateCode ?? (source.geographicScope.includes("Brasil") ? "Brasil" : "Localização não informada");
}

function statusLabel(result: string | undefined) {
  if (result === "verificada") return "Fonte marcada como verificada. A ativação continua sendo uma ação separada.";
  if (result === "ativada") return "Fonte ativada. A coleta continua limitada e exige uma ação explícita.";
  if (result === "desativada") return "Fonte desativada. Nenhuma nova coleta será iniciada por ela.";
  if (result === "coleta-iniciada") return "Coleta controlada concluída. Candidatos, se houver, seguem para revisão humana antes de publicar.";
  if (result === "publicada") return "Oportunidade aprovada no Radar. Ela aparece no catálogo de membros quando a integração pública está disponível.";
  if (result === "rejeitada") return "Oportunidade rejeitada e retirada da fila de revisão.";
  if (result === "erro-revisao") return "A decisão não foi aplicada. Confira a fonte, as evidências, a elegibilidade e o prazo vigente antes de tentar novamente.";
  if (result === "importada") return "Oportunidades oficiais recebidas para revisão. Nenhuma foi publicada automaticamente.";
  if (result === "erro-importacao") return "Importação não concluída. Confira as colunas, URLs oficiais, prazo, abrangência e se as fontes estão verificadas e ativas.";
  if (result === "confirmacao") return "Confirme os três itens de auditoria antes de verificar a fonte.";
  if (result === "erro") return "A operação não foi concluída. Confirme o estado atual da fonte e tente novamente.";
  return null;
}

function SourceCard({ source }: { source: RadarEditorialSource }) {
  const pending = source.verificationStatus === "pending" && !source.active;
  const collectable = source.active && source.verificationStatus === "verified" && automaticModes.has(source.extractionMode);
  return (
    <li className={styles.radarSourceCard}>
      <div className={styles.radarSourceHeader}>
        <div>
          <p className={styles.sectionEyebrow}>{source.institutionAcronym || "Fonte oficial"}</p>
          <h2>{source.name}</h2>
          <p>{source.institutionName} · {location(source)}</p>
        </div>
        <div className={styles.catalogueMeta} aria-label="Estado da fonte">
          <span>{source.verificationStatus === "verified" ? "Verificada" : source.verificationStatus === "rejected" ? "Rejeitada" : "Pendente"}</span>
          <span>{source.active ? "Ativa" : "Inativa"}</span>
          <span>{source.extractionMode}</span>
        </div>
      </div>

      <dl className={styles.radarSourceDetails}>
        <div><dt>Domínios</dt><dd>{source.allowedDomains.join(", ")}</dd></div>
        <div><dt>Páginas de listagem</dt><dd>{source.listingUrls.length}</dd></div>
      </dl>
      {source.auditEvidenceUrl ? <a className={styles.textLink} href={source.auditEvidenceUrl} target="_blank" rel="noopener noreferrer">Abrir evidência oficial</a> : null}

      {pending ? (
        <form action={verifyRadarSource} className={styles.radarAuditForm}>
          <input type="hidden" name="source_id" value={source.id} />
          <p>Confirme a auditoria antes de ativar esta fonte.</p>
          <label><input name="official_source" type="checkbox" value="confirmed" required /> O domínio e a evidência pertencem à instituição indicada.</label>
          <label><input name="location_confirmed" type="checkbox" value="confirmed" required /> A UF, cidade ou abrangência nacional foi confirmada na fonte oficial.</label>
          <label><input name="collection_allowed" type="checkbox" value="confirmed" required /> Robots e condições de consulta permitem a coleta controlada.</label>
          <button className={styles.button}>Marcar como verificada</button>
        </form>
      ) : null}

      {source.verificationStatus === "verified" ? (
        <form action={setRadarSourceActive} className={styles.radarAction}>
          <input type="hidden" name="source_id" value={source.id} />
          <input type="hidden" name="active" value={String(!source.active)} />
          <button className={source.active ? styles.secondaryButton : styles.button}>{source.active ? "Desativar fonte" : "Ativar fonte"}</button>
        </form>
      ) : null}

      {collectable ? (
        <form action={ingestRadarSource} className={styles.radarIngestionForm}>
          <input type="hidden" name="source_id" value={source.id} />
          <label className={styles.field}><span>Páginas</span><input name="max_pages" type="number" min="1" max="10" defaultValue="1" required /></label>
          <label className={styles.field}><span>Candidatos</span><input name="max_candidates" type="number" min="1" max="10" defaultValue="10" required /></label>
          <button className={styles.button}>Coletar para revisão</button>
        </form>
      ) : source.active && source.verificationStatus === "verified" ? <p className={styles.radarHint}>Esta fonte usa revisão manual assistida; a coleta automática não está habilitada.</p> : null}
    </li>
  );
}

export default async function AdminRadarPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  await requireAdmin("/admin/radar");
  const [params, radar, review, catalogue] = await Promise.all([
    searchParams, listRadarEditorialSources(), listRadarReviewOpportunities(), listAdminOpportunityCatalogue(),
  ]);
  const message = statusLabel(params.resultado);
  const pending = radar.sources.filter((source) => source.verificationStatus === "pending").length;
  const open = catalogue.filter((item) => isOpportunityOpen(item));
  const nationalCount = open.filter((item) => item.nationallyEligible === true).length;
  const courseCount = open.filter((item) => item.kind === "Curso").length;

  return (
    <div className={styles.content}>
      <AdminPageHeader
        title="Radar editorial"
        description="Audite a evidência oficial, confirme a localização estruturada e controle cada coleta. Nenhum candidato é publicado automaticamente."
        aside={<span className={styles.dataBadge}>{review.available ? `${review.opportunities.length} para revisar` : "Fila indisponível"}</span>}
      />

      {message ? <AdminNotice tone={params.resultado === "erro" || params.resultado === "erro-revisao" || params.resultado === "erro-importacao" || params.resultado === "confirmacao" ? "attention" : "success"} title="Auditoria editorial" description={message} /> : null}
      <section className={styles.surface} aria-labelledby="radar-coverage-title">
        <h2 id="radar-coverage-title">Cobertura visível na Apogee por UF</h2>
        <p>{nationalCount} {nationalCount === 1 ? "oportunidade nacional elegível" : "oportunidades nacionais elegíveis"} em todas as UFs · {courseCount} {courseCount === 1 ? "curso publicado" : "cursos publicados"}. As contagens locais dependem de localização confirmada.</p>
        <ul className={styles.radarCoverageGrid}>
          {BRAZILIAN_STATE_CODES.map((stateCode) => {
            const localCount = open.filter((item) => item.stateCode === stateCode).length;
            return <li key={stateCode}><strong>{stateCode}</strong><span>{localCount} locais · {nationalCount} nacionais</span></li>;
          })}
        </ul>
      </section>
      <section aria-labelledby="radar-review-title">
        <div className={styles.surfaceHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Publicação</p>
            <h2 id="radar-review-title">Aprovação de oportunidades</h2>
            <p>Confira a fonte oficial e as evidências de cada candidato antes de publicar.</p>
          </div>
        </div>
        {!review.available ? <AdminNotice tone="attention" title="Fila indisponível" description="Não foi possível consultar a fila do Radar. Nenhuma decisão editorial foi aplicada." /> : null}
        {review.available && review.opportunities.length === 0 ? <p className={styles.radarHint}>Nenhuma oportunidade aguarda aprovação.</p> : null}
        {review.available && review.opportunities.length > 0 ? (
          <ul className={styles.radarSourceList}>
            {review.opportunities.map((item) => (
              <li className={styles.radarSourceCard} key={item.id}>
                <div className={styles.radarSourceHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>{item.isCourse ? "Curso" : "Oportunidade"} · {item.institution}</p>
                    <h3>{item.title}</h3>
                    <p>{item.nationallyEligible ? "Brasil · elegibilidade nacional" : item.cityName ? `${item.cityName} · ${item.stateCode}` : item.stateCode ?? "Abrangência não informada"}</p>
                  </div>
                  <span className={styles.dataBadge}>Pendente</span>
                </div>
                <dl className={styles.radarSourceDetails}>
                  <div><dt>Público</dt><dd>{item.applicantType}</dd></div>
                  <div><dt>Candidatura</dt><dd>{item.applicationRoute}</dd></div>
                  <div><dt>Prazo</dt><dd>{item.deadlineAt ?? item.deadlinePrecision}</dd></div>
                </dl>
                {item.officialUrl ? <a className={styles.textLink} href={item.officialUrl} target="_blank" rel="noopener noreferrer">Abrir fonte oficial</a> : <p className={styles.radarHint}>Fonte ativa não informada. A aprovação será recusada.</p>}
                <div className={styles.radarEvidence}>
                  {Object.entries(item.evidence).map(([field, evidence]) => (
                    <div key={field}>
                      <strong>{field}{evidence.page ? ` · página ${evidence.page}` : ""}</strong>
                      <p>{evidence.excerpt}</p>
                      <a className={styles.textLink} href={evidence.source_url} target="_blank" rel="noopener noreferrer">Conferir trecho na fonte</a>
                    </div>
                  ))}
                </div>
                <form action={decideRadarOpportunity} className={styles.radarAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className={styles.button} name="decision" value="approve">Aprovar e publicar</button>
                  <button className={styles.secondaryButton} name="decision" value="reject">Rejeitar</button>
                </form>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className={styles.surface} aria-labelledby="radar-import-title">
        <h2 id="radar-import-title">Adicionar oportunidades para revisão</h2>
        <p>Importe até 10 chamadas ou cursos da mesma fonte por vez, somente de fontes oficiais já auditadas e ativas. Informe “course” em opportunity_kind para cursos e “true” em nationally_eligible apenas quando a fonte confirmar abrangência nacional.</p>
        <p>Colunas obrigatórias: official_source_name, source_page_url, title, institution, applicant_type, application_route, deadline, last_verified_at. Colunas opcionais: opportunity_kind, nationally_eligible, state_code, city_name, evidence_excerpt. Cursos e chamadas nacionais exigem evidence_excerpt.</p>
        <form action={importRadarCsv} className={styles.radarImportForm}>
          <label htmlFor="radar-csv">CSV com cabeçalho e dados verificados</label>
          <textarea id="radar-csv" name="csv" rows={6} maxLength={20000} required spellCheck={false}
            placeholder="official_source_name,source_page_url,title,institution,applicant_type,application_route,deadline,last_verified_at,opportunity_kind,nationally_eligible,state_code,city_name,evidence_excerpt" />
          <button className={styles.button}>Enviar para revisão</button>
        </form>
      </section>
      {!radar.available ? <AdminNotice tone="attention" title="Ponte interna indisponível" description="A fonte editorial não pôde ser consultada. Nenhuma alteração foi enviada ao Radar." /> : null}

      {radar.available && radar.sources.length > 0 ? (
        <section aria-labelledby="radar-sources-title">
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Fontes oficiais</p>
              <h2 id="radar-sources-title">Auditoria e coleta controlada · {pending} pendentes</h2>
              <p>Verifique primeiro a origem, a localização e as condições de coleta. Ative somente depois da confirmação.</p>
            </div>
          </div>
          <ul className={styles.radarSourceList}>{radar.sources.map((source) => <SourceCard key={source.id} source={source} />)}</ul>
        </section>
      ) : null}

      {radar.available && radar.sources.length === 0 ? (
        <section className={styles.emptyState} role="status">
          <div className={styles.stateCard}>
            <p className={styles.eyebrow}>Sem fontes</p>
            <h2>Nenhuma fonte editorial foi cadastrada.</h2>
            <p>Cadastre uma fonte oficial no Radar antes de iniciar a auditoria.</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
