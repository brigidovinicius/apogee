"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useActionState, useState } from "react";
import { updateProfile, type FormState } from "@/app/membros/actions";
import { useFormErrorFocus } from "@/components/ui/use-form-error-focus";
import { memberAvatarUrl } from "@/lib/members/avatar-url";
import { AvatarInitials } from "./avatar-initials";
import { Field, FormMessage } from "./form-field";
import { NameInput } from "./name-input";
import styles from "./members.module.css";

function AvatarEditor({ name, userId, initialImage }: { name: string; userId: string; initialImage: string | null }) {
  const router = useRouter();
  const [image, setImage] = useState(initialImage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("image") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) { setMessage("Selecione uma foto."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setMessage("Escolha uma foto JPEG, PNG ou WebP de até 5 MB.");
      return;
    }
    setBusy(true);
    setMessage(undefined);
    try {
      const form = new FormData();
      form.set("image", file);
      const response = await fetch("/api/membros/avatar", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a foto.");
      setImage(result.url);
      if (input) input.value = "";
      setMessage("Foto atualizada.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar a foto.");
    } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch("/api/membros/avatar", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível remover a foto.");
      setImage(null);
      setMessage("Foto removida.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    } finally { setBusy(false); }
  }

  return (
    <div className={styles.avatarEditor}>
      <AvatarInitials name={name} userId={userId} image={image} size="large" />
      <div>
        <p className={styles.avatarEditorTitle}>Foto de perfil</p>
        <p className={styles.hint}>JPEG, PNG ou WebP, até 5 MB. A foto aparece para outros membros.</p>
        <form onSubmit={upload} className={styles.avatarUploadForm}>
          <label htmlFor="profile-image">Escolher foto</label>
          <input id="profile-image" name="image" type="file" accept="image/jpeg,image/png,image/webp" />
          <button className={styles.primary} type="submit" disabled={busy}>{busy ? "Aguarde…" : "Enviar foto"}</button>
        </form>
        {memberAvatarUrl(image, userId) ? (
          <button className={styles.linkButton} type="button" onClick={remove} disabled={busy}>Remover foto</button>
        ) : null}
        {message ? <p role="status" className={styles.hint}>{message}</p> : null}
      </div>
    </div>
  );
}

export function ProfileForm({ name, userId, bio, image }: { name: string; userId: string; bio: string; image: string | null }) {
  const [state, action, pending] = useActionState(updateProfile, {} as FormState);
  const formRef = useFormErrorFocus(state);
  return (
    <>
    <AvatarEditor name={name} userId={userId} initialImage={image} />
    <form ref={formRef} className={styles.form} action={action} noValidate>
      <FormMessage message={state.message} />
      <Field name="name" label="Nome" error={state.errors?.name}>
        {(props) => (
          <NameInput {...props} defaultValue={state.values?.name ?? name} />
        )}
      </Field>
      <Field name="bio" label="Bio" error={state.errors?.bio} hint="Até 500 caracteres. Conte o que você está construindo.">
        {(props) => <textarea {...props} name="bio" rows={5} maxLength={500} defaultValue={state.values?.bio ?? bio} />}
      </Field>
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar perfil"} <span aria-hidden>→</span>
        </button>
      </div>
    </form>
    </>
  );
}
