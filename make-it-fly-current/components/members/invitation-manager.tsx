"use client";
import { useState, type FormEvent } from "react";
import styles from "@/components/admin/admin.module.css";

type Invite = { id: string; email: string; role: string; status: string; delivery: string; expiresAt: string };
const statuses: Record<string, string> = { pending: "Pendente", accepted: "Aceito", expired: "Expirado", revoked: "Revogado" };
const delivery: Record<string, string> = { sending: "Envio em andamento ou interrompido", provider_accepted: "Envio aceito pelo provedor", unconfirmed: "Envio não confirmado" };
export function InvitationManager({ initialInvitations, canManageAdmins, mailAvailable }: {
  initialInvitations: Invite[]; canManageAdmins: boolean; mailAvailable: boolean;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function operate(body: Record<string, string>) {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/api/members/invitations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      setMessage(result.message ?? "Operação concluída.");
      const refresh = await fetch("/api/members/invitations", { cache: "no-store" });
      if (refresh.ok) setInvitations((await refresh.json()).invitations);
    } catch { setMessage("Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente."); }
    finally { setPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await operate({ action: "create", email: String(form.get("email")), role: String(form.get("role")) });
  }
  return <>
    {!mailAvailable && <p role="status">O envio de e-mail está indisponível. Configure o provedor para emitir ou reenviar convites.</p>}
    <form onSubmit={submit} className={styles.filters}>
      <label className={styles.field}><span>E-mail do destinatário</span><input name="email" type="email" required maxLength={254} /></label>
      <label className={styles.field}><span>Perfil</span><select name="role"><option value="member">Membro</option>{canManageAdmins && <option value="admin">Administrador</option>}</select></label>
      <button className={styles.button} disabled={pending || !mailAvailable}>Enviar convite</button>
    </form>
    {message && <p role="status" aria-live="polite">{message}</p>}
    <p>“Envio aceito pelo provedor” confirma a submissão do e-mail. O recebimento depende da caixa do destinatário. Reenviar invalida o link anterior.</p>
    <p>Mostrando até os 100 convites mais recentes que você pode gerenciar.</p>
    <ul className={styles.userList}>{invitations.map((invite) => <li key={invite.id} className={styles.surfaceHeader}>
      <div><strong>{invite.email}</strong><p>{invite.role === "admin" ? "Administrador" : "Membro"} · {statuses[invite.status]}</p>
        <p>{delivery[invite.delivery]} · Validade: {new Date(invite.expiresAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p></div>
      <div>{["pending", "expired"].includes(invite.status) && <>
        <button className={styles.button} disabled={pending || !mailAvailable} onClick={() => operate({ action: "resend", id: invite.id })}>Reenviar</button>{" "}
        <button className={styles.button} disabled={pending} onClick={() => operate({ action: "revoke", id: invite.id })}>Revogar</button>
      </>}</div>
    </li>)}</ul>
    {!invitations.length && <p>Nenhum convite encontrado.</p>}
  </>;
}
