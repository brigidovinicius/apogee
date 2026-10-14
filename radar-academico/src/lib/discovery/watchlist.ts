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
};

export type DiscoveryLead = {
  id: string;
  target_id: string;
  url: string;
  title: string;
  status: "new" | "reviewing" | "mapped" | "dismissed";
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
    const targets = await client.query<DiscoveryTarget>("select id,name,organizer,kind,official_url,topics,priority,enabled,official_verified_at,official_verified_url,official_review_note,last_checked_at,next_check_at,last_status,evidence_url from discovery_targets order by priority desc,name");
    const leads = await client.query<DiscoveryLead>("select id,target_id,url,title,status,first_seen_at,last_seen_at from discovery_leads where status in ('new','reviewing') order by last_seen_at desc limit 100");
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
      else await client.query("update discovery_leads set last_seen_at=now() where target_id=$1 and url=$2", [targetId, lead.url]);
    }
    return added;
  });
}
