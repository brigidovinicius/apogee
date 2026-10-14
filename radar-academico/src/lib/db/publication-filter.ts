export const openDeadlinePredicate = `((o.deadline_precision='continuous_flow' and o.deadline_at is null)
  or (o.deadline_precision='date_only' and (o.deadline_at at time zone 'UTC')::date >= (now() at time zone 'America/Sao_Paulo')::date)
  or (o.deadline_precision='exact_datetime' and o.deadline_at >= now()))`;

export const publishedOpportunityPredicate = `o.review_status='approved'
  and o.verified_at is not null and o.verification_method in ('automatic','admin')
  and o.opportunity_status in ('open','upcoming') and not o.source_conflict
  and o.deleted_at is null and o.publication_issue is null
  and o.published_at is not null and ${openDeadlinePredicate}
  and exists (select 1 from official_sources s where s.id=o.official_source_id and s.active and s.verification_status='verified')`;
