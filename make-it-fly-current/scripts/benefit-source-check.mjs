import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { BlockList, isIP } from "node:net";

const privateNetworks = new BlockList();
for (const [address, size] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.88.99.0",24],["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",3]]) {
  privateNetworks.addSubnet(address, size, "ipv4");
}

const redirects = new Set([301, 302, 303, 307, 308]);
const maxBody = 3_000_000;
const packCard = /<h3 id="([a-z0-9-]+)" class="sr-only">[^<]+<\/h3>/g;
const packOffer = /<h5\b[^>]*>Offer(?:\s*#\d+)?<\/h5>\s*<p\b[^>]*>(.*?)<\/p>/gs;
const entities = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">", rsquo: "’", lsquo: "‘", ensp: " ", ndash: "–", mdash: "—" };

function checkedUrl(input, hosts) {
  const url = new URL(input);
  if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname) || !hosts.includes(url.hostname)) {
    throw new SourceError("unavailable", "Destino fora dos endereços oficiais");
  }
  url.hash = "";
  return url;
}

export class SourceError extends Error {
  constructor(outcome, message) {
    super(message);
    this.outcome = outcome;
  }
}

async function publicResponse(url) {
  const signal = AbortSignal.timeout(10_000);
  return new Promise((resolve, reject) => {
    function pinnedLookup(hostname, options, callback) {
      lookup(hostname, { family: 4, all: true }).then(addresses => {
        if (!addresses.length || addresses.some(({ address }) => privateNetworks.check(address, "ipv4"))) {
          callback(new SourceError("unavailable", "Endereço de rede inválido"));
          return;
        }
        const first = addresses[0];
        if (options.all) callback(null, [first]);
        else callback(null, first.address, first.family);
      }).catch(callback);
    }
    const request = get(url, {
      agent: false,
      lookup: pinnedLookup,
      family: 4,
      signal,
      headers: { "user-agent": "ApogeeBenefits/1.0 (+https://www.apogee.community)", accept: "text/html" },
    }, response => {
      response.on("error", reject);
      const status = response.statusCode ?? 0;
      const location = response.headers.location;
      const type = response.headers["content-type"] ?? "";
      if (status !== 200 || !type.includes("text/html")) {
        response.destroy();
        resolve({ status, location, body: "" });
        return;
      }
      const chunks = [];
      let size = 0;
      response.on("data", chunk => {
        size += chunk.length;
        if (size > maxBody) response.destroy(new SourceError("temporary", "Página acima do limite de leitura"));
        else chunks.push(chunk);
      });
      response.on("end", () => resolve({ status, location, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
  });
}

function normalize(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (!entity.startsWith("#")) return entities[entity] ?? match;
    const point = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2),16) : Number(entity.slice(1));
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
  }).normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

export function pageContent(html) {
  return html.replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

export function visibleText(html) {
  return normalize(pageContent(html).replace(/<[^>]+>/g, " "));
}

function packOffers(html) {
  html = pageContent(html);
  const headings = [...html.matchAll(packCard)];
  return new Map(headings.map((match, index) => {
    const next = headings[index + 1]?.index ?? html.indexOf("</main>", match.index);
    const card = html.slice(match.index, next < 0 ? undefined : next);
    const terms = [...card.matchAll(packOffer)].map(offer => {
      const text = visibleText(offer[1]);
      return { text, hash: createHash("sha256").update(text).digest("hex") };
    });
    return [match[1], terms];
  }));
}

export function packCampaigns(html) {
  return new Map([...packOffers(html)].map(([anchor, terms]) => [anchor, terms.map(term => term.hash)]));
}

export function sourceSession(transport = publicResponse) {
  const requests = new Map();
  const packs = new Map();

  async function read(test) {
    let url = checkedUrl(test.url, test.hosts);
    for (let redirect = 0; redirect <= 4; redirect++) {
      if (!requests.has(url.href)) requests.set(url.href, transport(url));
      const page = await requests.get(url.href);
      if (redirects.has(page.status) && page.location) {
        url = checkedUrl(new URL(page.location, url), test.hosts);
        continue;
      }
      if (page.status === 404 || page.status === 410) throw new SourceError("unavailable", "Página da campanha removida");
      if (page.status !== 200 || !page.body) throw new SourceError("temporary", "Consulta ao fornecedor inconclusiva");
      if (!test.paths.includes(url.pathname.replace(/\/$/, "") || "/")) {
        throw new SourceError("review", "A página oficial de destino mudou");
      }
      if (Object.entries(test.query ?? {}).some(([key, expected]) => url.searchParams.get(key) !== expected)) {
        throw new SourceError("review", "O encaminhamento oficial da oferta mudou");
      }
      if (/<title[^>]*>\s*(?:just a moment|access denied|attention required)/i.test(page.body)) {
        throw new SourceError("temporary", "O fornecedor restringiu a checagem automática");
      }
      return { url, html: page.body };
    }
    throw new SourceError("review", "O caminho de resgate mudou");
  }

  async function readPack(test) {
    const { url, html } = await read(test);
    if (!packs.has(url.href)) {
      if (!pageContent(html).includes('href="https://github.com/settings/education/benefits"')) {
        throw new SourceError("review", "A entrada oficial do programa mudou");
      }
      const cards = packOffers(html);
      if (!cards.size) throw new SourceError("review", "A apresentação do catálogo oficial mudou");
      packs.set(url.href, cards);
    }
    return packs.get(url.href);
  }

  async function check(offer) {
    try {
      if (!offer.tests?.length) throw new SourceError("review", "Campanha sem regra de verificação");
      for (const test of offer.tests) {
        if (test.pack) {
          const cards = await readPack(test);
          const campaign = cards.get(test.pack);
          if (!campaign) throw new SourceError("unavailable", "Campanha retirada do programa oficial");
          if (!test.hashes.every(hash => campaign.some(term => term.hash === hash))) throw new SourceError("review", "Os termos da campanha mudaram");
          continue;
        }
        const { html, url } = await read(test);
        const text = visibleText(html);
        if (test.ended?.some(marker => text.includes(normalize(marker)))) throw new SourceError("unavailable", "O fornecedor informou o encerramento");
        if (!test.markers.every(marker => text.includes(normalize(marker)))) throw new SourceError("review", "A condição ou o resgate precisa de revisão");
        if (test.brazil && !text.includes(normalize(test.brazil))) throw new SourceError("review", "Disponibilidade no Brasil inconclusiva");
        if (test.redemption) {
          const target = test.redemption;
          const links = pageContent(html).matchAll(/<a\b[^>]*?\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/gi);
          const expected = new URL(target.url).href;
          const listed = [...links].some(match => {
            const href = (match[1] ?? match[2]).replace(/&amp;/gi, "&");
            return URL.canParse(href, url) && new URL(href, url).href === expected;
          });
          if (!listed) throw new SourceError("review", "O link de resgate deixou de constar na oferta oficial");
          const destination = await read(target);
          const destinationText = visibleText(destination.html);
          if (!target.markers.every(marker => destinationText.includes(normalize(marker)))) {
            throw new SourceError("review", "A inscrição da oferta deixou de estar identificada no destino oficial");
          }
        }
      }
      return { outcome: "verified", reason: "Fonte oficial e caminho público conferidos" };
    } catch (error) {
      return error instanceof SourceError ? { outcome: error.outcome, reason: error.message }
        : { outcome: "temporary", reason: "Sem resposta conclusiva do fornecedor" };
    }
  }

  return Object.assign(check, { readPage: read, readPack });
}
