import { z } from "zod";
import { COLLECTION_COVERS, collectionIdPattern } from "@/lib/opportunities/collection-types";

const page = { page: z.number().int().min(1).max(10_000).optional(), pageSize: z.number().int().min(1).max(24).optional() };
const collectionId = z.string().regex(collectionIdPattern);
const opportunityId = z.string().regex(/^radar-[a-zA-Z0-9_-]{1,194}$/);
const name = z.string().trim().min(1).max(80);
const description = z.string().trim().max(500);
const cover = z.enum(Object.keys(COLLECTION_COVERS) as [keyof typeof COLLECTION_COVERS, ...(keyof typeof COLLECTION_COVERS)[]]);

export const accountToolSchemas = {
  get_account_profile: z.strictObject({}),
  list_my_calendar: z.strictObject(page),
  list_my_collections: z.strictObject(page),
  get_my_collection: z.strictObject({ collectionId, ...page }),
  set_calendar_opportunity: z.strictObject({ opportunityId, saved: z.boolean().describe("true salva; false remove da agenda pessoal. Não altera o catálogo.") }),
  create_collection: z.strictObject({ name, description: description.default(""), cover: cover.default("aurora") }),
  update_collection: z.strictObject({ collectionId, name: name.optional(), description: description.optional(), cover: cover.optional() })
    .refine(value => value.name !== undefined || value.description !== undefined || value.cover !== undefined, "Informe uma alteração."),
  set_collection_opportunity: z.strictObject({ collectionId, opportunityId, present: z.boolean().describe("true adiciona; false remove desta coleção.") }),
};
export type AccountToolName = keyof typeof accountToolSchemas;

export const accountToolScopes: Record<AccountToolName, string[]> = {
  get_account_profile: ["account:read"], list_my_calendar: ["account:read"], list_my_collections: ["account:read"], get_my_collection: ["account:read"],
  set_calendar_opportunity: ["account:read", "calendar:write"],
  create_collection: ["account:read", "collections:write"], update_collection: ["account:read", "collections:write"],
  set_collection_opportunity: ["account:read", "collections:write"],
};
