// Amostra do protótipo recebido. Não representa inscrições ou prazos vigentes.
export const DEMO_OPPORTUNITIES = [
  { id: "datathon", title: "7º Datathon de Moedas Digitais — FGV EESP 2026", organization: "Fundação Getulio Vargas", category: "Competição · Pesquisa e inovação", location: "Brasil", timing: "Prazo de exemplo", filters: ["competicao", "pesquisa", "breve", "novas"] },
  { id: "hackathon", title: "Tecnologia contra o Tráfico de Pessoas — TRT-SC/UDESC", organization: "Tribunal Regional do Trabalho e Udesc", category: "Hackathon · Impacto social", location: "Joinville · SC", timing: "Prazo de exemplo", filters: ["competicao", "breve", "novas"] },
  { id: "obvc", title: "Olimpíada Brasileira de Vibe Coding — OBVC 2026", organization: "Organização da OBVC", category: "Competição · Tecnologia", location: "Brasil · Online", timing: "Prazo de exemplo", filters: ["competicao", "novas"] },
  { id: "amazonia", title: "Projeto de extensão Amazônia Cidadã — 2027", organization: "Universidade Evangélica de Goiás", category: "Pesquisa · Extensão", location: "Experiência de campo", timing: "Prazo de exemplo", filters: ["pesquisa", "bolsa"] },
  { id: "enap", title: "Semana de Inovação — Enap 2026", organization: "Escola Nacional de Administração Pública", category: "Evento · Inovação pública", location: "Brasília · DF", timing: "Data de exemplo", filters: ["evento", "novas"] },
  { id: "usp", title: "Bolsa de PD em Endocrinologia Genética", organization: "Faculdade de Medicina da USP", category: "Bolsa · Pesquisa", location: "São Paulo · SP", timing: "Prazo de exemplo", filters: ["pesquisa", "bolsa", "breve"] },
];

export const SIDEBAR_FILTERS = [
  ["todas", "Radar"], ["novas", "Novas"], ["breve", "Encerrando"], ["bolsa", "Com bolsa"], ["salvas", "Salvas"],
] as const;
export const QUICK_FILTERS = [
  ["todas", "Todas"], ["breve", "Encerram em breve"], ["competicao", "Competições"], ["pesquisa", "Pesquisa"], ["bolsa", "Bolsas"], ["evento", "Eventos"],
] as const;

export function normalizePreviewText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
