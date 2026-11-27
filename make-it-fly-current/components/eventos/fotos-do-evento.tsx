"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { PHOTO_API, PHOTO_CONSENT_API, PHOTO_OPT_IN, SELFIE_CONSENT, type AlbumPhoto, type PhotoOptIn } from "@/lib/eventos/catalogo";
import styles from "./eventos.module.css";

const errors: Record<string, string> = {
  consent_required: "Confirme sua autorização para usar a selfie na busca.",
  no_face: "Não encontramos um rosto. Tente uma selfie de frente, com boa iluminação.",
  multiple_faces: "Encontramos mais de um rosto. Tire uma selfie em que apareça só você.",
  invalid_image: "Não foi possível ler a imagem. Tire outra selfie.",
  invalid_format: "A câmera não gerou uma imagem compatível. Tente novamente.",
  invalid_size: "A selfie ficou grande demais para enviar. Tire outra foto.",
  upload_timeout: "O envio demorou demais. Tente novamente.",
  not_enrolled: "A busca ainda não está disponível para esta conta neste álbum.",
  busy: "Outra busca está em andamento. Tente novamente em instantes.",
  search_timeout: "Não foi possível concluir a busca a tempo. Tente novamente em instantes.",
  rate_limit: "Você fez várias buscas em sequência. Aguarde um minuto para tentar de novo.",
  forbidden: "Sua conta perdeu o acesso ao álbum.",
};
const failure = "Não foi possível concluir a busca. Tente novamente em instantes.";
const PAGE_SIZE = 36;
const SELFIE_EDGE = 1600;

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => track.stop());
}

function cameraError(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Permita o acesso à câmera no navegador para tirar a selfie.";
    if (error.name === "NotFoundError") return "Nenhuma câmera foi encontrada neste dispositivo.";
    if (error.name === "NotReadableError") return "A câmera está indisponível. Feche outros apps que possam estar usando a câmera e tente de novo.";
  }
  return "Não foi possível abrir a câmera. Tente novamente.";
}

