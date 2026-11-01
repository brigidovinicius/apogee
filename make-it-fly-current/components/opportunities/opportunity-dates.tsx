import type { StudentOpportunity } from "@/lib/opportunities/types";
import { opportunityDateSummary } from "@/lib/opportunities/date-summary";
import styles from "./opportunity-dates.module.css";

export function OpportunityDates({ opportunity, className, detailed = false }: { opportunity: StudentOpportunity; className?: string; detailed?: boolean }) {
  const { registration, event } = opportunityDateSummary(opportunity);
  return <dl className={[styles.dates, !event && styles.single, className].filter(Boolean).join(" ")} aria-label="Inscrições e realização">
    {[registration, event].map(field => field && <div key={field.label}>
      <dt>{field.label}</dt>
      <dd>{field.dateTime ? <time dateTime={field.dateTime}>{field.text}</time> : field.text}
        {detailed && field.dateTime && !field.hasTime ? <small>Horário {field === registration ? "de encerramento " : ""}não informado.</small> : null}
      </dd>
    </div>)}
  </dl>;
}
