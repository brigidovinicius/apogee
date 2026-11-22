import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { requireAdmin, requireMember, requireSignedInMember } from "@/lib/members/dal";
import { communityAccess } from "@/lib/billing/community-store";
import { benefitSchema, trackSchema, moduleSchema, activitySchema, type DeliverableKind } from "./validation";

export class DeliverableConflictError extends Error {}
export type Benefit = { id: string; name: string; partner: string; description: string; eligibility: string; availability: string; starts_at: Date | null; ends_at: Date | null; verified_at: Date | null; redemption: string; redemption_url: string; audience?: string; evidence_url?: string; revision?: string; status: string; sort_order: number };
export type Track = { id: string; name: string; description: string; status: string; sort_order: number; revision?: string };
export type LearningModule = Track & { track_id: string; deliverable: string };
export type Activity = { id: string; module_id: string; name: string; instructions: string; resource_url: string; status: string; sort_order: number; revision?: string };
// Drizzle configures the shared postgres-js client to return raw timestamps.
// Normalize at the boundary so valid published benefits also render after auth.
const benefitDates = (b: Benefit): Benefit => ({ ...b, verified_at: b.verified_at ? new Date(b.verified_at) : null, starts_at: b.starts_at ? new Date(b.starts_at) : null, ends_at: b.ends_at ? new Date(b.ends_at) : null });

export async function deliverableMember(next: string) {
  const member = await requireSignedInMember(next);
  const annual = await communityAccess(member.id, process.env.STRIPE_MODE !== "test");
  // Authorization is distinct from payment status; the role comes from the current DB row.
  const access = { ...annual, allowed: member.role === "admin" || annual.active };
  if (access.allowed) await requireMember(next);
  return { member, access };
}

export async function memberBenefits() {
  const { member, access } = await deliverableMember("/membros/beneficios");
  if (!access.allowed) return { member, access, benefits: [] as Benefit[] };
  // Evidence and editor identifiers stay in administration, never member HTML/RSC.
  const benefits = await getSql()<Benefit[]>`select id,name,partner,description,eligibility,availability,starts_at,ends_at,verified_at,redemption,redemption_url,status,sort_order
    from member_benefit b where public.member_benefit_is_available(b) order by sort_order,name,id`;
  return { member, access, benefits: benefits.map(benefitDates) };
}

export async function adminDeliverables(next: "/admin/beneficios" | "/admin/trilha" = "/admin/trilha") {
  await requireAdmin(next);
  const sql = getSql();
  return {
    benefits: (await sql<Benefit[]>`select b.*,md5(to_jsonb(b)::text) as revision from member_benefit b order by sort_order,name,id`).map(benefitDates),
    tracks: await sql<Track[]>`select t.*,md5(to_jsonb(t)::text) as revision from member_learning_track t order by sort_order,name,id`,
    modules: await sql<LearningModule[]>`select m.*,md5(to_jsonb(m)::text) as revision from member_learning_module m order by sort_order,name,id`,
    activities: await sql<Activity[]>`select a.*,md5(to_jsonb(a)::text) as revision from member_learning_activity a order by sort_order,name,id`,
  };
}

