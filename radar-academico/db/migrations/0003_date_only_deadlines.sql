-- A deadline without a time remains open through its calendar day in Brazil.
-- Exact deadlines still close at their recorded instant.
drop policy if exists opportunities_public on opportunities;
create policy opportunities_public on opportunities for select using (
  review_status = 'approved' and human_verified_at is not null
  and opportunity_status = 'open' and published_at is not null
  and (
    deadline_at is null
    or (deadline_precision = 'date_only'
      and deadline_at::date >= (now() at time zone 'America/Sao_Paulo')::date)
    or (deadline_precision <> 'date_only' and deadline_at >= now())
  )
);

drop policy if exists opportunity_sources_public on opportunity_sources;
create policy opportunity_sources_public on opportunity_sources for select using (
  active = true and exists (
    select 1 from opportunities o where o.id = opportunity_id
      and o.review_status = 'approved' and o.human_verified_at is not null
      and o.opportunity_status = 'open' and o.published_at is not null
      and (
        o.deadline_at is null
        or (o.deadline_precision = 'date_only'
          and o.deadline_at::date >= (now() at time zone 'America/Sao_Paulo')::date)
        or (o.deadline_precision <> 'date_only' and o.deadline_at >= now())
      )
  )
);
