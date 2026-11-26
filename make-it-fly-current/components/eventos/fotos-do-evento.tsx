"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { MAX_SELFIE_BYTES, PHOTO_API, PHOTO_CONSENT_API, PHOTO_OPT_IN, SELFIE_CONSENT, type AlbumPhoto, type PhotoOptIn } from "@/lib/eventos/catalogo";
import styles from "./eventos.module.css";

const errors: Record<string, string> = {
  consent_required: "Confirme sua autorização para usar a selfie na busca.",
  no_face: "Não encontramos um rosto. Tente uma selfie de frente, com boa iluminação.",
  multiple_faces: "Encontramos mais de um rosto. Envie uma selfie em que apareça só você.",
  invalid_image: "Não foi possível ler esta imagem. Selecione outra selfie.",
  invalid_format: "Escolha uma imagem JPEG ou PNG.",
  invalid_size: "Escolha uma imagem de até 8 MB.",
  upload_timeout: "O envio demorou demais. Tente novamente.",
  not_enrolled: "Sua busca está aguardando a preparação das fotos. Você já pode usar a galeria.",
  busy: "Outra busca está em andamento. Tente novamente em instantes.",
  rate_limit: "Você fez várias buscas em sequência. Aguarde um minuto para tentar de novo.",
  forbidden: "Sua conta perdeu o acesso ao álbum.",
};
const failure = "Não foi possível concluir a busca. Tente novamente em instantes.";
const PAGE_SIZE = 36;

