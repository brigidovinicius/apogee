import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { candidateUrl } from '@/lib/discovery/documents';
import { auditedUfscPage, UFSC_DAC_PERFORMANCE_URL, UFSC_ENSUS_URL, UFSC_SECARTE_PERFORMANCE_URL } from './ufsc-discovery-policy';
import { explicitDatesToNumeric } from './explicit-dates';
import { eventHasNotStarted, eventStartFromText, parseEventStart } from './event-start';
import { confirmedTerminalStatus, deadlineIsCurrent } from './publication';
import { detectDeadline } from './detect-deadline';
import type { OfficialSource, OpportunityCandidate } from './types';

type Article = { title: string; text: string; html: string };
type Prepared = { candidate: OpportunityCandidate } | { reason: string } | undefined;
const clean = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim();

function base(article: Article, source: OfficialSource): OpportunityCandidate {
  return { officialSourceId: source.id, title: article.title, institution: source.institutionName,
    sourcePageUrl: source.baseUrl, applicantType: 'mixed', applicationRoute: 'direct_application',
    benefitType: 'other', categories: ['eventos'], isCourse: false, nationallyEligible: false,
    geographicScopeKind: 'unknown', countryCode: null, stateCode: null, cityName: null,
    deadlinePrecision: 'not_informed', opportunityStatus: 'open', reviewStatus: 'needs_information',
    requirementsText: article.text.slice(0, 6000), amountText: 'Valor não informado na fonte oficial.',
    extractionMethod: 'html', evidenceJson: {},
    contentHash: createHash('sha256').update(`audited-announcement:v1\n${article.text}\n${article.html}`).digest('hex') };
}

/** Explicit attendance confirmation for the OBQ ceremony, not a new competition. */
function obqCeremony(article: Article, source: OfficialSource, now: Date): Prepared {
  const url = new URL(source.baseUrl);
  if (url.hostname !== 'obquimica.org' || !/^\/noticias\/premiacao-nacional-das-olimpiadas-de-quimica-20\d{2}\/?$/.test(url.pathname)) return undefined;
  const $ = cheerio.load(article.html);
  const section = $('h2').filter((_, node) => clean($(node).text()).toLowerCase() === 'confirmação de presença');
  const dates = $('li').map((_, node) => clean($(node).text())).get().filter(text => /^Data:\s/iu.test(text));
  if (section.length !== 1 || dates.length !== 1) return { reason: 'candidate_unconfirmed' };
  const start = eventStartFromText('Data do evento: ' + explicitDatesToNumeric(dates[0].replace(/^Data:\s*/iu, '')));
  if (start?.slice(0, 4) !== /20\d{2}/.exec(url.pathname)?.[0]) return { reason: 'invalid_deadline' };
  const links = section.nextUntil('h1,h2').find('a[href]').toArray().flatMap(node => {
    if ($(node).is('[hidden],[disabled],[aria-disabled="true"]') || $(node).parents('[hidden],[aria-hidden="true"]').length) return [];
    const label = clean($(node).text());
    if (!/confirmar\s+(?:sua\s+)?presença/iu.test(label)) return [];
    try { const url = candidateUrl(new URL($(node).attr('href')!, source.baseUrl).href); return url ? [{ url, label }] : []; }
    catch { return []; }
  });
  if (!start || new Set(links.map(link => link.url)).size !== 1) return { reason: 'application_route_unconfirmed' };
  const deadline = detectDeadline(article.text);
  if (deadline.stated || deadline.precision !== 'not_informed') return { reason: 'invalid_deadline' };
  const proof = (excerpt: string) => ({ source_url: source.baseUrl, excerpt });
  return { candidate: { ...base(article, source), eventStartsAt: start, applicationUrl: links[0].url,
    opportunityStatus: confirmedTerminalStatus(article.text, article.title) ?? (eventHasNotStarted(start, now) ? 'open' : 'closed'),
    evidenceJson: { event_start: proof(dates[0]), registration_availability: proof(`${links[0].label}; ${links[0].url}`),
      opportunity_status: proof(clean(section.nextUntil('h1,h2').text())) } } };
}

