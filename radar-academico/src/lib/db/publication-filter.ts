export const openDeadlinePredicate = `((o.deadline_precision='continuous_flow' and o.deadline_at is null)
  or (o.deadline_precision='not_informed' and o.deadline_at is null and 'eventos'=any(o.categories)
    and o.opportunity_status='open'
    and coalesce(o.evidence_json->'event_start'->>'excerpt','')<>''
    and coalesce(o.evidence_json->'registration_availability'->>'excerpt','')<>''
    and case when o.event_starts_at ~ '^\\d{4}-\\d{2}-\\d{2}$'
      then (o.event_starts_at || 'T00:00:00-03:00')::timestamptz > now()
      when o.event_starts_at ~ '^\\d{4}-\\d{2}-\\d{2}T' then o.event_starts_at::timestamptz > now()
      else false end)
  or (o.deadline_precision='date_only' and (o.deadline_at at time zone 'UTC')::date >= (now() at time zone 'America/Sao_Paulo')::date)
  or (o.deadline_precision='exact_datetime' and o.deadline_at >= now()))`;

export const publishedOpportunityPredicate = `o.review_status='approved'
  and o.verified_at is not null and o.verification_method in ('automatic','admin')
  and o.opportunity_status in ('open','upcoming') and not o.source_conflict
  and o.deleted_at is null and o.publication_issue is null
  and o.published_at is not null and ${openDeadlinePredicate}
  and exists (select 1 from official_sources s where s.id=o.official_source_id and s.active and s.verification_status='verified')`;

export const calendarOpportunityPredicate = `o.verified_at is not null and o.verification_method in ('automatic','admin')
  and o.deleted_at is null and not o.source_conflict
  and o.opportunity_status in ('open','upcoming','closed','result_published')
  and (o.publication_issue is null or o.publication_issue in ('invalid_deadline','status_unconfirmed'))
  and o.review_status in ('approved','needs_information')
  and exists (select 1 from official_sources s where s.id=o.official_source_id and s.active and s.verification_status='verified')
  and exists (select 1 from jsonb_array_elements(coalesce(o.discovery->'editions','[]')) e,
    jsonb_array_elements(coalesce(e->'stages','[]')) st
    where case when length(coalesce(st->>'end',st->>'start'))=10
      then (coalesce(st->>'end',st->>'start') || 'T23:59:59-03:00')::timestamptz
      else coalesce(st->>'end',st->>'start')::timestamptz end >= now())`;
