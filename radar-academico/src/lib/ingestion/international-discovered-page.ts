import * as cheerio from 'cheerio';
import { createHash } from 'node:crypto';
import { fetchOfficialResource } from './fetch-source';
import { isOfficialSourceUrl } from './validate-url';
import { structuredEvents } from './structured-events';
import { singleOpportunityArticle, normalizeDiscoveredPage, discoveredPageFailureReason } from './discovered-page';
import type { OfficialSource, OpportunityCandidate } from './types';
import { weMakeDevsEligibilityText, isWeMakeDevsHackathonSource } from './normalize-wemakedevs';

export const BRAZIL_ELIGIBILITY_TOPIC = 'eligibility-br-required';
const policyNote = 'radar:eligibility-br-required:v1';
export const internationalEligibilityNote = (topics: readonly string[] = []) => topics.includes(BRAZIL_ELIGIBILITY_TOPIC) ? `; ${policyNote}` : '';
export const requiresBrazilEligibility = (source: OfficialSource) => source.notes?.includes(policyNote) === true;
const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/gu, ' ').toLowerCase().trim();

function eligibility(text: string): 'excluded' | 'eligible' | 'unknown' {
  const value = fold(text);
  // A platform saying "global" does not override its actual exclusion list.
  if (/(?:not open to|not eligible|ineligible|exclud(?:ed|ing|es)|except\s+(?:residents? of\s+)?|specific countries.{0,30}excluded|nao podem participar|nao elegiveis|excluid[oa]s?|exceto).{0,900}\b(?:brazil|brasil|brazilians?)\b/u.test(value) ||
    /\b(?:brazil|brasil|brazilians?)\b.{0,100}\b(?:not eligible|not permitted|not allowed|cannot (?:participate|enter|apply)|may not (?:participate|enter|apply)|are excluded|is excluded|nao podem|proibid)/u.test(value)) return 'excluded';
  if (/\b(?:only|exclusively).{0,25}\b(?:residents?|citizens?|based in).{0,100}/u.test(value) &&
    !/\b(?:only|exclusively).{0,25}\b(?:residents?|citizens?|based in).{0,100}\b(?:brazil|brasil)\b/u.test(value)) return 'unknown';
  // Require a participation statement. A registration button near a mention
  // of Brazil or a worldwide sponsor does not establish geographic eligibility.
  if (/\bwho can (?:take part|participate)\? (?:developers|participants|entrants) from anywhere in the world\b/u.test(value)) return 'eligible';
  if (/\b(?:open|welcome) to (?:(?:all|eligible) )?(?:participants?|entrants?|developers?|startups?|teams?|students?|anyone|people|residents?) (?:from )?(?:worldwide|anywhere(?: in the world)?|any country|all countries|around the world|brazil|brasil)\b/u.test(value) ||
    /\b(?:participation|entry|applications?) (?:is|are) open (?:worldwide|to (?:all countries|brazil|brasil))\b/u.test(value) ||
    /\b(?:open worldwide|brazilians? (?:are eligible|may apply|can participate)|residents? (?:of|in) (?:brazil|brasil) (?:are eligible|may apply|can participate)|(?:aberto|aberta) (?:a|para) (?:participantes|pessoas|equipes|estudantes|residentes) (?:de|do|em) (?:todo o mundo|qualquer pais|brasil)|(?:residentes no brasil|brasileiros) podem participar)\b/u.test(value)) return 'eligible';
  return 'unknown';
}

function documentText(html: string) {
  const $ = cheerio.load(html);
  $('script,style,noscript,nav,header,footer,aside').remove();
  $('p,div,li,h1,h2,h3,h4,h5,h6,br').append(' ');
  // Transport already bounds the document to 2 MiB. Do not truncate an
  // exclusion list that appears after a long introduction to the rules.
  return { $, text: $('body').text().replace(/\s+/gu, ' ').trim() };
}