/** The PET call states its edition year, registration range and unpaid nature. */
function petVolunteers(article: Article, source: OfficialSource, now: Date): Prepared {
  if (new URL(source.baseUrl).hostname !== 'petletras.paginas.ufsc.br' ||
    !/^EDITAL\s+\d+\/(20\d{2})\/PET\s*[–-]\s*SELEÇÃO DE VOLUNTÁRIOS/iu.test(article.title)) return undefined;
  const year = /EDITAL\s+\d+\/(20\d{2})\/PET/iu.exec(article.title)![1];
  const range = /início\s+às\s+\d{1,2}h\s+do dia\s+(\d{1,2})\s+de\s+(\p{L}+)\s+e\s+se estenderá\s+até\s+às\s+\d{1,2}h\s+do dia\s+(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(20\d{2})/iu.exec(article.text);
  if (!range || range[5] !== year || !/estudantes não bolsistas\s*[–-]\s*voluntários/iu.test(article.text) ||
    !/inscrições.{0,100}somente por meio de envio.{0,180}e-mail/iu.test(article.text)) return { reason: 'candidate_unconfirmed' };
  const date = (day: string, month: string) => {
    const numeric = explicitDatesToNumeric(`${day} de ${month} de ${year}`);
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(numeric);
    try { return match ? parseEventStart(`${match[3]}-${match[2]}-${match[1]}`) : null; }
    catch { return null; }
  };
  const first = date(range[1], range[2]), last = date(range[3], range[4]);
  if (!first || !last || last < first) return { reason: 'invalid_deadline' };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const proof = { source_url: source.baseUrl, excerpt: range[0] };
  return { candidate: { ...base(article, source), benefitType: 'unpaid_opportunity', categories: ['formacao'],
    applicantType: 'undergraduate_student', applicationRoute: 'direct_student_application',
    deadlineAt: last, deadlinePrecision: 'date_only',
    opportunityStatus: confirmedTerminalStatus(article.text, article.title) ?? (last < today ? 'closed' : first > today ? 'upcoming' : 'open'),
    amountText: 'Vaga voluntária, sem bolsa.', evidenceJson: { deadline_at: proof, opportunity_status: proof } } };
}

function ufscCalendar(article: Article, source: OfficialSource, now: Date): Prepared {
  if (new URL(source.baseUrl).hostname !== 'noticias.ufsc.br' || !new URL(source.baseUrl).pathname.startsWith('/event/')) return undefined;
  const $ = cheerio.load(article.html), event = $('.ai1ec-single-event');
  if (event.length !== 1) return { reason: 'detail_layout_unrecognized' };
  // An occurrence of an exhibition/congress must not restart the whole event
  // or create a separate opportunity for each calendar instance_id.
  if (event.find('.ai1ec-recurrence').length) return { reason: 'listing_or_ambiguous' };
  const starts = event.find('.dt-start');
  const availability = /(?:o )?evento é gratuito e aberto ao público/iu.exec(article.text);
  if (starts.length !== 1 || !availability) return { reason: 'application_route_unconfirmed' };
  let start: string | null;
  try { start = parseEventStart(clean(starts.text())); } catch { return { reason: 'invalid_deadline' }; }
  if (!start) return { reason: 'invalid_deadline' };
  const deadline = detectDeadline(article.text);
  if (deadline.stated || deadline.precision !== 'not_informed') return { reason: 'invalid_deadline' };
  const proof = (excerpt: string) => ({ source_url: source.baseUrl, excerpt });
  return { candidate: { ...base(article, source), eventStartsAt: start,
    amountText: 'Evento gratuito e aberto ao público.',
    opportunityStatus: confirmedTerminalStatus(article.text, article.title) ?? (eventHasNotStarted(start, now) ? 'open' : 'closed'),
    evidenceJson: { event_start: proof(clean(starts.text())), registration_availability: proof(availability[0]),
      opportunity_status: proof(availability[0]) } } };
}

const hiddenControls = '[hidden],[disabled],[aria-disabled="true"],[aria-hidden="true"]';

function ufscEnsus(article: Article, source: OfficialSource, now: Date): Prepared {
  if (source.baseUrl !== UFSC_ENSUS_URL) return undefined;
  if (!/^ENSUS 2027 abre inscrições e submissão de trabalhos científicos$/iu.test(article.title)) {
    return { reason: 'candidate_unconfirmed' };
  }
  const $ = cheerio.load(article.html);
  $(hiddenControls).remove();
  const rows = $('li').map((_, node) => clean($(node).text())).get();
  const deadlineRows = rows.filter(text => /^Prazo para submissão de trabalhos:/iu.test(text));
  const eventRows = rows.filter(text => /^Realização do evento:/iu.test(text));
  const range = /^Realização do evento:\s*(\d{1,2})\s+a\s+(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(2027)\.?$/iu.exec(eventRows[0] ?? '');
  const deadline = detectDeadline(deadlineRows[0] ?? '');
  if (deadlineRows.length !== 1 || eventRows.length !== 1 || !range ||
    deadline.precision !== 'date_only' || !deadline.deadlineAt) return { reason: 'invalid_deadline' };
  const start = ufscDay(`${range[1]} de ${range[3]} de ${range[4]}`);
  const end = ufscDay(`${range[2]} de ${range[3]} de ${range[4]}`);
  if (!start || !end || end < start || deadline.deadlineAt >= start) return { reason: 'invalid_deadline' };
  const submissionLinks = $('p').filter((_, node) => /^As orientações para submissão\b/iu.test(clean($(node).text())))
    .find('a[href]').map((_, node) => $(node).attr('href') ?? '').get();
  const applicationUrl = 'https://www.even3.com.br/ensus-2027-783898/';
  if (submissionLinks.length !== 1 || submissionLinks[0] !== applicationUrl) return { reason: 'application_route_unconfirmed' };
  const availability = $('p').map((_, node) => clean($(node).text())).get()
    .find(text => /^Estão abertas as submissões de trabalhos para o XV Encontro de Sustentabilidade em Projeto \(ENSUS 2027\)/iu.test(text));
  const terminal = confirmedTerminalStatus(article.text, article.title);
  if (!availability && !terminal) return { reason: 'status_unconfirmed' };
  const proof = (excerpt: string) => ({ source_url: source.baseUrl, excerpt });
  return { candidate: { ...base(article, source), title: 'ENSUS 2027 — Submissão de trabalhos científicos',
    categories: ['eventos', 'pesquisa'], stateCode: 'SC', cityName: 'Florianópolis', countryCode: 'BR', geographicScopeKind: 'city',
    applicationUrl, deadlineAt: deadline.deadlineAt, deadlinePrecision: deadline.precision, eventStartsAt: start,
    opportunityStatus: terminal ?? (deadlineIsCurrent({ deadlineAt: deadline.deadlineAt, deadlinePrecision: deadline.precision }, now) ? 'open' : 'closed'),
    requirementsText: 'Modalidade presencial para o encontro, na UFSC em Florianópolis. Pesquisadores, estudantes e profissionais podem submeter trabalhos em sustentabilidade. Consulte o regulamento oficial.',
    evidenceJson: { deadline_at: proof(deadlineRows[0]), event_start: proof(eventRows[0]),
      application_route: proof(`Plataforma de submissão indicada pela UFSC: ${applicationUrl}`),
      opportunity_status: proof(terminal ? article.text.slice(0, 1000) : availability!) },
    discovery: { primaryType: 'eventos', areas: ['ambiente', 'tecnologia'], editions: [{ id: 'ensus-2027',
      name: 'XV Encontro de Sustentabilidade em Projeto', stages: [
        { id: 'submissao', name: 'Prazo para envio de trabalhos', kind: 'registration', start: deadline.deadlineAt, sourceUrl: source.baseUrl, checkedAt: now.toISOString() },
        { id: 'encontro', name: 'Realização do ENSUS 2027', kind: 'event', start, end, sourceUrl: source.baseUrl, checkedAt: now.toISOString() },
      ] }] } } };
}

function ufscDay(value: string) {
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(explicitDatesToNumeric(value));
  try { return date ? parseEventStart(`${date[3]}-${date[2]}-${date[1]}`) : null; }
  catch { return null; }
}

function ufscOpenCulture(article: Article, source: OfficialSource, now: Date): Prepared {
  if (source.baseUrl !== UFSC_SECARTE_PERFORMANCE_URL && source.baseUrl !== UFSC_DAC_PERFORMANCE_URL) return undefined;
  if (!/^Performance\s+[“"]Nada Será Devolvido em Silêncio[”"]$/iu.test(article.title)) return { reason: 'candidate_unconfirmed' };
  const $ = cheerio.load(article.html);
  $(hiddenControls).remove();
  const service = $('p').filter((_, node) => /^O quê:\s*Performance Nada Será Devolvido em Silêncio/iu.test(clean($(node).text())));
  if (service.length !== 1) return { reason: 'detail_layout_unrecognized' };
  service.find('br').replaceWith('\n');
  const lines = service.text().split('\n').map(clean);
  const when = lines.find(line => /^Quando:/iu.test(line));
  const where = lines.find(line => /^Onde:.*Teatro Carmen Fossari.*Florianópolis\s*[-–]\s*SC/iu.test(line));
  const entry = lines.find(line => /^Quanto:\s*Evento gratuito e aberto a toda a comunidade\.?$/iu.test(line));
  if (!entry || !where) return { reason: 'application_route_unconfirmed' };
  const date = /^Quando:\s*(\d{2})\/(\d{2})\/(\d{4})\s*\|\s*sexta-feira\s*\|\s*(\d{1,2})h(\d{2})?$/iu.exec(when ?? '');
  let start: string | null = null;
  try {
    if (date) start = parseEventStart(`${date[3]}-${date[2]}-${date[1]}T${date[4].padStart(2, '0')}:${date[5] ?? '00'}:00-03:00`);
  } catch { return { reason: 'invalid_deadline' }; }
  const deadline = detectDeadline(article.text);
  if (!start || !when || deadline.stated || deadline.precision !== 'not_informed') return { reason: 'invalid_deadline' };
  const proof = (excerpt: string) => ({ source_url: source.baseUrl, excerpt });
  return { candidate: { ...base(article, source), title: 'Performance “Nada Será Devolvido em Silêncio”',
    stateCode: 'SC', cityName: 'Florianópolis', countryCode: 'BR', geographicScopeKind: 'city', eventStartsAt: start,
    requirementsText: `Modalidade presencial. Performance de poesia e música de Énia Lipanga. ${where}`,
    amountText: 'Entrada gratuita e aberta à comunidade.',
    opportunityStatus: confirmedTerminalStatus(article.text, article.title) ?? (eventHasNotStarted(start, now) ? 'open' : 'closed'),
    evidenceJson: { event_start: proof(when), location: proof(where), registration_availability: proof(entry), opportunity_status: proof(entry) },
    discovery: { primaryType: 'eventos', areas: ['artes'], editions: [{ id: 'performance-2026', name: 'Nada Será Devolvido em Silêncio',
      stages: [{ id: 'event', name: 'Realização', kind: 'event', start, sourceUrl: source.baseUrl, checkedAt: now.toISOString() }] }] } } };
}

/** Narrow, recorded official templates; missing dates and unrelated hosts remain held. */
export function prepareAuditedAnnouncement(article: Article, source: OfficialSource, now = new Date()): Prepared {
  const ceremony = obqCeremony(article, source, now);
  if (ceremony !== undefined) return ceremony;
  const ufscEdition = ufscEnsus(article, source, now) ?? ufscOpenCulture(article, source, now);
  if (ufscEdition !== undefined) return ufscEdition;
  if (!auditedUfscPage(source)) return undefined;
  return petVolunteers(article, source, now) ?? ufscCalendar(article, source, now);
}
