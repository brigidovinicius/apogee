// A date-only deadline is open through that calendar day in Brazil. The value
// was stored as timestamptz, so comparing it with now() would close it at midnight.
export const openDeadlinePredicate = `(o.deadline_at is null
  or (o.deadline_precision='date_only'
    and o.deadline_at::date >= (now() at time zone 'America/Sao_Paulo')::date)
  or (o.deadline_precision<>'date_only' and o.deadline_at >= now()))`;

// Defence in depth even if the configured DB role accidentally bypasses RLS.
// Keep in sync with opportunities_public; never weaken the human review gate.
export const publishedOpportunityPredicate = `o.review_status='approved'
  and o.human_verified_at is not null and o.opportunity_status='open'
  and o.published_at is not null and ${openDeadlinePredicate}`;
