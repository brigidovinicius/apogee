import { z } from "zod";
import { BRAZILIAN_STATE_CODES } from "@/lib/opportunities/location";
import { AREAS, EDUCATION_LEVELS, OPPORTUNITY_CATEGORIES, OPPORTUNITY_KINDS } from "@/lib/opportunities/types";

const filterShape = {
  query: z.string().trim().max(200).optional().describe("Nome, instituição ou assunto. Termos e acentos usam a busca do Radar."),
  category: z.enum([...OPPORTUNITY_CATEGORIES.map(c => c.id), "vestibular"]).optional(),
  area: z.enum(Object.keys(AREAS) as [keyof typeof AREAS, ...(keyof typeof AREAS)[]]).optional(),
  kind: z.enum(OPPORTUNITY_KINDS).optional(),
  level: z.enum(EDUCATION_LEVELS).optional(),
  stateCode: z.enum(BRAZILIAN_STATE_CODES).optional().describe("UF; inclui oportunidades com elegibilidade nacional conforme o Radar."),
  cityName: z.string().trim().min(2).max(120).optional().describe("Cidade; informe também stateCode."),
  format: z.enum(["online", "presencial", "hibrido"]).optional(),
  scope: z.literal("nacional").optional(),
  benefit: z.enum(["remunerado", "nao-remunerado", "premiacao", "gratuito"]).optional(),
  deadlineWindow: z.enum(["7dias", "30dias", "continuo", "nao-informado", "abertas"]).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
  pageSize: z.number().int().min(1).max(24).optional(),
};
export const mcpToolSchemas = {
  search_opportunities: z.strictObject(filterShape),
  get_opportunity: z.strictObject({ id: z.string().regex(/^[A-Za-z0-9_-]{1,200}$/) }),
  list_calendar_entries: z.strictObject({ ...filterShape,
    stage: z.enum(["registration", "exam", "result", "enrollment", "event"]).optional(),
    period: z.enum(["proximas", "hoje", "7dias", "30dias"]).optional(),
  }),
  get_radar_access: z.strictObject({}),
};
export type RadarToolName = keyof typeof mcpToolSchemas;
export type RadarSearchInput = z.infer<typeof mcpToolSchemas.search_opportunities>;
