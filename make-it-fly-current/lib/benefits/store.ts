import "server-only";
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getSql } from "@/lib/members/db";
import { requireAdmin } from "@/lib/members/dal";
import { supervisedRegistrationEnabled, existingAccountCutoff } from "@/lib/members/protection";
import { deliverableMember } from "@/lib/deliverables/store";
import { identifier, officialUrl } from "@/lib/deliverables/validation";
import { benefitFilters, savedBenefitInput, startBenefitInput, categoryInput, benefitCategorySlug, reviewRedemptionInput } from "./validation";
import { BENEFIT_PATHS, type BenefitView, type BenefitCategory, type BenefitOrganization, type CatalogueBenefit, type BenefitRedemption, type AdminRedemption } from "./types";

export class BenefitActionError extends Error {}
const dates = (b: CatalogueBenefit): CatalogueBenefit => ({ ...b, starts_at: b.starts_at ? new Date(b.starts_at) : null, ends_at: b.ends_at ? new Date(b.ends_at) : null });
const claimDates = <T extends BenefitRedemption>(r: T): T => ({ ...r, started_at: new Date(r.started_at), reviewed_at: r.reviewed_at ? new Date(r.reviewed_at) : null });

export async function memberBenefitWorkspace(view: BenefitView = "catalogue", input: unknown = {}) {
  const { member, access } = await deliverableMember(BENEFIT_PATHS[view]);
  const empty = { member, access, categories: [] as BenefitCategory[], benefits: [] as CatalogueBenefit[], history: [] as BenefitRedemption[], totals: { catalogue: 0, saved: 0, history: 0 } };
  // Do not even read private catalogue/history tables for an ineligible account.
  if (!access.allowed) return empty;
  const filters = benefitFilters.parse(input), sql = getSql();
  const categories = await sql<BenefitCategory[]>`select c.id,c.slug,c.name,c.description,c.status,c.sort_order,c.version,count(b.id)::int as count
    from member_benefit_category c join member_benefit_organization o on o.category_id=c.id
    join member_benefit b on b.id=o.benefit_id and b.status='published' and b.starts_at<=now() and b.ends_at>now()
    where c.status='published' group by c.id order by c.sort_order,c.name,c.id`;
  const [counts] = await sql`select count(*)::int as catalogue,count(s.benefit_id)::int as saved from member_benefit b
    left join member_benefit_organization o on o.benefit_id=b.id left join member_benefit_category c on c.id=o.category_id
    left join member_benefit_saved s on s.benefit_id=b.id and s.user_id=${member.id}
    where b.status='published' and b.starts_at<=now() and b.ends_at>now() and (c.id is null or c.status='published')`;
  const [historyCount] = await sql`select count(*)::int as count from member_benefit_redemption where user_id=${member.id}`;
  const totals = { catalogue: Number(counts.catalogue), saved: Number(counts.saved), history: Number(historyCount.count) };
  if (view === "history") {
    const history = await sql<BenefitRedemption[]>`select r.id,r.benefit_id,r.benefit_name,r.partner_name,r.status,r.started_at,r.reviewed_at,
      (b.status='published' and b.starts_at<=now() and b.ends_at>now() and (c.id is null or c.status='published')) as available
      from member_benefit_redemption r join member_benefit b on b.id=r.benefit_id
      left join member_benefit_organization o on o.benefit_id=b.id left join member_benefit_category c on c.id=o.category_id
      where r.user_id=${member.id} order by r.started_at desc,r.id`;
    return { ...empty, categories, totals, history: history.map(claimDates) };
  }
  const pattern = `%${filters.query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\\%_]/g, "\\$&")}%`;
  const benefits = await sql<CatalogueBenefit[]>`select b.id,b.name,b.partner,b.description,b.eligibility,b.availability,b.starts_at,b.ends_at,b.redemption,b.redemption_url,b.status,b.sort_order,
      c.name as category_name,c.slug as category_slug,coalesce(o.provider_label,'') as provider_label,coalesce(o.provider_access,'unconfirmed') as provider_access,(s.benefit_id is not null) as saved
    from member_benefit b left join member_benefit_organization o on o.benefit_id=b.id left join member_benefit_category c on c.id=o.category_id
    left join member_benefit_saved s on s.benefit_id=b.id and s.user_id=${member.id}
    where b.status='published' and b.starts_at<=now() and b.ends_at>now() and (c.id is null or c.status='published')
      and (${filters.category}='' or c.slug=${filters.category}) and (${view !== "saved"} or s.benefit_id is not null)
      and translate(lower(concat_ws(' ',b.name,b.partner,b.description,o.provider_label)), 'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc') like ${pattern}
    order by b.sort_order,b.name,b.id`;
  return { ...empty, categories, totals, benefits: benefits.map(dates) };
}

