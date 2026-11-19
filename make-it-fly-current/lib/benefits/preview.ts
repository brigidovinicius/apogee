import "server-only";
import { getSql } from "@/lib/members/db";
import { identifier } from "@/lib/deliverables/validation";
import { orderCatalogueOffers, rosaCampaignUrl } from "./catalogue-order";
import type { BenefitAudience } from "./types";

type PublicOffer = { id: string; name: string; partner: string; category: string | null; audience: BenefitAudience };

type RankedPublicOffer = PublicOffer & { sort_order: number; provider_access: string; rosa_campaign: boolean };

export async function previewBenefitCatalogue(filters: { query: string; category: string; audience: string }) {
  const sql = getSql();
  const query = filters.query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\\%_]/g, "\\$&");
  // Keep the public projection and searchable fields independent of the redeemable record.
  const [offers, categories] = await Promise.all([
    sql<RankedPublicOffer[]>`select b.id,b.name,b.partner,c.name as category,b.audience,
      b.sort_order,coalesce(o.provider_access,'unconfirmed') as provider_access,
      (b.redemption_url=${rosaCampaignUrl}) is true as rosa_campaign
      from member_benefit b left join member_benefit_organization o on o.benefit_id=b.id
      left join member_benefit_category c on c.id=o.category_id
      where public.member_benefit_is_available(b) and (${filters.category}='' or c.slug=${filters.category})
      and (${filters.audience}='' or b.audience=${filters.audience})
      and translate(lower(concat_ws(' ',b.name,b.partner,c.name)), 'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') like ${`%${query}%`}
      order by b.sort_order,b.name,b.id`,
    sql<{ slug: string; name: string }[]>`select distinct c.slug,c.name from member_benefit_category c
      join member_benefit_organization o on o.category_id=c.id join member_benefit b on b.id=o.benefit_id
      where c.status='published' and public.member_benefit_is_available(b) order by c.name`,
  ]);
  const ranked = orderCatalogueOffers(offers);
  return { offers: ranked.map(({ id, name, partner, category, audience }) => ({ id, name, partner, category, audience })), categories };
}

export async function previewBenefitTitle(id: string) {
  if (!identifier.safeParse(id).success) return null;
  const [offer] = await getSql()<PublicOffer[]>`select b.id,b.name,b.partner,c.name as category,b.audience
    from member_benefit b left join member_benefit_organization o on o.benefit_id=b.id
    left join member_benefit_category c on c.id=o.category_id
    where b.id=${id} and public.member_benefit_is_available(b)`;
  return offer ?? null;
}

export async function previewBenefitConditions(id: string) {
  const [offer] = await getSql()<{ eligibility: string; availability: string; ends_at: string | null; last_success_at: string }[]>`
    select b.eligibility,b.availability,b.ends_at,m.last_success_at
    from member_benefit b join member_benefit_monitor m on m.benefit_id=b.id
    where b.id=${id} and public.member_benefit_is_available(b)`;
  return offer ?? null;
}
