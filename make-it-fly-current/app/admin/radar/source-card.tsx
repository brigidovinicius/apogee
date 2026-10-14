import { adminStyles as styles } from "@/components/admin/admin-ui";
import type { RadarEditorialSource } from "@/lib/opportunities/radar-editorial-client";
import { ingestRadarSource, setRadarSourceActive, verifyRadarSource } from "./actions";
const automaticModes = new Set(["rss", "html", "pdf", "api", "sitemap"]);

function location(source: RadarEditorialSource) {
  return source.cityName ? `${source.cityName} · ${source.stateCode}` :
    source.stateCode ?? (source.geographicScope.includes("Brasil") ? "Brasil" : "Localização não informada");
}

export function SourceCard({ source }: { source: RadarEditorialSource }) {
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
          <button className={styles.button}>Atualizar fonte</button>
        </form>
      ) : source.active && source.verificationStatus === "verified" ? <p className={styles.radarHint}>Esta fonte usa importação assistida; a coleta automática não está habilitada.</p> : null}
    </li>
  );
}
