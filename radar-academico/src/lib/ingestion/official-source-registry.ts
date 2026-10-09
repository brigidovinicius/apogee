import { withAdminTransaction } from "@/lib/db/client";
import { officialSourceRegistry, getOfficialSource } from "@/lib/official-sources/registry";
import type { OfficialSource } from "./types";

export { officialSourceRegistry, getOfficialSource };

interface SourceRow {
  id: string;
  name: string;
  institution_name: string;
  institution_acronym: string;
  source_type: OfficialSource["sourceType"];
  base_url: string;
  allowed_domains: string[];
  allowed_path_prefixes: string[];
  listing_urls: string[];
  extraction_mode: OfficialSource["extractionMode"];
  audience_scope: OfficialSource["audienceScope"];
  geographic_scope: string[];
  state_code: string | null;
  city_name: string | null;
  categories: string[];
  priority: number;
  active: boolean;
  notes: string | null;
}

export async function loadActiveOfficialSources(): Promise<OfficialSource[]> {
  if (!process.env.DATABASE_URL) return officialSourceRegistry.filter((source) => source.active);
  const rows = await withAdminTransaction(async (client) =>
    (await client.query<SourceRow>("select * from official_sources where active=true and verification_status='verified' order by priority desc")).rows,
  );
  return rows.map((row) => ({
    id: row.id, name: row.name, institutionName: row.institution_name,
    institutionAcronym: row.institution_acronym, sourceType: row.source_type,
    baseUrl: row.base_url, allowedDomains: row.allowed_domains,
    allowedPathPrefixes: row.allowed_path_prefixes, listingUrls: row.listing_urls,
    extractionMode: row.extraction_mode, audienceScope: row.audience_scope,
    geographicScope: row.geographic_scope, categories: row.categories,
    location: { stateCode: row.state_code, cityName: row.city_name },
    priority: row.priority, active: row.active, notes: row.notes ?? undefined,
  }));
}