export async function memberBenefitDetail(id: string) {
  const { member, access } = await deliverableMember(`/membros/beneficios/${encodeURIComponent(id)}`);
  if (!access.allowed) return { member, access, benefit: null, redemptionStatus: undefined };
  if (!identifier.safeParse(id).success) return { member, access, benefit: null, redemptionStatus: undefined };
  const [benefit] = await getSql()<CatalogueBenefit[]>`select b.id,b.name,b.partner,b.description,b.eligibility,b.availability,b.starts_at,b.ends_at,b.redemption,b.redemption_url,b.status,b.sort_order,
      c.name as category_name,c.slug as category_slug,coalesce(o.provider_label,'') as provider_label,coalesce(o.provider_access,'unconfirmed') as provider_access,
      exists(select 1 from member_benefit_saved s where s.benefit_id=b.id and s.user_id=${member.id}) as saved
    from member_benefit b left join member_benefit_organization o on o.benefit_id=b.id left join member_benefit_category c on c.id=o.category_id
    where b.id=${id} and b.status='published' and b.starts_at<=now() and b.ends_at>now() and (c.id is null or c.status='published')`;
  const [existing] = benefit ? await getSql()<{ status: BenefitRedemption["status"] }[]>`select status from member_benefit_redemption where user_id=${member.id} and benefit_id=${benefit.id}` : [];
  return { member, access, benefit: benefit ? dates(benefit) : null, redemptionStatus: existing?.status };
}

async function lockedAccess(tx: TransactionSql, userId: string) {
  const [account] = await tx`select id,role,blocked,email_verified,created_at from "user" where id=${userId} for update`;
  if (!account || account.blocked) throw new BenefitActionError("Acesso indisponível para esta conta.");
  if (account.role === "admin") return;
  // Match the existing protection policy, inside the same lock used by a
  // review revocation. Never borrow another connection while holding it.
  if (supervisedRegistrationEnabled()) {
    const [review] = await tx`select status,reviewed_at from member_adult_review where user_id=${userId}`;
    const cutoff = existingAccountCutoff(), created = new Date(account.created_at);
    const approved = account.email_verified && review?.status === "approved";
    const transition = cutoff && Number.isFinite(created.getTime()) && created < cutoff && !review?.reviewed_at && (!review?.status || review.status === "pending");
    if (!approved && !transition) throw new BenefitActionError("A verificação desta conta precisa ser concluída antes de usar Benefícios.");
  }
  const eligible = await tx`select 1 from community_subscription s join community_invoice i on i.subscription_id=s.id
    where s.user_id=${userId} and s.livemode=${process.env.STRIPE_MODE !== "test"} and i.status='paid' and i.fraud_review_required=false
      and i.period_start<=now() and i.period_end>now() for share of s,i`;
  if (!eligible.length) throw new BenefitActionError("Benefícios exige assinatura anual vigente.");
}
async function availableBenefit(tx: TransactionSql, id: string) {
  const [benefit] = await tx`select b.id,b.name,b.partner,b.redemption_url,md5(to_jsonb(b)::text) as terms_revision
    from member_benefit b left join member_benefit_organization o on o.benefit_id=b.id left join member_benefit_category c on c.id=o.category_id
    where b.id=${id} and b.status='published' and b.starts_at<=now() and b.ends_at>now() and (c.id is null or c.status='published') for share of b`;
  if (!benefit) throw new BenefitActionError("Esta oferta não está disponível. Volte ao catálogo para conferir as opções.");
  return benefit;
}
export async function setSavedBenefit(input: unknown) {
  const { member, access } = await deliverableMember(BENEFIT_PATHS.saved);
  if (!access.allowed) throw new BenefitActionError("Benefícios exige assinatura anual vigente.");
  const v = savedBenefitInput.parse(input);
  await getSql().begin(async tx => {
    await lockedAccess(tx, member.id);
    if (v.saved) {
      await availableBenefit(tx, v.benefitId);
      await tx`insert into member_benefit_saved(user_id,benefit_id) values(${member.id},${v.benefitId}) on conflict do nothing`;
    } else await tx`delete from member_benefit_saved where user_id=${member.id} and benefit_id=${v.benefitId}`;
  });
  return { saved: v.saved };
}
export async function startBenefitRedemption(input: unknown) {
  const { member, access } = await deliverableMember(BENEFIT_PATHS.history);
  if (!access.allowed) throw new BenefitActionError("Benefícios exige assinatura anual vigente.");
  const v = startBenefitInput.parse(input);
  return getSql().begin(async tx => {
    await lockedAccess(tx, member.id);
    const b = await availableBenefit(tx, v.benefitId);
    if (!officialUrl.safeParse(b.redemption_url).success) throw new BenefitActionError("O destino desta oferta precisa de revisão.");
    await tx`insert into member_benefit_redemption(id,user_id,benefit_id,benefit_name,partner_name,terms_revision)
      values(${randomUUID()},${member.id},${b.id},${b.name},${b.partner},${b.terms_revision}) on conflict(user_id,benefit_id) do nothing`;
    const [redemption] = await tx<{ status: BenefitRedemption["status"] }[]>`select status from member_benefit_redemption where user_id=${member.id} and benefit_id=${b.id}`;
    return { destination: String(b.redemption_url), status: redemption.status };
  });
}

