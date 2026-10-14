import { PDAI_SOURCE_ID, PDAI_URL, PDAI_NEWS_URL } from "@/lib/ingestion/normalize-capes-pdai";
import type { OfficialSource } from "@/lib/ingestion/types";
export const pdaiSource: OfficialSource = { id: PDAI_SOURCE_ID, name: "CAPES PDAI", institutionName: "CAPES", institutionAcronym: "CAPES",
  sourceType: "government_foundation", baseUrl: PDAI_URL, listingUrls: [PDAI_URL], allowedDomains: ["www.gov.br"],
  allowedPathPrefixes: [new URL(PDAI_URL).pathname, new URL(PDAI_NEWS_URL).pathname], extractionMode: "html",
  audienceScope: ["mixed"], geographicScope: [], categories: ["bolsas", "pesquisa"], priority: 80, active: true };
export const pdaiProgramme = `<div id="page-document"><h1>Programa de Desenvolvimento Acadêmico Indígena (PDAI)</h1>
  <p>Estudantes indígenas na pós-graduação stricto sensu. Está vigente o Edital CAPES nº 23/2026;
  seleção de Programas de Pós-Graduação participantes.</p>
  <table><tr><td>Inscrições dos candidatos indígenas</td><td>Até 26 de outubro de 2026</td></tr>
  <tr><td>Seleção pelos PPGs</td><td>Até 18 de janeiro de 2027</td></tr></table>
  <table><tr><th>Modalidade</th><th>Quantidade</th><th>Duração</th><th>Valor mensal</th></tr>
  <tr><td>Mestrado</td><td>200</td><td>Até 24 meses</td><td>R$ 2.100,00</td></tr>
  <tr><td>Doutorado</td><td>100</td><td>Até 48 meses</td><td>R$ 3.100,00</td></tr></table>
  <p>Documentos relacionados: Manual de Inscrição do SICAPES; Autodeclaração Indígena;
  Declaração de Pertencimento Étnico Indígena.</p></div>`;
export const pdaiNews = `<div id="page-document"><h1>Prazo de inscrição no PDAI é prorrogado até 26 de outubro</h1>
  <p>Edital Conjunto nº 23/2026. As candidaturas poderão ser submetidas até as 23h59 do dia 26 de outubro,
  no horário de Brasília, exclusivamente pelo sistema eletrônico de inscrição da CAPES.</p><p>
  O formulário eletrônico específico deve ser preenchido diretamente no sistema de inscrição da CAPES.</p></div>`;
