import type { StudentOpportunity } from "./types";
import { AREAS, OPPORTUNITY_CATEGORIES, SUBTYPES } from "./vocabulary";

const stopWords = new Set(["a", "as", "o", "os", "de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos", "para", "por", "com", "the", "of", "and"]);
const equivalents = [
  ["ia", "ai", "inteligencia artificial", "artificial intelligence"],
  ["ead", "online", "on line", "a distancia", "educacao a distancia"],
  ["machine learning", "aprendizado de maquina"],
];
const institutions = [
  ["usp", "universidade de sao paulo"],
  ["ufsc", "universidade federal de santa catarina"],
  ["ufrj", "universidade federal do rio de janeiro"],
  ["unicamp", "universidade estadual de campinas"],
];
// Recognized siglas are case-independent; an uppercase word such as EVENTO
// must retain the same plural/prefix behavior as "evento".
const exactAcronyms = new Set([
  ...institutions.map(group => group[0]),
  "ifsc", "ifc", "ufscar", "ufrgs", "capes", "cnpq", "fapesp", "fapesc", "faperj", "fapemig", "sebrae", "senai", "senac",
]);

export function normalizeOpportunitySearch(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function containsPhrase(text: string, phrase: string) {
  return (` ${text} `).includes(` ${phrase} `);
}

function expand(text: string, groups = equivalents) {
  // Match whole words and phrases: IA must never be inferred from "fotografia".
  return [text, ...groups.filter(group => group.some(phrase => containsPhrase(text, phrase))).flat()].join(" ");
}

function words(text: string) {
  return [...new Set(text.split(" ").filter(word => word && !stopWords.has(word)))];
}

type SearchDocument = { names: string[]; title: string[]; structured: string[]; all: string[] };
// Reuse normalized fields during filtering, category counts and ranking in one request.
// Weak keys do not retain a catalogue after its server request has finished.
const documents = new WeakMap<StudentOpportunity, SearchDocument>();

function documentFor(item: StudentOpportunity): SearchDocument {
  const cached = documents.get(item);
  if (cached) return cached;
  const title = normalizeOpportunitySearch(item.title);
  const names = [title];
  // Explicit brand variants only; preserve the rest of the event name and edition.
  if (/\bhsm\s*\+/iu.test(item.title)) names.push(normalizeOpportunitySearch(item.title.replace(/hsm\s*\+/iu, "HSM Mais")));
  if (/\brec\s*n\s*play\b/u.test(title)) names.push(title.replace(/\brec\s*n\s*play\b/u, "recnplay"));
  if (/\brecnplay\b/u.test(title)) names.push(title.replace(/\brecnplay\b/u, "rec n play"));
  const titleText = names.map(name => expand(name)).join(" ");
  const organization = expand(normalizeOpportunitySearch(item.organization), institutions);
  const areas = (item.discovery?.areas ?? []).flatMap(area => [area, AREAS[area]]);
  const categories = (item.categories ?? []).flatMap(id => [id, OPPORTUNITY_CATEGORIES.find(category => category.id === id)?.label ?? ""]);
  const subtype = item.discovery?.subtype;
  const structuredText = `${titleText} ${organization} ${expand(normalizeOpportunitySearch([
    ...areas, ...categories, subtype ? SUBTYPES[subtype] : "", item.kind, item.level,
    item.cityName, item.stateCode, item.participationFormat,
    // Use confirmed city/UF, avoiding placeholders such as "Não informado".
    item.nationallyEligible ? "Brasil nacional" : "",
  ].filter(Boolean).join(" ")))}`;
  const allText = `${structuredText} ${expand(normalizeOpportunitySearch([item.eligibility, item.benefit, item.summary].join(" ")))}`;
  const document = { names, title: words(titleText), structured: words(structuredText), all: words(allText) };
  documents.set(item, document);
  return document;
}

function matchesWord(term: string, candidate: string, wholeWord: boolean) {
  if (term === candidate) return true;
  // Short siglas, UF codes and years require whole-word matches.
  if (wholeWord || term.length < 4 || /\d/u.test(term)) return false;
  if (candidate.startsWith(term)) return true;
  return term.endsWith("s") && term.length > 4 && candidate === term.slice(0, -1);
}

function nearbyWord(term: string, candidate: string) {
  if (term.length < 5 || candidate.length < 5 || /\d/u.test(term + candidate)) return false;
  const limit = term.length >= 8 ? 2 : 1;
  if (Math.abs(term.length - candidate.length) > limit) return false;
  let previous = Array.from({ length: candidate.length + 1 }, (_, i) => i);
  for (let i = 1; i <= term.length; i++) {
    const row = [i];
    for (let j = 1; j <= candidate.length; j++) {
      row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(term[i - 1] !== candidate[j - 1]));
    }
    if (Math.min(...row) > limit) return false;
    previous = row;
  }
  return previous[candidate.length] <= limit;
}

/** Higher tiers always precede deadlines, benefits and diversity penalties.
 * Every meaningful query word must match; at most one word may need typo recovery.
 * This pure matcher is also shared by legacy/admin filters; access stays on the server.
 */
export function createOpportunitySearch(query?: string | null) {
  const raw = query?.trim().slice(0, 100) ?? "";
  const normalized = normalizeOpportunitySearch(raw);
  const terms = words(normalized);
  // A query made only of stop words still searches those words, never all records.
  if (!terms.length && normalized) terms.push(...normalized.split(" "));
  const matches = (term: string, token: string) => matchesWord(term, token, exactAcronyms.has(term));
  const allTerms = (tokens: string[]) => terms.every(term => tokens.some(token => matches(term, token)));
  return {
    active: Boolean(raw),
    score(item: StudentOpportunity) {
      if (!raw) return 1;
      if (!terms.length) return 0;
      const document = documentFor(item);
      if (document.names.includes(normalized)) return 6;
      if (document.names.some(name => containsPhrase(name, normalized))) return 5;
      if (allTerms(document.title)) return 4;
      if (allTerms(document.structured)) return 3;
      if (allTerms(document.all)) return 2;
      let recovered = 0;
      for (const term of terms) {
        if (document.all.some(token => matches(term, token))) continue;
        if (++recovered > 1 || exactAcronyms.has(term) || !document.structured.some(token => nearbyWord(term, token))) return 0;
      }
      return 1;
    },
  };
}