export function FotosDoEvento({ album, browse, expires, initialOptIn }: {
  album: AlbumPhoto[]; browse: boolean; expires: string | null; initialOptIn: PhotoOptIn | null;
}) {
  const [updatedOptIn, setUpdatedOptIn] = useState<PhotoOptIn | null>(null);
  const optIn = updatedOptIn ?? initialOptIn;
  const [mode, setMode] = useState<"start" | "browse" | "results">("start");
  const [expanded, setExpanded] = useState(false);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<AlbumPhoto[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<AlbumPhoto | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const photos = mode === "browse" ? album : mode === "results" ? results : [];

  function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setSelfie(null);
    if (file.type !== "image/jpeg" && file.type !== "image/png") setError(errors.invalid_format);
    else if (!file.size || file.size > MAX_SELFIE_BYTES) setError(errors.invalid_size);
    else setSelfie(file);
    event.target.value = "";
  }

  function clear() {
    form.current?.reset();
    setSelfie(null);
    setConsent(false);
    setResults([]);
    setMode("start");
    setError("");
    setExpanded(false);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selfie || !consent || busy) return;
    setBusy(true);
    setError("");
    setMode("start");
    setResults([]);
    try {
      const response = await fetch(PHOTO_API, {
        method: "POST", headers: { "Content-Type": selfie.type, "X-Apogee-Consent": SELFIE_CONSENT },
        body: selfie, cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(errors[payload.error] ?? failure);
        return;
      }
      setResults(payload.photos);
      setMode("results");
      setVisible(PAGE_SIZE);
      setExpanded(false);
    } catch {
      setError(failure);
    } finally {
      setSelfie(null);
      setConsent(false);
      setBusy(false);
    }
  }

  async function changeOptIn(event: FormEvent<HTMLFormElement> | null, method: "POST" | "DELETE") {
    event?.preventDefault();
    if (busy || (method === "POST" && !consent)) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(PHOTO_CONSENT_API, { method, headers: { "X-Apogee-Consent": PHOTO_OPT_IN }, cache: "no-store" });
      const next = await response.json();
      if (!response.ok) {
        setError(errors[next.error] ?? "Não foi possível atualizar sua autorização. Tente novamente.");
        return;
      }
      clear();
      setUpdatedOptIn(next);
      setExpanded(method === "POST");
    } catch {
      setError("Não foi possível atualizar sua autorização. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function openPhoto(photo: AlbumPhoto) {
    setSelected(photo);
    dialog.current?.showModal();
  }

  return <section data-ap-card="" className={styles.panel} aria-labelledby="fotos-evento">
    <h2 id="fotos-evento" data-ap-title="">Fotos do evento</h2>
    {expires && <p>O álbum fica disponível até {expires}.</p>}
    <div className={styles.actions}>
      {optIn && <button type="button" data-ap-button="primary" disabled={busy} aria-expanded={expanded}
        onClick={() => {
          if (expanded) {
            setSelfie(null);
            setConsent(false);
          }
          setExpanded(!expanded);
          setError("");
        }}>Encontrar minhas fotos</button>}
      {browse && <button type="button" data-ap-button="secondary" disabled={busy} onClick={() => {
        clear(); setMode("browse"); setVisible(PAGE_SIZE);
      }}>Ver álbum completo</button>}
      {optIn?.granted && <button type="button" data-ap-button="secondary" disabled={busy}
        onClick={() => changeOptIn(null, "DELETE")}>Revogar autorização</button>}
      {mode === "results" && <button type="button" data-ap-button="secondary" disabled={busy} onClick={clear}>Limpar resultados</button>}
    </div>
    {expanded && optIn && !optIn.granted && <form className={styles.form} aria-busy={busy} onSubmit={event => changeOptIn(event, "POST")}>
      <p>A equipe vai selecionar somente o seu rosto nas fotos em que você aparece. As referências faciais são excluídas 30 dias após o aceite ou ao revogar a autorização.</p>
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={busy}
        onChange={event => setConsent(event.target.checked)} required />
        Autorizo a Apogee a processar meu rosto nas fotos deste evento para que eu possa encontrá-las com uma selfie.</label>
      <button type="submit" data-ap-button="secondary" disabled={busy || !consent}>Ativar busca nas minhas fotos</button>
    </form>}
    {expanded && optIn?.granted && !optIn.indexed && <p role="status">Você autorizou a busca. A equipe ainda precisa preparar suas fotos.</p>}
    {expanded && optIn?.indexed && <form ref={form} className={styles.form} onSubmit={search} aria-busy={busy}>
      <p>Use uma selfie em que apareça só você. A Apogee usa a imagem para esta busca e a descarta ao concluir a consulta.</p>
      <div className={styles.fileOptions}>
        <label>Tirar selfie <input type="file" accept="image/jpeg,image/png" capture="user" onChange={choose} disabled={busy} /></label>
        <label>Enviar selfie <input type="file" accept="image/jpeg,image/png" onChange={choose} disabled={busy} /></label>
      </div>
      {selfie && <p role="status">Selfie selecionada. Você já pode iniciar a busca.</p>}
      <label className={styles.consent}><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} required />
        Autorizo o uso biométrico da minha selfie para encontrar fotos neste evento.</label>
      <button type="submit" data-ap-button="secondary" disabled={busy || !selfie || !consent}>Buscar no álbum</button>
    </form>}
    {busy && <p role="status">Processando…</p>}
    {error && <p role="alert">{error}</p>}
    {mode !== "start" && <div className={styles.gallery}>
      <p role="status">{photos.length
        ? `${photos.length} ${photos.length === 1 ? "foto disponível" : "fotos disponíveis"}`
        : mode === "browse" ? "Nenhuma foto foi disponibilizada neste álbum." : "Não encontramos fotos com essa selfie. Tente outra imagem."}</p>
      {photos.length > 0 && <ul className={styles.grid} aria-label="Fotos do evento">
        {photos.slice(0, visible).map((photo, index) => <li key={photo.id}>
          <button type="button" className={styles.thumbnail} onClick={() => openPhoto(photo)} aria-label={`Visualizar foto ${index + 1}`}>
            {/* Images go through the signed member route without Next image caching. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.thumbnail} alt="" loading="lazy" />
          </button>
          <a href={photo.download} download>Baixar foto <span className="sr-only">{index + 1}</span></a>
        </li>)}
      </ul>}
      {visible < photos.length && <button type="button" data-ap-button="secondary" onClick={() => setVisible(visible + PAGE_SIZE)}>Carregar mais fotos</button>}
    </div>}
    <dialog ref={dialog} className={styles.dialog} aria-label="Visualização da foto" onClose={() => setSelected(null)}>
      {selected && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selected.thumbnail} alt="Foto do evento" />
        <div className={styles.actions}>
          <a href={selected.download} data-ap-button="primary" download>Baixar original</a>
          <button type="button" data-ap-button="secondary" onClick={() => dialog.current?.close()}>Fechar</button>
        </div>
      </>}
    </dialog>
  </section>;
}
