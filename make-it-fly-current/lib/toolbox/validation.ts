import type { ToolboxStatus } from "./types";

export class ToolboxInputError extends Error {}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
function field(data: FormData, key: string) {
  const value = data.get(key);
  if (value !== null && typeof value !== "string") throw new ToolboxInputError("Envie somente texto nos campos da ficha.");
  return (value ?? "").normalize("NFC").trim();
}
function text(data: FormData, key: string, label: string, max: number, required = true) {
  const value = field(data, key);
  if ((required && !value) || value.length > max || /[<>\p{C}]/u.test(value)) {
    throw new ToolboxInputError(`${label}: use texto simples${required ? " obrigatório" : ""}, com até ${max} caracteres.`);
  }
  return value;
}
export function toolboxId(value: string) {
  if (!uuid.test(value)) throw new ToolboxInputError("Item inválido. Reabra a ficha pela lista.");
  return value.toLowerCase();
}
function integer(value: string, label: string, minimum: number, maximum: number) {
  if (!/^\d{1,9}$/.test(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new ToolboxInputError(`${label}: informe um número entre ${minimum} e ${maximum}.`);
  }
  return Number(value);
}
function common(data: FormData) {
  const rawId = field(data, "id");
  const status = field(data, "status");
  if (!["draft", "published", "archived"].includes(status)) throw new ToolboxInputError("Escolha um estado válido para a ficha.");
  return {
    id: rawId ? toolboxId(rawId) : null,
    version: rawId ? integer(field(data, "version"), "Versão", 1, 999999999) : null,
    status: status as ToolboxStatus,
    order: integer(field(data, "order") || "0", "Ordem", 0, 9999),
  };
}
export function categorySlug(name: string) {
  const slug = name.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
  if (!slug) throw new ToolboxInputError("Use letras ou números no nome da categoria.");
  return slug;
}
export function toolUrl(value: string) {
  if (!value || value.length > 2048 || /[\s\\\p{C}]/u.test(value)) throw new ToolboxInputError("Informe um link oficial HTTPS válido, sem espaços ou credenciais.");
  let url: URL;
  try { url = new URL(value); } catch { throw new ToolboxInputError("Informe o endereço HTTPS completo do site oficial."); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z][a-z0-9-]*$/i.test(url.hostname) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)) {
    throw new ToolboxInputError("Use um link HTTPS de um site público, sem credenciais ou portas alternativas.");
  }
  if (url.search || url.hash) throw new ToolboxInputError("Use o link público da ferramenta, sem parâmetros, tokens, sessão ou dados pessoais.");
  return url.href;
}
export function categoryInput(data: FormData) {
  const name = text(data, "name", "Nome da categoria", 80);
  return { ...common(data), name, description: text(data, "description", "Descrição da categoria", 240, false) || null, slug: categorySlug(name) };
}
export function toolInput(data: FormData) {
  return {
    ...common(data), categoryId: toolboxId(field(data, "categoryId")),
    name: text(data, "name", "Nome da ferramenta", 100),
    description: text(data, "description", "Descrição da ferramenta", 280),
    url: toolUrl(field(data, "url")),
    conditions: text(data, "conditions", "Condições de uso", 280, false) || null,
    reviewed: data.get("reviewed") === "on",
  };
}
