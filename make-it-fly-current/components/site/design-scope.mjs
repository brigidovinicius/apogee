/** Event and community funnel have their own isolated visual identities. */
export function usesApogeeDesign(pathname) {
  return typeof pathname === "string" && pathname !== "/comunidade" && pathname !== "/gravacao" && pathname !== "/evento-openai" && !pathname.startsWith("/evento-openai/") && pathname !== "/makeitfly" && !pathname.startsWith("/makeitfly/");
}

/** @type {Record<string, string>} */
const publicAreas = {
  "": "home", comunidade: "comunidade", oportunidades: "radar", competicoes: "radar",
  beneficios: "beneficios", calendarios: "calendario", colecoes: "colecoes",
  blog: "blog", loja: "loja", galeria: "galeria", membros: "perfil", login: "perfil",
  mcp: "integracoes", privacidade: "protecao", termos: "protecao",
};


/** @type {Record<string, string>} */
const memberAreas = {
  "": "home", oportunidades: "radar", radar: "radar", beneficios: "beneficios",
  ferramentas: "ferramentas", eventos: "eventos", trilha: "trilha", "meu-calendario": "calendario",
  colecoes: "colecoes", forum: "forum", perfil: "perfil", protecao: "protecao",
  assinatura: "assinatura", suporte: "suporte", blog: "blog", integracoes: "integracoes",
};

/** @param {string} href */
export function areaForPath(href) {
  const [, area, section = ""] = href.split(/[?#]/, 1)[0].split("/");
  return area === "membros" ? memberAreas[section] ?? "perfil" : publicAreas[area];
}
