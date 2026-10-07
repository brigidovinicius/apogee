import { queryPublic, withAdminTransaction } from "./client";

export interface PublicOpportunity {
  id: string;
  title: string;
  institution: string;
  benefit_type: string;
  deadline_at: string | null;
  deadline_precision: string;
  application_route: string;
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
      o.application_route,o.human_verified_at,o.has_retification,
      os.source_page_url,os.official_document_url,os.application_url,os.last_checked_at
     from opportunities o join lateral (
       select * from opportunity_sources where opportunity_id=o.id and active order by is_primary desc, created_at desc limit 1
     ) os on true order by o.deadline_at nulls last`,
  );
  return result.rows;
}

export async function getPublicOpportunity(id: string): Promise<PublicOpportunity | null> {
  if (!process.env.DATABASE_URL) return null;
  const result = await queryPublic<PublicOpportunity>(
    `select o.id,o.title,o.institution,o.benefit_type,o.deadline_at,o.deadline_precision,
      o.application_route,o.human_verified_at,o.has_retification,
      os.source_page_url,os.official_document_url,os.application_url,os.last_checked_at
     from opportunities o join lateral (
       select * from opportunity_sources where opportunity_id=o.id and active order by is_primary desc, created_at desc limit 1
     ) os on true where o.id=$1`, [id],
  );
  return result.rows[0] ?? null;
}

export async function adminRows<T>(query: string, values: unknown[] = []): Promise<T[]> {
  if (!process.env.DATABASE_URL) return [];
  return withAdminTransaction(async (client) => (await client.query(query, values)).rows as T[]);
}