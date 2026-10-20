import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { canInvite } from "@/lib/admin/invitation-policy";
import { getSql } from "./db";
import { applicationOrigin, memberMailAvailable, sendMemberMail } from "./mail";
import { consumeRateLimit } from "./rate-limit";
import { emailSchema, nameSchema } from "./validation";

export class InvitationError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Tx = postgres.TransactionSql;
type Actor = { id: string; email: string; email_verified: boolean; role: string; blocked: boolean; can_manage_admins: boolean };
type Invitation = { id: string; email: string; role: "member" | "admin"; issuer_id: string; token_hash: string;
  status: "pending" | "accepted" | "revoked"; expires_at: Date | string; accepted_by: string | null; delivery: string; created_at: Date | string };
const invalid = () => new InvitationError(400, "Convite inválido, expirado ou indisponível.");
export function hashInvitationToken(token: unknown): string {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) throw invalid();
  return createHash("sha256").update(token).digest("hex");
}
function expiration(): Date {
  const hours = Number(process.env.MEMBERS_INVITATION_TTL_HOURS ?? 48);
  if (!Number.isFinite(hours) || hours < 1 || hours > 168) throw new Error("Validade de convite inválida.");
  return new Date(Date.now() + hours * 3600_000);
}
function allowed(actor: Actor | undefined, role: string) {
  if (!canInvite(actor && { role: actor.role, blocked: actor.blocked, canManageAdmins: actor.can_manage_admins }, role)) {
    throw new InvitationError(403, "Você não tem autorização para gerenciar estes convites.");
  }
}
async function actorForUpdate(tx: Tx, id: string): Promise<Actor | undefined> {
  const [actor] = await tx<Actor[]>`select id, email, email_verified, role, blocked, can_manage_admins from "user" where id = ${id} for update`;
  return actor;
}
async function limit(id: string, action: string, max = 20) {
  if (!(await consumeRateLimit(`invitation:${action}:${id}`, max, 3600))) {
    throw new InvitationError(429, "Muitas tentativas. Aguarde antes de tentar novamente.");
  }
}
async function event(tx: Tx, id: string, actorId: string, action: string) {
  await tx`insert into member_invitation_event (invitation_id, actor_id, action) values (${id}, ${actorId}, ${action})`;
}
function effectiveStatus(invite: Pick<Invitation, "status" | "expires_at">) {
  return invite.status === "pending" && new Date(invite.expires_at).getTime() <= Date.now() ? "expired" : invite.status;
}
async function deliver(invite: { id: string; email: string; role: string }, token: string, actorId: string) {
  const hash = hashInvitationToken(token);
  let confirmed = false;
  try {
    const url = new URL("/membros/convite", applicationOrigin());
    url.searchParams.set("token", token);
    await sendMemberMail({ to: invite.email, subject: "Seu convite para a Apogee",
      text: `Você recebeu um convite de ${invite.role === "admin" ? "administrador" : "membro"} da Apogee.\n\n${url.href}\n\nEntre ou crie sua conta com este e-mail, verifique o e-mail e confirme a aceitação. Abrir o link não concede acesso.`,
      key: `${invite.id}-${hash}` });
    confirmed = true;
  } catch {
    // Timeout é resultado incerto, não prova de falha de entrega. Sem logs de payload.
  }
  await getSql().begin(async (tx) => {
    const rows = await tx`update member_invitation set delivery = ${confirmed ? "provider_accepted" : "unconfirmed"}
      where id = ${invite.id} and token_hash = ${hash} and status = 'pending' returning id`;
    if (rows.length) await event(tx, invite.id, actorId, confirmed ? "provider_accepted" : "send_unconfirmed");
  });
  return { id: invite.id, sent: confirmed, message: confirmed
    ? "Envio aceito pelo provedor. O recebimento na caixa ainda não foi confirmado."
    : "Convite salvo, mas o envio não foi confirmado. Use Reenviar para tentar novamente." };
}

export async function createInvitation(actorId: string, email: string, role: "member" | "admin") {
  const recipient = emailSchema.parse(email);
  if (role !== "member" && role !== "admin") throw invalid();
  await limit(actorId, "manage");
  // Falha antes de criar um convite que não pode ser enviado.
  applicationOrigin();
  if (!memberMailAvailable()) throw new InvitationError(503, "Envio de e-mail indisponível. Configure o provedor antes de convidar.");
  const token = randomBytes(32).toString("hex");
  const id = randomUUID();
  const expires = expiration();
  await getSql().begin(async (tx) => {
    allowed(await actorForUpdate(tx, actorId), role);
    await tx`insert into member_invitation (id, email, role, issuer_id, token_hash, expires_at, delivery)
      values (${id}, ${recipient}, ${role}, ${actorId}, ${hashInvitationToken(token)}, ${expires.toISOString()}, 'sending')`;
    await event(tx, id, actorId, "created");
  });
  return deliver({ id, email: recipient, role }, token, actorId);
}

