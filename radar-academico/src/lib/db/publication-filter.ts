// Defence in depth even if the configured DB role accidentally bypasses RLS.
// Keep in sync with opportunities_public; never weaken the human review gate.
export const publishedOpportunityPredicate = `o.review_status='approved'
  and o.human_verified_at is not null and o.opportunity_status='open'
  and o.published_at is not null and (o.deadline_at is null or o.deadline_at >= now())`;
