import { publishedOpportunityPredicate } from "./publication-filter";
import { queryPublic, withAdminTransaction } from "./client";
import { BRAZILIAN_STATE_CODES, type BrazilianStateCode } from "@/lib/location";

export interface PublicOpportunity {
  id: string;
  title: string;
  institution: string;
  benefit_type: string;
  deadline_at: string | null;
  deadline_precision: string;
  application_route: string;
  state_code: BrazilianStateCode | null;
  city_name: string | null;
  human_verified_at: string;
  has_retification: boolean;
  source_page_url: string;
  official_document_url: string | null;
  application_url: string | null;
  last_checked_at: string;
}

export async function listPublicOpportunities(): Promise<PublicOpportunity[]> {
  if (!process.env.DATABASE_URL) return [];
  const result = await queryPublic<PublicOpportunity>(
    `select o.id,o.title,o.institution,o.benefit_type,o.deadline_at,o.deadline_precision,
      o.application_route,o.state_code,o.city_name,o.human_verified_at,o.has_retification,
      os.source_page_url,os.official_document_url,os.application_url,os.last_checked_at
     from opportunities o join lateral (
       select * from opportunity_sources where opportunity_id=o.id and active order by is_primary desc, created_at desc limit 1
     ) os on true where ${publishedOpportunityPredicate} order by o.deadline_at nulls last`,
  );
  return result.rows;
}

export async function getPublicOpportunity(id: string): Promise<PublicOpportunity | null> {
  if (!process.env.DATABASE_URL) return null;
  const result = await queryPublic<PublicOpportunity>(
    `select o.id,o.title,o.institution,o.benefit_type,o.deadline_at,o.deadline_precision,
      o.application_route,o.state_code,o.city_name,o.human_verified_at,o.has_retification,
      os.source_page_url,os.official_document_url,os.application_url,os.last_checked_at
     from opportunities o join lateral (
       select * from opportunity_sources where opportunity_id=o.id and active order by is_primary desc, created_at desc limit 1
     ) os on true where o.id=$1 and ${publishedOpportunityPredicate}`, [id],
  );
  return result.rows[0] ?? null;
}

export async function adminRows<T>(query: string, values: unknown[] = []): Promise<T[]> {
  if (!process.env.DATABASE_URL) return [];
  return withAdminTransaction(async (client) => (await client.query(query, values)).rows as T[]);
}

export type LocationMonitoringFilters = {
  stateCode: BrazilianStateCode | null;
  cityName: string | null;
};

export type LocationMonitoring = {
  available: boolean;
  total: number;
  filtered: number;
  missing: number;
  invalidStored: number;
  rejectedDuringIngestion: number | null;
  lastUpdatedAt: string | null;
  states: BrazilianStateCode[];
  cities: string[];
  breakdown: Array<{ stateCode: BrazilianStateCode | null; cityName: string | null; count: number }>;
};

export async function getLocationMonitoring(
  filters: LocationMonitoringFilters,
): Promise<LocationMonitoring> {
  if (!process.env.DATABASE_URL) {
    return {
      available: false, total: 0, filtered: 0, missing: 0, invalidStored: 0,
      rejectedDuringIngestion: null, lastUpdatedAt: null, states: [], cities: [], breakdown: [],
    };
  }

  return withAdminTransaction(async (client) => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (filters.stateCode) {
      values.push(filters.stateCode);
      conditions.push(`state_code=$${values.length}`);
    }
    if (filters.cityName) {
      values.push(filters.cityName);
      conditions.push(`city_name=$${values.length}`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";

    const [summaryResult, statesResult, citiesResult, breakdownResult, telemetryResult] = await Promise.all([
      client.query<{
        total: number; missing: number; invalid_stored: number; last_updated_at: string | null;
      }>(
        `select count(*)::int as total,
           count(*) filter (where state_code is null and city_name is null)::int as missing,
           count(*) filter (where city_name is not null and state_code is null
             or state_code is not null and not (state_code=any($1::text[])))::int as invalid_stored,
           max(updated_at)::text as last_updated_at
         from opportunities`,
        [BRAZILIAN_STATE_CODES],
      ),
      client.query<{ state_code: BrazilianStateCode }>(
        "select distinct state_code from opportunities where state_code is not null order by state_code",
      ),
      filters.stateCode
        ? client.query<{ city_name: string }>(
            "select distinct city_name from opportunities where state_code=$1 and city_name is not null order by city_name",
            [filters.stateCode],
          )
        : Promise.resolve({ rows: [] as Array<{ city_name: string }> }),
      client.query<{ state_code: BrazilianStateCode | null; city_name: string | null; count: number }>(
        `select state_code,city_name,count(*)::int as count from opportunities ${where}
         group by state_code,city_name order by state_code nulls last,city_name nulls last`,
        values,
      ),
      client.query<{ rejected: number; runs_with_location_telemetry: number }>(
        `select
           coalesce(sum(case when jsonb_typeof(execution_metadata->'location'->'rejected')='number'
             then (execution_metadata->'location'->>'rejected')::int else 0 end),0)::int as rejected,
           count(*) filter (where execution_metadata ? 'location')::int as runs_with_location_telemetry
         from ingestion_runs`,
      ),
    ]);

    const summary = summaryResult.rows[0];
    const telemetry = telemetryResult.rows[0];
    const breakdown = breakdownResult.rows.map((row) => ({
      stateCode: row.state_code,
      cityName: row.city_name,
      count: row.count,
    }));
    return {
      available: true,
      total: summary?.total ?? 0,
      filtered: breakdown.reduce((sum, row) => sum + row.count, 0),
      missing: summary?.missing ?? 0,
      invalidStored: summary?.invalid_stored ?? 0,
      rejectedDuringIngestion: telemetry?.runs_with_location_telemetry ? telemetry.rejected : null,
      lastUpdatedAt: summary?.last_updated_at ?? null,
      states: statesResult.rows.map((row) => row.state_code),
      cities: citiesResult.rows.map((row) => row.city_name),
      breakdown,
    };
  });
}
