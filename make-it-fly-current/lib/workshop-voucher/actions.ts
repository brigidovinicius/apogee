"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireSignedInMember } from "@/lib/members/dal";
import { getAuth } from "@/lib/members/auth";
import { getSql } from "@/lib/members/db";
import { applicationOrigin, memberMailAvailable } from "@/lib/members/mail";
import { consumeRateLimit } from "@/lib/members/rate-limit";
import { parseVoucherGuests, parseVoucherLinks, voucherImport, VoucherInputError, VOUCHER_ADMIN_PATH, VOUCHER_PATH } from "./input";
import { voucherConfigured } from "./secrets";
import { linkVoucherCode, releaseVoucherBatch, releaseVoucherGuest, revokeVoucherGuest, saveVoucherGuests, saveVoucherStock, sendVoucherNotices } from "./store";

export type VoucherActionResult = { ok?: boolean; message?: string };

export async function manageVoucherAction(_: VoucherActionResult, form: FormData): Promise<VoucherActionResult> {
  const admin = await requireAdmin(VOUCHER_ADMIN_PATH);
  if (!voucherConfigured()) return { message: "Configure a chave do workshop antes de continuar." };
  const revision = String(form.get("revision") ?? "");
  if (!/^[a-f0-9-]{36}$/i.test(revision)) return { message: "Atualize a página e tente novamente." };
  let message: string;

  try {
    switch (form.get("operation")) {
      case "stock":
        await saveVoucherStock(admin.id, revision, parseVoucherLinks(await voucherImport(form)));
        message = "Os 50 links foram armazenados.";
        break;
      case "guests":
        await saveVoucherGuests(admin.id, revision, parseVoucherGuests(await voucherImport(form)));
        message = "Lista carregada. Confira os e-mails antes de liberar.";
        break;
      case "release":
        if (form.get("confirm") !== "on") throw new VoucherInputError("Confirme a lista de contemplados.");
        await releaseVoucherBatch(admin.id, revision);
        message = "O lote foi liberado em Benefícios.";
        break;
      case "release-guest": {
        const result = await releaseVoucherGuest(admin.id, form.get("email"));
        message = result.already ? `Já estava liberado (voucher ${result.slot}).` : `Liberado: voucher ${result.slot}.`;
        break;
      }
      case "revoke-guest":
        await revokeVoucherGuest(admin.id, form.get("email"));
        message = "Liberação desfeita. O link voltou para o estoque.";
        break;
      case "notify":
        if (form.get("confirm") !== "on") throw new VoucherInputError("Confirme o envio aos contemplados.");
        if (!memberMailAvailable()) throw new VoucherInputError("O serviço de e-mail está indisponível.");
        await sendVoucherNotices(admin.id);
        message = "O provedor aceitou os avisos do workshop.";
        break;
      default:
        return { message: "Ação inválida." };
    }
  } catch (error) {
    return { message: error instanceof VoucherInputError ? error.message : "A Apogee não confirmou a operação. Atualize a página e confira o estado do lote." };
  }
  revalidatePath(VOUCHER_ADMIN_PATH);
  revalidatePath(VOUCHER_PATH);
  return { ok: true, message };
}

export async function linkVoucherAction(_: VoucherActionResult, form: FormData): Promise<VoucherActionResult> {
  const member = await requireSignedInMember(VOUCHER_PATH);
  const code = form.get("codigo");
  if (!voucherConfigured() || typeof code !== "string" || code.length > 40) return { message: "Confira o código recebido por e-mail." };
  try {
    if (!await consumeRateLimit(`workshop-voucher-code:${member.id}`, 12, 600)) {
      return { message: "Aguarde alguns minutos antes de tentar novamente." };
    }
    if (!await linkVoucherCode(member.id, code)) return { message: "Este código está indisponível. Confira o e-mail do evento ou fale com a equipe." };
  } catch {
    return { message: "Não foi possível confirmar o código agora. Tente novamente." };
  }
  revalidatePath(VOUCHER_PATH);
  return { ok: true, message: "Voucher vinculado à sua conta." };
}

export async function verifyVoucherEmailAction(): Promise<VoucherActionResult> {
  const member = await requireSignedInMember(VOUCHER_PATH);
  if (!voucherConfigured()) return { message: "O voucher está temporariamente indisponível." };
  try {
    if (!await consumeRateLimit(`workshop-voucher-email:${member.id}`, 2, 600)) {
      return { message: "Aguarde alguns minutos e confira sua caixa de entrada." };
    }
    const [account] = await getSql()<{ email: string; email_verified: boolean }[]>`
      select email,email_verified from "user" where id=${member.id} and not blocked`;
    if (!account) return { message: "Entre na sua conta novamente." };
    if (!account.email_verified) await getAuth().api.sendVerificationEmail({
      headers: await headers(),
      body: { email: account.email, callbackURL: new URL(VOUCHER_PATH, applicationOrigin()).href },
    });
  } catch {
    return { message: "O envio não pôde ser confirmado agora. Você também pode usar o código do e-mail do workshop." };
  }
  revalidatePath(VOUCHER_PATH);
  return { ok: true, message: "Confira sua caixa de entrada e volte a esta página após confirmar." };
}
