"use client";

import { useMemo, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { manageVoucherAction } from "@/lib/workshop-voucher/actions";
import { parseVoucherParticipants, VoucherInputError, VOUCHER_LIMIT, type VoucherParticipant } from "@/lib/workshop-voucher/input";
import { VoucherForm } from "./form";
import styles from "./form.module.css";

export type ReleasedGuest = { email: string; slot: number; linked: boolean; opened: boolean };

// The participant list never leaves this browser. Only the e-mail of a released
// person is sent to the server, where the voucher assignment already lives.
const storageKey = "apogee-voucher-openai-participants-v1";
const listeners = new Set<() => void>();
let memory = "";

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function snapshot() {
  try {
    return localStorage.getItem(storageKey) ?? memory;
  } catch {
    return memory;
  }
}
function store(value: string) {
  memory = value;
  try {
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);
  } catch {
    // Private windows may block storage; the list then lasts for this page only.
  }
  listeners.forEach(listener => listener());
}
function readStored(value: string): VoucherParticipant[] {
  try {
    const parsed: unknown = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((p): p is VoucherParticipant =>
      typeof p?.email === "string" && typeof p?.name === "string") : [];
  } catch {
    return [];
  }
}
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

function releaseStatus(guest: ReleasedGuest) {
  return `Liberado · voucher ${guest.slot} · ${guest.opened ? "link aberto" : guest.linked ? "conta vinculada" : "aguardando a pessoa entrar"}`;
}

function GuestAction({ email, name, guest, revision, canRelease }: {
  email: string; name: string; guest?: ReleasedGuest; revision: string; canRelease: boolean;
}) {
  const who = name || email;
  const hidden = <><input type="hidden" name="revision" value={revision} /><input type="hidden" name="email" value={email} /></>;
  if (!guest) {
    return <VoucherForm action={manageVoucherAction} label="Liberar" accessibleLabel={`Liberar voucher para ${who}`} disabled={!canRelease}>
      {hidden}<input type="hidden" name="operation" value="release-guest" />
    </VoucherForm>;
  }
  if (guest.linked || guest.opened) return null;
  return <VoucherForm action={manageVoucherAction} label="Desfazer" accessibleLabel={`Desfazer liberação de ${who}`}>
    {hidden}<input type="hidden" name="operation" value="revoke-guest" />
  </VoucherForm>;
}

export function VoucherParticipants({ released, revision, stockReady }: {
  released: ReleasedGuest[]; revision: string; stockReady: boolean;
}) {
  const stored = useSyncExternalStore(subscribe, snapshot, () => "");
  const participants = useMemo(() => readStored(stored), [stored]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const byEmail = useMemo(() => new Map(released.map(guest => [guest.email, guest])), [released]);
  const full = released.length >= VOUCHER_LIMIT;
  const canRelease = stockReady && !full;

  const visible = useMemo(() => {
    const term = fold(query.trim());
    return participants
      .filter(p => !term || fold(`${p.name} ${p.email}`).includes(term))
      .sort((a, b) => collator.compare(a.name || a.email, b.name || b.email));
  }, [participants, query]);
  const listed = new Set(participants.map(p => p.email));
  const outside = released.filter(guest => !listed.has(guest.email));

  async function load(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      store(JSON.stringify(parseVoucherParticipants(await file.text())));
      setError("");
    } catch (failure) {
      setError(failure instanceof VoucherInputError ? failure.message : "Não foi possível ler o arquivo. Use um CSV com a coluna E-mail.");
    }
  }

  return <section className={styles.participants} aria-labelledby="voucher-participants-title">
    <h3 id="voucher-participants-title">Liberar por participante</h3>
    <p role="status"><strong>{released.length} de {VOUCHER_LIMIT} vouchers liberados</strong> · {participants.length} participantes na lista deste navegador.</p>
    {!stockReady && <p role="alert">Carregue os 50 links antes de liberar.</p>}
    {full && <p role="status">Os 50 vouchers já foram liberados.</p>}
    <p className={styles.note}>Cada clique reserva o próximo link livre para o e-mail da pessoa, que aparece para ela em Benefícios ao entrar com esse e-mail. “Desfazer” só funciona antes de a pessoa abrir ou vincular o link.</p>

    <div className={styles.toolbar}>
      <label>Lista de participantes (CSV com Nome e E-mail)
        <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={load} />
      </label>
      {participants.length > 0 && <button type="button" data-ap-button="secondary" onClick={() => store("")}>Remover lista deste navegador</button>}
    </div>
    {error && <p role="alert">{error}</p>}

    <VoucherForm action={manageVoucherAction} label="Liberar este e-mail" disabled={!canRelease}>
      <input type="hidden" name="revision" value={revision} /><input type="hidden" name="operation" value="release-guest" />
      <p><label>Liberar para alguém fora da lista <input type="email" name="email" required maxLength={254} autoComplete="off" /></label></p>
    </VoucherForm>

    {participants.length > 0 && <>
      <p><label>Buscar participante <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nome ou e-mail" className={styles.search} /></label></p>
      <p className={styles.note}>{visible.length} de {participants.length} participantes.</p>
      <ul className={styles.list}>
        {visible.map(p => {
          const guest = byEmail.get(p.email);
          return <li key={p.email} className={styles.row} data-released={guest ? "" : undefined}>
            <div className={styles.rowMeta}>
              <strong>{p.name || p.email}</strong>
              {p.name && <span>{p.email}</span>}
              <span className={styles.status}>{guest ? releaseStatus(guest) : "Não liberado"}</span>
            </div>
            <GuestAction email={p.email} name={p.name} guest={guest} revision={revision} canRelease={canRelease} />
          </li>;
        })}
      </ul>
    </>}

    {outside.length > 0 && <details>
      <summary>{outside.length} liberados fora da lista deste navegador</summary>
      <ul className={styles.list}>{outside.map(guest => <li key={guest.email} className={styles.row} data-released="">
        <div className={styles.rowMeta}><strong>{guest.email}</strong><span className={styles.status}>{releaseStatus(guest)}</span></div>
        <GuestAction email={guest.email} name="" guest={guest} revision={revision} canRelease={canRelease} />
      </li>)}</ul>
    </details>}
  </section>;
}
