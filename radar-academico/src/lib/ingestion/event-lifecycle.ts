import { withAdminTransaction } from "@/lib/db/client";
import { knownEventStart } from "@/lib/db/publication-filter";

/** Expire known dates independently of source outages. Keep event history. */
export function retireElapsedEvents() {
  return withAdminTransaction(async client => {
    const retired = await client.query<{ reason: "event_started" | "registration_expired" }>(`
      with due as (
        select o.id, to_jsonb(o) as previous,
          case when (${knownEventStart}) <= now() then 'event_started' else 'registration_expired' end as reason
        from opportunities o
        where 'eventos'=any(o.categories)
          and o.deleted_at is null and o.published_at is not null
          and o.opportunity_status in ('open','upcoming')
          and ((${knownEventStart}) <= now()
            or (o.deadline_precision='date_only' and
              (o.deadline_at at time zone 'UTC')::date < (now() at time zone 'America/Sao_Paulo')::date)
            or (o.deadline_precision='exact_datetime' and o.deadline_at < now()))
        order by o.published_at,o.id
        limit 100 for update skip locked
      ), closed as (
        update opportunities o set
          publication_issue=case when due.reason='event_started' then 'status_unconfirmed' else 'invalid_deadline' end,
          published_at=null, opportunity_status='closed', version=o.version+1, updated_at=now()
        from due where o.id=due.id
        returning o.id, due.previous, due.reason, o.publication_issue
      )
      insert into opportunity_management_events(opportunity_id,actor,action,previous_data,new_data)
      select id,'radar:automatic','withdraw',previous,jsonb_build_object(
        'reason',reason,'publicationIssue',publication_issue,'opportunityStatus','closed')
      from closed returning new_data->>'reason' as reason`);
    const editions = await client.query(`
      update annual_event_editions set status='past'
      where status='announced' and coalesce(ends_on,starts_on) < (now() at time zone 'America/Sao_Paulo')::date`);
    return {
      eventsStarted: retired.rows.filter(row => row.reason === "event_started").length,
      registrationsExpired: retired.rows.filter(row => row.reason === "registration_expired").length,
      editionsPast: editions.rowCount ?? 0,
    };
  });
}
