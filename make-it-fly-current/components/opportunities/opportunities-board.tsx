"use client";

import { OpportunityBenefits, OpportunityCosts } from "./opportunity-financials";
import { AdmissionProcessCard } from "./admission-process-card";
import { groupAdmissionProcesses } from "@/lib/opportunities/admission-processes";
import { OpportunityCountdown } from "./opportunity-countdown";
import { OpportunityAlert } from "./opportunity-alert";
import { LiveCatalogueRefresh } from "./live-refresh";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, CalendarDays, Compass, MapPin, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  EMPTY_OPPORTUNITY_FILTERS,
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_CATEGORY_PRIORITY,
  primaryOpportunityCategory,
  countActiveOpportunityFilters,
  type EducationLevel,
  filterOpportunities,
  getOpportunityFilterOptions,
  isOpportunityOpen,
  type OpportunityKind,
  type OpportunityFilters,
  type StudentOpportunity,
  dateInBrazil,
  opportunityFiltersFromSearchParams,
  sanitizeOpportunityFilters,
  setOpportunityFilterSearchParams,
} from "@/lib/opportunities/types";
import type { BrazilianStateCode } from "@/lib/opportunities/location";
import styles from "./opportunities.module.css";

import type { OpportunityPage } from "@/lib/opportunities/catalogue";

type OpportunityBoardProps = {
  catalogue?: OpportunityPage;
  opportunities: readonly StudentOpportunity[];
  management?: boolean;
  editorialFeed?: boolean;
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(date.length > 10 ? { hour: "2-digit" as const, minute: "2-digit" as const } : {}),
    timeZone: "America/Sao_Paulo",
  }).format(new Date(date.length > 10 ? date : `${date}T12:00:00Z`));

