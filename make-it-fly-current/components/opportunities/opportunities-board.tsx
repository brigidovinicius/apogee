"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  EMPTY_OPPORTUNITY_FILTERS,
  countActiveOpportunityFilters,
  type EducationLevel,
  filterOpportunities,
  getOpportunityFilterOptions,
  type OpportunityKind,
  type OpportunityFilters,
  type StudentOpportunity,
  dateInBrazil,
} from "@/lib/opportunities/types";
import styles from "./opportunities.module.css";

type OpportunityBoardProps = {
  opportunities: readonly StudentOpportunity[];
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${date}T12:00:00Z`));

export function OpportunitiesBoard({ opportunities }: OpportunityBoardProps) {
  const [filters, setFilters] = useState<OpportunityFilters>(() => ({
    ...EMPTY_OPPORTUNITY_FILTERS,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [today] = useState(() => dateInBrazil());
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const visible = useMemo(
    () => filterOpportunities(opportunities, filters, today),
    [filters, opportunities, today],
  );
  const filterOptions = useMemo(
    () => getOpportunityFilterOptions(opportunities, today),
    [opportunities, today],
  );
  const activeFilterCount = countActiveOpportunityFilters(filters);

  const clearFilters = () => setFilters({ ...EMPTY_OPPORTUNITY_FILTERS });
  const closeFilters = () => {
    setFiltersOpen(false);
    filterButtonRef.current?.focus();
  };

  return (
    <section className={styles.board} aria-labelledby="mural-title">
      <div className={styles.boardHeading}>
        <div>
          <p className={styles.kicker}>Mural em atualização</p>
          <h2 id="mural-title">Encontre a sua próxima janela de lançamento.</h2>
        </div>
        <p className={styles.count} aria-live="polite">
          {visible.length} {visible.length === 1 ? "oportunidade" : "oportunidades"} visíveis
        </p>
      </div>

      <div className={styles.filterToolbar}>
        <button
          ref={filterButtonRef}
          type="button"
          className={styles.filterTrigger}
          aria-expanded={filtersOpen}
          aria-controls="opportunity-filter-panel"
          aria-label={`${filtersOpen ? "Fechar" : "Abrir"} filtros de oportunidades${
            activeFilterCount === 0
              ? ""
              : `, ${activeFilterCount} ${activeFilterCount === 1 ? "ativo" : "ativos"}`
          }`}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <SlidersHorizontal size={17} aria-hidden />
          <span>Filtros</span>
          {activeFilterCount > 0 ? (
            <span className={styles.filterBadge} aria-hidden="true">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        <p className={styles.filterSummary}>
          {activeFilterCount === 0
            ? "Mostrando todas as classificações disponíveis"
            : `${activeFilterCount} ${activeFilterCount === 1 ? "filtro ativo" : "filtros ativos"}`}
        </p>
      </div>

      <div
        id="opportunity-filter-panel"
        className={styles.filterPanel}
        role="region"
        aria-labelledby="opportunity-filter-title"
        hidden={!filtersOpen}
        onKeyDown={(event) => {
          if (event.key === "Escape") closeFilters();
        }}
      >
        <div className={styles.filterPanelHeader}>
          <div>
            <p className={styles.filterPanelEyebrow}>Refine o radar</p>
            <h3 id="opportunity-filter-title">Filtrar oportunidades</h3>
            <p className={styles.filterPanelDescription}>
              Só aparecem opções presentes nos dados estruturados das chamadas abertas.
            </p>
          </div>
          <button
            type="button"
            className={styles.filterClose}
            aria-label="Fechar painel de filtros"
            onClick={closeFilters}
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        <div className={styles.filterFields}>
          {filterOptions.kinds.length > 0 ? (
            <FilterGroup<OpportunityKind>
              label="Modalidade"
              options={filterOptions.kinds}
              value={filters.kind}
              onChange={(kind) => setFilters((current) => ({ ...current, kind }))}
            />
          ) : null}
          {filterOptions.levels.length > 0 ? (
            <FilterGroup<EducationLevel>
              label="Formação"
              options={filterOptions.levels}
              value={filters.level}
              onChange={(level) => setFilters((current) => ({ ...current, level }))}
            />
          ) : null}
        </div>

        <div className={styles.filterPanelFooter}>
          <button
            type="button"
            className={styles.clearFilters}
            disabled={activeFilterCount === 0}
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
          <p>Remuneração, localização e idade aguardam campos estruturados da fonte.</p>
        </div>
      </div>

      {visible.length > 0 ? (
        <div id="opportunity-results" className={styles.grid}>
          {visible.map((opportunity) => (
            <article className={styles.card} key={opportunity.id}>
              <div className={styles.cardTopline}>
                <span className={styles.kind}>{opportunity.kind}</span>
                <span>{opportunity.level}</span>
              </div>
              <div className={styles.cardMain}>
                <p className={styles.organization}>{opportunity.organization}</p>
                <h3>{opportunity.title}</h3>
                <p className={styles.summary}>{opportunity.summary}</p>
              </div>
              <dl className={styles.details}>
                <div>
                  <dt>Para quem</dt>
                  <dd>{opportunity.eligibility}</dd>
                </div>
                <div>
                  <dt>Apoio</dt>
                  <dd>{opportunity.benefit}</dd>
                </div>
              </dl>
              <div className={styles.launchWindow}>
                <CalendarDays size={17} aria-hidden />
                <div>
                  <span>Janela de inscrição</span>
                  <strong>{opportunity.deadlineLabel}</strong>
                </div>
              </div>
              <div className={styles.cardFooter}>
                <span>Verificado em {formatDate(opportunity.verifiedAt)}</span>
                <Link
                  href={opportunity.officialUrl}
                  className={styles.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ver página oficial de ${opportunity.title}`}
                >
                  Ver oportunidade <ArrowUpRight size={16} aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div id="opportunity-results" className={styles.empty} role="status">
          <Compass size={28} aria-hidden />
          <h3>
            {activeFilterCount > 0
              ? "Nenhuma oportunidade com estes filtros."
              : "Nenhuma oportunidade aberta no momento."}
          </h3>
          <p>
            {activeFilterCount > 0
              ? "Limpe ou ajuste os filtros para explorar outras chamadas verificadas pela Apogee."
              : "Novas chamadas verificadas aparecerão aqui assim que estiverem disponíveis."}
          </p>
          {activeFilterCount > 0 ? (
            <button type="button" onClick={clearFilters}>
              Limpar filtros
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}

type FilterGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
};

function FilterGroup<T extends string>({ label, options, value, onChange }: FilterGroupProps<T>) {
  return (
    <fieldset className={styles.filterFieldset}>
      <legend>{label}</legend>
      <div className={styles.filterGroup}>
        <button
          type="button"
          className={value === null ? styles.selected : undefined}
          aria-label={`${label}: Todas`}
          aria-pressed={value === null}
          aria-controls="opportunity-results"
          onClick={() => onChange(null)}
        >
          Todas
        </button>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? styles.selected : undefined}
            aria-label={`${label}: ${option}`}
            aria-pressed={value === option}
            aria-controls="opportunity-results"
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
