"use client";

import { ArrowDownRight } from "lucide-react";
import { useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { InternalFooter } from "@/components/site/internal-footer";
import { InternalHeader } from "@/components/site/internal-header";
import { normalizeInstagram } from "@/lib/instagram";
import {
  FileUploadCard,
  type UploadedMedia,
} from "@/components/ui/file-upload-card";
import { GalleryHero } from "./gallery-hero";
import { PhotoGrid } from "./photo-grid";
import { preparePhoto } from "./prepare-photo";
import { useCommunityPhotos } from "./use-community-photos";
import styles from "./gallery.module.css";

const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "image/avif",
  "image/gif",
]);
const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|hei[cf]|avif|gif)$/i;

export function GalleryExperience() {
  const [files, setFiles] = useState<UploadedMedia[]>([]);
  const [message, setMessage] = useState("");
  const [author, setAuthor] = useState("");
  const [instagram, setInstagram] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [instagramError, setInstagramError] = useState("");
  const [sending, setSending] = useState(false);
  const { photos, loading, error, refresh, hasMore, loadingMore, loadMore } = useCommunityPhotos();
  const objectUrlsRef = useRef(new Set<string>());
  const activeMediaIdsRef = useRef(new Set<string>());
  const preparationQueueRef = useRef(Promise.resolve());
  const unmountedRef = useRef(false);
  const instagramInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const gridInView = useInView(gridRef, { margin: "-12% 0px -12% 0px" });

  const hasPreparingFiles = files.some((media) => media.status === "preparando");

  useEffect(() => {
    if (!hasPreparingFiles) return;

    const timer = window.setInterval(() => {
      setFiles((current) =>
        current.map((media) => {
          if (media.status !== "preparando") return media;
          const progress = Math.min(media.progress + 8, 90);
          return {
            ...media,
            progress,
          };
        })
      );
    }, 180);

    return () => window.clearInterval(timer);
  }, [hasPreparingFiles]);

  useEffect(() => {
    const objectUrls = objectUrlsRef.current;
    const activeMediaIds = activeMediaIdsRef.current;
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      activeMediaIds.clear();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const chooseFiles = (selection: File[]) => {
    const availableSlots = Math.max(0, MAX_FILES - files.length);
    const selectedFiles = selection.slice(0, availableSlots);

    const newMedia: UploadedMedia[] = selectedFiles.map((file, index) => {
      const invalidType = !ACCEPTED_TYPES.has(file.type) && !(file.type === "" && ACCEPTED_EXTENSIONS.test(file.name));
      const tooLarge = file.size > MAX_FILE_SIZE;

      return {
        id: `${file.name}-${file.lastModified}-${index}-${Date.now()}`,
        file,
        progress: invalidType || tooLarge ? 0 : 4,
        status: invalidType || tooLarge ? "erro" : "preparando",
        error: invalidType
          ? "Formato não aceito"
          : tooLarge
            ? "Arquivo maior que 20 MB"
            : undefined,
      };
    });

    setFiles((current) => [...current, ...newMedia]);
    for (const media of newMedia) {
      if (media.status === "preparando") activeMediaIdsRef.current.add(media.id);
    }
    preparationQueueRef.current = preparationQueueRef.current.then(async () => {
      for (const media of newMedia) {
        if (media.status !== "preparando" || !activeMediaIdsRef.current.has(media.id)) continue;
        try {
          const prepared = await preparePhoto(media.file);
          if (!activeMediaIdsRef.current.has(media.id) || unmountedRef.current) continue;
          const previewUrl = URL.createObjectURL(prepared);
          objectUrlsRef.current.add(previewUrl);
          setFiles((current) => current.map((item) => item.id === media.id
            ? { ...item, prepared, previewUrl, progress: 100, status: "pronto" }
            : item));
        } catch (error) {
          if (!activeMediaIdsRef.current.has(media.id) || unmountedRef.current) continue;
          setFiles((current) => current.map((item) => item.id === media.id
            ? { ...item, progress: 0, status: "erro", error: error instanceof Error ? error.message : "Não foi possível preparar a foto." }
            : item));
        }
      }
    });

    if (availableSlots === 0) {
      setMessage(`Você já atingiu o limite de ${MAX_FILES} arquivos.`);
    } else if (selection.length > availableSlots) {
      setMessage(`Foram adicionados ${availableSlots} arquivos. O limite é de ${MAX_FILES}.`);
    } else {
      setMessage("");
    }
  };

  const removeFile = (id: string) => {
    activeMediaIdsRef.current.delete(id);
    setFiles((current) => {
      const removed = current.find((media) => media.id === id);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((media) => media.id !== id);
    });
    setMessage("");
  };

  const readyFiles = files.filter((media) => media.status === "pronto");
  const hasErrors = files.some((media) => media.status === "erro");

  const submitPhotos = async () => {
    if (sending || readyFiles.length === 0) return;
    const normalizedInstagram = anonymous ? "" : normalizeInstagram(instagram);
    if (normalizedInstagram === null) {
      setInstagramError("Use @usuario ou cole o link do seu perfil do Instagram.");
      instagramInputRef.current?.focus();
      return;
    }
    setSending(true);
    setMessage("Preparando e enviando as fotos…");
    let uploaded = 0;
    let failure = "";
    for (const media of readyFiles) {
      try {
        if (!media.prepared) throw new Error("A foto ainda está sendo preparada.");
        const form = new FormData();
        form.append("photo", media.prepared, `${media.id}.${media.prepared.type === "image/webp" ? "webp" : "jpg"}`);
        form.append("author", anonymous ? "" : author.trim());
        form.append("instagram", normalizedInstagram);
        form.append("anonymous", anonymous ? "true" : "false");
        form.append("consent", "true");
        const response = await fetch("/api/gallery", { method: "POST", body: form });
        const body: { error?: string } = await response.json();
        if (!response.ok) throw new Error(body.error || "Não foi possível enviar a foto.");
        uploaded += 1;
        if (media.previewUrl) {
          URL.revokeObjectURL(media.previewUrl);
          objectUrlsRef.current.delete(media.previewUrl);
        }
        activeMediaIdsRef.current.delete(media.id);
        setFiles((current) => current.filter((item) => item.id !== media.id));
      } catch (error) {
        failure = error instanceof Error ? error.message : "Não foi possível enviar a foto.";
        break;
      }
    }
    if (uploaded) await refresh();
    setSending(false);
    setMessage(failure || `${uploaded} ${uploaded === 1 ? "foto publicada" : "fotos publicadas"} na galeria da comunidade Apogee.`);
    if (uploaded) window.requestAnimationFrame(() => document.getElementById("mural-da-comunidade")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className={styles.page}>
      <div aria-hidden className={styles.grain} />
      <InternalHeader current="galeria" />

      <main id="experiencia">
        <GalleryHero gridInView={gridInView} />
        <div ref={gridRef}>
          <PhotoGrid
            photos={photos}
            loading={loading}
            error={error}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        </div>

        <section id="enviar-fotos" className={styles.uploadSection} aria-labelledby="upload-title">
          <div className={styles.uploadIntro}>
            <p className={styles.kicker}>Sua câmera também fez parte</p>
            <h2 id="upload-title">Inclua o seu ponto de vista.</h2>
            <p>
              Selecione até {MAX_FILES} fotos, escolha como quer aparecer e publique seus
              registros na galeria da comunidade Apogee.
            </p>
            <ol>
              <li><span>1</span> Selecione as fotos</li>
              <li><span>2</span> Escolha como assinar</li>
              <li><span>3</span> Autorize e publique</li>
            </ol>
          </div>

          <form
            className={styles.uploadForm}
            onSubmit={async (event) => {
              event.preventDefault();
              await submitPhotos();
            }}
          >
            <FileUploadCard
              files={files}
              onFilesChange={chooseFiles}
              onFileRemove={removeFile}
            />

            {files.some((media) => media.previewUrl && media.status !== "erro") && (
              <div className={styles.selectedPreview} aria-label="Prévia das fotos antes da publicação">
                <p>Prévia antes de publicar</p>
                <div>
                  {files.filter((media) => media.previewUrl && media.status !== "erro").map((media) => (
                    <figure key={media.id}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={media.previewUrl} alt={`Prévia de ${media.file.name}`} />
                      <figcaption>{anonymous ? "Anônimo" : `${author.trim() || "Seu nome"} · @${normalizeInstagram(instagram) || "seuusuario"}`}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.submissionDetails}>
              <fieldset className={styles.creditChoice}>
                <legend>Como você quer aparecer?</legend>
                <label>
                  <input type="radio" name="creditMode" value="identified" checked={!anonymous} onChange={() => setAnonymous(false)} />
                  <span>Com meu nome e Instagram</span>
                </label>
                <label>
                  <input type="radio" name="creditMode" value="anonymous" checked={anonymous} onChange={() => { setAnonymous(true); setInstagramError(""); }} />
                  <span>Postar anonimamente</span>
                </label>
              </fieldset>

              {!anonymous && (
                <div className={styles.fields}>
                  <label>
                    <span>Seu nome</span>
                    <input
                      name="author"
                      type="text"
                      autoComplete="name"
                      placeholder="Como devemos creditar você?"
                      value={author}
                      onChange={(event) => setAuthor(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Seu Instagram</span>
                    <input
                      ref={instagramInputRef}
                      name="instagram"
                      type="text"
                      autoComplete="off"
                      inputMode="text"
                      placeholder="@seuusuario"
                      value={instagram}
                      onChange={(event) => { setInstagram(event.target.value); setInstagramError(""); }}
                      onBlur={() => {
                        if (!instagram.trim()) return;
                        const normalized = normalizeInstagram(instagram);
                        if (normalized) setInstagram(`@${normalized}`);
                        else setInstagramError("Use @usuario ou cole o link do seu perfil do Instagram.");
                      }}
                      aria-invalid={Boolean(instagramError)}
                      aria-describedby="instagram-help"
                      required
                    />
                    <small id="instagram-help" className={instagramError ? styles.fieldError : styles.fieldHint}>
                      {instagramError || "Aceita @usuario ou o link do perfil."}
                    </small>
                  </label>
                </div>
              )}

              <label className={styles.consent}>
                <input name="consent" type="checkbox" required />
                <span>
                  Confirmo que tenho direito de compartilhar estas fotos e autorizo sua
                  publicação automática na galeria da Apogee{anonymous ? " sem exibir meu nome ou Instagram." : " com meu nome e Instagram."}
                </span>
              </label>

              <div className={styles.formFooter}>
                <p aria-live="polite">
                  {message || "As fotos serão publicadas automaticamente após o envio."}
                </p>
                <button
                  type="submit"
                  disabled={readyFiles.length === 0 || hasPreparingFiles || hasErrors || sending}
                >
                  {sending ? "Enviando…" : "Publicar fotos"} <ArrowDownRight aria-hidden strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </form>
        </section>
      </main>

      <InternalFooter />
    </div>
  );
}