export function OpportunitiesBoard({ opportunities, management = false, editorialFeed = false, catalogue }: OpportunityBoardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(24);
  const [initialToday] = useState(() => dateInBrazil());
  const today = catalogue?.today ?? initialToday;
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  const filterOptions = useMemo(
    () => catalogue?.filterOptions ?? getOpportunityFilterOptions(opportunities, today),
    [catalogue, opportunities, today],
  );
  const filters = useMemo(
    () => catalogue?.filters ?? sanitizeOpportunityFilters(
      opportunityFiltersFromSearchParams(new URLSearchParams(searchParams.toString())),
      filterOptions,
    ),
    [catalogue, filterOptions, searchParams],
  );
  const visible = useMemo(
    () => filterOpportunities(opportunities, filters, today, editorialFeed, management),
    [filters, opportunities, today, editorialFeed, management],
  );
  const grouped = useMemo(() => groupAdmissionProcesses(visible), [visible]);
  // Public/member ranking and pagination are computed on the server.
  // Group before slicing so course options never create duplicates across pages.
  const entries = grouped.entries;
  const total = catalogue?.total ?? grouped.total;
  const activeFilterCount = countActiveOpportunityFilters(filters);
  const coverage = useMemo(() => {
    if (catalogue) return catalogue.coverage;
    const open = opportunities.filter((item) => isOpportunityOpen(item, today));
    return { total: groupAdmissionProcesses(open).total, byCategory: Object.fromEntries(
      [...OPPORTUNITY_CATEGORIES.map(({ id }) => [id, groupAdmissionProcesses(filterOpportunities(open, { ...filters, category: id }, today, true, management)).total]),
        ["vestibular", groupAdmissionProcesses(filterOpportunities(open, { ...filters, category: "vestibular" }, today, true)).total]]),
    };
  }, [catalogue, opportunities, today, filters, management]);
  const cityOptions = filters.stateCode
    ? filterOptions.citiesByState[filters.stateCode] ?? []
    : [];

  const updateFilters = (nextFilters: OpportunityFilters) => {
    setVisibleLimit(24);
    const params = setOpportunityFilterSearchParams(
      new URLSearchParams(searchParams.toString()),
      nextFilters,
    );
    params.delete("pagina");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const clearFilters = () => updateFilters({ ...EMPTY_OPPORTUNITY_FILTERS });
  const closeFilters = () => {
    setFiltersOpen(false);
    filterButtonRef.current?.focus();
  };

  const pageHref = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (page > 1) params.set("pagina", String(page)); else params.delete("pagina");
    return `${pathname}${params.size ? `?${params}` : ""}#mural-title`;
  };

  return (
    <section className={styles.board} aria-labelledby="mural-title">
      <LiveCatalogueRefresh />
      <div className={styles.boardHeading}>
        <div>
          <p className={styles.kicker}>Mural em atualização</p>
          <h2 id="mural-title">Explore o Radar</h2>
        </div>
        <p className={styles.count} aria-live="polite">
          {total} {total === 1 ? "oportunidade visível" : "oportunidades visíveis"}
        </p>
      </div>
      {management ? <p className={styles.coverageProgress}>
        Cobertura do Radar: {coverage.total.toLocaleString("pt-BR")} de 1.000 oportunidades vigentes verificadas.
      </p> : null}

      <div className={styles.searchBar}>
          <form className={styles.locationField} onSubmit={(event) => {
            event.preventDefault();
            const query = new FormData(event.currentTarget).get("busca");
            updateFilters({ ...filters, query: String(query ?? "").trim().slice(0, 100) || null });
          }}>
            <label htmlFor="opportunity-query">Área ou palavra-chave</label>
            <input key={filters.query ?? ""} id="opportunity-query" name="busca" type="search" maxLength={100} defaultValue={filters.query ?? ""} placeholder="Ex.: engenharia, saúde, soldagem" />
            <button type="submit">Buscar</button>
          </form>
      </div>

      <nav className={styles.categoryNavigation} aria-label="Categorias de oportunidades">
        <button type="button" aria-current={!filters.category ? "page" : undefined}
          className={!filters.category ? styles.activeCategory : undefined}
          onClick={() => updateFilters({ ...filters, category: null })}>Todas</button>
        {[...OPPORTUNITY_CATEGORIES].sort((a, b) => OPPORTUNITY_CATEGORY_PRIORITY.indexOf(a.id) - OPPORTUNITY_CATEGORY_PRIORITY.indexOf(b.id)).map(({ id, label }) => (
          <button key={id} type="button" aria-current={filters.category === id ? "page" : undefined}
            className={filters.category === id ? styles.activeCategory : undefined}
            onClick={() => updateFilters({ ...filters, category: id })}>
            {label} <span>({coverage.byCategory[id]})</span>
          </button>
        ))}
        <button type="button" aria-current={filters.category === "vestibular" ? "page" : undefined}
          className={filters.category === "vestibular" ? styles.activeCategory : undefined}
          onClick={() => updateFilters({ ...filters, category: "vestibular" })}>
          Ingresso por vestibular <span>({coverage.byCategory.vestibular})</span>
        </button>
      </nav>

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
            ? editorialFeed ? "Experiências extracurriculares primeiro" : "Mostrando oportunidades disponíveis"
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
              UFs e cidades mostram oportunidades locais e programas nacionais elegíveis no Brasil.
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
          <div className={styles.locationField}>
            <label htmlFor="opportunity-format">Formato confirmado</label>
            <select id="opportunity-format" value={filters.format ?? ""} onChange={event => updateFilters({ ...filters, format: event.target.value as OpportunityFilters["format"] || null })}>
              <option value="">Todos os formatos</option><option value="online">Online</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option>
            </select>
          </div>
          <div className={styles.locationField}>
            <label htmlFor="opportunity-scope">Abrangência</label>
            <select id="opportunity-scope" value={filters.scope ?? ""} onChange={event => updateFilters({ ...filters, scope: event.target.value === "nacional" ? "nacional" : null })}>
              <option value="">Local e nacional</option><option value="nacional">Nacional</option>
            </select>
          </div>
          <div className={styles.locationField}>
            <label htmlFor="opportunity-benefit">Benefício ou participação confirmados</label>
            <select id="opportunity-benefit" value={filters.benefit ?? ""} onChange={event => updateFilters({ ...filters, benefit: event.target.value as OpportunityFilters["benefit"] || null })}>
              <option value="">Todas as condições</option><option value="remunerado">Com benefício financeiro</option><option value="nao-remunerado">Não remunerado</option><option value="premiacao">Com premiação financeira</option><option value="gratuito">Gratuito</option>
            </select>
            <span className={styles.fieldHint}>Condições não informadas ficam fora destes filtros específicos.</span>
          </div>
          <div className={styles.locationField}>
            <label htmlFor="opportunity-deadline">Prazo e inscrições</label>
            <select id="opportunity-deadline" value={filters.deadlineWindow ?? ""} onChange={event => updateFilters({ ...filters, deadlineWindow: event.target.value as OpportunityFilters["deadlineWindow"] || null })}>
              <option value="">Todos os prazos vigentes</option><option value="abertas">Inscrições abertas</option><option value="7dias">Encerram em até 7 dias</option><option value="30dias">Encerram em até 30 dias</option><option value="continuo">Fluxo contínuo</option><option value="nao-informado">Prazo não informado</option>
            </select>
          </div>
          {filterOptions.kinds.length > 0 ? (
            <FilterGroup<OpportunityKind>
              label="Modalidade"
              options={filterOptions.kinds}
              value={filters.kind}
              onChange={(kind) => updateFilters({ ...filters, kind })}
            />
          ) : null}
          {filterOptions.levels.length > 0 ? (
            <FilterGroup<EducationLevel>
              label="Formação"
              options={filterOptions.levels}
              value={filters.level}
              onChange={(level) => updateFilters({ ...filters, level })}
            />
          ) : null}
          {filterOptions.states.length > 0 ? (
            <div className={styles.locationField}>
              <label htmlFor="opportunity-state">Estado/UF</label>
              <select
                id="opportunity-state"
                value={filters.stateCode ?? ""}
                aria-controls="opportunity-results opportunity-city"
                onChange={(event) => updateFilters({
                  ...filters,
                  stateCode: (event.target.value || null) as BrazilianStateCode | null,
                  cityName: null,
                })}
              >
                <option value="">Todos os estados</option>
                {filterOptions.states.map((stateCode) => (
                  <option key={stateCode} value={stateCode}>{stateCode}</option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={styles.locationField}>
            <label htmlFor="opportunity-city">Cidade</label>
            <select
              id="opportunity-city"
              value={filters.cityName ?? ""}
              disabled={!filters.stateCode || cityOptions.length === 0}
              aria-controls="opportunity-results"
              aria-describedby="opportunity-city-hint"
              onChange={(event) => updateFilters({
                ...filters,
                cityName: event.target.value || null,
              })}
            >
              <option value="">Todas as cidades</option>
              {cityOptions.map((cityName) => (
                <option key={`${filters.stateCode}-${cityName}`} value={cityName}>{cityName}</option>
              ))}
            </select>
            <span id="opportunity-city-hint" className={styles.fieldHint}>
              {filters.stateCode
                ? cityOptions.length > 0
                  ? `Cidades para buscar resultados locais e nacionais em ${filters.stateCode}.`
                  : `Nenhuma cidade estruturada disponível em ${filters.stateCode}.`
                : "Selecione uma UF para escolher a cidade."}
            </span>
          </div>
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
          <p>Programas nacionais podem aparecer em qualquer UF; a localização exibida continua sendo Brasil.</p>
        </div>
      </div>

      {!management && !editorialFeed ? <p className={styles.previewCount}><Link href="/membros/entrar?next=%2Fmembros%2Foportunidades">Entre na comunidade para continuar explorando o Radar.</Link></p> : null}
      <div id="opportunity-results">
      {entries.length > 0 ? (
        <div className={styles.grid}>
          {entries.slice(0, visibleLimit).map((entry) => entry.type === "admission"
            ? <AdmissionProcessCard key={entry.id} group={entry.group} management={management} />
            : <OpportunityCard key={entry.id} opportunity={entry.opportunity} management={management} />)}
        </div>
      ) : total === 0 ? (
        <div className={styles.empty} role="status">
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
      ) : null}
      </div>
      {catalogue && catalogue.pageCount > 1 ? <nav className={styles.pagination} aria-label="Páginas do Radar">
        {catalogue.page > 1 ? <Link className={styles.loadMore} href={pageHref(catalogue.page - 1)}>Página anterior</Link> : null}
        <span>Página {catalogue.page} de {catalogue.pageCount}</span>
        {catalogue.page < catalogue.pageCount ? <Link className={styles.loadMore} href={pageHref(catalogue.page + 1)}>Próxima página</Link> : null}
      </nav> : !catalogue && entries.length > visibleLimit ? <button type="button" className={styles.loadMore}
        onClick={() => setVisibleLimit((limit) => limit + 24)}>
        Mostrar mais oportunidades ({Math.min(entries.length - visibleLimit, 24)} próximas)
      </button> : null}
    </section>
  );
}

function OpportunityCard({ opportunity, management }: { opportunity: StudentOpportunity; management: boolean }) {
  return (
    <article className={styles.card}>
      <div className={styles.cardTopline}>
        <span className={styles.kind}>{OPPORTUNITY_CATEGORIES.find(category => category.id === primaryOpportunityCategory(opportunity))?.label ?? opportunity.kind}{opportunity.opportunityStatus === "upcoming" ? " · Em breve" : ""}</span>
        <span>{opportunity.level}</span>
      </div>
      {opportunity.categories?.length ? <p className={styles.cardCategories}>
        {opportunity.kind}{OPPORTUNITY_CATEGORIES.filter(({ id }) => id !== primaryOpportunityCategory(opportunity) && opportunity.categories?.includes(id)).map(({ label }) => ` · ${label}`).join("")}
      </p> : null}
      <div className={styles.cardMain}>
        <p className={styles.organization} title={opportunity.organization}>{opportunity.organization}</p>
        <h3>{opportunity.title}</h3>
        <OpportunityBenefits opportunity={opportunity} />
        <p className={styles.summary}>{opportunity.summary}</p>
      </div>
      <dl className={styles.details}>
        <div>
          <dt>Localização</dt>
          <dd className={styles.locationValue}><MapPin size={15} aria-hidden />{opportunity.location}</dd>
        </div>
        {opportunity.eventStartsAt && Number.isFinite(Date.parse(opportunity.eventStartsAt)) ? <div>
          <dt>Realização</dt>
          <dd><time dateTime={opportunity.eventStartsAt}>{formatDate(opportunity.eventStartsAt)}</time></dd>
        </div> : null}
      </dl>
      <details className={styles.cardDisclosure}>
        <summary>Requisitos e condições</summary>
        <dl className={styles.details}>
        <div>
          <dt>Para quem</dt>
          <dd>{opportunity.eligibility}</dd>
        </div>
          <OpportunityCosts opportunity={opportunity} />
        </dl>
      </details>
      <div className={styles.launchWindow}>
        <CalendarDays size={17} aria-hidden />
        <div>
          <span>{opportunity.deadlineKind === "submission" ? "Janela de envio" : "Janela de inscrição"}</span>
          <strong>{opportunity.deadlineLabel}</strong>
          {opportunity.deadline && !opportunity.deadlineAt ? <small>Horário de encerramento não informado.</small> : null}
        </div>
      </div>
      <OpportunityCountdown opportunity={opportunity} />
      {opportunity.deadline === null ? <OpportunityAlert id={opportunity.id} title={opportunity.title} available={opportunity.alertsAvailable === true}/> : null}
      <div className={styles.cardFooter}>
        <span>{opportunity.verificationMethod === "admin" ? "Atualizado pela equipe" : "Fonte consultada"} em <time dateTime={opportunity.verificationTimestamp ?? opportunity.verifiedAt} title="Horário de Brasília">{formatDate(opportunity.verificationTimestamp ?? opportunity.verifiedAt)}</time></span>
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
      {management ? <Link className={styles.externalLink} href={`/admin/radar?editar=${encodeURIComponent(opportunity.id.replace(/^radar-/, ""))}`}>Editar ou excluir</Link> : null}
    </article>
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