/** One additional rules page, within the same audited host/path and request budget. */
export async function prepareDiscoveredPage(html: string, source: OfficialSource, reserveRulePage: () => boolean = () => true): Promise<{ candidate: OpportunityCandidate } | { reason: string }> {
  let proof: { source_url: string; excerpt: string; supporting_url?: string; supporting_sha256?: string } | undefined;
  if (requiresBrazilEligibility(source)) {
    const { $, text } = documentText(html);
    if (eligibility(text) === 'excluded') return { reason: 'eligibility_br_excluded' } as const;
    const links = new Set<string>();
    let invalidLink = false;
    $('a[href]').each((_, element) => {
      const label = $(element).text().trim();
      if (!/\brules?\b|\bregulamentos?\b|\beligibility\b|\beligibilidade\b|\bterms\s*(?:and|&)\s*conditions\b|\btermos\s+e\s+condi[çc][õo]es\b/iu.test(label)) return;
      try {
        const url = new URL($(element).attr('href')!, source.baseUrl); url.hash = '';
        const base = new URL(source.baseUrl), childPrefix = base.pathname.replace(/\/$/, '') + '/';
        const linkScope = { ...source, id: 'eligibility-link-proof' };
        if (url.origin !== base.origin || !(url.pathname === base.pathname || url.pathname.startsWith(childPrefix)) || !isOfficialSourceUrl(url.href, [linkScope])) invalidLink = true;
        else links.add(url.href);
      } catch { invalidLink = true; }
    });
    if (invalidLink || links.size > 1) return { reason: 'eligibility_br_unconfirmed' } as const;
    let evidenceText: string;
    let evidenceUrl = source.baseUrl;
    let rulesHash: string | undefined;
    if (links.size) {
      if (!reserveRulePage()) return { reason: 'processing_budget_exhausted' } as const;
      evidenceUrl = [...links][0];
      // Keep the original page's authority unchanged. Its actual rules link
      // grants one exact child URL a separate, non-persistent transport policy.
      const rulesSource = { ...source, id: 'auto-page-rules-' + createHash('sha256').update(evidenceUrl).digest('hex').slice(0, 32), baseUrl: evidenceUrl,
        allowedPathPrefixes: [new URL(evidenceUrl).pathname], listingUrls: [evidenceUrl] };
      const rules = await fetchOfficialResource(evidenceUrl, rulesSource, 2 * 1024 * 1024);
      if (!/text\/html|application\/xhtml/i.test(rules.contentType)) return { reason: 'eligibility_br_unconfirmed' } as const;
      evidenceText = documentText(rules.body.toString('utf8')).text;
      rulesHash = rules.hash;
    } else {
      // A footer's worldwide community slogan is not participation evidence.
      const events = structuredEvents(html);
      evidenceText = singleOpportunityArticle(html)?.text || weMakeDevsEligibilityText(html, source) || (events.length === 1 && typeof events[0].description === 'string' ? events[0].description : '');
    }
    const result = eligibility(evidenceText);
    if (result !== 'eligible') return { reason: result === 'excluded' ? 'eligibility_br_excluded' : 'eligibility_br_unconfirmed' } as const;
    const match = /open|eligible|worldwide|brazil|brasil|aberto|aceita/iu.exec(evidenceText);
    const start = Math.max(0, (match?.index ?? 0) - 80);
    proof = { source_url: source.baseUrl, excerpt: (rulesHash ? `Regras vinculadas pela página: ${evidenceUrl}. ` : '') + evidenceText.slice(start, start + 700),
      ...(rulesHash ? { supporting_url: evidenceUrl, supporting_sha256: rulesHash } : {}) };
  }
  const candidate = normalizeDiscoveredPage(html, source);
  if (!candidate) return { reason: isWeMakeDevsHackathonSource(source) ? 'candidate_unconfirmed' : discoveredPageFailureReason(html) };
  if (proof) candidate.evidenceJson.eligibility_br = proof;
  return { candidate };
}
