import "server-only";
import { getMcpMember } from "@/lib/mcp/identity";
import { applicationOrigin } from "@/lib/members/mail";
import { isGeneratedGoogleUsername } from "@/lib/members/validation";
import { radarAccess } from "@/lib/billing/store";
import { RADAR_ACCESS_PATH } from "@/lib/billing/config";
import { freeRadarOpportunity } from "@/lib/opportunities/detail-store";
import { listRadarOpportunities } from "@/lib/opportunities/radar-client";
import { opportunityCardData } from "@/lib/opportunities/card-data";
import { opportunityDetailPath } from "@/lib/opportunities/detail-path";
import { calendarEntries } from "@/lib/opportunities/discovery";
import { filterCalendarEntries, filterCalendarItems, type CalendarFilters } from "@/lib/opportunities/calendar-filters";
import { rankOpportunities } from "@/lib/opportunities/ranking";
import { EMPTY_OPPORTUNITY_FILTERS, filterOpportunities, isOpportunityOpen, type StudentOpportunity } from "@/lib/opportunities/types";
import { mcpToolSchemas, type RadarToolName, type RadarSearchInput } from "./schemas";

export class RadarToolError extends Error {
  constructor(readonly code: string, message: string, readonly nextUrl?: string) { super(message); }
}

type Rights = { fullAccess: boolean; freeOpportunityId: string | null };
function canRead(item: StudentOpportunity, rights: Rights) {
  return rights.fullAccess || rights.freeOpportunityId === item.id;
}
function serialize(item: StudentOpportunity, rights: Rights) {
  const allowed = canRead(item, rights);
  return {
    ...opportunityCardData(item),
    ...(allowed ? { eligibility: item.eligibility, officialUrl: item.officialUrl, financials: item.financials, discovery: item.discovery } : {}),
    detailAccess: allowed ? (rights.fullAccess ? "full" : "free") : "locked",
    apogeeUrl: `${applicationOrigin()}${opportunityDetailPath(item.id)}`,
    deadlineUnknown: item.deadlineUnknown === true,
  };
}
function page<T>(items: T[], input: { page?: number; pageSize?: number }) {
  const number = input.page ?? 1, size = input.pageSize ?? 12;
  return { items: items.slice((number - 1) * size, number * size), total: items.length, page: number,
    pageSize: size, hasMore: number * size < items.length, generatedAt: new Date().toISOString(), timeZone: "America/Sao_Paulo" };
}
function filters(input: RadarSearchInput) {
  if (input.cityName && !input.stateCode) throw new RadarToolError("invalid_arguments", "Informe a UF para filtrar por cidade.");
  // Valid filters absent from the catalogue must remain filters, yielding zero results.
  return { ...EMPTY_OPPORTUNITY_FILTERS, ...input };
}

/** Every tool call rechecks account and rights. No write operation belongs here. */
export async function readRadarTool(userId: string, name: string, args: unknown): Promise<Record<string, unknown>> {
  if (!Object.hasOwn(mcpToolSchemas, name)) throw new RadarToolError("unknown_tool", "Ferramenta indisponível.");
  const parsed = mcpToolSchemas[name as RadarToolName].safeParse(args);
  if (!parsed.success) throw new RadarToolError("invalid_arguments", "Confira os filtros, a paginação e os argumentos informados.");
  const member = await getMcpMember(userId);
  if (!member) throw new RadarToolError("account_unavailable", "Conta indisponível. Entre novamente na Apogee.");
  if (member.nameNeedsConfirmation || isGeneratedGoogleUsername(member.username)) {
    throw new RadarToolError("profile_required", "Conclua seu perfil na Apogee para continuar.", `${applicationOrigin()}/membros/perfil/configurar`);
  }
  const access = await radarAccess(member.id, process.env.STRIPE_MODE !== "test", { claimPurchases: false });
  const rights: Rights = { fullAccess: access.active, freeOpportunityId: access.active ? null : await freeRadarOpportunity(member.id) };
  if (name === "get_radar_access") return { ...rights, readOnly: true, accessUrl: `${applicationOrigin()}${RADAR_ACCESS_PATH}` };
  const items = await listRadarOpportunities(name !== "search_opportunities");
  if (name === "get_opportunity") {
    const { id } = mcpToolSchemas.get_opportunity.parse(args);
    const item = items.find(item => item.id === id && (isOpportunityOpen(item) || calendarEntries([item]).length > 0));
    if (!item) throw new RadarToolError("not_found", "Oportunidade indisponível no catálogo publicado.");
    return { item: serialize(item, rights) };
  }
  if (name === "list_calendar_entries") {
    const input = mcpToolSchemas.list_calendar_entries.parse(args);
    const selected: CalendarFilters = { ...filters(input), view: "list", stage: input.stage, period: input.period };
    const entries = filterCalendarEntries(calendarEntries(filterCalendarItems(items, selected)), selected);
    return page(entries.map(entry => ({ key: entry.key, edition: entry.edition,
      stage: { id: entry.stage.id, name: entry.stage.name, kind: entry.stage.kind,
        start: entry.stage.start, end: entry.stage.end, checkedAt: entry.stage.checkedAt,
        ...(canRead(entry.item, rights) && entry.stage.sourceUrl ? { sourceUrl: entry.stage.sourceUrl } : {}) },
      item: serialize(entry.item, rights),
    })), input);
  }
  const input = mcpToolSchemas.search_opportunities.parse(args);
  const selected = filters(input);
  const matched = rankOpportunities(filterOpportunities(items, selected, undefined, true), selected);
  return page(matched.map(item => serialize(item, rights)), input);
}
