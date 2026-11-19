import { readFile, rename, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { SourceError, pageContent, sourceSession, visibleText } from "./benefit-source-check.mjs";

const day = 24 * 60 * 60 * 1000;
const retryDelay = 6 * 60 * 60 * 1000;
const adobeTermsPath = /^\/br\/offer-terms\/[a-z0-9-]+\.html$/;
const maxAdobePages = 12;
const months = "janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro".split(" ");
const brazilDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
const programEnded = ["applications are closed", "no longer accepting applications", "inscrições encerradas", "oferta encerrada"];

const load = async filename => JSON.parse(await readFile(new URL(`../content/${filename}`, import.meta.url), "utf8"));

function officialPage(address) {
  const url = new URL(address);
  return { url: url.href, hosts: [url.hostname], paths: [url.pathname.replace(/\/$/, "") || "/"] };
}

function campaignUrl(address) {
  const url = new URL(address);
  return url.origin + url.pathname.replace(/\/$/, "") + url.hash;
}

function githubCandidates(cards, approved) {
  const known = new Map();
  for (const offer of approved) {
    for (const rule of offer.tests.filter(test => test.pack && test.url === "https://education.github.com/pack")) {
      known.set(rule.pack, new Set([...(known.get(rule.pack) ?? []), ...rule.hashes]));
    }
  }
  const existingTerms = new Set([...known.values()].flatMap(hashes => [...hashes]));
  return [...cards].flatMap(([anchor, terms]) => {
    const hashes = terms.map(term => term.hash);
    if (!terms.length) return [];
    const previous = known.get(anchor);
    if (previous && hashes.every(hash => previous.has(hash)) && [...previous].every(hash => hashes.includes(hash))) return [];
    if (!previous) {
      const benefit = terms.some(({ hash, text }) => !existingTerms.has(hash) && /(?:\d\s*%\s*off|\b(?:credit|credits|discount)\b|\bfree\b.*\b(?:plan|subscription|months?|years?|days?|students?|premium|pro|license|access)\b)/.test(text)
        && !/\b(?:free for everyone|open source by)\b/.test(text));
      if (!benefit) return [];
      for (const hash of hashes) existingTerms.add(hash);
    }
    return [{
      key: anchor,
      evidenceUrl: `https://education.github.com/pack#${anchor}`,
      change: previous ? "terms_changed" : "new_campaign",
      verify: "Conferir a vantagem no cartão, as condições do parceiro, a região e o fluxo para estudante aprovado.",
    }];
  });
}

function adobeTermsLinks(html, index) {
  const links = new Map();
  for (const match of pageContent(html).matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    let url;
    try {
      url = new URL(match[1] ?? match[2], index);
    } catch {
      continue;
    }
    if (url.origin === index.origin && !url.username && !url.password && adobeTermsPath.test(url.pathname)) {
      links.set(url.pathname, url.origin + url.pathname);
    }
  }
  return [...links.values()];
}

function adobeDeadline(text) {
  const date = text.match(/\baté (\d{1,2}) de ([a-zç]+) de (20\d{2})\b/);
  if (!date) return null;
  const [, day, name, year] = date;
  const month = months.indexOf(name) + 1;
  if (!month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function adobeCandidates(source, check, approvedByUrl) {
  const { html, url } = await check.readPage(officialPage(source.url));
  const links = adobeTermsLinks(html, url);
  if (!links.length) throw new SourceError("review", "A página brasileira deixou de expor links de termos no formato esperado.");

  const candidates = [];
  const unresolved = [];
  for (const link of links.slice(0, maxAdobePages)) {
    try {
      const terms = visibleText((await check.readPage(officialPage(link))).html);
      if (!terms.includes("termos e condições") || !terms.includes("oferta") || !/(?:r\$\s*\d|\d\s*%)/.test(terms)) {
        throw new SourceError("review", "Os termos não exibiram uma condição monetária reconhecida.");
      }
      const deadline = adobeDeadline(terms);
      if (deadline && deadline < brazilDate.format(new Date())) {
        throw new SourceError("unavailable", "O prazo de contratação indicado nos termos já passou.");
      }
      const known = approvedByUrl.get(campaignUrl(link));
      if (known && (await check(known)).outcome === "verified") continue;
      candidates.push({
        key: new URL(link).pathname,
        evidenceUrl: link,
        change: known ? "terms_to_review" : "new_campaign",
        deadline,
        verify: "Conferir oferta, público, janela de contratação, duração do desconto, compromisso e renovação no Brasil.",
      });
    } catch (error) {
      unresolved.push({ evidenceUrl: link, ...explain(error) });
    }
  }
  return { candidates, unresolved, remaining: Math.max(0, links.length - maxAdobePages) };
}

function explain(error) {
  return error instanceof SourceError ? { outcome: error.outcome, reason: error.message }
    : { outcome: "temporary", reason: "Sem resposta conclusiva da fonte oficial." };
}

async function inspect(source, approved, approvedByUrl, makeSession) {
  const check = makeSession();
  try {
    if (source.kind === "adobe-br") {
      const result = await adobeCandidates(source, check, approvedByUrl);
      return { outcome: result.unresolved.length || result.remaining ? "partial" : "observed", ...result };
    }
    if (source.kind === "github-education") {
      const cards = await check.readPack(officialPage(source.url));
      return { outcome: "observed", candidates: githubCandidates(cards, approved) };
    }
    const result = await check({ tests: [{ ...officialPage(source.url), markers: source.markers, ended: programEnded }] });
    if (result.outcome !== "verified") return { ...result, candidates: [] };
    const known = approvedByUrl.get(campaignUrl(source.url));
    return {
      outcome: "observed",
      candidates: known && (await check(known)).outcome === "verified" ? [] : [{
        key: source.id,
        evidenceUrl: source.url,
        change: known ? "terms_to_review" : "new_program",
        verify: source.verify,
      }],
    };
  } catch (error) {
    return { ...explain(error), candidates: [] };
  }
}

function previousCandidates(previous, result) {
  if (!previous) return [];
  const retryUrls = new Set(result.unresolved?.filter(item => item.outcome === "temporary").map(item => item.evidenceUrl));
  const existing = [...previous.candidates.map(candidate => ({ ...candidate, checkedAt: previous.checkedAt })), ...(previous.staleCandidates ?? [])];
  return existing.filter(candidate => result.outcome === "temporary" || retryUrls.has(candidate.evidenceUrl));
}

export async function discoverBenefitCandidates(sources, approved, makeSession = sourceSession, previousSources = []) {
  const approvedByUrl = new Map(approved.flatMap(offer => [offer.source, ...offer.tests.filter(test => !test.pack).map(test => test.url)]
    .map(address => [campaignUrl(address), offer])));
  const previousById = new Map(previousSources.map(source => [source.id, source]));
  const observations = [];
  for (const source of sources) {
    const result = await inspect(source, approved, approvedByUrl, makeSession);
    const staleCandidates = previousCandidates(previousById.get(source.id), result);
    observations.push({
      id: source.id,
      provider: source.provider,
      audience: source.audience,
      sourceUrl: source.url,
      checkedAt: new Date().toISOString(),
      ...result,
      ...(staleCandidates.length ? { staleCandidates } : {}),
    });
  }
  return { generatedAt: new Date().toISOString(), status: "editorial_review", sources: observations };
}

function needsRetry(report) {
  return report?.sources?.some(source => source.outcome === "temporary" || source.unresolved?.some(item => item.outcome === "temporary"));
}

async function watch(sources, approved, path) {
  // A troca atômica mantém o relatório anterior disponível se uma rodada for interrompida.
  const temporaryPath = `${path}.${process.pid}.tmp`;
  for (;;) {
    try {
      let existing = null;
      try {
        existing = JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
      }
      const age = Date.now() - Date.parse(existing?.generatedAt);
      const interval = needsRetry(existing) ? retryDelay : day;
      if (existing?.status === "editorial_review" && age >= 0 && age < interval) {
        await sleep(interval - age);
        continue;
      }
      const report = await discoverBenefitCandidates(sources, approved, sourceSession, existing?.sources);
      await writeFile(temporaryPath, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
      await rename(temporaryPath, path);
      console.log(JSON.stringify({
        job: "benefit-discovery",
        at: report.generatedAt,
        sources: report.sources.map(({ id, outcome, candidates }) => ({ id, outcome, candidates: candidates.length })),
      }));
    } catch {
      console.error("A rodada de descoberta não foi salva. Nova tentativa em 1 hora.");
      await sleep(60 * 60 * 1000);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--watch" || !args[1])) {
    throw Error("Use sem argumentos para executar uma rodada ou --watch seguido do caminho do relatório.");
  }
  const [sources, approved] = await Promise.all([load("benefit-discovery-sources.json"), load("benefit-offers.json")]);
  if (args.length) return watch(sources, approved, args[1]);
  console.log(JSON.stringify(await discoverBenefitCandidates(sources, approved), null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    console.error("A descoberta de benefícios não pôde ser executada. Confira os argumentos e o manifesto de fontes.");
    process.exitCode = 1;
  });
}
