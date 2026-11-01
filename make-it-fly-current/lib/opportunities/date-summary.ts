import type { StudentOpportunity } from "./types";

type DateField = { label: string; text: string; dateTime: string | null; hasTime: boolean };

function confirmedDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  const day = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(Date.parse(value)) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== value.slice(0, 10)) return null;
  const hasTime = value.length > 10;
  const text = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric", month: "long", year: "numeric",
    timeZone: hasTime ? "America/Sao_Paulo" : "UTC",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(hasTime ? value : `${value}T12:00:00Z`));
  return { text: `${text}${hasTime ? " (Brasília)" : ""}`, dateTime: value, hasTime };
}

/** Registration closes independently of an event's confirmed start. Neither date fills the other. */
export function opportunityDateSummary(opportunity: Pick<StudentOpportunity, "categories" | "deadline" | "deadlineAt" | "deadlineLabel" | "eventStartsAt" | "discovery">): { registration: DateField; event: DateField | null } {
  const deadline = confirmedDate(opportunity.deadlineAt) ?? confirmedDate(opportunity.deadline);
  const start = confirmedDate(opportunity.eventStartsAt);
  const event = Boolean(opportunity.eventStartsAt) || opportunity.categories?.some(category => ["eventos", "competicoes"].includes(category)) ||
    ["eventos", "competicoes"].includes(opportunity.discovery?.primaryType ?? "") || opportunity.discovery?.subtype === "hackathon";
  return {
    registration: deadline ? { label: "Inscrições até", ...deadline } : {
      label: "Inscrições", text: /fluxo contínuo/iu.test(opportunity.deadlineLabel ?? "") ? "Em fluxo contínuo" : "Prazo não informado",
      dateTime: null, hasTime: false,
    },
    event: event ? { label: "Data do evento", ...(start ?? { text: "Data não informada", dateTime: null, hasTime: false }) } : null,
  };
}
