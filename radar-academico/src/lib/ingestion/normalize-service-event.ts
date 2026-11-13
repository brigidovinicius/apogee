import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { candidateUrl } from '@/lib/discovery/documents';
import { explicitDatesToNumeric } from './explicit-dates';
import { eventHasNotStarted, eventStartFromText } from './event-start';
import { detectDeadline } from './detect-deadline';
import { confirmedTerminalStatus } from './publication';
import type { OfficialSource, OpportunityCandidate } from './types';
import { classifyDiscovery } from './discovery';

const clean = (value: string) => value.normalize('NFC').replace(/\s+/gu, ' ').trim();

/** One official event service, with an explicit edition/date and an actionable ticket link.
 * It never follows the registration destination or derives a closing date or timezone.
 */
export function normalizeServiceEvent(article: { title: string; text: string; html: string },
  source: OfficialSource, now = new Date()): OpportunityCandidate | null | undefined {
  if (!source.categories.includes('eventos')) return undefined;
  const $ = cheerio.load(article.html);
  const headings = $('h2,h3,h4').filter((_, node) => /^serviço$/iu.test(clean($(node).text())));
  if (!headings.length) return undefined;
  if (headings.length !== 1) return null;
  const service = headings.nextUntil('h1,h2,h3,h4');
  const copy = service.clone();
  copy.find('br').replaceWith('\n'); copy.filter('p,div,li').append('\n'); copy.find('p,div,li').append('\n');
  const lines = copy.text().split('\n').map(clean).filter(Boolean);
  if (!lines.some(line => line.startsWith('Ingressos:'))) return undefined;
  const field = (name: string) => {
    const matches = lines.filter(line => line.startsWith(name + ':'));
    return matches.length === 1 ? clean(matches[0].slice(name.length + 1)) : null;
  };
  const name = lines[0], date = field('Data'), entry = field('Entrada'), tickets = field('Ingressos');
  if (!name || name.length < 8 || !article.title.toLocaleLowerCase('pt-BR').startsWith(name.toLocaleLowerCase('pt-BR')) ||
    !date || !entry || !tickets) return null;
  const numericDate = explicitDatesToNumeric(date);
  if (!/^\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\((?:(?:segunda|terça|quarta|quinta|sexta)-feira|sábado|domingo)\))?$/iu.test(numericDate)) return null;
  const start = eventStartFromText('Data do evento: ' + numericDate);
  if (!start) return null;
  const applications = service.find('a[href]').toArray().flatMap(node => {
    const link = $(node);
    if (link.is('[disabled],[aria-disabled="true"],[hidden]') || link.parents('[hidden],[aria-hidden="true"]').length ||
      !/^(?:retire(?: seus?| os)?(?: ingressos?)?|retirada de ingressos|comprar ingressos?|garanta (?:seu|o) ingresso|inscreva-se)\b/iu.test(clean(link.text()))) return [];
    try {
      const url = candidateUrl(new URL(link.attr('href')!, source.baseUrl).href);
      return url ? [{ url, label: clean(link.text()) }] : [];
    } catch { return []; }
  });
  if (new Set(applications.map(item => item.url)).size !== 1) return null;
  const application = applications[0];
  const deadline = detectDeadline(article.text);
  // A ticket-specific closing statement needs its own date extraction; it must
  // not fall through to the policy for genuinely absent registration deadlines.
  if (deadline.stated && deadline.precision === 'not_informed' ||
    /\bingressos?\b.{0,80}(?:até|prazo|data limite)(?!\p{L})/iu.test(article.text)) return null;
  const terminal = confirmedTerminalStatus(article.text, article.title) ??
    (/\bingressos?\s+(?:estão\s+)?(?:esgotados?|indisponíveis)|retirada de ingressos\s+encerrada/iu.test(article.text) ? 'closed' : null);
  const status = terminal ?? (eventHasNotStarted(start, now) ? 'open' : 'closed');
  const proof = (excerpt: string) => ({ source_url: source.baseUrl, excerpt });
  const serviceText = lines.join('; ');
  return { officialSourceId: source.id, title: article.title, institution: source.institutionName,
    sourcePageUrl: source.baseUrl, applicationUrl: application.url, applicantType: 'mixed',
    applicationRoute: 'direct_application', benefitType: 'other', categories: ['eventos'],
    isCourse: false, nationallyEligible: false, geographicScopeKind: 'unknown', countryCode: null,
    stateCode: null, cityName: null, eventStartsAt: start,
    deadlinePrecision: deadline.precision, ...(deadline.deadlineAt ? { deadlineAt: deadline.deadlineAt } : {}),
    opportunityStatus: status, reviewStatus: 'needs_information', extractionMethod: 'html',
    requirementsText: `${serviceText}. Retirada sujeita à disponibilidade e às regras na fonte oficial.`,
    amountText: entry,
    evidenceJson: { event_start: proof(`Data: ${date}`),
      registration_availability: proof(`Ingressos: ${tickets}; ${application.label}; ${application.url}`),
      opportunity_status: proof(`${serviceText}; ${terminal ?? application.label}`),
      ...(deadline.deadlineAt ? { deadline_at: proof(article.text) } : {}) },
    discovery: { ...classifyDiscovery(article.title, ['eventos']), editions: [{ id: source.id, name: article.title,
      stages: [{ id: 'event', name: 'Realização', kind: 'event', start, sourceUrl: source.baseUrl, checkedAt: now.toISOString() }] }] },
    contentHash: createHash('sha256').update(`service-event:v1\n${article.text}\n${application.url}`).digest('hex') };
}