export async function saveDeliverable(kind: DeliverableKind, input: unknown) {
  const actor = await requireAdmin(kind === "benefit" ? "/admin/beneficios" : "/admin/trilha");
  const sql = getSql();
  const v = ({ benefit: benefitSchema, track: trackSchema, module: moduleSchema, activity: activitySchema }[kind]).parse(input);
  const id = v.id ?? randomUUID();
  const table = { benefit: "member_benefit", track: "member_learning_track", module: "member_learning_module", activity: "member_learning_activity" }[kind];
  let revision = "";
  await sql.begin(async tx => {
    // Account may have been revoked since rendering. Repeat authorization under a lock.
    const admins = await tx`select id from "user" where id=${actor.id} and role='admin' and blocked=false for share`;
    if (!admins.length) throw Error("Administração indisponível para esta conta.");
    if (v.id) {
      const [previous] = await tx`select md5(to_jsonb(record)::text) as revision from ${tx(table)} record where id=${id} for update`;
      if (!v.revision || !previous || previous.revision !== v.revision) {
        throw new DeliverableConflictError("Esta ficha mudou em outra edição. Seus campos foram preservados; copie o que deseja manter e recarregue a página antes de revisar e salvar.");
      }
    }
    if (kind === "benefit") {
      const b = benefitSchema.parse(input);
      if (b.categoryId) {
        const [category] = await tx`select status from member_benefit_category where id=${b.categoryId} for share`;
        if (!category || b.status === "published" && category.status !== "published") throw Error("Confira a categoria antes de publicar a oferta.");
      }
      await tx`insert into member_benefit(id,name,partner,description,evidence_url,eligibility,availability,starts_at,ends_at,verified_at,redemption,redemption_url,status,sort_order,reviewed_by,audience)
        values(${id},${b.name},${b.partner},${b.description},${b.evidenceUrl},${b.eligibility},${b.availability},${b.startsAt ? new Date(b.startsAt).toISOString() : null},${b.endsAt ? new Date(b.endsAt).toISOString() : null},${b.verifiedOn ? new Date(b.verifiedOn).toISOString() : null},${b.redemption},${b.redemptionUrl},${b.status},${b.sortOrder},${actor.id},${b.audience ?? "geral"})
        on conflict(id) do update set name=excluded.name,partner=excluded.partner,description=excluded.description,evidence_url=excluded.evidence_url,
          eligibility=excluded.eligibility,availability=excluded.availability,starts_at=excluded.starts_at,ends_at=excluded.ends_at,verified_at=excluded.verified_at,redemption=excluded.redemption,
          redemption_url=excluded.redemption_url,status=excluded.status,sort_order=excluded.sort_order,reviewed_by=excluded.reviewed_by,reviewed_at=now(),
          audience=coalesce(${b.audience ?? null},member_benefit.audience)`;
      // Optional for old callers; the current benefits editor writes metadata
      // atomically with the existing editorial row and revision check.
      if (b.categoryId !== undefined) await tx`insert into member_benefit_organization(benefit_id,category_id,provider_label,provider_access,source_url)
        values(${id},${b.categoryId || null},${b.providerLabel ?? ""},${b.providerAccess ?? "unconfirmed"},${b.sourceUrl ?? ""})
        on conflict(benefit_id) do update set category_id=excluded.category_id,provider_label=excluded.provider_label,provider_access=excluded.provider_access,source_url=excluded.source_url`;
    } else if (kind === "track") {
      const t = trackSchema.parse(input);
      await tx`insert into member_learning_track(id,name,description,status,sort_order,reviewed_by) values(${id},${t.name},${t.description},${t.status},${t.sortOrder},${actor.id})
        on conflict(id) do update set name=excluded.name,description=excluded.description,status=excluded.status,sort_order=excluded.sort_order,reviewed_by=excluded.reviewed_by,reviewed_at=now()`;
    } else if (kind === "module") {
      const m = moduleSchema.parse(input);
      await tx`insert into member_learning_module(id,track_id,name,description,deliverable,status,sort_order,reviewed_by) values(${id},${m.trackId},${m.name},${m.description},${m.deliverable},${m.status},${m.sortOrder},${actor.id})
        on conflict(id) do update set track_id=excluded.track_id,name=excluded.name,description=excluded.description,deliverable=excluded.deliverable,status=excluded.status,sort_order=excluded.sort_order,reviewed_by=excluded.reviewed_by,reviewed_at=now()`;
    } else {
      const a = activitySchema.parse(input);
      await tx`insert into member_learning_activity(id,module_id,name,instructions,resource_url,status,sort_order,reviewed_by) values(${id},${a.moduleId},${a.name},${a.instructions},${a.resourceUrl},${a.status},${a.sortOrder},${actor.id})
        on conflict(id) do update set module_id=excluded.module_id,name=excluded.name,instructions=excluded.instructions,resource_url=excluded.resource_url,status=excluded.status,sort_order=excluded.sort_order,reviewed_by=excluded.reviewed_by,reviewed_at=now()`;
    }
    await tx`insert into member_deliverable_audit(id,actor_id,entity_type,entity_id,action,status) values(${randomUUID()},${actor.id},${kind},${id},${v.id ? "update" : "create"},${v.status})`;
    const [saved] = await tx`select md5(to_jsonb(record)::text) as revision from ${tx(table)} record where id=${id}`;
    revision = String(saved.revision);
  });
  return { id, revision };
}
