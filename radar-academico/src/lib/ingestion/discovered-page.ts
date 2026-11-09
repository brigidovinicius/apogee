import * as cheerio from "cheerio";
import { normalizeOpportunity, relevantOpportunityContent } from "./normalize-opportunity";
import { asObject, publicText, structuredEvents } from "./structured-events";
import { normalizeLuma } from "./normalize-expansion";
import type { OfficialSource, OpportunityCandidate } from "./types";
import { brazilianStateCode } from "@/lib/location";
import { normalizePublicEvent } from "./public-event";
import { detectDeadline } from './detect-deadline';
import { classifyApplicationRoute } from './classify-application-route';
import { deadlineIsCurrent } from './publication';
import { normalizeServiceEvent } from './normalize-service-event';

export const isDiscoveredPageSource = (source: Pick<OfficialSource, "id">) => source.id.startsWith("auto-page-");
const clean = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();

/** Shared semantic HTML extraction; dedicated source normalizers keep their own policy. */
export function singleOpportunityArticle(html: string) {
  const $ = cheerio.load(html);
  $("script,style,noscript,nav,footer,aside,.entry-meta,.postmetadata,[class*='related'],.post-navigation").remove();
  $('.section__page__hero__meta,.headNews > .meta').remove();
  const articles = $("article");
  // Single-post themes render recommendations as sibling <article> cards.
  // Only one primary article may contain an h1; archive/list pages still fail.
  const wpPrimary = $('body.single-post article').filter((_, node) => $(node).find('h1').length > 0);
  const elementor = $('body.single-post .elementor-location-single');
  const postDetail = $('body.single-post #primary .post-detail-holder');
  if (elementor.length + postDetail.length > 1 || wpPrimary.length > 1) return null;
  if (articles.length > 1 && !elementor.length && !postDetail.length && wpPrimary.length !== 1) return null;
  const themedRoot = elementor.length ? elementor : postDetail;
  const themedBody = elementor.length ? elementor.find('.elementor-widget-theme-post-content') : postDetail.find('.entry-content');
  if (themedRoot.length) {
    const title = elementor.length ? elementor.find('.elementor-widget-theme-post-title h1') : postDetail.children('h1.entry-title');
    if (title.length !== 1 || themedBody.length !== 1 || themedBody.find('h1').length) return null;
    themedBody.prepend(title.clone());
  }
  // Joomla keeps the title beside the body, without a semantic <article>.
  // Read only that body; modules and publication metadata are not evidence.
  const joomla = $('.com-content-article.item-page');
  const joomlaBody = joomla.find('.com-content-article__body');
  if (joomla.length) {
    if (joomla.length !== 1 || joomlaBody.length !== 1 || joomla.find('h1').length !== 1) return null;
    const heading = joomla.find('h1');
    if (!joomlaBody.find('h1').length) joomlaBody.prepend(heading.clone());
  }
  // The institutional WordPress theme has a site h1 outside its detail block.
  const institutional = $('body.wp-singular #conteudo > #artigos > .artigo');
  if (institutional.length > 1) return null;
  // WordPress block themes may repeat the exact page title in a cover banner.
  const wpTitle = $('h1.wp-block-post-title'), wpContent = $('.wp-block-post-content');
  if (wpTitle.length === 1 && wpContent.length === 1) {
    const title = clean(wpTitle.text());
    if (!title || wpContent.find('h1').toArray().some(node => clean($(node).text()) !== title)) return null;
    wpContent.find('h1').remove();
    wpContent.prepend($('<h1>').text(title));
    if (wpTitle.closest('.wp-block-post-content').length === 0) wpTitle.remove();
  }
  const article = themedRoot.length === 1 ? themedBody : wpPrimary.length === 1 ? wpPrimary :
    joomla.length === 1 ? joomlaBody : institutional.length === 1 ? institutional :
    wpContent.length === 1 && wpTitle.length === 1 ? wpContent :
    articles.length === 1 && articles.find('h1').length === 1 ? articles :
      $('.cps-texto-conteudo').length === 1 ? $('.cps-texto-conteudo') : $('main,[role="main"]');
  if (article.length !== 1 || article.find("h1").length !== 1) return null;
  const title = clean(article.find("h1").first().text());
  const articleHtml = article.html() ?? '';
  article.find('br').replaceWith(' ');
  article.find("p,div,h1,h2,h3,li,a").append(" ");
  const text = clean(article.text()).slice(0, 30_000);
  return title && text ? { title, text, html: articleHtml } : null;
}

