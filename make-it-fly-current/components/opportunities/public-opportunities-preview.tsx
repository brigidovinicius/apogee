"use client";

import { Compass, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { OpportunityPreview } from "@/lib/opportunities/types";
import styles from "./opportunities.module.css";

type PublicOpportunitiesPreviewProps = {
  opportunities: readonly OpportunityPreview[];
  memberNext: string;
};

type PublicFilter = "Todas" | string;

export function PublicOpportunitiesPreview({
  opportunities,
  memberNext,
}: PublicOpportunitiesPreviewProps) {
  const [kind, setKind] = useState<PublicFilter>("Todas");
  const [level, setLevel] = useState<PublicFilter>("Todas");
  const kinds = useMemo(() => Array.from(new Set(opportunities.map((opportunity) => opportunity.kind))), [opportunities]);
  const levels = useMemo(() => Array.from(new Set(opportunities.map((opportunity) => opportunity.level))), [opportunities]);
  const visible = useMemo(
    () => opportunities
      .filter((opportunity) => kind === "Todas" || opportunity.kind === kind)
      .filter((opportunity) => level === "Todas" || opportunity.level === level),
    [kind, level, opportunities],
  );
  const hasActiveFilters = kind !== "Todas" || level !== "Todas";

  if (opportunities.length === 0) {
    return <EmptyPreview />;
  }

  return (
    <>
      <div className={styles.filters} aria-label="Filtrar prévia pública">
        <div className={styles.filterLabel}>
          <SlidersHorizontal size={15} aria-hidden />
          Filtrar prévia por
        </div>
        <FilterGroup label="modalidade" options={kinds} value={kind} onChange={setKind} />
        <FilterGroup label="formação" options={levels} value={level} onChange={setLevel} />
      </div>

      <p className={styles.previewCount} aria-live="polite" aria-atomic="true">
        {visible.length} {visible.length === 1 ? "oportunidade visível" : "oportunidades visíveis"}
      </p>

      {visible.length > 0 ? (
        <div id="public-opportunity-results" className={styles.grid}>
          {visible.map((opportunity) => (
            <article className={`${styles.card} ${styles.previewCard}`} key={opportunity.id}>
              <div className={styles.cardTopline}>
                <span className={styles.kind}>{opportunity.kind}</span>
                <span>{opportunity.level}</span>
              </div>
              <div className={styles.cardMain}>
                <p className={styles.organization}>{opportunity.organization}</p>
                <h3>{opportunity.title}</h3>
              </div>
              <div className={styles.previewDetails} aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
              </div>
              <p className={styles.srOnly}>
                Os detalhes desta oportunidade ficam disponíveis somente para membros autenticados.
              </p>
              <Link className={styles.previewCardLink} href={`/membros/cadastro?next=${memberNext}`}>
                Desbloquear detalhes <span aria-hidden>→</span>
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div id="public-opportunity-results" className={styles.empty} role="status">
          <Compass size={28} aria-hidden />
          <h3>Nenhuma oportunidade com estes filtros.</h3>
          <p>Remova um filtro para voltar à prévia do Radar.</p>
          <button type="button" onClick={() => { setKind("Todas"); setLevel("Todas"); }}>
            Limpar filtros
          </button>
        </div>
      )}

      {hasActiveFilters ? (
        <button className={styles.clearPreviewFilters} type="button" onClick={() => { setKind("Todas"); setLevel("Todas"); }}>
          Limpar todos os filtros da prévia
        </button>
      ) : null}
    </>
  );
}

function EmptyPreview() {
  return (
    <div className={styles.empty} role="status">
      <h3>Novas oportunidades serão exibidas em breve.</h3>
      <p>Crie sua conta para acessar o Radar completo assim que ele for atualizado.</p>
    </div>
  );
}

type FilterGroupProps = {
  label: string;
  options: readonly string[];
  value: PublicFilter;
  onChange: (value: PublicFilter) => void;
};

function FilterGroup({ label, options, value, onChange }: FilterGroupProps) {
  return (
    <div className={styles.filterGroup} aria-label={`Filtrar prévia por ${label}`}>
      {["Todas", ...options].map((option) => (
        <button
          key={option}
          type="button"
          className={value === option ? styles.selected : undefined}
          aria-pressed={value === option}
          aria-controls="public-opportunity-results"
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
