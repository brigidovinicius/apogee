import "server-only";
import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/members/db";
import { requireAdmin, requireMember, requireSignedInMember } from "@/lib/members/dal";
import { communityAccess } from "@/lib/billing/community-store";
import { benefitSchema, trackSchema, moduleSchema, activitySchema, progressSchema, type DeliverableKind } from "./validation";

export class DeliverableConflictError extends Error {}
export type Benefit = { id: string; name: string; partner: string; description: string; eligibility: string; availability: string; starts_at: Date | null; ends_at: Date | null; redemption: string; redemption_url: string; evidence_url?: string; revision?: string; status: string; sort_order: number };
export type Track = { id: string; name: string; description: string; status: string; sort_order: number; revision?: string };
export type LearningModule = Track & { track_id: string; deliverable: string };
export type Activity = { id: string; module_id: string; name: string; instructions: string; resource_url: string; status: string; sort_order: number; completed_at?: Date | null; revision?: string };
// Drizzle configures the shared postgres-js client to return raw timestamps.
// Normalize at the boundary so valid published benefits also render after auth.
const benefitDates = (b: Benefit): Benefit => ({ ...b, starts_at: b.starts_at ? new Date(b.starts_at) : null, ends_at: b.ends_at ? new Date(b.ends_at) : null });

export async function annualMember(next: string) {
  const member = await requireSignedInMember(next);
  const access = await communityAccess(member.id, process.env.STRIPE_MODE !== "test");
  if (access.active) await requireMember(next);
  return { member, access };
}

export async function memberBenefits() {
  const { member, access } = await annualMember("/membros/beneficios");
  if (!access.active) return { member, access, benefits: [] as Benefit[] };
  // Evidence and editor identifiers stay in administration, never member HTML/RSC.
  const benefits = await getSql()<Benefit[]>`select id,name,partner,description,eligibility,availability,starts_at,ends_at,redemption,redemption_url,status,sort_order
    from member_benefit where status='published' and starts_at<=now() and ends_at>now() order by sort_order,name,id`;
  return { member, access, benefits: benefits.map(benefitDates) };
}

export async function memberLearning() {
  const { member, access } = await annualMember("/membros/trilha");
  if (!access.active) return { member, access, tracks: [] as Track[], modules: [] as LearningModule[], activities: [] as Activity[] };
  const sql = getSql();
  const tracks = await sql<Track[]>`select id,name,description,status,sort_order from member_learning_track where status='published' order by sort_order,name,id`;
  // Preparing modules disclose only their public title; no private unfinished material.
  const modules = await sql<LearningModule[]>`select m.id,m.track_id,m.name,m.status,m.sort_order,
      case when m.status='published' then m.description else '' end as description,
      case when m.status='published' then m.deliverable else '' end as deliverable
    from member_learning_module m join member_learning_track t on t.id=m.track_id
    where t.status='published' and m.status in ('published','preparing') order by m.sort_order,m.name,m.id`;
  const activities = await sql<Activity[]>`select a.id,a.module_id,a.name,a.instructions,a.resource_url,a.status,a.sort_order,p.completed_at
    from member_learning_activity a join member_learning_module m on m.id=a.module_id
    join member_learning_track t on t.id=m.track_id
    left join member_learning_progress p on p.activity_id=a.id and p.user_id=${member.id}
    where a.status='published' and m.status='published' and t.status='published' order by a.sort_order,a.name,a.id`;
  return { member, access, tracks, modules, activities };
}

export async function setLearningProgress(input: unknown) {
  const { member, access } = await annualMember("/membros/trilha");
  if (!access.active) throw Error("A Trilha exige assinatura anual vigente.");
  const v = progressSchema.parse(input), sql = getSql();
  // Recheck account/right/content inside the mutation. Never accept a user ID.
  return sql.begin(async tx => {
    await tx`select id from "user" where id=${member.id} for update`;
    const eligible = await tx`select 1 from community_subscription s join community_invoice i on i.subscription_id=s.id
      join "user" u on u.id=s.user_id where s.user_id=${member.id} and s.livemode=${process.env.STRIPE_MODE !== "test"}
      and u.blocked=false and i.status='paid' and i.fraud_review_required=false and i.period_start<=now() and i.period_end>now() limit 1`;
    if (!eligible.length) throw Error("A Trilha exige assinatura anual vigente.");
    const content = await tx`select a.id from member_learning_activity a join member_learning_module m on m.id=a.module_id
      join member_learning_track t on t.id=m.track_id where a.id=${v.activityId} and a.status='published' and m.status='published' and t.status='published' for share of a,m,t`;
    if (!content.length) throw Error("Atividade indisponível. Atualize a página.");
    if (v.completed) await tx`insert into member_learning_progress(user_id,activity_id) values(${member.id},${v.activityId}) on conflict do nothing`;
    else await tx`delete from member_learning_progress where user_id=${member.id} and activity_id=${v.activityId}`;
  });
}

export async function adminDeliverables() {
  await requireAdmin("/admin/trilha");
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
      await tx`insert into member_benefit(id,name,partner,description,evidence_url,eligibility,availability,starts_at,ends_at,redemption,redemption_url,status,sort_order,reviewed_by)
        values(${id},${b.name},${b.partner},${b.description},${b.evidenceUrl},${b.eligibility},${b.availability},${b.startsAt ? new Date(b.startsAt).toISOString() : null},${b.endsAt ? new Date(b.endsAt).toISOString() : null},${b.redemption},${b.redemptionUrl},${b.status},${b.sortOrder},${actor.id})
        on conflict(id) do update set name=excluded.name,partner=excluded.partner,description=excluded.description,evidence_url=excluded.evidence_url,
          eligibility=excluded.eligibility,availability=excluded.availability,starts_at=excluded.starts_at,ends_at=excluded.ends_at,redemption=excluded.redemption,
          redemption_url=excluded.redemption_url,status=excluded.status,sort_order=excluded.sort_order,reviewed_by=excluded.reviewed_by,reviewed_at=now()`;
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
