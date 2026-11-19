import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { candidateUrl } from '@/lib/discovery/documents';
import { auditedUfscPage } from './ufsc-discovery-policy';
import { explicitDatesToNumeric } from './explicit-dates';
import { eventHasNotStarted, eventStartFromText, parseEventStart } from './event-start';
import { confirmedTerminalStatus } from './publication';
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

/** Narrow, recorded official templates; missing dates and unrelated hosts remain held. */
export function prepareAuditedAnnouncement(article: Article, source: OfficialSource, now = new Date()): Prepared {
  const ceremony = obqCeremony(article, source, now);
  if (ceremony !== undefined) return ceremony;
  if (!auditedUfscPage(source)) return undefined;
  return petVolunteers(article, source, now) ?? ufscCalendar(article, source, now);
}
