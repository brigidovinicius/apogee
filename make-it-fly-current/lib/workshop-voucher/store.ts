import "server-only";
import { randomUUID } from "node:crypto";
import type { TransactionSql } from "postgres";
import { getSql } from "@/lib/members/db";
import { applicationOrigin, sendMemberMailBatch } from "@/lib/members/mail";
import { VOUCHER_LIMIT, VOUCHER_PATH, VoucherInputError, voucherEmail, voucherUrl } from "./input";
import { sealVoucher, unsealVoucher, voucherCode, voucherCodeHash } from "./secrets";

type Assignment = {
  slot: number;
  email: string;
  linked_at: Date | null;
  opened_at: Date | null;
};

type Batch = {
  revision: string;
  released_at: Date | null;
  notice_started_at: Date | null;
  notice_accepted_at: Date | null;
};

type AccountMatch = { member_id: string | null; slot: number };

async function editableBatch(tx: TransactionSql, actor: string) {
  const [admin] = await tx`select id from "user" where id=${actor} and role='admin' and not blocked for share`;
  if (!admin) throw new VoucherInputError("Acesso administrativo indisponível.");
  const [batch] = await tx<Batch[]>`select * from workshop_voucher_batch where singleton for update`;
  if (!batch) throw new Error("Lote de vouchers ausente.");
  return batch;
}

async function stocked(tx: TransactionSql) {
  const [row] = await tx<{ count: number }[]>`select count(*)::int as count from workshop_voucher_stock`;
  return row.count;
}

export async function adminVoucherStatus() {
  const sql = getSql();
  const [batch] = await sql<Batch[]>`select * from workshop_voucher_batch where singleton`;
  const [stock] = await sql<{ count: number }[]>`select count(*)::int as count from workshop_voucher_stock`;
  const guests = await sql<Assignment[]>`select slot,email,linked_at,opened_at from workshop_voucher_assignment order by slot`;
  if (!batch) throw new Error("Lote de vouchers ausente.");
  return { batch, stock: stock.count, guests };
}

export async function saveVoucherStock(actor: string, revision: string, links: string[]) {
  const stock = links.map((url, index) => ({ slot: index + 1, url_encrypted: sealVoucher(url, index + 1) }));
  await getSql().begin(async tx => {
    const batch = await editableBatch(tx, actor);
    if (batch.released_at || batch.revision !== revision) throw new VoucherInputError("O lote mudou. Atualize a página.");
    await tx`insert into workshop_voucher_stock ${tx(stock)} on conflict (slot) do update set url_encrypted=excluded.url_encrypted`;
    await tx`update workshop_voucher_batch set revision=${randomUUID()} where singleton`;
  });
}

export async function saveVoucherGuests(actor: string, revision: string, emails: string[]) {
  const guests = emails.map((email, index) => {
    const nonce = randomUUID();
    return { slot: index + 1, email, proof_nonce: nonce, proof_hash: voucherCodeHash(voucherCode(nonce)) };
  });
  await getSql().begin(async tx => {
    const batch = await editableBatch(tx, actor);
    if (batch.released_at || batch.revision !== revision) throw new VoucherInputError("O lote mudou. Atualize a página.");
    if (await stocked(tx) !== VOUCHER_LIMIT) throw new VoucherInputError("Carregue os 50 links primeiro.");
    await tx`delete from workshop_voucher_assignment`;
    await tx`insert into workshop_voucher_assignment ${tx(guests)}`;
    await tx`update workshop_voucher_batch set revision=${randomUUID()} where singleton`;
  });
}

export async function releaseVoucherBatch(actor: string, revision: string) {
  await getSql().begin(async tx => {
    const batch = await editableBatch(tx, actor);
    if (batch.released_at || batch.revision !== revision) throw new VoucherInputError("O lote mudou. Atualize a página.");
    const [guest] = await tx`select slot from workshop_voucher_assignment limit 1`;
    if (!guest || await stocked(tx) !== VOUCHER_LIMIT) throw new VoucherInputError("Carregue os links e os contemplados antes de liberar.");
    await tx`update workshop_voucher_batch set released_at=now(), released_by=${actor} where singleton`;
  });
}

// Reception flow: each click reserves the lowest free link for one e-mail. The batch
// row lock serializes clicks, so two people never share a slot.
export async function releaseVoucherGuest(actor: string, rawEmail: unknown): Promise<{ slot: number; already: boolean }> {
  const email = voucherEmail(rawEmail);
  return getSql().begin(async tx => {
    await editableBatch(tx, actor);
    if (await stocked(tx) !== VOUCHER_LIMIT) throw new VoucherInputError("Carregue os 50 links antes de liberar.");
    const [existing] = await tx<{ slot: number }[]>`select slot from workshop_voucher_assignment where email=${email}`;
    if (existing) return { slot: existing.slot, already: true };
    const [free] = await tx<{ slot: number }[]>`select s.slot from workshop_voucher_stock s
      where not exists (select 1 from workshop_voucher_assignment a where a.slot=s.slot) order by s.slot limit 1`;
    if (!free) throw new VoucherInputError("Os 50 vouchers já foram liberados.");
    const nonce = randomUUID();
    await tx`insert into workshop_voucher_assignment ${tx({ slot: free.slot, email, proof_nonce: nonce, proof_hash: voucherCodeHash(voucherCode(nonce)) })}`;
    await tx`update workshop_voucher_batch set released_at=coalesce(released_at,now()), released_by=coalesce(released_by,${actor}) where singleton`;
    return { slot: free.slot, already: false };
  });
}