export function FotosDoEvento({ album, browse, expires, selfieEnabled }: {
  album: AlbumPhoto[]; browse: boolean; expires: string | null; selfieEnabled: boolean;
}) {
  const [optIn, setOptIn] = useState<PhotoOptIn | null>(null);
  const [loadingOptIn, setLoadingOptIn] = useState(false);
  const [selfieValidated, setSelfieValidated] = useState(false);
  const [mode, setMode] = useState<"start" | "browse" | "results" | "saved">("start");
  const [expanded, setExpanded] = useState(false);
  const [camera, setCamera] = useState<"off" | "opening" | "preview">("off");
  const [cameraReady, setCameraReady] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<AlbumPhoto[]>([]);
  const [saved, setSaved] = useState<AlbumPhoto[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<AlbumPhoto | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream>(null);
  const cameraRequest = useRef(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const photos = mode === "browse" ? album : mode === "saved" ? saved : results;
  const selectedSaved = !!selected && saved.some(photo => photo.id === selected.id);
  const pending = busy || loadingOptIn;
  const selfieAction = optIn?.indexed ? "Buscar com meu rosto" : "Validar selfie";
  const captureAction = optIn?.indexed ? "Tirar selfie e buscar" : "Tirar selfie";

  const releaseCamera = useCallback(() => {
    cameraRequest.current++;
    stopStream(stream.current);
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }, []);

  const closeCamera = useCallback(() => {
    releaseCamera();
    setCamera("off");
    setCameraReady(false);
  }, [releaseCamera]);

  useEffect(() => {
    // A permissão vale para o documento. Saia do workshop com uma nova navegação.
    const leave = (event: MouseEvent) => {
      if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        !(event.target instanceof Element)) return;
      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self") ||
        link.origin !== window.location.origin || link.pathname === window.location.pathname) return;
      event.preventDefault();
      window.location.assign(link.href);
    };
    document.addEventListener("click", leave, true);
    window.addEventListener("pagehide", closeCamera);
    return () => {
      document.removeEventListener("click", leave, true);
      window.removeEventListener("pagehide", closeCamera);
      releaseCamera();
    };
  }, [closeCamera, releaseCamera]);

  async function openCamera() {
    setError("");
    setSelfieValidated(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("A câmera está indisponível neste navegador. Abra a página do workshop em um navegador que permita capturar fotos.");
      return;
    }

    const request = ++cameraRequest.current;
    setCamera("opening");
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      const preview = video.current;
      if (request !== cameraRequest.current || !preview) {
        stopStream(next);
        return;
      }
      stream.current = next;
      preview.srcObject = next;
      setCamera("preview");
      await preview.play();
    } catch (error) {
      if (request !== cameraRequest.current) return;
      closeCamera();
      setError(cameraError(error));
    }
  }

  async function toggleSearch() {
    if (expanded) {
      setExpanded(false);
      closeCamera();
      setConsent(false);
      setSelfieValidated(false);
      setError("");
      return;
    }
    setExpanded(true);
    setOptIn(null);
    setLoadingOptIn(true);
    setError("");
    try {
      const response = await fetch(PHOTO_CONSENT_API, { cache: "no-store" });
      const state = await response.json();
      if (response.ok) setOptIn(state);
      else setError("Não foi possível abrir a busca. Feche e tente novamente.");
    } catch {
      setError("Não foi possível abrir a busca. Feche e tente novamente.");
    } finally {
      setLoadingOptIn(false);
    }
  }

  function clear() {
    closeCamera();
    setConsent(false);
    setSelfieValidated(false);
    setResults([]);
    setMode("start");
    setError("");
    setExpanded(false);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!optIn?.granted || pending || camera === "opening") return;
    if (camera === "off") {
      await openCamera();
      return;
    }
    const preview = video.current;
    if (!cameraReady || !preview?.videoWidth || !preview.videoHeight) return;

    setBusy(true);
    setError("");
    setMode("start");
    setResults([]);
    setSelfieValidated(false);
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, SELFIE_EDGE / Math.max(preview.videoWidth, preview.videoHeight));
      canvas.width = Math.round(preview.videoWidth * scale);
      canvas.height = Math.round(preview.videoHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      context.drawImage(preview, 0, 0, canvas.width, canvas.height);
      closeCamera();

      const upload = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
      canvas.width = 0;
      if (!upload) throw new Error();

      let validateOnly = !optIn.indexed;
      if (validateOnly) {
        const availability = await fetch(PHOTO_CONSENT_API, { cache: "no-store" });
        if (!availability.ok) throw new Error();
        const state: PhotoOptIn = await availability.json();
        setOptIn(state);
        if (!state.granted) {
          setError(errors.consent_required);
          return;
        }
        validateOnly = !state.indexed;
      }

      const response = await fetch(validateOnly ? `${PHOTO_API}?modo=validar` : PHOTO_API, {
        method: "POST", headers: { "Content-Type": upload.type, "X-Apogee-Consent": SELFIE_CONSENT },
        body: upload, cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.error === "consent_required") setOptIn({ granted: false, indexed: false });
        if (payload.error === "not_enrolled") setOptIn({ granted: true, indexed: false });
        setError(errors[payload.error] ?? failure);
        return;
      }
      if (validateOnly) {
        if (payload.validated !== true) throw new Error();
        setSelfieValidated(true);
        return;
      }
      setResults(payload.photos);
      setMode("results");
      setVisible(PAGE_SIZE);
      setExpanded(false);
    } catch {
      closeCamera();
      setError(failure);
    } finally {
      setBusy(false);
    }
  }

  async function openGallery(view: "browse" | "saved") {
    if (pending) return;
    clear();
    setVisible(PAGE_SIZE);
    if (view === "browse") setMode(view);
    setBusy(true);
    setLoadingSaved(true);
    try {
      const response = await fetch(PHOTO_API, { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      setSaved(payload.photos);
      setMode(view);
    } catch {
      setError("Não foi possível abrir suas fotos salvas. Tente novamente.");
    } finally {
      setLoadingSaved(false);
      setBusy(false);
    }
  }

  async function changeOptIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !consent) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(PHOTO_CONSENT_API, { method: "POST", headers: { "X-Apogee-Consent": PHOTO_OPT_IN }, cache: "no-store" });
      const next = await response.json();
      if (!response.ok) {
        setError(errors[next.error] ?? "Não foi possível atualizar sua autorização. Tente novamente.");
        return;
      }
      clear();
      setOptIn(next);
      setExpanded(true);
    } catch {
      setError("Não foi possível atualizar sua autorização. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function openPhoto(photo: AlbumPhoto) {
    setSelected(photo);
    setSaveError("");
    dialog.current?.showModal();
  }

  async function changeSavedPhoto(photo: AlbumPhoto) {
    if (saving || loadingSaved) return;
    const remove = selectedSaved;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch(`${PHOTO_API}/${photo.id}/salvar`, {
        method: remove ? "DELETE" : "PUT", cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setSaved(current => {
        const others = current.filter(item => item.id !== photo.id);
        return remove ? others : [photo, ...others];
      });
      if (remove && mode === "saved") dialog.current?.close();
    } catch {
      setSaveError(remove ? "Não foi possível remover a foto dos salvos." : "Não foi possível salvar a foto.");
    } finally {
      setSaving(false);
    }
  }

  return <section data-ap-card="" className={styles.panel} aria-labelledby="fotos-evento">
    <h2 id="fotos-evento" data-ap-title="">Fotos do evento</h2>
    {expires && <p>O álbum fica disponível até {expires}.</p>}
    <div className={styles.actions}>
      {selfieEnabled && <button type="button" data-ap-button="primary" disabled={pending} aria-expanded={expanded}
        aria-controls="busca-facial-workshop" onClick={toggleSearch}>Encontrar minhas fotos</button>}
      {browse && <button type="button" data-ap-button="secondary" disabled={pending} onClick={() => void openGallery("browse")}>
        Ver álbum completo
      </button>}
      <button type="button" data-ap-button="secondary" disabled={pending} onClick={() => void openGallery("saved")}>Minhas fotos salvas</button>
      {mode === "results" && <button type="button" data-ap-button="secondary" disabled={pending} onClick={clear}>Fechar resultados</button>}
    </div>
    <div id="busca-facial-workshop" className={styles.searchPanel} hidden={!expanded}>
      {loadingOptIn && <p role="status">Carregando a busca…</p>}
      {optIn && !optIn.granted && <form className={styles.form} aria-busy={busy} onSubmit={changeOptIn}>
        <label className={styles.consent}><input type="checkbox" checked={consent} disabled={busy}
          onChange={event => setConsent(event.target.checked)} aria-describedby="busca-facial-privacidade" required />
          <span>Autorizo o uso da minha imagem para buscar minhas fotos deste evento.</span></label>
        <p id="busca-facial-privacidade">A busca usa seu rosto. A selfie é descartada após a consulta e as fotos encontradas ficam salvas na sua conta.</p>
        <button type="submit" data-ap-button="secondary" disabled={busy || !consent}>Continuar</button>
      </form>}
      {optIn?.granted && <form className={styles.form} onSubmit={search} aria-busy={busy}>
        {camera === "preview" && <p>Apareça sozinho na selfie.</p>}
        <video ref={video} className={styles.cameraPreview} hidden={camera === "off"} autoPlay muted playsInline
          aria-label="Prévia da câmera" onCanPlay={() => { if (stream.current) setCameraReady(true); }} />
        {camera === "opening" && <p role="status">Aguardando acesso à câmera…</p>}
        <div className={styles.actions}>
          <button type="submit" data-ap-button="secondary" disabled={busy || camera === "opening" || (camera === "preview" && !cameraReady)}>
            {camera === "preview" ? captureAction : selfieAction}
          </button>
          {camera !== "off" && <button type="button" data-ap-button="secondary" onClick={closeCamera}>Cancelar câmera</button>}
        </div>
        {!optIn.indexed && <p role="status">
          {selfieValidated ? "Selfie validada. " : "A validação só confere a selfie. "}
          A busca ainda não está disponível para esta conta neste álbum.
        </p>}
      </form>}
    </div>
    {busy && <p role="status">{loadingSaved ? "Carregando suas fotos salvas…" : "Processando…"}</p>}
    {error && <p role="alert">{error}</p>}
    {mode !== "start" && <div className={styles.gallery}>
      <p role="status">{photos.length
        ? mode === "browse"
          ? `${photos.length} ${photos.length === 1 ? "foto disponível" : "fotos disponíveis"}`
          : `${photos.length} ${photos.length === 1 ? "foto salva" : "fotos salvas"} na sua conta`
        : mode === "browse" ? "Nenhuma foto foi disponibilizada neste álbum."
          : mode === "saved" ? "Você ainda não tem fotos salvas deste evento."
            : "Não encontramos fotos com essa selfie. Tente tirar outra foto."}</p>
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
    <dialog ref={dialog} className={styles.dialog} aria-label="Visualização da foto" onClose={() => setSelected(null)}
      onCancel={event => { if (saving) event.preventDefault(); }}>
      {selected && <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={selected.thumbnail} alt="Foto do evento" />
        <div className={styles.actions}>
          <a href={selected.download} data-ap-button="primary" download>Baixar original</a>
          {(mode === "browse" || mode === "saved") && <button type="button" data-ap-button="secondary"
            disabled={saving || loadingSaved} onClick={() => void changeSavedPhoto(selected)}>
            {saving ? "Atualizando…" : selectedSaved ? "Remover dos salvos" : "Salvar foto"}
          </button>}
          <button type="button" data-ap-button="secondary" onClick={() => dialog.current?.close()} disabled={saving}>Fechar</button>
        </div>
        {saveError && <p role="alert">{saveError}</p>}
      </>}
    </dialog>
  </section>;
}
