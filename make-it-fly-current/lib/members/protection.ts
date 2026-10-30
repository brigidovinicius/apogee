import "server-only";
import {randomUUID} from "node:crypto";
import {getSql} from "./db";

export const PROTECTION_POLICY_VERSION="2026-10-30";
export const supervisedRegistrationEnabled=()=>process.env.MEMBERS_SUPERVISED_REGISTRATION_ENABLED==="true";
export async function adultAccess(userId:string) {
  if(!supervisedRegistrationEnabled())return true;
  const [row]=await getSql()`select u.role,u.blocked,u.email_verified,r.status from "user" u
    left join member_adult_review r on r.user_id=u.id where u.id=${userId}`;
  return !!row && !row.blocked && (row.role==='admin' || row.email_verified && row.status==='approved');
}
export async function protectionOverview(userId:string) {
  const [row]=await getSql()`select u.email_verified,u.adult_declared,r.status from "user" u
    left join member_adult_review r on r.user_id=u.id where u.id=${userId}`;
  const dependents=await getSql()`select id,nickname,age_band,relationship,status,consent_at from member_dependent where guardian_id=${userId} order by consent_at`;
  return {emailVerified:!!row?.email_verified,adultDeclared:!!row?.adult_declared,status:row?.status?String(row.status):null,dependents};
}
export async function requestAdultReview(userId:string,declared:boolean) {
  if(!supervisedRegistrationEnabled()||!declared)throw Error('Confirme que esta conta pertence a uma pessoa maior de 18 anos.');
  await getSql().begin(async tx=>{
    const [user]=await tx`select id,email_verified,blocked from "user" where id=${userId} for update`;
    if(!user?.email_verified||user.blocked)throw Error('Confirme seu e-mail antes de solicitar a revisão.');
    await tx`update "user" set adult_declared=true where id=${userId}`;
    await tx`insert into member_adult_review(user_id) values (${userId}) on conflict(user_id) do update
      set status=case when member_adult_review.status='approved' then 'approved' else 'pending' end,
      requested_at=now()`;
    await tx`insert into member_protection_audit(actor_id,subject_id,action) values (${userId},${userId},'adult_review_requested')`;
  });
}
export async function requestDependent(userId:string,input:{nickname:string;ageBand:string;relationship:string;consent:boolean}) {
  if(!supervisedRegistrationEnabled()||!input.consent||!['under_12','12_15','16_17'].includes(input.ageBand)||!['parent','legal_guardian'].includes(input.relationship)||
    !/^[\p{L}\p{N} .'-]{2,40}$/u.test(input.nickname.trim()))throw Error('Confira o apelido, a faixa etária, o vínculo e a autorização.');
  return getSql().begin(async tx=>{
    const [guardian]=await tx`select u.email_verified,u.blocked,u.role,r.status from "user" u left join member_adult_review r on r.user_id=u.id where u.id=${userId} for update of u`;
    if(!guardian?.email_verified||guardian.blocked||!(guardian.role==='admin'||guardian.status==='approved'))throw Error('A conta do responsável precisa estar verificada e aprovada.');
    const [{count}]=await tx`select count(*)::int as count from member_dependent where guardian_id=${userId} and status in ('pending','approved')`;
    if(count>=10)throw Error('O limite de solicitações ativas foi atingido. Entre em contato com a equipe.');
    const id=randomUUID();
    await tx`insert into member_dependent(id,guardian_id,nickname,age_band,relationship,consent_version)
      values (${id},${userId},${input.nickname.trim()},${input.ageBand},${input.relationship},${PROTECTION_POLICY_VERSION})`;
    await tx`insert into member_protection_audit(actor_id,subject_id,action) values (${userId},${id},'dependent_consent_recorded')`;
    return id;
  });
}
export async function revokeDependent(userId:string,id:string) {
  if(!supervisedRegistrationEnabled())throw Error('Recurso indisponível.');
  await getSql().begin(async tx=>{
    const rows=await tx`update member_dependent set status='revoked' where id=${id} and guardian_id=${userId} and status<>'revoked' returning id`;
    if(!rows.length)throw Error('Solicitação não encontrada.');
    await tx`insert into member_protection_audit(actor_id,subject_id,action) values (${userId},${id},'dependent_consent_revoked')`;
  });
}
export async function reviewProtection(actorId:string,kind:string,id:string,approved:boolean,reference:string,checks:boolean) {
  if(!supervisedRegistrationEnabled()||!['adult','dependent'].includes(kind)||!checks||reference.trim().length<8||reference.length>160)throw Error('Registre a conferência e sua referência interna.');
  await getSql().begin(async tx=>{
    const [actor]=await tx`select role,blocked from "user" where id=${actorId} for update`;
    if(actor?.role!=='admin'||actor.blocked)throw Error('Acesso negado.');
    if(kind==='adult') {
      if(actorId===id)throw Error('A revisão da própria conta não é permitida.');
      const [user]=await tx`select email_verified,adult_declared,blocked from "user" where id=${id} for update`;
      if(!user?.email_verified||!user.adult_declared||user.blocked)throw Error('A conta não está pronta para revisão.');
      const rows=await tx`update member_adult_review set status=${approved?'approved':'rejected'},reviewed_at=now(),reviewer_id=${actorId},evidence_reference=${reference.trim()}
        where user_id=${id} returning user_id`;
      if(!rows.length)throw Error('Solicitação não encontrada.');
      if(!approved)await tx`update member_dependent set status='revoked' where guardian_id=${id} and status in ('pending','approved')`;
    }else {
      const [dependent]=await tx`select guardian_id,status from member_dependent where id=${id} for update`;
      if(!dependent||dependent.status==='revoked'||dependent.guardian_id===actorId)throw Error('Solicitação indisponível para esta revisão.');
      const [guardian]=await tx`select u.email_verified,u.blocked,u.role,r.status from "user" u left join member_adult_review r on r.user_id=u.id where u.id=${String(dependent.guardian_id)} for update of u`;
      if(!guardian?.email_verified||guardian.blocked||!(guardian.role==='admin'||guardian.status==='approved'))throw Error('O responsável precisa estar aprovado.');
      await tx`update member_dependent set status=${approved?'approved':'rejected'},reviewed_at=now(),reviewer_id=${actorId},evidence_reference=${reference.trim()} where id=${id}`;
    }
    await tx`insert into member_protection_audit(actor_id,subject_id,action) values (${actorId},${id},${kind+(approved?'_approved':'_rejected')})`;
  });
}
export async function protectionReviewQueue() {
  const adults=await getSql()`select r.user_id,u.email,u.name,r.status,r.requested_at from member_adult_review r join "user" u on u.id=r.user_id order by r.requested_at desc limit 100`;
  const dependents=await getSql()`select d.id,d.nickname,d.age_band,d.relationship,d.status,u.email as guardian_email from member_dependent d join "user" u on u.id=d.guardian_id order by d.consent_at desc limit 100`;
  return {adults,dependents};
}
