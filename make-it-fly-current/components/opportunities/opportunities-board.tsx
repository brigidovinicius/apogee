"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Compass, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import {
  EDUCATION_LEVELS,
  OPPORTUNITY_KINDS,
  type EducationLevel,
  type OpportunityKind,
  type StudentOpportunity,
  dateInBrazil,
  isOpportunityOpen,
  sortByDeadline,
} from "@/lib/opportunities/types";
import styles from "./opportunities.module.css";

type OpportunityBoardProps = {
  opportunities: readonly StudentOpportunity[];
};

type Filter<T extends string> = T | "Todas";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(`${date}T12:00:00Z`));

export function OpportunitiesBoard({ opportunities }: OpportunityBoardProps) {
  const [kind, setKind] = useState<Filter<OpportunityKind>>("Todas");
  const [level, setLevel] = useState<Filter<EducationLevel>>("Todas");
  const [today] = useState(() => dateInBrazil());

  const visible = useMemo(
    () =>
      sortByDeadline(opportunities)
        .filter((opportunity) => isOpportunityOpen(opportunity, today))
        .filter((opportunity) => kind === "Todas" || opportunity.kind === kind)
        .filter((opportunity) => level === "Todas" || opportunity.level === level),
    [kind, level, opportunities, today],
  );

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

      <div className={styles.filters} aria-label="Filtrar oportunidades">
        <div className={styles.filterLabel}>
          <SlidersHorizontal size={15} aria-hidden />
          Filtrar por
        </div>
        <FilterGroup
          label="Modalidade"
          options={OPPORTUNITY_KINDS}
          value={kind}
          onChange={setKind}
        />
        <FilterGroup
          label="Formação"
          options={EDUCATION_LEVELS}
          value={level}
          onChange={setLevel}
        />
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
          <h3>Nenhuma oportunidade com estes filtros.</h3>
          <p>Remova um filtro para explorar as chamadas verificadas pela Apogee.</p>
          <button type="button" onClick={() => { setKind("Todas"); setLevel("Todas"); }}>
            Limpar filtros
          </button>
        </div>
      )}
    </section>
  );
}

type FilterGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: Filter<T>;
  onChange: (value: Filter<T>) => void;
};

function FilterGroup<T extends string>({ label, options, value, onChange }: FilterGroupProps<T>) {
  return (
    <fieldset className={styles.filterFieldset}>
      <legend>{label}</legend>
      <div className={styles.filterGroup}>
        {(["Todas", ...options] as Filter<T>[]).map((option) => (
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
