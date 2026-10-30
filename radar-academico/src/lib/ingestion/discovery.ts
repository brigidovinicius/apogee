import { OPPORTUNITY_CATEGORIES } from './categories';
import { isOfficialSourceUrl } from './validate-url';
import type { OfficialSource } from './types';

export type Stage = { id: string; name: string; kind: 'registration' | 'exam' | 'result' | 'enrollment' | 'event'; start: string; end?: string; sourceUrl: string; checkedAt: string };
export type Discovery = { primaryType?: string; subtype?: string; areas: string[]; editions: { id: string; name: string; stages: Stage[] }[] };
/** A successful recheck refreshes evidence timestamps without creating a revision. */
export function discoveryContent(value: Discovery | undefined) {
  if (!value) return value;
  return { ...value, editions: value.editions.map(edition => ({ ...edition,
    stages: edition.stages.map(({ id, name, kind, start, end, sourceUrl }) => ({ id, name, kind, start, end, sourceUrl })) })) };
}
const subtypes = ['olimpiada', 'vestibular', 'hackathon', 'curso_online', 'escola_de_verao', 'estagio'];
const areas = ['matematica','fisica','quimica','biologia','astronomia','clima','ambiente','saude','neurociencia','tecnologia','ia','robotica','dados','humanas','geografia','linguas','educacao','artes','comunicacao','negocios','direito','relacoes-internacionais','esportes'];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Dados de calendário inválidos');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error('Texto de calendário inválido');
  return value.trim();
}
function id(value: unknown) {
  const result = text(value, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(result)) throw Error('Identificador de etapa inválido');
  return result;
}
export function calendarDate(value: unknown) {
  const result = text(value, 40);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(result) || !Number.isFinite(Date.parse(result))) throw Error('Data inválida; horários exigem fuso');
  if (new Date(result.slice(0, 10)+'T12:00:00Z').toISOString().slice(0,10) !== result.slice(0,10)) throw Error('Data inexistente');
  return result;
}
/** Optional enrichment: absence never invents eligibility or blocks the legacy catalogue. */
export function parseDiscovery(value: unknown, source: OfficialSource): Discovery {
  const data = object(value);
  const primaryType = data.primaryType ? text(data.primaryType, 40) : undefined;
  const subtype = data.subtype ? text(data.subtype, 40) : undefined;
  if (primaryType && !(OPPORTUNITY_CATEGORIES as readonly string[]).includes(primaryType) || subtype && !subtypes.includes(subtype)) throw Error('Tipo ou subtipo inválido');
  if (!Array.isArray(data.areas) || data.areas.length > areas.length || !data.areas.every(a => typeof a === 'string' && areas.includes(a))) throw Error('Área inválida');
  if (!Array.isArray(data.editions) || data.editions.length > 10) throw Error('Edições inválidas');
  const editions = data.editions.map(raw => {
    const edition = object(raw);
    if (!Array.isArray(edition.stages) || edition.stages.length > 30) throw Error('Etapas inválidas');
    const stages = edition.stages.map(rawStage => {
      const stage = object(rawStage);
      const kind = text(stage.kind, 30) as Stage['kind'];
      if (!['registration','exam','result','enrollment','event'].includes(kind)) throw Error('Tipo de etapa inválido');
      const start = calendarDate(stage.start), end = stage.end ? calendarDate(stage.end) : undefined;
      if (end && ((start.length === 10) !== (end.length === 10) || Date.parse(end) < Date.parse(start))) throw Error('Intervalo de etapa inválido');
      const sourceUrl = text(stage.sourceUrl, 2000), checkedAt = calendarDate(stage.checkedAt);
      if (!isOfficialSourceUrl(sourceUrl, [source]) || checkedAt.length === 10 || Date.parse(checkedAt) > Date.now()+60_000) throw Error('Etapa exige fonte oficial e conferência válida');
      return { id: id(stage.id), name: text(stage.name, 160), kind, start, ...(end ? { end } : {}), sourceUrl, checkedAt };
    });
    if (new Set(stages.map(s => s.id)).size !== stages.length) throw Error('Etapas repetidas');
    return { id: id(edition.id), name: text(edition.name, 160), stages };
  });
  if (new Set(editions.map(e => e.id)).size !== editions.length) throw Error('Edições repetidas');
  return { ...(primaryType ? { primaryType } : {}), ...(subtype ? { subtype } : {}), areas: [...new Set(data.areas)] as string[], editions };
}

/** Conservative hints from the title and already verified categories, never from audience guesses. */
export function classifyDiscovery(title: string, categories: readonly string[] = []): Discovery {
  const rules: [string,RegExp][] = [
    ["matematica",/\bmatem[áa]tica/iu], ["fisica",/\bf[íi]sica/iu], ["quimica",/\bqu[íi]mica/iu],
    ["biologia",/\bbiologia/iu], ["astronomia",/\bastronomia|aeroespacial/iu],
    ["robotica",/\brob[óo]tica/iu], ["ia",/\bintelig[êe]ncia artificial/iu],
    ["tecnologia",/\bprogramaç[ãa]o|desenvolvimento de software/iu],
  ];
  const primaryType = ["competicoes","eventos","formacao","pesquisa","bolsas","intercambios","carreira"].find(c=>categories.includes(c));
  const subtype = categories.includes("competicoes") && /\bolimp[íi]ada/iu.test(title) ? "olimpiada"
    : categories.includes("competicoes") && /\bhackathon/iu.test(title) ? "hackathon" : undefined;
  return { ...(primaryType?{primaryType}:{}), ...(subtype?{subtype}:{}), areas:rules.filter(([,pattern])=>pattern.test(title)).map(([area])=>area), editions:[] };
}