export async function listInvitations(actorId: string) {
  await limit(actorId, "list", 120);
  return getSql().begin(async (tx) => {
    const actor = await actorForUpdate(tx, actorId);
    allowed(actor, "member");
    const rows = await tx<Invitation[]>`select id, email, role, issuer_id, status, expires_at, accepted_by, delivery, created_at
      from member_invitation where role = 'member' or ${actor!.can_manage_admins} order by created_at desc limit 100`;
    return rows.map(({ id, email, role, issuer_id, expires_at, delivery, created_at, ...rest }) => ({
      id, email, role, issuerId: issuer_id, status: effectiveStatus({ status: rest.status, expires_at }),
      expiresAt: new Date(expires_at).toISOString(), createdAt: new Date(created_at).toISOString(), delivery,
    }));
  });
}

export async function resendInvitation(actorId: string, id: string) {
  await limit(actorId, "manage");
  applicationOrigin();
  if (!memberMailAvailable()) throw new InvitationError(503, "Envio de e-mail indisponível.");
  const token = randomBytes(32).toString("hex");
  const expires = expiration();
  const invite = await getSql().begin(async (tx) => {
    const [row] = await tx<Invitation[]>`select * from member_invitation where id = ${id} for update`;
    if (!row) throw invalid();
    const actors = await tx<Actor[]>`select id, email, email_verified, role, blocked, can_manage_admins from "user"
      where id in (${actorId}, ${row.issuer_id}) order by id for update`;
    allowed(actors.find((actor) => actor.id === actorId), row.role);
    // O emissor original continua sendo a autoridade vinculada ao convite.
    allowed(actors.find((actor) => actor.id === row.issuer_id), row.role);
    if (row.status !== "pending") throw invalid();
    await tx`update member_invitation set token_hash = ${hashInvitationToken(token)}, expires_at = ${expires.toISOString()}, delivery = 'sending' where id = ${id}`;
    await event(tx, id, actorId, "resent");
    return row;
  });
  return deliver(invite, token, actorId);
}

export async function revokeInvitation(actorId: string, id: string) {
  await limit(actorId, "manage");
  await getSql().begin(async (tx) => {
    const [invite] = await tx<Invitation[]>`select * from member_invitation where id = ${id} for update`;
    if (!invite) throw invalid();
    allowed(await actorForUpdate(tx, actorId), invite.role);
    if (invite.status === "accepted") throw invalid();
    if (invite.status === "revoked") return;
    await tx`update member_invitation set status = 'revoked' where id = ${id}`;
    await event(tx, id, actorId, "revoked");
  });
  return { message: "Convite revogado." };
}

export async function previewInvitation(token: string) {
  const hash = hashInvitationToken(token);
  const [invite] = await getSql()<Invitation[]>`select role, status, expires_at from member_invitation where token_hash = ${hash}`;
  if (!invite) throw invalid();
  return { role: invite.role, status: effectiveStatus(invite) };
}

export async function acceptInvitation(userId: string, token: string, name: string) {
  const parsedName = nameSchema.parse(name);
  const hash = hashInvitationToken(token);
  await limit(userId, "accept");
  return getSql().begin(async (tx) => {
    const [invite] = await tx<Invitation[]>`select * from member_invitation where token_hash = ${hash} for update`;
    if (!invite) throw invalid();
    // Ordem estável para evitar deadlock entre destinatários/emissores.
    const actors = await tx<Actor[]>`select id, email, email_verified, role, blocked, can_manage_admins from "user"
      where id in (${userId}, ${invite.issuer_id}) order by id for update`;
    const recipient = actors.find((actor) => actor.id === userId);
    if (!recipient || recipient.blocked || !recipient.email_verified || recipient.email.toLowerCase() !== invite.email.toLowerCase()) {
      throw new InvitationError(403, "Entre com o mesmo e-mail do convite e confirme a verificação do e-mail.");
    }
    if (invite.status === "accepted") {
      if (invite.accepted_by === userId) return { accepted: true, role: recipient.role, alreadyAccepted: true };
      throw invalid();
    }
    if (effectiveStatus(invite) !== "pending") throw invalid();
    allowed(actors.find((actor) => actor.id === invite.issuer_id), invite.role);
    // Não toca em account/senha/assinatura. Um convite de membro nunca rebaixa admin.
    const role = recipient.role === "admin" ? "admin" : invite.role;
    await tx`update "user" set role = ${role}, name = ${parsedName}, name_needs_confirmation = false, updated_at = now() where id = ${userId}`;
    await tx`update member_invitation set status = 'accepted', accepted_by = ${userId}, accepted_at = now() where id = ${invite.id}`;
    await event(tx, invite.id, userId, "accepted");
    return { accepted: true, role, alreadyAccepted: false };
  });
}