/** A detail page must identify one opportunity; navigation and mixed listings fail closed. */
export function normalizeDiscoveredPage(html: string, source: OfficialSource): OpportunityCandidate | null {
  const events = structuredEvents(html);
  if (events.length && (new URL(source.baseUrl).hostname !== "luma.com" ||
    events[0].eventAttendanceMode === "https://schema.org/OnlineEventAttendanceMode")) {
    return events.length === 1 ? normalizePublicEvent(html, events[0], source) : null;
  }
  if (new URL(source.baseUrl).hostname === "luma.com") {
    if (events.length !== 1) return null;
    const event = events[0];
    const organizer = (Array.isArray(event.organizer) ? event.organizer : [event.organizer])
      .map(asObject).find(org => typeof org?.name === "string" && clean(org.name) === clean(source.institutionName));
    const address = asObject(asObject(event.location)?.address);
    const region = address?.addressRegion;
    const state = brazilianStateCode(region);
    const authorityUrl = /; authority=(.+)$/.exec(source.notes ?? "")?.[1];
    const description = typeof event.description === "string" ? clean(publicText(event.description)).slice(0, 2000) : "";
    // Luma city aggregators do not establish an organizer's identity. Only an
    // independently verified organizer calendar can authorize these events.
    if (!organizer || typeof organizer.url !== "string" || organizer.url !== authorityUrl ||
      !state || typeof address?.addressLocality !== "string" ||
      typeof event.name !== "string" || event.url !== source.baseUrl ||
      !/hackathon|workshop|\bia\b|inteligência artificial|programaç|tecnologia|empreendedor|startup|ciência|carreira|builders|pitch/i
        .test(`${event.name} ${typeof event.description === "string" ? publicText(event.description) : ""}`)) return null;
    return normalizeLuma(html, source, {
      id: source.id, url: source.baseUrl, title: clean(event.name), organizer: source.institutionName,
      organizer_name: String(organizer.name), organizer_url: organizer.url,
      state: String(state), city: address.addressLocality,
      checks: description ? [description] : [], competition: /hackathon|competição|desafio/i.test(event.name),
      requirements: description || "Consulte os requisitos na página oficial do organizador.",
      conditions: "Consulte as condições do evento na fonte oficial.",
    }, new Date());
  }
  const article = singleOpportunityArticle(html);
  if (!article || !relevantOpportunityContent(article.title, article.text)) return null;
  const service = normalizeServiceEvent(article, source);
  return service === undefined ? normalizeOpportunity({ ...article, url: source.baseUrl, source }) : service;
}

/** Explain a failed generic extraction without turning incomplete text into a candidate. */
export function discoveredPageFailureReason(html: string) {
  if (structuredEvents(html).length) return 'candidate_unconfirmed';
  const article = singleOpportunityArticle(html);
  if (!article) return 'detail_layout_unrecognized';
  if (!relevantOpportunityContent(article.title, article.text)) return 'irrelevant_link';
  const text = `${article.title} ${article.text}`;
  const deadline = detectDeadline(text);
  if (deadline.precision === 'not_informed') return 'invalid_deadline';
  if (!deadlineIsCurrent({ deadlineAt: deadline.deadlineAt, deadlinePrecision: deadline.precision })) return 'expired';
  if (classifyApplicationRoute(text) === 'unclear') return 'application_route_unconfirmed';
  return 'candidate_unconfirmed';
}
