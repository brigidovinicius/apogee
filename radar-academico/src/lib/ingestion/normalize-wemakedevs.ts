import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { parseEventStart, eventHasNotStarted } from './event-start';
import { classifyDiscovery } from './discovery';
import type { OfficialSource, OpportunityCandidate } from './types';

const root = 'https://www.wemakedevs.org/hackathons';
const clean = (text: string) => text.replace(/\s+/gu, ' ').trim();

export function isWeMakeDevsHackathonSource(source: OfficialSource) {
  try {
    const url = new URL(source.baseUrl);
    return source.id.startsWith('auto-page-') && source.institutionName === 'WeMakeDevs' &&
      source.notes?.endsWith(`; authority=${root}`) === true && url.origin === new URL(root).origin &&
      /^\/hackathons\/[a-z0-9-]+\/?$/.test(url.pathname) && !url.search;
  } catch { return false; }
}

function template(html: string, source: OfficialSource) {
  if (!isWeMakeDevsHackathonSource(source)) return null;
  const $ = cheerio.load(html);
  $('script,style,noscript,header,footer,nav,aside').remove();
  $('p,div,section,h1,h2,summary,br').append(' ');
  const titles = $('meta[property="og:title"]');
  const title = titles.length === 1 ? clean(titles.attr('content') ?? '').replace(/ \| WeMakeDevs$/, '') : '';
  if (!title || $('h1').length !== 1 || !/hackathon/i.test(title)) return null;
  const faq = (question: string) => {
    const entries = $('details').filter((_, node) => clean($(node).children('summary').text()) === question);
    return entries.length === 1 && entries.children('p').length === 1 ? clean(entries.children('p').text()) : '';
  };
  return { $, title, text: clean($('body').text()), when: faq('When is the hackathon?'), who: faq('Who can take part?'),
    where: faq('Where do I register?'), prizes: faq('What are the prizes?') };
}

/** Only the participation FAQ of this audited organizer template supplies eligibility. */
export function weMakeDevsEligibilityText(html: string, source: OfficialSource) {
  const page = template(html, source);
  return page?.who ? `Who can take part? ${page.who}` : '';
}

/** A project submission date is not an application closing date. */
export function normalizeWeMakeDevsHackathon(html: string, source: OfficialSource, now = new Date()): OpportunityCandidate | null | undefined {
  if (!isWeMakeDevsHackathonSource(source)) return undefined;
  const page = template(html, source);
  if (!page) return null;
  const { $, title, text, when, who, where, prizes } = page;
  const dates = /^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}) to (\d{1,2}), (\d{4})\./.exec(when);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if (!dates || !/\bthe hackathon is online and free to enter\b/i.test(who) ||
    !/\bsign in or create a free WeMakeDevs account, then click Register now on this page\b/i.test(where)) return null;
  // A new registration deadline or terminal notice cannot be silently ignored
  // by this date-only adapter, even if a stale Register button is still present.
  if (/\b(?:registrations?|applications?) (?:is |are )?(?:clos(?:e[ds]?|ing)|ends?|deadline|suspended|cancelled|full|sold out)|\b(?:hackathon|event) (?:is |was )?(?:cancelled|suspended)\b/i.test(text)) return null;
  const date = (day: string) => `${dates[4]}-${String(months.indexOf(dates[1]) + 1).padStart(2,'0')}-${day.padStart(2,'0')}`;
  let start: string | null, end: string | null;
  try { start = parseEventStart(date(dates[2])); end = parseEventStart(date(dates[3])); }
  catch { return null; }
  if (!start || !end || end < start) return null;
  const controls = $('button,a[href]').filter((_, node) => clean($(node).text()) === 'Register now' &&
    !$(node).is('[disabled],[aria-disabled="true"],[hidden]') && !$(node).parents('[hidden],[aria-hidden="true"]').length);
  if (!controls.length) return null;
  const status = eventHasNotStarted(start, now) ? 'open' : 'closed';
  const proof = { source_url: source.baseUrl, excerpt: `${title}. ${when} ${who} ${where} Register now.` };
  const categories: NonNullable<OpportunityCandidate['categories']> = ['competicoes','eventos'];
  return {
    officialSourceId: source.id, title, institution: source.institutionName, sourcePageUrl: source.baseUrl,
    applicationUrl: source.baseUrl, applicantType: 'mixed', applicationRoute: 'direct_application',
    benefitType: prizes && !/\bno prizes?\b/i.test(prizes) ? 'prize' : 'other', categories, isCourse: false, nationallyEligible: false,
    geographicScopeKind: 'global', countryCode: null, stateCode: null, cityName: null,
    eventStartsAt: start, deadlinePrecision: 'not_informed', opportunityStatus: status, reviewStatus: 'needs_information',
    requirementsText: `Formato: online. ${who} ${when} ${where} Consulte as regras e os requisitos do projeto na página oficial. O encerramento das inscrições não é informado; a entrega dos projetos é uma etapa distinta.`,
    amountText: `Participação gratuita. ${prizes || 'Consulte os prêmios e suas condições na página oficial.'}`,
    evidenceJson: { event_start: proof, registration_availability: proof, opportunity_status: proof }, extractionMethod: 'html',
    discovery: { ...classifyDiscovery(title, categories), editions: [{ id: source.id, name: title, stages: [
      { id: 'event', name: 'Realização do hackathon', kind: 'event', start, end, sourceUrl: source.baseUrl, checkedAt: now.toISOString() },
    ] }] },
    contentHash: createHash('sha256').update(JSON.stringify({version:1,title,start,end,who,when,where,prizes,status})).digest('hex'),
  };
}
