import { AdminNotice, AdminPageHeader, adminStyles as styles } from "@/components/admin/admin-ui";
import { requireAdmin } from "@/lib/admin/access";
import { listRadarEditorialSources, type RadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";
import { ingestRadarSource, setRadarSourceActive, verifyRadarSource } from "./actions";

export const dynamic = "force-dynamic";

const automaticModes = new Set(["rss", "html", "pdf", "api", "sitemap"]);

function location(source: RadarEditorialSource) {
  return source.cityName ? `${source.cityName} · ${source.stateCode}` : source.stateCode ?? "UF não informada";
}

function statusLabel(result: string | undefined) {
  if (result === "verificada") return "Fonte marcada como verificada. A ativação continua sendo uma ação separada.";
  if (result === "ativada") return "Fonte ativada. A coleta continua limitada e exige uma ação explícita.";
  if (result === "desativada") return "Fonte desativada. Nenhuma nova coleta será iniciada por ela.";
  if (result === "coleta-iniciada") return "Coleta controlada concluída. Candidatos, se houver, seguem para revisão humana antes de publicar.";
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
          <label><input name="location_confirmed" type="checkbox" value="confirmed" required /> A UF e a cidade foram confirmadas sem inferência por texto livre.</label>
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
  const [params, radar] = await Promise.all([searchParams, listRadarEditorialSources()]);
  const message = statusLabel(params.resultado);
  const pending = radar.sources.filter((source) => source.verificationStatus === "pending").length;

  return (
    <div className={styles.content}>
      <AdminPageHeader
        title="Radar editorial"
        description="Audite a evidência oficial, confirme a localização estruturada e controle cada coleta. Nenhum candidato é publicado automaticamente."
        aside={<span className={styles.dataBadge}>{radar.available ? `${pending} pendentes` : "Ponte indisponível"}</span>}
      />

      {message ? <AdminNotice tone={params.resultado === "erro" || params.resultado === "confirmacao" ? "attention" : "success"} title="Auditoria editorial" description={message} /> : null}
      {!radar.available ? <AdminNotice tone="attention" title="Ponte interna indisponível" description="A fonte editorial não pôde ser consultada. Nenhuma alteração foi enviada ao Radar." /> : null}

      {radar.available && radar.sources.length > 0 ? (
        <section aria-labelledby="radar-sources-title">
          <div className={styles.surfaceHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Fontes nacionais</p>
              <h2 id="radar-sources-title">Auditoria e coleta controlada</h2>
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
