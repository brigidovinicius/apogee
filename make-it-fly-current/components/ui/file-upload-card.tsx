"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Trash2, UploadCloud, XCircle } from "lucide-react";
import type { CSSProperties, DragEvent } from "react";
import { useRef, useState } from "react";
import styles from "./file-upload-card.module.css";

export type MediaStatus = "preparando" | "pronto" | "erro";

export type UploadedMedia = {
  id: string;
  file: File;
  prepared?: Blob;
  previewUrl?: string;
  progress: number;
  status: MediaStatus;
  error?: string;
};

type FileUploadCardProps = {
  files: UploadedMedia[];
  onFilesChange: (files: File[]) => void;
  onFileRemove: (id: string) => void;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 KB";

  const units = ["bytes", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;

  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)} ${units[unitIndex]}`;
};

const fileType = (file: File) => {
  const extension = file.name.split(".").pop();
  return extension?.slice(0, 4).toUpperCase() || "ARQ";
};

export function FileUploadCard({ files, onFilesChange, onFileRemove }: FileUploadCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const receiveFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    onFilesChange(Array.from(fileList));
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    receiveFiles(event.dataTransfer.files);
  };

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className={styles.cardBody}>
        <header className={styles.cardHeader}>
          <span className={styles.headerIcon} aria-hidden>
            <UploadCloud strokeWidth={1.4} />
          </span>
          <div>
            <h3>Enviar fotos</h3>
            <p>Selecione os registros que você quer compartilhar.</p>
          </div>
        </header>

        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,image/gif,.heic,.heif"
          multiple
          onChange={(event) => {
            receiveFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDragging(false);
            }
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <button
            className={styles.dropzoneButton}
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className={styles.dropIcon} aria-hidden strokeWidth={1.25} />
            <strong>Escolha arquivos ou arraste e solte aqui.</strong>
            <span className={styles.formatHint}>JPEG, PNG, WebP, HEIC, AVIF ou GIF, com até 20 MB por foto.</span>
            <span className={styles.browseButton}>Procurar arquivos</span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div
            className={styles.fileArea}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <p className={styles.fileCount}>
              {files.length} {files.length === 1 ? "arquivo selecionado" : "arquivos selecionados"}
            </p>
            <ul>
              <AnimatePresence initial={false}>
                {files.map((media) => (
                  <motion.li
                    key={media.id}
                    layout
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 18 }}
                  >
                    <span className={styles.fileType}>{fileType(media.file)}</span>
                    <div className={styles.fileInfo}>
                      <strong title={media.file.name}>{media.file.name}</strong>
                      <div className={styles.fileMeta}>
                        <span>
                          {media.status === "preparando"
                            ? `${formatFileSize((media.file.size * media.progress) / 100)} de ${formatFileSize(media.file.size)}`
                            : formatFileSize(media.file.size)}
                        </span>
                        <span aria-hidden>•</span>
                        <span
                          className={
                            media.status === "erro"
                              ? styles.statusError
                              : media.status === "pronto"
                                ? styles.statusReady
                                : styles.statusPreparing
                          }
                        >
                          {media.status === "erro"
                            ? media.error || "Arquivo inválido"
                            : media.status === "pronto"
                              ? "Pronto para envio"
                              : "Preparando..."}
                        </span>
                      </div>
                      {media.status === "preparando" && (
                        <span
                          className={styles.progressTrack}
                          role="progressbar"
                          aria-label={`Preparando ${media.file.name}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={media.progress}
                        >
                          <span
                            className={styles.progressValue}
                            style={{ "--progress": `${media.progress}%` } as CSSProperties}
                          />
                        </span>
                      )}
                    </div>
                    <span className={styles.fileActions}>
                      {media.status === "pronto" && <CheckCircle2 aria-label="Arquivo pronto" />}
                      {media.status === "erro" && <XCircle aria-label="Arquivo com erro" />}
                      <button
                        type="button"
                        onClick={() => onFileRemove(media.id)}
                        aria-label={`Remover ${media.file.name}`}
                      >
                        <Trash2 aria-hidden />
                      </button>
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