export async function adminBenefitWorkspace() {
  await requireAdmin("/admin/beneficios");
  const sql = getSql();
  return { categories: await sql<BenefitCategory[]>`select id,slug,name,description,status,sort_order,version from member_benefit_category order by sort_order,name,id`,
    organization: await sql<BenefitOrganization[]>`select benefit_id,category_id,provider_label,provider_access,source_url from member_benefit_organization`,
    redemptions: (await sql<AdminRedemption[]>`select r.id,r.user_id,r.benefit_id,r.benefit_name,r.partner_name,r.status,r.started_at,r.reviewed_at,r.evidence_reference,md5(to_jsonb(r)::text) as revision,
      (b.status='published' and b.starts_at<=now() and b.ends_at>now()) as available from member_benefit_redemption r join member_benefit b on b.id=r.benefit_id order by r.started_at desc,r.id limit 100`).map(claimDates) };
}
export async function saveBenefitCategory(input: unknown) {
  const actor = await requireAdmin("/admin/beneficios"), v = categoryInput.parse(input), slug = benefitCategorySlug(v.name);
  if (!slug) throw new BenefitActionError("O nome precisa conter letras ou números.");
  await getSql().begin(async tx => {
    const admins = await tx`select id from "user" where id=${actor.id} and role='admin' and blocked=false for share`;
    if (!admins.length) throw new BenefitActionError("Administração indisponível para esta conta.");
    if (v.id) {
      const updated = await tx`update member_benefit_category set name=${v.name},slug=${slug},description=${v.description},status=${v.status},sort_order=${v.sortOrder},version=version+1,updated_by=${actor.id},updated_at=now() where id=${v.id} and version=${v.version ?? 0} returning id`;
      if (!updated.length) throw new BenefitActionError("Esta categoria mudou. Recarregue antes de editar novamente.");
    } else await tx`insert into member_benefit_category(id,slug,name,description,status,sort_order,updated_by) values(${randomUUID()},${slug},${v.name},${v.description},${v.status},${v.sortOrder},${actor.id})`;
  });
}
export async function reviewBenefitRedemption(input: unknown) {
  const actor = await requireAdmin("/admin/beneficios"), v = reviewRedemptionInput.parse(input);
  await getSql().begin(async tx => {
    const admins = await tx`select id from "user" where id=${actor.id} and role='admin' and blocked=false for share`;
    if (!admins.length) throw new BenefitActionError("Administração indisponível para esta conta.");
    const updated = await tx`update member_benefit_redemption r set status=${v.status},evidence_reference=${v.evidenceReference},reviewed_by=${actor.id},reviewed_at=now()
      where r.id=${v.id} and md5(to_jsonb(r)::text)=${v.revision} returning id`;
    if (!updated.length) throw new BenefitActionError("Este resgate mudou. Recarregue antes de conferir novamente.");
  });
}
