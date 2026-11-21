import { z } from "zod";

export const VOUCHER_LIMIT = 50;
export const VOUCHER_PATH = "/membros/beneficios/voucher-openai";
export const VOUCHER_ADMIN_PATH = "/admin/beneficios/voucher-openai";
export const VOUCHER_OPEN_PATH = "/api/membros/workshop-voucher/abrir";
const maxInput = 450_000;

export class VoucherInputError extends Error {}

export function voucherUrl(value: string): string {
  try {
    const url = new URL(value);
    const official = ["openai.com", "chatgpt.com"].some(domain =>
      url.hostname === domain || url.hostname.endsWith("." + domain));
    if (value.length <= 4096 && url.protocol === "https:" && official &&
        !url.username && !url.password && !url.port && !/[\s\u0000-\u001f\u007f]/u.test(value)) {
      return url.href;
    }
  } catch {
    // Avoid returning the URL or parser error to the browser.
  }
  throw new VoucherInputError("Use links HTTPS válidos da OpenAI ou do ChatGPT.");
}

// Accepts quoted cells (including line breaks), CRLF, UTF-8 BOM, and empty rows.
function readTable(input: string, separator: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const finishRow = () => {
    row.push(cell.trim());
    if (row.some(Boolean)) rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"' && (quoted || !cell)) {
      quoted = !quoted;
    } else if (!quoted && char === separator) {
      row.push(cell.trim());
      cell = "";
    } else if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      finishRow();
    } else {
      cell += char;
    }
  }
  if (quoted) throw new VoucherInputError("O arquivo tem aspas sem fechamento.");
  finishRow();
  return rows;
}

function readColumn(raw: string, headers: string[], missingColumn: string): string[] {
  if (raw.length > maxInput) throw new VoucherInputError("O arquivo excede o tamanho permitido.");
  const input = raw.replace(/^\uFEFF/, "").trim();
  if (!input) return [];
  const lines = input.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.every(line => /^https:\/\//i.test(line))) return lines;
  for (const separator of [",", ";", "\t"]) {
    const [header = [], ...rows] = readTable(input, separator);
    const column = header.findIndex(field => headers.includes(field.toLowerCase().replace(/[\s-]+/g, "_")));
    if (column >= 0) return rows.map(row => row[column] ?? "");
  }
  if (lines.every(line => !/[,;\t"]/.test(line))) return lines;
  throw new VoucherInputError(missingColumn);
}

export function parseVoucherLinks(raw: string): string[] {
  const links = readColumn(raw, ["link", "url", "link_de_ativação", "link_de_ativacao", "activation_url"],
    "Cole um link por linha ou envie uma tabela com a coluna Link.");
  if (links.length !== VOUCHER_LIMIT) throw new VoucherInputError("Carregue exatamente 50 links de ativação.");
  const normalized = links.map(voucherUrl);
  if (new Set(normalized).size !== VOUCHER_LIMIT) throw new VoucherInputError("Há links de ativação repetidos.");
  return normalized;
}

export function parseVoucherGuests(raw: string): string[] {
  const emails = readColumn(raw, ["email", "e_mail", "guest_email", "email_address"],
    "O CSV do Luma precisa ter uma coluna Email ou E-mail.");
  if (emails.length > VOUCHER_LIMIT) {
    throw new VoucherInputError("A lista excede 50 linhas. Use a exportação feita ao completar o 50º check-in.");
  }
  const normalized = emails.map(email => email.trim().toLowerCase());
  if (!normalized.length || !normalized.every(email => email.length <= 254 && z.email().safeParse(email).success)) {
    throw new VoucherInputError("O lote precisa conter um e-mail válido por participante.");
  }
  if (new Set(normalized).size !== normalized.length) throw new VoucherInputError("Há e-mails repetidos. Confira a lista no Luma.");
  return normalized;
}

export type VoucherParticipant = { name: string; email: string };
export const PARTICIPANT_LIMIT = 2000;
const emailHeaders = ["email", "e_mail", "guest_email", "email_address"];
const nameHeaders = ["nome", "name", "nome_completo", "full_name"];

export function voucherEmail(value: unknown): string {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (email.length <= 254 && z.email().safeParse(email).success) return email;
  throw new VoucherInputError("Informe um e-mail válido.");
}

// The participant list stays in the admin's browser; only released e-mails reach the database.
export function parseVoucherParticipants(raw: string): VoucherParticipant[] {
  if (raw.length > maxInput) throw new VoucherInputError("O arquivo excede o tamanho permitido.");
  const input = raw.replace(/^﻿/, "").trim();
  for (const separator of [",", ";", "\t"]) {
    const [header = [], ...rows] = input ? readTable(input, separator) : [];
    const fields = header.map(field => field.toLowerCase().replace(/[\s-]+/g, "_"));
    const emailColumn = fields.findIndex(field => emailHeaders.includes(field));
    if (emailColumn < 0) continue;
    if (!rows.length) throw new VoucherInputError("A lista não tem nenhum participante.");
    if (rows.length > PARTICIPANT_LIMIT) throw new VoucherInputError(`A lista excede ${PARTICIPANT_LIMIT} participantes.`);
    const nameColumn = fields.findIndex(field => nameHeaders.includes(field));
    const seen = new Set<string>();
    const participants: VoucherParticipant[] = [];
    rows.forEach((row, index) => {
      let email: string;
      try {
        email = voucherEmail(row[emailColumn] ?? "");
      } catch {
        throw new VoucherInputError(`A linha ${index + 2} não tem um e-mail válido.`);
      }
      if (seen.has(email)) return; // Luma may export one row per ticket.
      seen.add(email);
      const name = (nameColumn >= 0 ? row[nameColumn] ?? "" : "").replace(/[\u0000-\u001f\u007f]/gu, "").replace(/\s+/g, " ").trim().slice(0, 120);
      participants.push({ name, email });
    });
    return participants;
  }
  throw new VoucherInputError(input ? "A tabela precisa de uma coluna E-mail." : "A lista não tem nenhum participante.");
}

export async function voucherImport(form: FormData): Promise<string> {
  const file = form.get("arquivo");
  const pasted = form.get("conteudo");
  if (file instanceof File && file.size > 0) {
    if (file.size > maxInput) throw new VoucherInputError("O arquivo excede o tamanho permitido.");
    if (typeof pasted === "string" && pasted.trim()) throw new VoucherInputError("Envie o arquivo ou cole os dados.");
    return file.text();
  }
  return typeof pasted === "string" ? pasted : "";
}
