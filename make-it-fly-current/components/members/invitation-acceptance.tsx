"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { NameInput } from "./name-input";
import { Field } from "./form-field";
import { nameSchema, NAME_ERROR } from "@/lib/members/validation";
import styles from "./members.module.css";

export function InvitationAcceptance({ token, initialName }: { token: string; initialName: string }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [role, setRole] = useState("");
  async function request(path: string, body: Record<string, string>) {
    setPending(true); setMessage("");
    try {
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (result.accepted) { setAccepted(true); setRole(result.role); setMessage("Convite aceito. Seu acesso foi atualizado."); }
      else setMessage(result.message ?? "Não foi possível concluir a operação.");
    } catch { setMessage("Não foi possível confirmar a operação. Tente novamente."); }
    finally { setPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get("name");
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) { setMessage(NAME_ERROR); return; }
    await request("/api/members/invitations", { action: "accept", token, name: parsed.data });
  }
  return <>
    {message && <p role="status" aria-live="polite">{message}</p>}
    {accepted ? <><Link href="/membros">Ir para a área de membros</Link>{role === "admin" && <p><Link href="/admin">Abrir administração</Link></p>}</> : <>
      <p>Se ainda não confirmou seu e-mail, solicite a verificação. Após abrir o e-mail, volte a esta página e aceite o convite.</p>
      <button className={styles.secondary} disabled={pending} onClick={() => request("/api/members/verification", { next: `/membros/convite?token=${token}` })}>Verificar meu e-mail</button>
      <form className={styles.form} onSubmit={submit}>
        <Field name="name" label="Confirme seu nome" hint="De 1 a 100 caracteres, sem links ou e-mails.">
          {(props) => <NameInput {...props} defaultValue={initialName} />}
        </Field>
        <button className={styles.primary} disabled={pending}>{pending ? "Confirmando…" : "Aceitar convite"}</button>
      </form>
    </>}
  </>;
}