// Undo is only possible while the link was never shown to anyone.
export async function revokeVoucherGuest(actor: string, rawEmail: unknown): Promise<void> {
  const email = voucherEmail(rawEmail);
  await getSql().begin(async tx => {
    await editableBatch(tx, actor);
    const removed = await tx`delete from workshop_voucher_assignment
      where email=${email} and member_id is null and linked_at is null and opened_at is null returning slot`;
    if (!removed.length) throw new VoucherInputError("Este voucher já foi vinculado ou aberto e não pode ser desfeito.");
  });
}

export async function sendVoucherNotices(actor: string) {
  const sql = getSql();
  const notice = await sql.begin(async tx => {
    const batch = await editableBatch(tx, actor);
    if (!batch.released_at) throw new VoucherInputError("Libere o lote antes de enviar os avisos.");
    if (batch.notice_accepted_at) return null;
    if (batch.notice_started_at && Date.now() - new Date(batch.notice_started_at).getTime() >= 23 * 60 * 60 * 1000) {
      throw new VoucherInputError("Confira o envio no provedor antes de tentar novamente. O prazo para repetir com segurança passou.");
    }
    await tx`update workshop_voucher_batch set notice_started_at=coalesce(notice_started_at,now()) where singleton`;
    const guests = await tx<{ email: string; proof_nonce: string }[]>`select email, proof_nonce from workshop_voucher_assignment order by slot`;
    return { revision: batch.revision, guests };
  });
  if (!notice) return;
  const destination = new URL(VOUCHER_PATH, applicationOrigin()).href;
  const messages = notice.guests.map(({ email, proof_nonce }) => {
    const code = voucherCode(proof_nonce).match(/.{6}/g)!.join("-");
    return {
      to: email,
      subject: "Seu voucher da OpenAI está reservado na Apogee",
      text: `Olá! Seu check-in no Codex Community Workshop garantiu uma reserva de voucher da OpenAI.

Acesse seu voucher na Apogee: ${destination}

Entre ou crie uma conta gratuita. Se o e-mail da sua conta for diferente do e-mail do ingresso, ou ainda não estiver confirmado, use o código individual abaixo na página do voucher.

${code}

Guarde o código para você. O link individual de ativação fica na área de Benefícios da Apogee.`,
    };
  });
  await sendMemberMailBatch(messages, `workshop-voucher-${notice.revision}`);
  await sql`update workshop_voucher_batch set notice_accepted_at=coalesce(notice_accepted_at,now())
    where singleton and revision=${notice.revision}`;
}

export async function memberVoucherState(memberId: string) {
  const [state] = await getSql()<{
    released: boolean;
    canOpen: boolean;
    verified: boolean;
    opened: boolean;
  }[]>`
    select b.released_at is not null as released, u.email_verified as verified,
      a.slot is not null as "canOpen", a.opened_at is not null as opened
    from workshop_voucher_batch b join "user" u on u.id=${memberId} and not u.blocked
    left join lateral (
      select slot, opened_at from workshop_voucher_assignment
      where member_id=u.id or (linked_at is null and u.email_verified and email=lower(u.email))
      order by (member_id is not null) desc limit 1
    ) a on b.released_at is not null where b.singleton`;
  return state ?? { released: false, canOpen: false, verified: false, opened: false };
}

export async function linkVoucherCode(memberId: string, rawCode: string): Promise<boolean> {
  const code = rawCode.toLowerCase().replace(/[\s-]/g, "");
  if (!/^[a-f0-9]{24}$/.test(code)) return false;
  return getSql().begin(async tx => {
    const [user] = await tx`select id from "user" where id=${memberId} and not blocked for update`;
    if (!user) return false;
    const [linked] = await tx<AccountMatch[]>`select slot, member_id from workshop_voucher_assignment where member_id=${memberId}`;
    const [candidate] = await tx<AccountMatch[]>`
      select a.slot,a.member_id from workshop_voucher_assignment a
      join workshop_voucher_batch b on b.singleton and b.released_at is not null
      where a.proof_hash=${voucherCodeHash(code)} and (a.linked_at is null or a.member_id=${memberId})
      for update of a`;
    if (!candidate || (linked && linked.slot !== candidate.slot)) return false;
    await tx`update workshop_voucher_assignment set member_id=${memberId}, linked_at=coalesce(linked_at,now()) where slot=${candidate.slot}`;
    return true;
  });
}

export async function openMemberVoucher(memberId: string): Promise<string | null> {
  return getSql().begin(async tx => {
    const [user] = await tx<{ email: string; email_verified: boolean }[]>`
      select email,email_verified from "user" where id=${memberId} and not blocked for update`;
    if (!user) return null;
    const [assignment] = await tx<{ slot: number; url_encrypted: string }[]>`
      select a.slot,s.url_encrypted from workshop_voucher_assignment a
      join workshop_voucher_batch b on b.singleton and b.released_at is not null
      join workshop_voucher_stock s on s.slot=a.slot
      where a.member_id=${memberId}
        or (a.linked_at is null and ${user.email_verified} and a.email=lower(${user.email}))
      order by (a.member_id is not null) desc limit 1 for update of a`;
    if (!assignment) return null;
    const url = voucherUrl(unsealVoucher(assignment.url_encrypted, assignment.slot));
    await tx`update workshop_voucher_assignment
      set member_id=${memberId}, linked_at=coalesce(linked_at,now()), opened_at=coalesce(opened_at,now())
      where slot=${assignment.slot}`;
    return url;
  });
}
