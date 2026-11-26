"use client";

import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { WORKSHOP_REFERENCES_PATH } from "@/lib/eventos/catalogo";
import { isFaceRegion, type FaceRegion } from "@/lib/eventos/regiao";
import { deleteReference, loadReference, saveReference } from "./actions";
import styles from "./references.module.css";

type Participant = { id: string; name: string; username: string | null };
type Point = [x: number, y: number];

const labels = ["Esquerda", "Topo", "Direita", "Base"];
const emptyFields = ["", "", "", ""];

function toFields(box: FaceRegion | null) {
  return box?.map(value => String(Number((value * 100).toFixed(3)))) ?? emptyFields;
}

function fromFields(fields: string[]) {
  if (fields.some(value => !value.trim())) return null;
  const box = fields.map(value => Number(value) / 100);
  return isFaceRegion(box) ? box : null;
}

export function ReferenceEditor({ photos, participants }: { photos: string[]; participants: Participant[] }) {
  const [memberId, setMemberId] = useState("");
  const [index, setIndex] = useState(0);
  if (!photos.length) return <p>Nenhuma foto do evento está disponível.</p>;
  if (!participants.length) return <p>Nenhum participante autorizou a busca neste evento.</p>;

  const photo = photos[index];
  return <section data-ap-card="" className={styles.panel} aria-label="Marcações autorizadas">
    <div className={styles.controls}>
      <label>Participante
        <select value={memberId} onChange={event => setMemberId(event.target.value)}>
          <option value="">Selecione quem aparece na foto</option>
          {participants.map(member => <option key={member.id} value={member.id}>
            {member.name}{member.username ? ` (@${member.username})` : ""}
          </option>)}
        </select>
      </label>
      <label>Foto do álbum
        <select value={index} onChange={event => setIndex(Number(event.target.value))}>
          {photos.map((id, position) => <option key={id} value={position}>Foto {position + 1} de {photos.length}</option>)}
        </select>
      </label>
      <button type="button" data-ap-button="secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Anterior</button>
      <button type="button" data-ap-button="secondary" disabled={index + 1 === photos.length} onClick={() => setIndex(index + 1)}>Próxima</button>
    </div>
    {memberId && <RegionForm key={`${memberId}:${photo}`} memberId={memberId} photo={photo} position={index + 1} />}
  </section>;
}

function RegionForm({ memberId, photo, position }: { memberId: string; photo: string; position: number }) {
  const [fields, setFields] = useState(emptyFields);
  const [corner, setCorner] = useState<Point | null>(null);
  const [saved, setSaved] = useState<FaceRegion | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Carregando a marcação…");
  const firstField = useRef<HTMLInputElement>(null);
  const box = fromFields(fields);

  useEffect(() => {
    let current = true;
    loadReference(memberId, photo).then(result => {
      if (!current) return;
      setStatus("");
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFields(toFields(result.box));
      setSaved(result.box);
      setLoaded(true);
    }).catch(() => {
      if (!current) return;
      setStatus("");
      setError("Não foi possível carregar a marcação.");
    });
    return () => { current = false; };
  }, [memberId, photo, attempt]);

  function update(next: string[]) {
    setFields(next);
    setConfirmed(false);
    setStatus("");
    setError("");
  }

  function pickCorner(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail === 0) {
      firstField.current?.focus();
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.min(1, Math.max(0, value));
    const point: Point = [clamp((event.clientX - bounds.left) / bounds.width), clamp((event.clientY - bounds.top) / bounds.height)];
    if (!corner) {
      setCorner(point);
      setConfirmed(false);
      return;
    }
    const next = [
      Math.min(corner[0], point[0]), Math.min(corner[1], point[1]),
      Math.max(corner[0], point[0]), Math.max(corner[1], point[1]),
    ];
    setCorner(null);
    if (isFaceRegion(next)) update(toFields(next));
  }

  async function change(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!loaded || busy || (event && (!box || !confirmed || !imageReady || corner))) return;
    if (!event && !window.confirm("Remover esta marcação da busca do participante?")) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const result = event && box
        ? await saveReference(memberId, photo, box, confirmed)
        : await deleteReference(memberId, photo);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setFields(toFields(result.box));
      setSaved(result.box);
      setCorner(null);
      setConfirmed(false);
      setStatus(result.box ? "Marcação salva. Esta foto já pode entrar na busca do participante." : "Marcação removida da busca.");
    } catch {
      setError("Não foi possível registrar a alteração. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <form className={styles.editor} onSubmit={change} aria-busy={busy || (!loaded && !error)}>
    <p id="orientacao-marcacao">Clique em dois cantos opostos para delimitar apenas o rosto da pessoa selecionada ou informe os limites em porcentagem.</p>
    <button type="button" className={styles.preview} onClick={pickCorner} disabled={!loaded || !imageReady || busy}
      aria-label={`Marcar o rosto na foto ${position}`} aria-describedby="orientacao-marcacao">
      {/* A miniatura autenticada usa as mesmas coordenadas relativas do original. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${WORKSHOP_REFERENCES_PATH}/${photo}/miniatura`} alt={`Foto ${position} do evento`} draggable={false}
        onLoad={() => setImageReady(true)} onError={() => setError("Não foi possível carregar a foto.")} />
      {box && <span aria-hidden="true" className={styles.box} style={{
        left: `${box[0] * 100}%`, top: `${box[1] * 100}%`,
        width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%`,
      }} />}
      {corner && <span aria-hidden="true" className={styles.corner} style={{ left: `${corner[0] * 100}%`, top: `${corner[1] * 100}%` }} />}
    </button>
    {corner && <p role="status">Marque agora o canto oposto do rosto.</p>}
    <fieldset className={styles.controls} disabled={!loaded || !imageReady || busy}>
      <legend>Limites do rosto em porcentagem</legend>
      {labels.map((label, index) => <label key={label}>{label}
        <input ref={index === 0 ? firstField : undefined} type="number" min="0" max="100" step="any" value={fields[index]}
          onChange={event => {
            setCorner(null);
            update(fields.map((value, field) => field === index ? event.target.value : value));
          }} />
      </label>)}
    </fieldset>
    <label className={styles.confirm}>
      <input type="checkbox" checked={confirmed} disabled={!box || !imageReady || busy || !!corner}
        onChange={event => setConfirmed(event.target.checked)} />
      Confirmei que esta região contém apenas o rosto do participante selecionado.
    </label>
    <div className={styles.controls}>
      <button type="submit" data-ap-button="primary" disabled={!box || !confirmed || !loaded || !imageReady || busy || !!corner}>Salvar marcação</button>
      {saved && <button type="button" data-ap-button="secondary" disabled={busy} onClick={() => change()}>Remover marcação</button>}
      {!loaded && error && <button type="button" data-ap-button="secondary" onClick={() => {
        setError("");
        setStatus("Carregando a marcação…");
        setAttempt(attempt + 1);
      }}>Tentar novamente</button>}
    </div>
    {error && <p role="alert">{error}</p>}
    {status && <p role="status">{status}</p>}
  </form>;
}
