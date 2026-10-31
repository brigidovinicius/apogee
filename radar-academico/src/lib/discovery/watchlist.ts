import type { PoolClient } from "pg";
import { withAdminTransaction } from "@/lib/db/client";

export type DiscoveryTarget = {
  id: string;
  name: string;
  organizer: string;
  kind: "site" | "program" | "event_series";
  official_url: string;
  topics: string[];
  priority: number;
  enabled: boolean;
  official_verified_at: Date | null;
  official_verified_url: string | null;
  official_review_note: string | null;
  last_checked_at: Date | null;
  next_check_at: Date | null;
  last_status: "not_checked" | "checked" | "blocked" | "failed";
  evidence_url: string;
  last_changed_at?: Date | null;
};

export type DiscoveryLead = {
  id: string;
  target_id: string;
  url: string;
  title: string;
  status: "new" | "reviewing" | "mapped" | "dismissed";
  processing_status: "pending" | "processing" | "retry" | "blocked" | "completed" | "ignored";
  processing_reason: string | null;
  processing_attempts: number;
  processed_at: Date | null;
  first_seen_at: Date;
  last_seen_at: Date;
};

export type EventEdition = {
  id: string;
  target_id: string;
  edition_name: string;
  starts_on: string | null;
  ends_on: string | null;
  location_text: string | null;
  status: "announced" | "past" | "cancelled" | "unconfirmed";
  evidence_url: string;
};

export async function listDiscoveryWatchlist() {
  return withAdminTransaction(async (client) => {
    const targets = await client.query<DiscoveryTarget>(`select id,name,organizer,kind,official_url,topics,priority,enabled,official_verified_at,official_verified_url,official_review_note,last_checked_at,next_check_at,last_status,evidence_url,observation.last_changed_at from discovery_targets target left join lateral (
      select max(finished_at) as last_changed_at from ingestion_runs
      where execution_metadata->>'component'='discovery-observation' and execution_metadata->>'target_id'=target.id
        and execution_metadata->>'changed'='true'
    ) observation on true order by priority desc,name`);
    const leads = await client.query<DiscoveryLead>("select id,target_id,url,title,status,first_seen_at,last_seen_at,processing_status,processing_reason,processing_attempts,processed_at from discovery_leads where status in ('new','reviewing') order by last_seen_at desc limit 100");
    const events = await client.query<EventEdition>("select id,target_id,edition_name,starts_on::text,ends_on::text,location_text,status,evidence_url from annual_event_editions order by starts_on nulls last,edition_name");
    return { targets: targets.rows, leads: leads.rows, events: events.rows };
  });
}

export async function claimDueDiscoveryTargets(limit: number): Promise<DiscoveryTarget[]> {
  return withAdminTransaction(async (client) => (await client.query<DiscoveryTarget>(
    `with due as (
       select id from discovery_targets where enabled and official_verified_at is not null
         and official_verified_url = official_url and (next_check_at is null or next_check_at <= now())
       order by next_check_at nulls first, priority desc, id limit $1 for update skip locked
     )
     update discovery_targets target set next_check_at=now() + interval '10 minutes',updated_at=now()
     from due where target.id=due.id returning target.*`,
    [limit],
  )).rows);
}

export async function completeDiscoveryTarget(id: string, status: DiscoveryTarget["last_status"]) {
  await withAdminTransaction((client) => client.query(
    `update discovery_targets set last_checked_at=now(),last_status=$2,
       next_check_at=now() + case when $2='checked' then make_interval(hours => check_interval_hours)
         else interval '24 hours' end,updated_at=now() where id=$1`,
    [id, status],
  ));
}

export async function saveDiscoveryLeads(targetId: string, leads: { url: string; title: string; excerpt: string }[]) {
  return withAdminTransaction(async (client) => {
    let added = 0;
    for (const lead of leads) {
      const result = await client.query(
        `insert into discovery_leads(target_id,url,title,excerpt) values($1,$2,$3,$4)
         on conflict (target_id,url) do nothing returning id`,
        [targetId, lead.url, lead.title, lead.excerpt],
      );
      if (result.rows[0]) added += 1;
      else {
        const existing = await client.query<{ id: string }>("update discovery_leads set last_seen_at=now() where target_id=$1 and url=$2 returning id", [targetId, lead.url]);
        if (existing.rows[0]) await requeueDiscoveryLeads(client, { leadId: existing.rows[0].id, reason: "rediscovered" });
      }
    }
    return added;
  });
}

/** Re-evaluation is audited and never revives a dismissal or an active lease. */
export async function requeueDiscoveryLeads(client: PoolClient, options: {
  leadId?: string; targetId?: string;
  reason: "manual_recheck" | "configuration_changed" | "rediscovered";
}) {
  if (Boolean(options.leadId) === Boolean(options.targetId)) throw new Error("Escolha um link ou um alvo");
  const field = options.leadId ? "id" : "target_id";
  const result = await client.query(
    `with reset as (
       update discovery_leads set processing_status='pending',processing_next_at=now(),
         processing_attempts=0,processing_reason=null,processed_at=null,
         processing_lease_until=null,processing_lease_token=null
       where ${field}=$1 and status in ('new','reviewing') and processing_status in ('blocked','retry')
         and ($2::text<>'rediscovered' or (processing_status='blocked'
           and processing_reason is distinct from 'retry_exhausted'
           and processed_at<=now()-interval '24 hours'))
       returning id
     ) insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
       select now(),now(),'skipped',jsonb_build_object('component','discovery-requeue','lead_id',id,'reason',$2::text)
       from reset`,
    [options.leadId ?? options.targetId, options.reason],
  );
  return result.rowCount ?? 0;
}

/** An immutable check/change log; failures never replace the last successful observation. */
export async function recordDiscoveryObservation(targetId: string, observation: { hash: string; excerpt: string }) {
  return withAdminTransaction(async client => {
    await client.query("select id from discovery_targets where id=$1 for update", [targetId]);
    const previous = (await client.query<{ hash: string }>(
      `select execution_metadata->>'hash' as hash from ingestion_runs
       where execution_metadata->>'component'='discovery-observation' and execution_metadata->>'target_id'=$1
       order by finished_at desc,id desc limit 1`, [targetId])).rows[0]?.hash;
    const changed = Boolean(previous && previous !== observation.hash);
    await client.query(`insert into ingestion_runs(started_at,finished_at,status,pages_checked,execution_metadata)
      values(now(),now(),'completed',1,$1::jsonb)`, [JSON.stringify({ component: "discovery-observation", target_id: targetId,
        hash: observation.hash, previous_hash: previous ?? null, changed, excerpt: observation.excerpt })]);
    return changed;
  });
}
export async function recordDiscoveryObservationChanged(targetId: string) {
  return withAdminTransaction(client => requeueDiscoveryLeads(client, { targetId, reason: "configuration_changed" }));
}
