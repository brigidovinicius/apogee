/** Selection only: publication still requires freshly verified official evidence. */
const relevant = /olimp[ií]ada|torneio|maratona|pitch|build(?:ers)? day|\bia\b|bolsa|auxílio|monitoria|estágio|mobilidade|intercâmbio|oportunidade|curso|oficina|formação|prêmio|premiaç|competição|hackathon|desafio|edital|seleção|inscriç|chamada|programa|evento|workshop|conferência|congresso|seminário|encontro|feira|palestra|webinar|extensão|empreendedorismo|incuba|acelera|scholarship|fellowship|conference|summit|\bcall\b/i;
export const CALL_PRIORITY_PATTERN = 'inscri|edital|chamada|bolsa|hackathon|workshop|webinar|summit';
const navigation = /^(?:anterior|próximo|cursos|eventos e cursos|calendário de inscrições|inscrições e acompanhamento|chamadas (?:abertas|andamento)|ver todos os palestrantes|programação|destaques|a feira|acesso à informação|equipe(?: organizadora)?|contato|sobre)$/i;

export function discoveryLinkIssue(link: { url: string; title: string }): 'unsupported_content' | 'irrelevant_link' | null {
  let path: string;
  try { path = decodeURIComponent(new URL(link.url).pathname); } catch { return 'irrelevant_link'; }
  if (/\.(?:png|jpe?g|gif|webp|svg|ico|mp[34]|mov|avi|woff2?|ttf|css|js|zip|rar|gz|docx?|xlsx?|pptx?)$/i.test(path)) return 'unsupported_content';
  if (/(?:^|\/)(?:@@search|tag|category|categoria|author|wp-json|wp-admin|feed)(?:\/|$)/i.test(path)) return 'irrelevant_link';
  const slug = path.split('/').filter(Boolean).at(-1)?.replace(/[-_]/g, ' ') ?? '';
  // Sitemap titles used to repeat the entire path, including irrelevant ancestor keywords.
  const title = link.title.trim() === path.replace(/[-_/]/g, ' ').trim() ? slug : link.title.trim();
  const numberedCall = /^(?:\d+[-_\d]*|[a-f\d]{8,})$/i.test(slug) &&
    /\/(?:editais|bolsas|chamadas|inscricoes)(?:\/\d{4})?\/[^/]+\/?$/i.test(path);
  if (navigation.test(title) || !(numberedCall || relevant.test(`${title} ${slug}`) || /inscri[cç]|registration|application/i.test(`${title} ${slug}`))) return 'irrelevant_link';
  return null;
}
